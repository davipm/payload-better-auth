import { MinimalTemplate } from '@payloadcms/ui/rsc';
import { redirect } from 'next/navigation.js';
import type { AdminViewServerProps, Payload, ServerProps } from 'payload';
import type { ReactNode } from 'react';
import { z } from 'zod';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { firstParam, getLoginPlugins, resolveLoginIdentifiers } from '../../utils/login-config.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Logo } from '../logo.js';
import { AdminSignupClient } from './client.js';

const rootClass = 'login'; // reuse core login styles
const baseClass = 'admin-signup';

const tokenSchema = z.string().min(1).max(256);

interface AdminSignupProps extends AdminViewServerProps {
  adminInvitationsSlug: string;
  pluginOptions: PayloadAuthOptions;
}

async function isValidInvite(payload: Payload, slug: string, token: string) {
  try {
    const { totalDocs } = await payload.count({
      collection: slug,
      overrideAccess: true,
      // With an expiry field:
      // where: { and: [{ token: { equals: token } }, { expiresAt: { greater_than: new Date().toISOString() } }] },
      where: { token: { equals: token } },
    });
    return totalDocs > 0;
  } catch (err) {
    payload.logger.error({ err, msg: 'Failed to validate admin invite token' });
    return false;
  }
}

function InvalidInvite() {
  return (
    <FormHeader
      style={{ textAlign: 'center' }}
      heading="Invalid or expired token"
      description="You need to get a new invite to sign up."
    />
  );
}

export default async function AdminSignup({
  initPageResult,
  params,
  searchParams,
  server,
  pluginOptions,
  adminInvitationsSlug,
}: AdminSignupProps) {
  const { locale, permissions, req } = initPageResult;
  const { i18n, user, headers, payload } = req;
  const { collections, config } = payload;
  const {
    admin: { user: userSlug },
    routes: { admin: adminRoute },
  } = config;

  const redirectUrl = getSafeRedirect(firstParam(searchParams?.redirect) ?? '', adminRoute);

  // Signed-in users have nothing to sign up for (same behavior as the login view)
  if (user) redirect(redirectUrl);

  // `user` is always null past the redirect, so it's omitted
  const serverProps = {
    i18n,
    locale,
    params,
    payload,
    permissions,
    searchParams,
    server,
  } satisfies ServerProps;

  const layout = (children: ReactNode) => (
    <MinimalTemplate className={`${rootClass} ${baseClass}`}>
      <div className={`${rootClass}__brand ${baseClass}__brand`}>
        <Logo {...serverProps} />
      </div>
      {children}
    </MinimalTemplate>
  );

  const parsed = tokenSchema.safeParse(firstParam(searchParams?.token));
  if (!parsed.success || !(await isValidInvite(payload, adminInvitationsSlug, parsed.data))) {
    return layout(<InvalidInvite />);
  }

  const baOptions = pluginOptions.betterAuthOptions ?? {};
  const plugins = getLoginPlugins(baOptions);

  // Username options are only relevant when the BA username plugin is installed
  const usernameOptions = plugins.username
    ? collections?.[userSlug]?.config.auth.loginWithUsername
    : undefined;

  return layout(
    <AdminSignupClient
      adminInviteToken={parsed.data}
      loginMethods={pluginOptions.admin?.loginMethods ?? []}
      loginIdentifiers={resolveLoginIdentifiers(plugins.username, usernameOptions)}
      loginWithUsername={Boolean(usernameOptions)}
      requireUsername={
        typeof usernameOptions === 'object' && Boolean(usernameOptions.requireUsername)
      }
      plugins={plugins}
      redirectUrl={redirectUrl}
      adminRoute={adminRoute}
      baseURL={resolveBaseURL(baOptions.baseURL, headers)}
      basePath={baOptions.basePath}
    />,
  );
}
