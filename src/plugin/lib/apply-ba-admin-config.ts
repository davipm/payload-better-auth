import type { CollectionConfig, Config } from 'payload';
import { adminRoutes, baModelKey, baseSlugs, supportedBAPluginIds } from '../constants.js';
import { checkPluginExists } from '../helpers/check-plugin-exists.js';
import type { BetterAuthSchemas, PayloadAuthOptions } from '../types.js';
import { stripSecretsFromPluginOptions } from './strip-secrets.js';

/**
 * Applies Better Auth admin UI overrides to the Payload config.
 * Replaces default Payload login/signup/password views with Better Auth equivalents.
 * Mutates the provided Payload config in-place.
 */
export function applyBetterAuthAdminConfig({
  config,
  pluginOptions,
  collectionMap,
  resolvedBetterAuthSchemas,
}: {
  config: Config;
  pluginOptions: PayloadAuthOptions;
  collectionMap: Record<string, CollectionConfig>;
  resolvedBetterAuthSchemas: BetterAuthSchemas;
}): void {
  // serverProps get serialized into the admin client config and embedded in
  // the RSC payload of the HTML response, so anything passed here is public.
  // Strip secret and socialProviders[*].clientSecret before handing them off.
  const safePluginOptions = stripSecretsFromPluginOptions(pluginOptions);

  config.admin = {
    ...config.admin,
    components: {
      ...config.admin?.components,
      afterLogin: [
        {
          path: '@davipm/payload-better-auth/rsc#RSCRedirect',
          serverProps: {
            pluginOptions: safePluginOptions,
            redirectTo: `${config.routes?.admin === undefined ? '/admin' : config.routes.admin.replace(/\/+$/, '')}${adminRoutes.adminLogin}`,
          },
        },
        ...(config.admin?.components?.afterLogin || []),
      ],
      logout: {
        Button: {
          path: '@davipm/payload-better-auth/client#LogoutButton',
        },
      },
      views: {
        ...config.admin?.components?.views,
        adminLogin: {
          path: adminRoutes.adminLogin,
          Component: {
            path: '@davipm/payload-better-auth/rsc#AdminLogin',
            serverProps: {
              pluginOptions: safePluginOptions,
              adminInvitationsSlug: collectionMap[baseSlugs.adminInvitations].slug,
            },
          },
        },
        adminSignup: {
          path: adminRoutes.adminSignup,
          Component: {
            path: '@davipm/payload-better-auth/rsc#AdminSignup',
            serverProps: {
              pluginOptions: safePluginOptions,
              adminInvitationsSlug: collectionMap[baseSlugs.adminInvitations].slug,
            },
          },
        },
        forgotPassword: {
          path: adminRoutes.forgotPassword,
          Component: {
            path: '@davipm/payload-better-auth/rsc#ForgotPassword',
            serverProps: {
              pluginOptions: safePluginOptions,
            },
          },
        },
        resetPassword: {
          path: adminRoutes.resetPassword,
          Component: {
            path: '@davipm/payload-better-auth/rsc#ResetPassword',
            serverProps: {
              pluginOptions: safePluginOptions,
            },
          },
        },
        ...(checkPluginExists(
          pluginOptions.betterAuthOptions ?? {},
          supportedBAPluginIds.twoFactor,
        ) && {
          twoFactorVerify: {
            path: adminRoutes.twoFactorVerify,
            Component: {
              path: '@davipm/payload-better-auth/rsc#TwoFactorVerify',
              serverProps: {
                pluginOptions: safePluginOptions,
                verificationsSlug: resolvedBetterAuthSchemas[baModelKey.verification].modelName,
              },
            },
          },
        }),
      },
    },
    routes: {
      ...config.admin?.routes,
      login: adminRoutes.loginRedirect,
    },
  };
}
