'use client';

import { type ComponentPropsWithoutRef, useId } from 'react';
import { type FieldPath, useController } from 'react-hook-form';
import { FieldErrors, FieldInputWrap, FormField, FormLabel } from '../ui/index.js';

type FormValues = Record<string, string>;

type TextFieldProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'className' | 'id' | 'name' | 'label'
> & {
  className?: string;
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
  const id = useId();
  const {
    field,
    fieldState: { error, isTouched },
    formState: { isSubmitted },
  } = useController<FormValues>({ name });
  const hasError = Boolean(error && (isTouched || isSubmitted));

  return (
    <FormField className={className} hasError={hasError}>
      <FormLabel label={label} htmlFor={id} required={required} />
      <FieldInputWrap>
        <input
          {...inputProps}
          {...field}
          id={id}
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
        <FieldErrors error={error?.message} visible={hasError} />
      </FieldInputWrap>
    </FormField>
  );
}
