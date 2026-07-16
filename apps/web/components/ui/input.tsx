import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // Mismo lenguaje visual que el trigger del DatePicker:
          // rounded-xl, borde border-border, fondo bg-surface y sombra sutil.
          'flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary shadow-sm transition placeholder:text-text-muted hover:border-brand-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
