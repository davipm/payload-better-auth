'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { toast, useAuth, useConfig, useTranslation } from '@payloadcms/ui';
import { createAuthClient } from 'better-auth/react';
import { useRouter } from 'next/navigation.js';
import { formatAdminURL } from 'payload/shared';
import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Submit, TextField } from '../form/index.js';
import { Form, FormInputWrap } from '../form/ui/index.js';

interface PasswordResetFormProps {
  readonly token: string;
  readonly minPasswordLength?: number;
  readonly maxPasswordLength?: number;
  readonly baseURL?: string;
  readonly basePath?: string;
}

export function PasswordResetForm({ token, baseURL, basePath }: PasswordResetFormProps) {
  const { t } = useTranslation();
  const history = useRouter();
  const { fetchFullUser } = useAuth();
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const authClient = useMemo(() => createAuthClient({ baseURL, basePath }), []);
  const {
    config: {
      admin: {
        routes: { login: loginRoute },
      },
      routes: { admin: adminRoute },
    },
  } = useConfig();

  const resetPasswordSchema = z
    .object({
      password: z.string().min(1, t('validation:required') || 'Password is required'),
      confirmPassword: z
        .string()
        .min(1, t('validation:required') || 'Confirm password is required'),
    })
    .refine(
      (data) => {
        // Only validate matching passwords if both fields have values
        if (data.password && data.confirmPassword) {
          return data.password === data.confirmPassword;
        }
        // If one or both fields are empty, validation will be handled by the min(1) validators
        return true;
      },
      {
        message: t('fields:passwordsDoNotMatch') || 'Passwords do not match',
        path: ['confirmPassword'],
      },
    );

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onSubmit',
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    try {
      const { data, error } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (error) {
        toast.error(error.message || 'Error resetting password');
        return;
      }
      if (data?.status) {
        const user = await fetchFullUser();
        if (user) {
          history.push(adminRoute);
        } else {
          history.push(
            formatAdminURL({
              adminRoute,
              path: loginRoute,
            }),
          );
        }
        toast.success(t('authentication:passwordResetSuccessfully'));
      }
    } catch {
      toast.error('An unexpected error occurred');
    }
  });

  return (
    <Form form={form} onSubmit={onSubmit}>
      <FormInputWrap className="login__form">
        <TextField
          name="password"
          type="password"
          className="password"
          label={t('authentication:newPassword')}
          required
        />

        <TextField
          name="confirmPassword"
          type="password"
          className="password"
          label={t('authentication:confirmPassword')}
          required
        />
      </FormInputWrap>
      <Submit
        onSubmit={onSubmit}
        label={t('authentication:resetPassword')}
        loadingLabel={t('general:loading')}
      />
    </Form>
  );
}
