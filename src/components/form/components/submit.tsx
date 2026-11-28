'use client';

import { FormSubmit } from '@payloadcms/ui';
import { useFormContext } from 'react-hook-form';

interface SubmitProps {
  label: string;
  loadingLabel: string;
}

export function Submit({ label, loadingLabel }: SubmitProps) {
  const {
    formState: { isSubmitting },
  } = useFormContext();

  return (
    <FormSubmit buttonStyle="primary" type="submit" size="large" disabled={isSubmitting}>
      {isSubmitting ? loadingLabel : label}
    </FormSubmit>
  );
}
