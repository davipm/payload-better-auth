'use client';

import {
  AlternativeMethods,
  CredentialsForm,
  LoginFormProvider,
  type LoginFormProviderProps,
} from '../login-form/index.js';

export type AdminLoginClientProps = Omit<LoginFormProviderProps, 'children'>;

export function AdminLoginClient(props: AdminLoginClientProps) {
  return (
    <LoginFormProvider {...props}>
      <CredentialsForm />
      <AlternativeMethods />
    </LoginFormProvider>
  );
}
