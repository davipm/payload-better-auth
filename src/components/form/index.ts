import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { Submit } from './components/submit.js';
import { TextField } from './fields/text-field.js';

const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();

const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
  },
  formComponents: {
    Submit,
  },
});

export { fieldContext, formContext, useAppForm, useFieldContext, useFormContext, withForm };
