'use client';

import { Tooltip } from '@payloadcms/ui/elements/Tooltip';
import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';
import { type FieldValues, FormProvider, type UseFormReturn } from 'react-hook-form';
import './index.css';

interface FormFieldProps extends ComponentProps<'div'> {
  hasError?: boolean;
}

function FormField({ children, hasError, className, ...rest }: FormFieldProps) {
  return (
    <div {...rest} className={clsx('field-type', className, { error: hasError })}>
      {children}
    </div>
  );
}

interface FormLabelProps extends Omit<ComponentProps<'label'>, 'htmlFor'> {
  htmlFor: string; // required, so the label is always bound to a control
  label: ReactNode;
  required?: boolean;
}

function FormLabel({ label, htmlFor, required = false, className, ...rest }: FormLabelProps) {
  return (
    <label {...rest} htmlFor={htmlFor} className={clsx('field-label', className)}>
      {label}
      {required && (
        <span className="required" aria-hidden="true">
          *
        </span>
      )}
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
  if (!errors?.length) return null;
  return (
    <div role="alert" className={clsx('form-error', className)}>
      {errors.join(', ')}
    </div>
  );
}

interface FormProps<T extends FieldValues> extends ComponentProps<'form'> {
  form: UseFormReturn<T>;
}

function Form<T extends FieldValues>({ form, children, className, ...rest }: FormProps<T>) {
  return (
    <FormProvider {...form}>
      {/* noValidate: zod owns validation; native bubbles would block submit before it runs */}
      <form noValidate {...rest} className={clsx('form', className)}>
        {children}
      </form>
    </FormProvider>
  );
}

type FormInputWrapProps = ComponentProps<'div'>;

/** BEM-style wrapper: `className="login__form"` → `login__form__inputWrap` */
function FormInputWrap({ children, className, ...rest }: FormInputWrapProps) {
  return (
    <div {...rest} className={className ? `${className}__inputWrap` : undefined}>
      {children}
    </div>
  );
}

type FieldInputWrapProps = ComponentProps<'div'>;

function FieldInputWrap({ children, className, ...rest }: FieldInputWrapProps) {
  return (
    <div {...rest} className={clsx('field-type__wrap', className)}>
      {children}
    </div>
  );
}

export type {
  FieldErrorsProps,
  FieldInputWrapProps,
  FormErrorProps,
  FormFieldProps,
  FormInputWrapProps,
  FormLabelProps,
  FormProps,
};

export { FieldErrors, FieldInputWrap, Form, FormError, FormField, FormInputWrap, FormLabel };
