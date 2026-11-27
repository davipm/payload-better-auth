'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast, useTranslation } from '@payloadcms/ui';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Submit, TextField } from '../form/index.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';
import { createSignupSchema } from '../form/validation.js';
import {
  AlternativeMethods,
  LoginFormProvider,
  type LoginFormProviderProps,
  useLoginForm,
} from '../login-form/index.js';

const baseClass = 'admin-signup';
const VERIFY_MESSAGE = 'Check your email for a verification link';

export type AdminSignupClientProps = Omit<LoginFormProviderProps, 'children' | 'isSignup'> & {
  loginWithUsername: boolean;
  requireUsername: boolean;
};

interface SignupFormProps {
  loginWithUsername: boolean;
  requireUsername: boolean;
  onVerificationRequired: () => void;
}

function SignupForm({
  loginWithUsername,
  requireUsername,
  onVerificationRequired,
}: SignupFormProps) {
  const { t } = useTranslation();
  const { authClient, redirectUrl, adminInviteToken } = useLoginForm();

  const signupSchema = useMemo(
    () => createSignupSchema({ t, requireUsername, requireConfirmPassword: true }),
    [t, requireUsername],
  );

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      ...(loginWithUsername ? { username: '' } : {}),
    },
    resolver: zodResolver(signupSchema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ name, email, username, password }) => {
    try {
      const { data, error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: redirectUrl,
        ...(loginWithUsername && username ? { username } : {}),
        fetchOptions: { query: { adminInviteToken } },
      });

      if (
        error?.code === 'EMAIL_NOT_VERIFIED' ||
        (data && !data.token && !data.user.emailVerified)
      ) {
        toast.success(VERIFY_MESSAGE);
        onVerificationRequired();
        return;
      }

      if (error) {
        toast.error(error.message || t('error:unknown'));
        return;
      }

      toast.success(t('general:success'));
      // Hard navigation: the session cookie just changed, so drop cached RSC state
      window.location.assign(redirectUrl);
    } catch {
      toast.error(t('error:unknown'));
    }
  });

  return (
    <Form className={baseClass} form={form} onSubmit={onSubmit}>
      <FormInputWrap className="login__form" style={{ marginBottom: '1.5rem' }}>
        <TextField
          name="name"
          type="text"
          className="text"
          autoComplete="name"
          label={t('general:name')}
          required
        />
        <TextField
          name="email"
          type="email"
          className="email"
          autoComplete="email"
          label={t('general:email')}
          required
        />
        {loginWithUsername && (
          <TextField
            name="username"
            type="text"
            className="text"
            autoComplete="username"
            label={t('authentication:username')}
            required={requireUsername}
          />
        )}
        <TextField
          name="password"
          type="password"
          className="password"
          autoComplete="new-password"
          label={t('authentication:newPassword')}
          required
        />
        <TextField
          name="confirmPassword"
          type="password"
          className="password"
          autoComplete="new-password"
          label={t('authentication:confirmPassword')}
          required
        />
      </FormInputWrap>
      <button type="submit" style={{ display: 'none' }} tabIndex={-1} />
      <Submit onSubmit={onSubmit} label={t('general:create')} loadingLabel={t('general:loading')} />
    </Form>
  );
}

export function AdminSignupClient({
  loginWithUsername,
  requireUsername,
  ...providerProps
}: AdminSignupClientProps) {
  const [verificationSent, setVerificationSent] = useState(false);

  if (verificationSent) {
    return (
      <FormHeader
        heading="Please verify your email"
        description={`${VERIFY_MESSAGE}.`}
        style={{ textAlign: 'center' }}
      />
    );
  }

  return (
    <LoginFormProvider {...providerProps} isSignup>
      {providerProps.loginMethods.includes('emailPassword') && (
        <SignupForm
          loginWithUsername={loginWithUsername}
          requireUsername={requireUsername}
          onVerificationRequired={() => setVerificationSent(true)}
        />
      )}
      <AlternativeMethods />
    </LoginFormProvider>
  );
}
