'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast, useConfig, useTranslation } from '@payloadcms/ui';
import { createAuthClient } from 'better-auth/react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { adminRoutes } from '../../plugin/constants.js';
import { emailRegex } from '../../utils/regex.js';
import { Submit, TextField } from '../form/index.js';
import { FormHeader } from '../form/ui/header/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';

interface ForgotPasswordFormProps {
  baseURL?: string;
  basePath?: string;
}

export function ForgotPasswordForm({ baseURL, basePath }: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const {
    config: {
      routes: { admin: adminRoute },
    },
  } = useConfig();
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const authClient = useMemo(() => createAuthClient({ baseURL, basePath }), [baseURL, basePath]);

  const forgotSchema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .trim()
          .superRefine((val, ctx) => {
            if (!val) {
              ctx.addIssue({ code: 'custom', message: t('validation:required') });
            } else if (!emailRegex.test(val)) {
              ctx.addIssue({ code: 'custom', message: t('authentication:emailNotValid') });
            }
          }),
      }),
    [t],
  );

  const form = useForm({
    defaultValues: { email: '' },
    resolver: zodResolver(forgotSchema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      const { data, error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${adminRoute}${adminRoutes.resetPassword}`,
      });

      if (error || !data?.status) {
        toast.error(error?.message || t('error:unknown'));
        return;
      }

      setHasSubmitted(true);
    } catch {
      toast.error(t('error:unknown'));
    }
  });

  if (hasSubmitted) {
    return (
      <FormHeader
        heading={t('authentication:emailSent')}
        description={t('authentication:checkYourEmailForPasswordReset')}
      />
    );
  }

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormHeader
        heading={t('authentication:forgotPassword')}
        description={t('authentication:forgotPasswordEmailInstructions')}
      />
      <FormInputWrap>
        <TextField
          name="email"
          type="text"
          className="email"
          autoComplete="email"
          label={t('general:email')}
        />
      </FormInputWrap>
      <Submit label={t('general:submit')} loadingLabel={t('general:loading')} />
    </Form>
  );
}
