import { RenderServerComponent } from '@payloadcms/ui/elements/RenderServerComponent';
import { MinimalTemplate } from '@payloadcms/ui/rsc';
import { redirect } from 'next/navigation.js';
import type { AdminViewServerProps, Payload, ServerProps } from 'payload';
import { adminRoutes, defaults, supportedBAPluginIds } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { checkPluginExists } from '../../utils/plugin/check-plugin-exists.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import type { LoginIdentifier } from '../login-form/context.js';
import { Logo } from '../logo.js';
import { AdminLoginClient } from './client.js';

export const loginBaseClass = 'login';

interface AdminLoginProps extends AdminViewServerProps {
  adminInvitationsSlug: string;
  pluginOptions: PayloadAuthOptions;
}

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

function resolveLoginIdentifiers(
  hasUsernamePlugin: boolean,
  loginWithUsername?: boolean | { allowEmailLogin?: boolean },
): LoginIdentifier[] {
  if (!hasUsernamePlugin || !loginWithUsername) return ['email'];
  if (typeof loginWithUsername === 'object' && loginWithUsername.allowEmailLogin === false) {
    return ['username'];
  }
  return ['email', 'username'];
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
      overrideAccess: true,
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
    await payload.create({ collection, data: { role, token }, overrideAccess: true });
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
  server,
  searchParams,
  pluginOptions,
  adminInvitationsSlug,
}: AdminLoginProps) {
  const { locale, permissions, req } = initPageResult;
  const { i18n, payload, user } = req;
  const { config, collections } = payload;

  const {
    admin: { components: { afterLogin, beforeLogin } = {}, user: userSlug, autoLogin },
    routes: { admin: adminRoute },
  } = config;

  const redirectUrl = getSafeRedirect(firstParam(searchParams?.redirect) ?? '', adminRoute);
  if (user) redirect(redirectUrl);

  // First-run bootstrap: no admin yet → send to admin signup with a (reused) invite token
  const adminRole = pluginOptions.users?.defaultAdminRole ?? defaults.adminRole;
  const { totalDocs: adminCount } = await payload.count({
    collection: userSlug,
    overrideAccess: true,
    where: { role: { equals: adminRole } },
  });

  if (adminCount === 0) {
    const token = await getOrCreateAdminInviteToken(payload, adminInvitationsSlug, adminRole);
    redirect(`${adminRoute}${adminRoutes.adminSignup}?token=${encodeURIComponent(token)}`);
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

  const loginIdentifiers = resolveLoginIdentifiers(
    plugins.username,
    collections?.[userSlug]?.config.auth.loginWithUsername,
  );

  // `user` is always null here (redirected above), so it's omitted
  const serverProps = {
    i18n,
    locale,
    params,
    payload,
    permissions,
    searchParams,
    server,
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
