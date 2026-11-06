import { FormSubmit } from '@payloadcms/ui';
import type React from 'react';
import { useFormContext } from '../index.js';

type SubmitProps = {
  label: string;
  loadingLabel: string;
};

export const Submit: React.FC<SubmitProps> = ({ label, loadingLabel }) => {
  const form = useFormContext();

  return (
    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting]}
      // biome-ignore lint/correctness/noChildrenProp: <explanation>
      children={([canSubmit, isSubmitting]) => (
        <FormSubmit
          buttonStyle="primary"
          type="button"
          onClick={() => form.handleSubmit()}
          size="large"
          disabled={!canSubmit}
        >
          {isSubmitting ? loadingLabel : label}
        </FormSubmit>
      )}
    />
  );
};
