import { useSelector } from '@tanstack/react-form';
import type { ComponentPropsWithoutRef } from 'react';
import { useFieldContext } from '../index.js';
import { FieldErrors, FieldInputWrap, FormField, FormLabel } from '../ui/index.js';

type TextFieldProps = Omit<
  ComponentPropsWithoutRef<'input'>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur' | 'className' | 'id' | 'name' | 'label'
> & {
  className: string;
  label: string;
  onValueChange?: (value: string) => void;
};

export function TextField({
  className,
  label,
  required = false,
  type = 'text',
  autoComplete = 'off',
  onValueChange,
  ...inputProps // inputMode, placeholder, maxLength, disabled, etc.
}: TextFieldProps) {
  const field = useFieldContext<string>();
  const value = useSelector(field.store, (state) => state.value);
  const meta = useSelector(field.store, (state) => state.meta);

  const hasError = meta.isTouched && meta.errors.length > 0;

  return (
    <FormField id={field.name} className={className} hasError={hasError}>
      <FormLabel label={label} htmlFor={field.name} required={required} />
      <FieldInputWrap>
        <input
          {...inputProps}
          id={field.name}
          name={field.name}
          type={type}
          autoComplete={autoComplete}
          value={value ?? ''}
          onChange={(e) => {
            field.handleChange(e.target.value);
            onValueChange?.(e.target.value);
          }}
          onBlur={field.handleBlur}
          required={required}
          aria-invalid={hasError || undefined}
          className="text-field"
        />
        <FieldErrors meta={meta} />
      </FieldInputWrap>
    </FormField>
  );
}
