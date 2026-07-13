import { cn } from '@/lib/utils';
import { REQUEST_STATUS_META, ENTITY_STATUS_META } from '@/lib/constants';
import type { RequestStatus, EntityStatus } from '@/lib/types';

const toneClasses: Record<string, string> = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  info: 'bg-info-soft text-info border-info/20',
  warning: 'bg-warning-soft text-warning border-warning/30',
  success: 'bg-success-soft text-success border-success/20',
  danger: 'bg-danger-soft text-danger border-danger/20',
  brand: 'bg-brand-100 text-brand-700 border-brand-200',
};

export function StatusBadge({ status, className }: { status: RequestStatus; className?: string }) {
  const meta = REQUEST_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClasses[meta.tone],
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', `bg-current opacity-70`)} />
      {meta.label}
    </span>
  );
}

export function EntityStatusBadge({ status, className }: { status: EntityStatus; className?: string }) {
  const meta = ENTITY_STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap',
        toneClasses[meta.tone],
        className
      )}
    >
      {meta.label}
    </span>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneClasses;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
