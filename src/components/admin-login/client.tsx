'use client';

import { useConfig } from '@payloadcms/ui';
import type { LoginMethod } from '../../plugin/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';
import { AlternativeMethods, CredentialsForm, LoginFormProvider } from '../login-form/index.js';

interface AdminLoginClientProps {
  loginMethods: LoginMethod[];
  plugins?: {
    username?: boolean;
    passkey?: boolean;
    magicLink?: boolean;
  };
  loginIdentifiers: ('email' | 'username')[];
  prefill?: {
    email?: string;
    password?: string;
    username?: string;
  };
  searchParams: { [key: string]: string | string[] | undefined };
  baseURL?: string;
  basePath?: string;
}

export function AdminLoginClient({
  loginMethods,
  searchParams,
  loginIdentifiers,
  baseURL,
  basePath,
  plugins,
  prefill,
}: AdminLoginClientProps) {
  const { config } = useConfig();
  const adminRoute = config.routes.admin;
  const redirectUrl = getSafeRedirect(searchParams?.redirect as string, adminRoute);

  return (
    <LoginFormProvider
      loginMethods={loginMethods}
      redirectUrl={redirectUrl}
      adminRoute={adminRoute}
      baseURL={baseURL}
      basePath={basePath}
      loginIdentifiers={loginIdentifiers}
      plugins={plugins}
      prefill={prefill}
    >
      <CredentialsForm />
      <AlternativeMethods />
    </LoginFormProvider>
  );
}
