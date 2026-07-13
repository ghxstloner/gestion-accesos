'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { getNavGroups } from '@/lib/navigation';
import { ROLES } from '@/lib/constants';

export function AppSidebar() {
  const pathname = usePathname();
  const currentUser = useSgaStore((s) => s.currentUser);
  const userData = useCurrentUserData();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('sga-sidebar-collapsed');
    if (stored === '1') setCollapsed(true);
  }, []);

  useEffect(() => {
    localStorage.setItem('sga-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  if (!currentUser) return null;

  const groups = getNavGroups(currentUser.role);
  const width = collapsed ? 'w-[72px]' : 'w-60';

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-surface transition-all duration-200',
        width
      )}
    >
      {/* Logo */}
      <div className={cn('flex h-16 items-center border-b border-border-subtle', collapsed ? 'justify-center px-2' : 'px-5')}>
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-900 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-text-primary">SGA</span>
              <span className="text-[10px] font-medium text-text-muted">Gestión de Accesos</span>
            </div>
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-disabled">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      collapsed && 'justify-center',
                      active
                        ? 'bg-brand-600 text-white'
                        : 'text-text-secondary hover:bg-brand-50 hover:text-brand-700'
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className={cn(
          'flex items-center gap-2 border-t border-border-subtle py-3 text-xs font-medium text-text-muted hover:bg-surface-muted',
          collapsed ? 'justify-center px-2' : 'px-5'
        )}
      >
        {collapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <>
            <PanelLeftClose className="h-4 w-4" />
            <span>Contraer</span>
          </>
        )}
      </button>

      {/* User info */}
      <div className={cn('border-t border-border-subtle p-3', collapsed && 'px-2')}>
        <div className={cn('flex items-center gap-2.5', collapsed && 'justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {userData ? initials(userData.firstName, userData.lastName) : '?'}
          </div>
          {!collapsed && userData && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-text-primary">
                {userData.firstName} {userData.lastName}
              </p>
              <p className="truncate text-[10px] text-text-muted">
                {ROLES[currentUser.role].label}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}
