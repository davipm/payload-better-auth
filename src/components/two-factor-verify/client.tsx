'use client';

import { toast, useTranslation } from '@payloadcms/ui';
import { twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
import { useMemo } from 'react';
import { z } from 'zod';
import { useAppForm } from '../form/index.js';
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

  const form = useAppForm({
    defaultValues: { code: '' },
    onSubmit: async ({ value }) => {
      const { code } = value;
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) {
        toast.error(error.message);
        return;
      }
      router.push(redirect);
      toast.success('Two-factor verified!');
    },
    validators: { onSubmit: otpSchema },
  });

  return (
    <Form
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      <FormHeader style={{ textAlign: 'center' }} heading={'Verify Two-Factor'} />
      <FormInputWrap>
        <form.AppField name="code">
          {(field) => (
            <field.TextField
              type="text"
              className="text otp"
              label={`${twoFactorDigits}-digit Code`}
              required
              autoComplete="one-time-password"
            />
          )}
        </form.AppField>
      </FormInputWrap>
      <form.AppForm>
        <form.Submit
          label={t('authentication:verify') || 'Verify'}
          loadingLabel={t('general:loading') || 'Loading'}
        />
      </form.AppForm>
    </Form>
  );
}
