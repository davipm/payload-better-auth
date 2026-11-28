'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast, useTranslation } from '@payloadcms/ui';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Submit, TextField } from '../form/index.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';
import { otpField } from '../form/validation.js';

interface TwoFactorVerifyFormProps {
  redirect: string;
  twoFactorDigits?: number;
  baseURL?: string;
  basePath?: string;
}

export function TwoFactorVerifyForm({
  redirect,
  twoFactorDigits = 6,
  baseURL,
  basePath,
}: TwoFactorVerifyFormProps) {
  const { t } = useTranslation();

  const authClient = useMemo(
    () => createAuthClient({ baseURL, basePath, plugins: [twoFactorClient()] }),
    [baseURL, basePath],
  );

  const schema = useMemo(
    () => z.object({ code: otpField({ digits: twoFactorDigits }) }),
    [twoFactorDigits],
  );

  const form = useForm({
    defaultValues: { code: '' },
    resolver: zodResolver(schema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ code }) => {
    try {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        toast.error(error.message || t('error:unknown'));
        return;
      }
      // Hard navigation: the session cookie just changed, so drop cached RSC state
      window.location.assign(redirect);
    } catch {
      toast.error(t('error:unknown'));
    }
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader style={{ textAlign: 'center' }} heading="Verify Two-Factor" />
      <FormInputWrap>
        <TextField
          name="code"
          type="text"
          className="text otp"
          inputMode="numeric"
          autoComplete="one-time-code"
          label={`${twoFactorDigits}-digit Code`}
          required
        />
      </FormInputWrap>
      <Submit label={t('authentication:verify')} loadingLabel={t('general:loading')} />
    </Form>
  );
}
