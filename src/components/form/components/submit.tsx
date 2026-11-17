import { FormSubmit } from '@payloadcms/ui';
import type React from 'react';
import type { BaseSyntheticEvent } from 'react';
import { useFormContext } from 'react-hook-form';

type SubmitProps = {
  label: string;
  loadingLabel: string;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
};

export const Submit: React.FC<SubmitProps> = ({ label, loadingLabel, onSubmit }) => {
  const { formState } = useFormContext();

  return (
    <FormSubmit
      buttonStyle="primary"
      type="button"
      onClick={() => void onSubmit()}
      size="large"
      disabled={formState.isSubmitting || (formState.isSubmitted && !formState.isValid)}
    >
      {formState.isSubmitting ? loadingLabel : label}
    </FormSubmit>
  );
};
