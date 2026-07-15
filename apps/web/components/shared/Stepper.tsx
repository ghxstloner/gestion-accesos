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
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${(current / steps.length) * 100}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-2 xl:grid-cols-8">
          {steps.map((step) => {
            const done = step.id < current;
            const active = step.id === current;
            return (
              <div key={step.id} className="min-w-0">
                <button
                  type="button"
                  onClick={() => onStepClick?.(step.id)}
                  disabled={step.id > current}
                  className={cn(
                    'group flex w-full min-w-0 items-center gap-2 rounded-xl px-2 py-2 text-left',
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
                      'min-w-0 text-[11px] font-semibold leading-tight',
                      active ? 'text-text-primary' : 'text-text-muted'
                    )}
                  >
                    {step.label}
                  </span>
                </button>
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
