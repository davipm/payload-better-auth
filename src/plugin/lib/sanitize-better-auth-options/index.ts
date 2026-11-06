import type { CollectionConfig } from 'payload';
import { set } from '@/utils/set.js';
import { baModelFieldKeys, baModelKey, baseSlugs, supportedBAPluginIds } from '../../constants.js';
import { checkPluginExists } from '../../helpers/check-plugin-exists.js';
import type {
  BetterAuthSchemas,
  PayloadAuthOptions,
  SanitizedBetterAuthOptions,
} from '../../types.js';
import {
  getSchemaCollectionSlug,
  getSchemaFieldName,
} from '../build-collections/utils/collection-schema.js';
import { configureAdminPlugin } from './admin-plugin.js';
import { configureApiKeyPlugin } from './api-key-plugin.js';
import { configureDeviceAuthorizationPlugin } from './device-authorization-plugin.js';
import { configureOidcPlugin } from './oidc-plugin.js';
import { configureOrganizationPlugin } from './organizations-plugin.js';
import { configurePasskeyPlugin } from './passkey-plugin.js';
import { configureSsoPlugin } from './sso-plugin.js';
import { configureTwoFactorPlugin } from './two-factor-plugin.js';
import { adminAfterRoleMiddleware } from './utils/admin-after-role-middleware.js';
import { adminBeforeRoleMiddleware } from './utils/admin-before-role-middleware.js';
import { useAdminInviteAfterSignUpMiddleware } from './utils/admin-invite-after-signup-middleware.js';
import { applySaveToJwtReturned } from './utils/apply-save-to-jwt-returned.js';
import { requireAdminInviteForSignUpMiddleware } from './utils/require-admin-invite-for-sign-up-middleware.js';

/**
 * Sanitizes the BetterAuth options
 */
export function sanitizeBetterAuthOptions({
  pluginOptions,
  resolvedSchemas,
  collections,
}: {
  pluginOptions: PayloadAuthOptions;
  resolvedSchemas: BetterAuthSchemas;
  collections: CollectionConfig[];
}): SanitizedBetterAuthOptions {
  const betterAuthOptions: SanitizedBetterAuthOptions = {
    ...(pluginOptions.betterAuthOptions ?? {}),
  };

  const userCollectionSlug = getSchemaCollectionSlug(resolvedSchemas, baModelKey.user);
  const adminInvitationCollectionSlug =
    pluginOptions.adminInvitations?.slug ?? baseSlugs.adminInvitations;

  set(betterAuthOptions, `${baModelKey.user}.modelName`, userCollectionSlug);

  const baseModels = [baModelKey.account, baModelKey.session, baModelKey.verification] as const;
  // biome-ignore lint/suspicious/useIterableCallbackReturn: <explanation>
  baseModels.forEach((model) =>
    set(betterAuthOptions, `${model}.modelName`, getSchemaCollectionSlug(resolvedSchemas, model)),
  );

  set(
    betterAuthOptions,
    `${baModelKey.account}.fields.userId`,
    getSchemaFieldName(resolvedSchemas, baModelKey.account, baModelFieldKeys.account.userId),
  );
  set(
    betterAuthOptions,
    `${baModelKey.session}.fields.userId`,
    getSchemaFieldName(resolvedSchemas, baModelKey.session, baModelFieldKeys.session.userId),
  );

  set(
    betterAuthOptions,
    `emailAndPassword.enabled`,
    betterAuthOptions.emailAndPassword?.enabled ?? true,
  );

  // Handle admin invite for sign up
  if (pluginOptions.requireAdminInviteForSignUp) {
    betterAuthOptions.socialProviders = betterAuthOptions.socialProviders || {};
    betterAuthOptions.socialProviders = Object.fromEntries(
      Object.entries(betterAuthOptions.socialProviders).map(([provider, config]) => [
        provider,
        { ...config, disableImplicitSignUp: true },
      ]),
    );
    requireAdminInviteForSignUpMiddleware({
      options: betterAuthOptions,
      pluginOptions,
    });
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: <explanation>
  void useAdminInviteAfterSignUpMiddleware({
    options: betterAuthOptions,
    adminInvitationCollectionSlug,
    userCollectionSlug,
  });

  // Mirror Payload saveToJWT=false onto BetterAuth additionalFields so cookie cache never includes filtered fields.
  // Safe here because collections are already built (final schema is known).
  applySaveToJwtReturned({
    betterAuthOptions,
    collections,
    resolvedSchemas,
    modelKey: baModelKey.user,
  });
  applySaveToJwtReturned({
    betterAuthOptions,
    collections,
    resolvedSchemas,
    modelKey: baModelKey.session,
  });

  // Process plugins — configure supported ones, pass through unsupported ones
  if (betterAuthOptions.plugins?.length) {
    try {
      // Configure plugins by type
      const pluginConfigurators: Record<string, (p: any) => void> = {
        [supportedBAPluginIds.admin]: (p: any) =>
          configureAdminPlugin(p, pluginOptions, resolvedSchemas),
        [supportedBAPluginIds.apiKey]: (p: any) => configureApiKeyPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.passkey]: (p: any) => configurePasskeyPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.organization]: (p: any) =>
          configureOrganizationPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.sso]: (p: any) => configureSsoPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.oidc]: (p: any) => configureOidcPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.twoFactor]: (p: any) => configureTwoFactorPlugin(p, resolvedSchemas),
        [supportedBAPluginIds.deviceAuthorization]: (p: any) =>
          configureDeviceAuthorizationPlugin(p, resolvedSchemas),
      };

      betterAuthOptions.plugins.forEach((plugin) => {
        const configurator = pluginConfigurators[plugin.id];
        if (configurator) configurator(plugin as any);
      });

      // All plugins are kept — unsupported ones pass through unconfigured
    } catch (error) {
      throw new Error(`Error sanitizing BetterAuth plugins: ${error}`);
    }
  }

  if (checkPluginExists(betterAuthOptions, supportedBAPluginIds.admin)) {
    adminBeforeRoleMiddleware({
      sanitizedOptions: betterAuthOptions,
    });

    adminAfterRoleMiddleware({
      sanitizedOptions: betterAuthOptions,
    });
  }

  return betterAuthOptions;
}
