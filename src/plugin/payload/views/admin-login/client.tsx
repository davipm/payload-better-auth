'use client';

import { useConfig } from '@payloadcms/ui';
import type { LoginMethod } from '../../../types.js';
import {
  AlternativeMethods,
  CredentialsForm,
  LoginFormProvider,
} from '../../components/login-form/index.js';
import { getSafeRedirect } from '../../utils/get-safe-redirect.js';

// import { BaseURLConfig } from "better-auth";
// import {
//   AlternativeMethods,
//   CredentialsForm,
//   LoginFormProvider,
// } from '@/better-auth/plugin/payload/components/login-form';
// import { getSafeRedirect } from '@/better-auth/plugin/payload/utils/get-safe-redirect';
// import type { LoginMethod } from '@/better-auth/plugin/types';

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
