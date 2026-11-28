import { MinimalTemplate } from '@payloadcms/ui/rsc';
import { cookies } from 'next/headers.js';
import { redirect } from 'next/navigation.js';
import type { AdminViewServerProps, Payload, SanitizedConfig } from 'payload';
import { adminRoutes, supportedBAPluginIds } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { getPayloadAuth } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { firstParam } from '../../utils/login-config.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { valueOrDefaultString } from '../../utils/value-or-default.js';
import { TwoFactorVerifyForm } from './client.js';

interface TwoFactorVerifyProps extends AdminViewServerProps {
  pluginOptions: PayloadAuthOptions;
  verificationsSlug: string;
}

/**
 * Is there a live two-factor challenge for this browser?
 * better-auth doesn't register the `two_factor` cookie under `authCookies`; it creates it ad hoc via
 * `ctx.context.createAuthCookie('two_factor')`. Reusing that function on the auth context yields
 * the exact name better-auth set (secure prefix, `advanced.cookiePrefix`, per-cookie overrides).
 */
async function hasPendingTwoFactor({
  config,
  payload,
  verificationsSlug,
}: {
  config: SanitizedConfig;
  payload: Payload;
  verificationsSlug: string;
}) {
  const payloadAuth = await getPayloadAuth(config);
  const authContext = await payloadAuth.betterAuth?.$context;
  const cookieName = authContext?.createAuthCookie('two_factor').name;
  if (!cookieName) return false;

  const token = (await cookies()).get(cookieName)?.value?.split('.').at(0);
  if (!token) return false;

  const { totalDocs } = await payload.count({
    collection: verificationsSlug,
    overrideAccess: true,
    where: {
      and: [
        { identifier: { equals: token } },
        { expiresAt: { greater_than: new Date().toISOString() } },
      ],
    },
  });
  return totalDocs > 0;
}

export default async function TwoFactorVerify({
  searchParams,
  initPageResult,
  pluginOptions,
  verificationsSlug,
}: TwoFactorVerifyProps) {
  const { req } = initPageResult;
  const { payload, user, headers } = req;
  const { config } = payload;
  const {
    admin: {
      routes: { login },
    },
    routes: { admin: adminRoute },
  } = config;

  const redirectUrl = getSafeRedirect(firstParam(searchParams?.redirect) ?? '', adminRoute);
  if (user) redirect(redirectUrl);

  const loginUrl = `${adminRoute}${valueOrDefaultString(login, adminRoutes.adminLogin)}`;
  if (!(await hasPendingTwoFactor({ config, payload, verificationsSlug }))) redirect(loginUrl);

  const { baseURL, basePath, plugins } = pluginOptions.betterAuthOptions ?? {};
  const twoFactorOptions =
    plugins?.find((plugin) => plugin.id === supportedBAPluginIds.twoFactor)?.options ?? {};

  return (
    <MinimalTemplate className="two-factor-verify">
      <TwoFactorVerifyForm
        redirect={redirectUrl}
        twoFactorDigits={twoFactorOptions?.totpOptions?.digits}
        baseURL={resolveBaseURL(baseURL, headers)}
        basePath={basePath}
      />
    </MinimalTemplate>
  );
}
