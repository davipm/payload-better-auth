'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, toast, useConfig, useTranslation } from '@payloadcms/ui';
import { useSearchParams } from 'next/navigation.js';
import { formatAdminURL } from 'payload/shared';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { adminRoutes } from '../../plugin/constants.js';
import { valueOrDefaultString } from '../../utils/value-or-default.js';
import { Submit, TextField } from '../form/index.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Form, FormError, FormInputWrap } from '../form/ui/index.js';
import { createLoginSchema, isValidEmail } from '../form/validation.js';
import { useLoginForm } from './context.js';
import './index.css';
import { getErrorCode } from '../../utils/get-error-code.js';

const baseClass = 'login__form';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function CredentialsForm() {
  const { config } = useConfig();
  const { t } = useTranslation();
  const searchParamError = useSearchParams().get('error');
  const { authClient, loginType, hasMethod, setEmail, redirectUrl, prefill } = useLoginForm();
  const [requireEmailVerification, setRequireEmailVerification] = useState(false);

  const adminRoute = valueOrDefaultString(config?.routes?.admin, '/admin');
  const showPasswordField = hasMethod('emailPassword');
  const showEmailField = showPasswordField || hasMethod('magicLink');

  const forgotPasswordUrl = formatAdminURL({
    adminRoute,
    path: adminRoutes.forgotPassword as `/${string}`,
  });

  const loginSchema = useMemo(() => createLoginSchema({ t, loginType }), [t, loginType]);

  const form = useForm({
    defaultValues: {
      login: prefill.email ?? prefill.username ?? '',
      password: prefill.password ?? '',
    },
    resolver: showPasswordField ? zodResolver(loginSchema) : undefined,
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ login, password }) => {
    if (!showPasswordField) return;

    const withEmail =
      loginType === 'email' || (loginType === 'emailOrUsername' && isValidEmail(login));

    try {
      const { data, error } = await (withEmail
        ? authClient.signIn.email({ email: login, password, callbackURL: redirectUrl })
        : authClient.signIn.username({ username: login, password }));

      if (error) {
        if (getErrorCode(error) === 'EMAIL_NOT_VERIFIED') setRequireEmailVerification(true);
        toast.error(error.message ? capitalize(error.message) : t('error:unknown'));
        return;
      }

      // 2FA accounts get no token here: twoFactorClient's onTwoFactorRedirect takes over
      if (data?.token) {
        toast.success(t('general:success'));
        // Hard navigation: the session cookie just changed, so drop cached RSC state
        window.location.assign(redirectUrl);
      }
    } catch {
      toast.error(t('error:unknown'));
    }
  });

  if (!showEmailField) return null;

  if (requireEmailVerification) {
    return (
      <FormHeader
        heading="Please verify your email"
        description={t('authentication:emailSent')}
        style={{ textAlign: 'center' }}
      />
    );
  }

  const loginLabel = {
    email: t('general:email'),
    username: t('authentication:username'),
    emailOrUsername: t('authentication:emailOrUsername'),
  }[loginType];

  return (
    <div className={`${baseClass}__wrapper`}>
      {searchParamError === 'signup_disabled' && <FormError errors={['Sign up is disabled.']} />}
      <Form
        className={baseClass}
        form={form}
        onSubmit={showPasswordField ? onSubmit : (event) => event.preventDefault()}
      >
        <FormInputWrap className={baseClass}>
          <TextField
            name="login"
            type="text"
            className="email"
            autoComplete="username"
            label={loginLabel}
            onValueChange={setEmail}
          />
          {showPasswordField && (
            <TextField
              name="password"
              type="password"
              className="password"
              autoComplete="current-password"
              label={t('general:password')}
            />
          )}
        </FormInputWrap>
        {showPasswordField && (
          <>
            <Link href={forgotPasswordUrl} prefetch={false}>
              {t('authentication:forgotPasswordQuestion')}
            </Link>
            <button type="submit" style={{ display: 'none' }} tabIndex={-1} />
            <Submit
              // onSubmit={onSubmit}
              label={t('authentication:login')}
              loadingLabel={t('general:loading')}
            />
          </>
        )}
      </Form>
    </div>
  );
}
