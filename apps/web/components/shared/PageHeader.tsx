'use client';

import { cn } from '@/lib/utils';

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div>
        <div className="mb-2 h-1 w-10 rounded-full bg-brand-400" />
        <h1 className="font-display text-3xl leading-tight text-brand-950 sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-4', className)}>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-text-muted">{description}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function DetailSection({
  title,
  children,
  className,
  action,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className={cn('premium-card rounded-2xl border border-border/80 bg-surface', className)}>
      <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  tone = 'brand',
  className,
}: {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: { value: string; positive?: boolean };
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  className?: string;
}) {
  const toneBg: Record<string, string> = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
    neutral: 'bg-slate-100 text-slate-500',
  };
  return (
    <div className={cn('rounded-xl border border-border bg-surface p-4', className)}>
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-text-muted">{label}</span>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', toneBg[tone])}>
            <Icon className="h-4 w-4" />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-semibold tracking-tight text-text-primary">{value}</span>
        {trend && (
          <span className={cn('text-xs font-medium', trend.positive ? 'text-success' : 'text-danger')}>
            {trend.value}
          </span>
        )}
      </div>
    </div>
  );
}
