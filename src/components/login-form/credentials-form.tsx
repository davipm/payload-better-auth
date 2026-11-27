'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Link, toast, useConfig, useTranslation } from '@payloadcms/ui';
import { formatAdminURL } from 'payload/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { adminRoutes } from '../../plugin/constants.js';
import { valueOrDefaultString } from '../../utils/value-or-default.js';
import { Submit, TextField } from '../form/index.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Form, FormError, FormInputWrap } from '../form/ui/index.js';
import { createLoginSchema, isValidEmail } from '../form/validation.js';
import { useLoginForm } from './context.js';
import './index.css';

const baseClass = 'login__form';

export function CredentialsForm() {
  const { config } = useConfig();
  const { t } = useTranslation();
  const { authClient, loginType, hasMethod, setEmail, redirectUrl, prefill } = useLoginForm();
  const adminRoute = valueOrDefaultString(config?.routes?.admin, '/admin');

  const hasEmailPassword = hasMethod('emailPassword');
  const hasMagicLink = hasMethod('magicLink');
  const showEmailField = hasEmailPassword || hasMagicLink;
  const showPasswordField = hasEmailPassword;

  const [requireEmailVerification, setRequireEmailVerification] = useState(false);
  const [searchParamError] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('error');
    }
    return null;
  });

  const forgotPasswordUrl = formatAdminURL({
    adminRoute,
    path: adminRoutes?.forgotPassword as `/${string}`,
  });

  const loginSchema = createLoginSchema({
    t,
    loginType,
    canLoginWithUsername: loginType !== 'email',
  });

  const form = useForm({
    defaultValues: {
      login: prefill.email ?? prefill.username ?? '',
      password: prefill.password ?? '',
    },
    resolver: showPasswordField ? zodResolver(loginSchema) : undefined,
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async (value) => {
    if (!showPasswordField) return;

    const { login, password } = value;
    const isEmail = isValidEmail(login);

    try {
      const { data, error } = await (loginType === 'email' ||
      (loginType === 'emailOrUsername' && isEmail)
        ? authClient.signIn.email({
            email: login,
            password,
            callbackURL: redirectUrl,
          })
        : authClient.signIn.username({ username: login, password }));
      if (error) {
        if (error.code === 'EMAIL_NOT_VERIFIED') {
          setRequireEmailVerification(true);
        }
        if (error.message) {
          toast.error(error.message.charAt(0).toUpperCase() + error.message.slice(1));
        }
      }
      if (data?.token) {
        toast.success(t('general:success'));
        window.location.href = redirectUrl;
      }
    } catch {
      toast.error(t('error:unknown') || 'An unexpected error occurred');
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

  const getLoginTypeLabel = () => {
    const labels = {
      email: t('general:email') || 'Email',
      username: t('authentication:username') || 'Username',
      emailOrUsername: t('authentication:emailOrUsername') || 'Email or Username',
    };
    return labels[loginType];
  };

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
            autoComplete="email"
            label={getLoginTypeLabel()}
            onValueChange={setEmail}
          />

          {showPasswordField && (
            <TextField
              name="password"
              type="password"
              className="password"
              autoComplete="password"
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
              onSubmit={onSubmit}
              label={t('authentication:login')}
              loadingLabel={t('general:loading')}
            />
          </>
        )}
      </Form>
    </div>
  );
}
