import type { ComponentPropsWithoutRef } from 'react';
import { type FieldPath, useController, useFormContext } from 'react-hook-form';
import { FieldErrors, FieldInputWrap, FormField, FormLabel } from '../ui/index.js';

type FormValues = Record<string, string>;

type TextFieldProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'className' | 'id' | 'name' | 'label'
> & {
  className: string;
  label: string;
  name: FieldPath<FormValues>;
  onValueChange?: (value: string) => void;
};

export function TextField({
  name,
  className,
  label,
  required = false,
  type = 'text',
  autoComplete = 'off',
  onValueChange,
  ...inputProps
}: TextFieldProps) {
  const { control, formState } = useFormContext<FormValues>();
  const { field, fieldState } = useController({ name, control });
  const hasError = Boolean(fieldState.error && (fieldState.isTouched || formState.isSubmitted));

  return (
    <FormField id={name} className={className} hasError={hasError}>
      <FormLabel label={label} htmlFor={name} required={required} />
      <FieldInputWrap>
        <input
          {...field}
          {...inputProps}
          id={name}
          type={type}
          autoComplete={autoComplete}
          value={field.value ?? ''}
          onChange={(event) => {
            field.onChange(event);
            onValueChange?.(event.target.value);
          }}
          required={required}
          aria-invalid={hasError || undefined}
          className="text-field"
        />
        <FieldErrors error={fieldState.error?.message} visible={hasError} />
      </FieldInputWrap>
    </FormField>
  );
}
