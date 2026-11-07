import { MinimalTemplate } from '@payloadcms/next/templates';
import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent';
import { redirect } from 'next/navigation.js';
import type { AdminViewServerProps, Payload, ServerProps } from 'payload';
import { adminRoutes, defaults, supportedBAPluginIds } from '../../plugin/constants.js';
import { checkPluginExists } from '../../plugin/helpers/check-plugin-exists.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { Logo } from '../logo.js';
import { AdminLoginClient } from './client.js';

export const loginBaseClass = 'login';

interface AdminLoginProps extends AdminViewServerProps {
  adminInvitationsSlug: string;
  pluginOptions: PayloadAuthOptions;
}

/**
 * Returns the existing admin invite token or creates one.
 * Requires a unique index on `role` (or `token`) in the invitations collection:
 * on a concurrent first visit the loser's create throws, and we re-read the winner's token.
 */
async function getOrCreateAdminInviteToken(
  payload: Payload,
  collection: string,
  role: string,
): Promise<string> {
  const findToken = async (): Promise<string | undefined> => {
    const { docs } = await payload.find({
      collection,
      where: { role: { equals: role } },
      limit: 1,
      depth: 0,
      pagination: false,
    });
    return docs[0]?.token as string | undefined;
  };

  const existing = await findToken();
  if (existing) return existing;

  const token = crypto.randomUUID();
  try {
    await payload.create({ collection, data: { role, token } });
    return token;
  } catch (err) {
    const winner = await findToken();
    if (winner) return winner;
    throw err;
  }
}

export default async function AdminLogin({
  initPageResult,
  params,
  searchParams,
  pluginOptions,
  adminInvitationsSlug,
}: AdminLoginProps) {
  const { locale, permissions, req } = initPageResult;
  const {
    i18n,
    payload: { config, collections },
    payload,
    user,
  } = req;

  const {
    admin: { components: { afterLogin, beforeLogin } = {}, user: userSlug, autoLogin },
    routes: { admin: adminRoute },
  } = config;

  const adminRole = pluginOptions.users?.defaultAdminRole ?? defaults.adminRole;

  // searchParams.redirect can be string | string[]; normalize before sanitizing
  const rawRedirect = Array.isArray(searchParams?.redirect)
    ? searchParams.redirect[0]
    : searchParams?.redirect;
  const redirectUrl = getSafeRedirect(rawRedirect ?? '', adminRoute);

  if (user) redirect(redirectUrl);

  const adminCount = await payload.count({
    collection: userSlug,
    where: { role: { equals: adminRole } },
  });

  if (adminCount.totalDocs === 0) {
    const token = await getOrCreateAdminInviteToken(payload, adminInvitationsSlug, adminRole);
    redirect(`${adminRoute}${adminRoutes.adminSignup}?token=${token}`);
  }

  // Drop the first afterLogin entry (the custom login redirect component) to avoid an infinite loop
  const filteredAfterLogin =
    Array.isArray(afterLogin) && afterLogin.length > 1 ? afterLogin.slice(1) : undefined;

  const prefill =
    typeof autoLogin === 'object' && autoLogin.prefillOnly
      ? { email: autoLogin.email, username: autoLogin.username, password: autoLogin.password }
      : undefined;

  const baOptions = pluginOptions.betterAuthOptions ?? {};
  const plugins = {
    username: checkPluginExists(baOptions, supportedBAPluginIds.username),
    passkey: checkPluginExists(baOptions, supportedBAPluginIds.passkey),
    magicLink: checkPluginExists(baOptions, supportedBAPluginIds.magicLink),
  };

  const loginWithUsername = collections?.[userSlug]?.config.auth.loginWithUsername;
  const loginIdentifiers: ('email' | 'username')[] =
    !plugins.username || !loginWithUsername
      ? ['email']
      : typeof loginWithUsername === 'object' && loginWithUsername.allowEmailLogin === false
        ? ['username']
        : ['email', 'username'];

  const serverProps = {
    i18n,
    locale,
    params,
    payload,
    permissions,
    searchParams,
    user: user ?? undefined,
  } satisfies ServerProps;

  return (
    <MinimalTemplate className={loginBaseClass}>
      <div className={`${loginBaseClass}__brand`}>
        <Logo {...serverProps} />
      </div>
      {RenderServerComponent({
        Component: beforeLogin,
        importMap: payload.importMap,
        serverProps,
      })}
      <AdminLoginClient
        loginIdentifiers={loginIdentifiers}
        plugins={plugins}
        loginMethods={pluginOptions.admin?.loginMethods ?? []}
        prefill={prefill}
        redirectUrl={redirectUrl}
        adminRoute={adminRoute}
        baseURL={resolveBaseURL(baOptions.baseURL, req.headers)}
        basePath={baOptions.basePath}
      />
      {RenderServerComponent({
        Component: filteredAfterLogin,
        importMap: payload.importMap,
        serverProps,
      })}
    </MinimalTemplate>
  );
}
