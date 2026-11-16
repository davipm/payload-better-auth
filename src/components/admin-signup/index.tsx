import { MinimalTemplate } from '@payloadcms/next/templates';
import type { AdminViewServerProps, Payload } from 'payload';
import { z } from 'zod';
import { supportedBAPluginIds } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { checkPluginExists } from '../../utils/plugin/check-plugin-exists.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Logo } from '../logo.js';
import { AdminSignupClient } from './client.js';

const baseClass = 'login admin-signup'; // reuse core login styles

const searchParamsSchema = z.object({
  token: z.string().min(1),
});

interface AdminSignupProps extends AdminViewServerProps {
  adminInvitationsSlug: string;
  pluginOptions: PayloadAuthOptions;
}

async function isValidInvite(payload: Payload, slug: string, token: string) {
  try {
    const { totalDocs } = await payload.count({
      collection: slug,
      where: { token: { equals: token } },
      // add if your invitations collection has an expiry field:
      // and: [{ expiresAt: { greater_than: new Date().toISOString() } }]
      overrideAccess: true,
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

async function AdminSignup({
  initPageResult,
  params,
  searchParams,
  pluginOptions,
  adminInvitationsSlug,
}: AdminSignupProps) {
  const {
    locale,
    permissions,
    req,
    req: {
      i18n,
      user,
      headers,
      payload,
      payload: {
        collections,
        config: {
          admin: { user: userSlug },
        },
      },
    },
  } = initPageResult;

  const parsed = searchParamsSchema.safeParse(searchParams);
  const token = parsed.success ? parsed.data.token : null;
  const validInvite = token !== null && (await isValidInvite(payload, adminInvitationsSlug, token));

  const baAuthOptions = pluginOptions.betterAuthOptions ?? {};
  const hasPlugin = (id: string) => checkPluginExists(baAuthOptions, id);

  const plugins = {
    username: hasPlugin(supportedBAPluginIds.username),
    passkey: hasPlugin(supportedBAPluginIds.passkey),
    magicLink: hasPlugin(supportedBAPluginIds.magicLink),
  };

  const rawLoginWithUsername = collections?.[userSlug]?.config.auth.loginWithUsername;
  const loginWithUsername = plugins.username ? (rawLoginWithUsername ?? false) : false;

  const loginIdentifiers: ('email' | 'username')[] = !loginWithUsername
    ? ['email']
    : typeof loginWithUsername === 'object' && loginWithUsername.allowEmailLogin === false
      ? ['username']
      : ['email', 'username'];

  return (
    <MinimalTemplate className={baseClass}>
      <div className={`${baseClass.split(' ')[0]}__brand admin-signup__brand`}>
        <Logo
          i18n={i18n}
          locale={locale}
          params={params}
          payload={payload}
          permissions={permissions}
          searchParams={searchParams}
          user={user ?? undefined}
        />
      </div>
      {validInvite && token ? (
        <AdminSignupClient
          adminInviteToken={token}
          loginMethods={pluginOptions.admin?.loginMethods ?? []}
          searchParams={searchParams ?? {}}
          loginWithUsername={loginWithUsername}
          loginIdentifiers={loginIdentifiers}
          plugins={plugins}
          baseURL={resolveBaseURL(baAuthOptions.baseURL, headers)}
          basePath={baAuthOptions.basePath}
        />
      ) : (
        <InvalidInvite />
      )}
    </MinimalTemplate>
  );
}

export default AdminSignup;
