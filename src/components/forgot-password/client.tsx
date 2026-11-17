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
  const { config } = useConfig();
  const adminRoute = config.routes.admin;
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(false);
  const authClient = useMemo(() => createAuthClient({ baseURL, basePath }), [basePath, baseURL]);

  const forgotSchema = z.object({
    email: z.string().superRefine((val, ctx) => {
      if (!val) {
        ctx.addIssue({
          code: 'custom',
          message: t('validation:required') || 'Required',
        });
        return;
      }

      if (!emailRegex.test(val)) {
        ctx.addIssue({
          code: 'custom',
          message: t('authentication:emailNotValid') || 'Invalid email',
        });
      }
    }),
  });

  const form = useForm({
    defaultValues: {
      email: '',
    },
    resolver: zodResolver(forgotSchema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    try {
      const { data, error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${adminRoute}${adminRoutes.resetPassword}`,
      });
      if (error) {
        toast.error(error.message || t('authentication:emailNotValid') || 'Error');
        return;
      }
      if (data?.status) {
        setHasSubmitted(true);
        toast.success('Successfully sent reset email.');
      } else {
        toast.error(t('general:error') || 'Server Error');
      }
    } catch {
      toast.error(t('general:error') || 'An unexpected error occurred');
    }
  });

  if (hasSubmitted) {
    return (
      <FormHeader
        description={t('authentication:checkYourEmailForPasswordReset')}
        heading={t('authentication:emailSent')}
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
      <Submit onSubmit={onSubmit} label={t('general:submit')} loadingLabel={t('general:loading')} />
    </Form>
  );
}
