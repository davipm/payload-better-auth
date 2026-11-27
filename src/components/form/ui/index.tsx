import { Tooltip } from '@payloadcms/ui/elements/Tooltip';
import clsx from 'clsx';
import type React from 'react';
import type { ReactNode } from 'react';
import { type FieldValues, FormProvider, type UseFormReturn } from 'react-hook-form';

import './index.css';

interface FormFieldProps extends React.ComponentProps<'div'> {
  hasError?: boolean;
}

function FormField({ children, hasError, className, ...rest }: FormFieldProps) {
  return (
    <div className={clsx('field-type', className, { error: hasError })} {...rest}>
      {children}
    </div>
  );
}

interface FormLabelProps extends React.ComponentProps<'label'> {
  label: ReactNode;
  required?: boolean;
}

function FormLabel({ label, required = false, className, ...rest }: FormLabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: <explanation>
    <label className={clsx('field-label', className)} {...rest}>
      {label}
      {required && <span className="required">*</span>}
    </label>
  );
}

interface FieldErrorsProps {
  error?: string;
  visible: boolean;
  className?: string;
}

function FieldErrors({ error, visible, className }: FieldErrorsProps) {
  return (
    <Tooltip
      alignCaret="right"
      className={clsx('field-error', className)}
      show={visible && !!error}
      delay={0}
      staticPositioning
    >
      {error}
    </Tooltip>
  );
}

interface FormErrorProps {
  errors?: string[];
  className?: string;
}

function FormError({ errors, className }: FormErrorProps) {
  if (!errors) return null;
  return <div className={clsx('form-error', className)}>{errors.join(', ')}</div>;
}

interface FormProps<T extends FieldValues> extends React.ComponentProps<'form'> {
  form: UseFormReturn<T>;
}

function Form<T extends FieldValues>({ form, children, className, ...rest }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      <form className={clsx('form', className)} {...rest}>
        {children}
      </form>
    </FormProvider>
  );
}

interface FormInputWrapProps extends React.ComponentProps<'div'> {}

function FormInputWrap({ children, className, ...rest }: FormInputWrapProps) {
  return (
    <div className={`${className}__inputWrap`} {...rest}>
      {children}
    </div>
  );
}

interface FieldInputWrapProps extends React.ComponentProps<'div'> {}

function FieldInputWrap({ children, className, ...rest }: FieldInputWrapProps) {
  return (
    <div className={clsx('field-type__wrap', className)} {...rest}>
      {children}
    </div>
  );
}

export type { FormErrorProps, FormFieldProps, FormInputWrapProps, FormLabelProps, FormProps };
export { FieldErrors, FieldInputWrap, Form, FormError, FormField, FormInputWrap, FormLabel };
