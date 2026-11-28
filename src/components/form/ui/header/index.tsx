import clsx from 'clsx';
import type { ComponentProps, ReactNode } from 'react';

import './index.css';

interface FormHeaderProps extends Omit<ComponentProps<'div'>, 'children'> {
  description?: ReactNode;
  heading: string;
}

export function FormHeader({ description, heading, className, ...props }: FormHeaderProps) {
  if (!heading) return null;

  return (
    <div {...props} className={clsx('form-header', className)}>
      <h1>{heading}</h1>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
