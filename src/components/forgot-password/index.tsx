import { Button, Link, Translation } from '@payloadcms/ui';
import { MinimalTemplate } from '@payloadcms/ui/rsc';
import type { AdminViewServerProps } from 'payload';
import { formatAdminURL } from 'payload/shared';
import { adminRoutes } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/index.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { FormHeader } from '../form/ui/header/index.js';
import { ForgotPasswordForm } from './client.js';

interface ForgotPasswordProps extends AdminViewServerProps {
  pluginOptions: PayloadAuthOptions;
}

export default function ForgotPassword({ pluginOptions, initPageResult }: ForgotPasswordProps) {
  const {
    req: {
      headers,
      i18n,
      user,
      payload: {
        config: {
          admin: {
            routes: { account: accountRoute },
          },
          routes: { admin: adminRoute },
        },
      },
    },
  } = initPageResult;

  if (user) {
    return (
      <MinimalTemplate>
        <FormHeader
          heading={i18n.t('authentication:alreadyLoggedIn')}
          description={
            <Translation
              i18nKey="authentication:loggedInChangePassword"
              t={i18n.t}
              elements={{
                '0': ({ children }) => (
                  <Link href={formatAdminURL({ adminRoute, path: accountRoute })} prefetch={false}>
                    {children}
                  </Link>
                ),
              }}
            />
          }
        />
        <Button buttonStyle="secondary" el="link" size="large" to={adminRoute}>
          {i18n.t('general:backToDashboard')}
        </Button>
      </MinimalTemplate>
    );
  }

  const { baseURL, basePath } = pluginOptions.betterAuthOptions ?? {};

  return (
    <MinimalTemplate>
      <ForgotPasswordForm baseURL={resolveBaseURL(baseURL, headers)} basePath={basePath} />
      <Link
        href={formatAdminURL({ adminRoute, path: adminRoutes.adminLogin as `/${string}` })}
        prefetch={false}
      >
        {i18n.t('authentication:backToLogin')}
      </Link>
    </MinimalTemplate>
  );
}
