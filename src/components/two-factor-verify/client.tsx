'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast, useTranslation } from '@payloadcms/ui';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
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
  const router = useRouter();
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const authClient = useMemo(
    () => createAuthClient({ baseURL, basePath, plugins: [twoFactorClient()] }),
    [],
  );

  const otpSchema = z.object({
    code: otpField({ digits: twoFactorDigits }),
  });

  const form = useForm({
    defaultValues: { code: '' },
    resolver: zodResolver(otpSchema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ code }) => {
    const { error } = await authClient.twoFactor.verifyTotp({ code });
    if (error) {
      toast.error(error.message);
      return;
    }
    router.push(redirect);
    toast.success('Two-factor verified!');
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader style={{ textAlign: 'center' }} heading="Verify Two-Factor" />
      <FormInputWrap>
        <TextField
          name="code"
          type="text"
          className="text otp"
          label={`${twoFactorDigits}-digit Code`}
          required
          autoComplete="one-time-password"
        />
      </FormInputWrap>
      <Submit
        label={t('authentication:verify') || 'Verify'}
        loadingLabel={t('general:loading') || 'Loading'}
      />
    </Form>
  );
}
