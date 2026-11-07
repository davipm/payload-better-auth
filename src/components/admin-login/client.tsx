'use client';

import type { LoginMethod } from '../../plugin/index.js';
import { AlternativeMethods, CredentialsForm, LoginFormProvider } from '../login-form/index.js';

export interface AdminLoginClientProps {
  loginMethods: LoginMethod[];
  loginIdentifiers: ('email' | 'username')[];
  plugins?: { username?: boolean; passkey?: boolean; magicLink?: boolean };
  prefill?: { email?: string; password?: string; username?: string };
  redirectUrl: string;
  adminRoute: string;
  baseURL?: string;
  basePath?: string;
}

export function AdminLoginClient(props: AdminLoginClientProps) {
  return (
    <LoginFormProvider {...props}>
      <CredentialsForm />
      <AlternativeMethods />
    </LoginFormProvider>
  );
}
