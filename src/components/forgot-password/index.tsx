import { MinimalTemplate } from '@payloadcms/next/templates';
import { Button, Translation } from '@payloadcms/ui';
import Link from 'next/link.js';
import type { AdminViewServerProps } from 'payload';
import { formatAdminURL } from 'payload/shared';
import React, { Fragment } from 'react';
import { adminRoutes } from '../../plugin/constants.js';
import type { PayloadAuthOptions } from '../../plugin/types.js';
import { resolveBaseURL } from '../../utils/resolve-base-url.js';
import { FormHeader } from '../form/ui/header/index.js';
import { ForgotPasswordForm } from './client.js';

interface ForgotPasswordProps extends AdminViewServerProps {
  pluginOptions: PayloadAuthOptions;
}

function ForgotPassword({ pluginOptions, initPageResult }: ForgotPasswordProps) {
  const {
    req: {
      headers,
      payload: {
        config: {
          admin: {
            routes: { account: accountRoute },
          },
          routes: { admin: adminRoute },
        },
      },
      user,
      i18n,
    },
  } = initPageResult;

  if (user) {
    return (
      <Fragment>
        <FormHeader
          description={
            <Translation
              elements={{
                '0': ({ children }) => (
                  // @ts-expect-error
                  <Link
                    href={formatAdminURL({
                      adminRoute,
                      path: accountRoute,
                    })}
                    prefetch={false}
                  >
                    {children}
                  </Link>
                ),
              }}
              i18nKey="authentication:loggedInChangePassword"
              t={i18n.t}
            />
          }
          heading={i18n.t('authentication:alreadyLoggedIn')}
        />
        <Button buttonStyle="secondary" el="link" size="large" to={adminRoute}>
          {i18n.t('general:backToDashboard')}
        </Button>
      </Fragment>
    );
  }

  return (
    <MinimalTemplate>
      <ForgotPasswordForm
        baseURL={resolveBaseURL(pluginOptions.betterAuthOptions?.baseURL, headers)}
        basePath={pluginOptions.betterAuthOptions?.basePath}
      />
      {/* @ts-expect-error */}
      <Link
        href={formatAdminURL({
          adminRoute,
          path: adminRoutes.adminLogin as `/${string}`,
        })}
        prefetch={false}
      >
        {i18n.t('authentication:backToLogin')}
      </Link>
    </MinimalTemplate>
  );
}

export default ForgotPassword;
