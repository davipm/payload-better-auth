import type { Config, SanitizedConfig } from 'payload';
import type { PayloadAuthOptions } from '../types/plugin.js';
import { getDefaultBetterAuthSchema } from '../utils/plugin/get-better-auth-schema.js';
import { syncResolvedSchemaWithCollectionMap } from '../utils/plugin/sync-resolved-schema-with-collection-map.js';
import { applyBetterAuthAdminConfig } from './lib/apply-ba-admin-config.js';
import { buildCollections } from './lib/build-collections/index.js';
import { initBetterAuth } from './lib/init-better-auth.js';
import { sanitizeBetterAuthOptions } from './lib/sanitize-better-auth-options/index.js';
import { setLoginMethods } from './lib/set-login-methods.js';

export * from '../types/plugin.js';
export * from '../utils/plugin/index.js';
export * from './lib/access-control.js';
export { getPayloadAuth } from './lib/get-payload-auth.js';
export { sanitizeBetterAuthOptions } from './lib/sanitize-better-auth-options/index.js';

function buildBetterAuthData({
  payloadConfig,
  pluginOptions,
}: {
  payloadConfig: SanitizedConfig;
  pluginOptions: PayloadAuthOptions;
}) {
  pluginOptions = setLoginMethods({ pluginOptions });

  const defaultBetterAuthSchemas = getDefaultBetterAuthSchema(pluginOptions);

  let collectionMap = buildCollections({
    resolvedSchemas: defaultBetterAuthSchemas,
    incomingCollections: payloadConfig.collections ?? [],
    pluginOptions,
  });

  const resolvedBetterAuthSchemas = syncResolvedSchemaWithCollectionMap(
    defaultBetterAuthSchemas,
    collectionMap,
  );

  // We need to build the collections a second time with the resolved schemas
  // due to hooks, endpoints, useAsTitle, etc should rely on resolvedBetterAuthSchemas to get slugs
  // if they are referencing to other collections then it self.
  collectionMap = buildCollections({
    resolvedSchemas: resolvedBetterAuthSchemas,
    incomingCollections: payloadConfig.collections ?? [],
    pluginOptions,
  });

  const sanitizedBetterAuthOptions = sanitizeBetterAuthOptions({
    pluginOptions,
    resolvedSchemas: resolvedBetterAuthSchemas,
    collections: Object.values(collectionMap),
  });

  return {
    pluginOptions,
    collectionMap,
    resolvedBetterAuthSchemas,
    sanitizedBetterAuthOptions,
  };
}

export function betterAuthPlugin(pluginOptions: PayloadAuthOptions) {
  return (config: Config): Config => {
    if (pluginOptions.disabled) {
      return config;
    }

    config.custom = {
      ...config.custom,
      hasBetterAuthPlugin: true,
    };

    const { collectionMap, resolvedBetterAuthSchemas, sanitizedBetterAuthOptions } =
      buildBetterAuthData({
        payloadConfig: config as SanitizedConfig,
        pluginOptions,
      });

    // ---------------------- Finalize config -----------------
    applyBetterAuthAdminConfig({
      config,
      pluginOptions,
      collectionMap,
      resolvedBetterAuthSchemas,
    });

    config.collections = config.collections ?? [];
    config.collections = Object.values(collectionMap);

    const incomingOnInit = config.onInit;

    config.onInit = async (payload) => {
      try {
        // Execute any existing onInit functions first
        if (incomingOnInit) {
          await incomingOnInit(payload);
        }

        // Initialize and set the betterAuth instance
        const auth = initBetterAuth<typeof pluginOptions>({
          payload,
          idType: payload.db.defaultIDType,
          options: {
            ...sanitizedBetterAuthOptions,
            enableDebugLogs: pluginOptions.debug?.enableDebugLogs ?? false,
            plugins: [...(sanitizedBetterAuthOptions.plugins ?? [])],
          },
        });

        // Type-safe extension of payload with betterAuth
        Object.defineProperty(payload, 'betterAuth', {
          value: auth,
          writable: false,
          configurable: false,
        });
      } catch (error) {
        payload.logger.error({ err: error, msg: 'Failed to initialize BetterAuth' });
        throw error;
      }
    };

    return config;
  };
}
