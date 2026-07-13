'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  id: number;
  label: string;
}

export function Stepper({
  steps,
  current,
  onStepClick,
  className,
}: {
  steps: Step[];
  current: number;
  onStepClick?: (id: number) => void;
  className?: string;
}) {
  return (
    <>
      {/* Desktop horizontal stepper */}
      <div className={cn('hidden md:block', className)}>
        <div className="flex items-center">
          {steps.map((step, i) => {
            const done = step.id < current;
            const active = step.id === current;
            return (
              <div key={step.id} className="flex items-center">
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  disabled={step.id > current}
                  className={cn(
                    'group flex items-center gap-2.5',
                    step.id <= current && 'cursor-pointer',
                    step.id > current && 'cursor-not-allowed opacity-60'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors',
                      done && 'border-brand-600 bg-brand-600 text-white',
                      active && 'border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-200',
                      !done && !active && 'border-border bg-surface text-text-muted'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : step.id}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium whitespace-nowrap',
                      active ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    {step.label}
                  </span>
                </button>
                {i < steps.length - 1 && (
                  <div
                    className={cn(
                      'mx-3 h-px w-12',
                      step.id < current ? 'bg-brand-500' : 'bg-border'
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile compact stepper */}
      <div className={cn('md:hidden', className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-primary">
            Paso {current} de {steps.length}
          </span>
          <span className="text-xs text-text-muted">
            {steps.find((s) => s.id === current)?.label}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full rounded-full bg-brand-600 transition-all"
            style={{ width: `${(current / steps.length) * 100}%` }}
          />
        </div>
      </div>
    </>
  );
}
