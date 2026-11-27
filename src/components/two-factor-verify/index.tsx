import { MinimalTemplate } from '@payloadcms/ui/rsc';
import { cookies } from 'next/headers.js';
import { redirect } from 'next/navigation.js';
import type { AdminViewServerProps } from 'payload';
import { adminRoutes, supportedBAPluginIds } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { getPayloadAuth } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { valueOrDefaultString } from '../../utils/value-or-default.js';
import { TwoFactorVerifyForm } from './client.js';

interface TwoFactorVerifyProps extends AdminViewServerProps {
  pluginOptions: PayloadAuthOptions;
  verificationsSlug: string;
}

async function TwoFactorVerify({
  searchParams,
  initPageResult,
  pluginOptions,
  verificationsSlug,
}: TwoFactorVerifyProps) {
  const { req } = initPageResult;
  const {
    payload: { config },
    payload,
  } = req;

  const {
    admin: {
      routes: { login },
    },
    routes: { admin: adminRoute },
  } = config;
  const cookieStore = await cookies();
  const loginRoute = valueOrDefaultString(login, adminRoutes.adminLogin);
  const redirectUrl = getSafeRedirect(searchParams?.redirect as string, adminRoute);

  const twoFactorOptions =
    pluginOptions.betterAuthOptions?.plugins?.find(
      (plugin) => plugin.id === supportedBAPluginIds.twoFactor,
    )?.options ?? {};

  // Better Auth's two-factor plugin does not register its verification
  // cookie under `authCookies` (unlike sessionToken/sessionData/etc) — it is
  // created ad hoc via `ctx.context.createAuthCookie("two_factor")` on every
  // use (@see better-auth/dist/plugins/two-factor/{index,verify-two-factor}.mjs
  // and the "two_factor" name from better-auth/dist/plugins/two-factor/constant.mjs).
  // `createAuthCookie` is exposed directly on the auth context
  // (better-auth/dist/context/create-context.mjs) and derives the exact same
  // name Better Auth itself set (secure prefix + advanced.cookiePrefix +
  // any advanced.cookies["two_factor"].name override), so we reuse it here
  // instead of re-deriving the naming rule ourselves.
  const payloadAuth = await getPayloadAuth(config);
  const authContext = await payloadAuth.betterAuth?.$context;
  const twoFactorCookieName = authContext?.createAuthCookie('two_factor').name;
  const twoFactorCookie = twoFactorCookieName
    ? cookieStore.get(twoFactorCookieName)?.value
    : undefined;
  if (!twoFactorCookie) {
    redirect(`${adminRoute}${loginRoute}`);
  }
  const twoFactorVerifyToken = twoFactorCookie.split('.').at(0);
  if (!twoFactorVerifyToken) {
    redirect(`${adminRoute}${loginRoute}`);
  }
  const { totalDocs: isValidTwoFactorToken } = await payload.count({
    collection: verificationsSlug,
    overrideAccess: true,
    where: {
      identifier: {
        equals: twoFactorVerifyToken,
      },
    },
  });
  if (!isValidTwoFactorToken) {
    redirect(`${adminRoute}${loginRoute}`);
  }

  return (
    <MinimalTemplate className="two-factor-verify">
      <TwoFactorVerifyForm
        redirect={redirectUrl}
        twoFactorDigits={twoFactorOptions?.totpOptions?.digits}
        baseURL={resolveBaseURL(pluginOptions.betterAuthOptions?.baseURL, req.headers)}
        basePath={pluginOptions.betterAuthOptions?.basePath}
      />
    </MinimalTemplate>
  );
}

export default TwoFactorVerify;
