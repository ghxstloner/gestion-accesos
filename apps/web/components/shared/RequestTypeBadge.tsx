'use client';

import { IdCard, User, Car, Wrench } from 'lucide-react';
import { REQUEST_TYPE_META } from '@/lib/constants';
import type { RequestType } from '@/lib/types';
import { cn } from '@/lib/utils';

const icons: Record<string, React.ComponentType<{ className?: string }>> = {
  'id-card': IdCard,
  user: User,
  car: Car,
  wrench: Wrench,
};

export function RequestTypeBadge({ type, className }: { type: RequestType; className?: string }) {
  const meta = REQUEST_TYPE_META[type];
  const Icon = icons[meta.icon] ?? User;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 whitespace-nowrap',
        className
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.short}
    </span>
  );
}
