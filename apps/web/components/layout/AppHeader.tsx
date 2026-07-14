'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronRight, Search, Bell, Plus, Menu, ShieldCheck, ChevronDown } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { ROLES, ROLE_LIST } from '@/lib/constants';
import type { Role } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AppSidebar } from './AppSidebar';
import { Badge } from '@/components/shared/StatusBadge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/constants';

const routeLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  companies: 'Empresas',
  users: 'Usuarios',
  people: 'Personas',
  'authorized-signers': 'Firmantes autorizados',
  requests: 'Solicitudes',
  reviews: 'Bandeja de revisión',
  issuance: 'Emisión de carnés',
  catalogs: 'Catálogos',
  new: 'Nuevo',
  login: 'Iniciar sesión',
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useSgaStore((s) => s.currentUser);
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const userData = useCurrentUserData();
  const users = useSgaStore((s) => s.users);
  const notifications = useSgaStore((s) => s.notifications);
  const markNotificationRead = useSgaStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useSgaStore((s) => s.markAllNotificationsRead);
  const resetData = useSgaStore((s) => s.resetData);
  const [search, setSearch] = useState('');

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    router.push(`/requests?search=${encodeURIComponent(q)}`);
  };

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.map((part, i) => {
      const label = routeLabels[part] ?? part;
      const href = '/' + parts.slice(0, i + 1).join('/');
      return { label, href };
    });
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const switchRole = (role: Role) => {
    if (!currentUser) return;
    setCurrentUser({ userId: currentUser.userId, role });
  };

  const switchUser = (userId: string) => {
    if (!currentUser) return;
    router.push('/dashboard');
    setCurrentUser({ userId, role: currentUser.role });
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <button type="button" aria-label="Menú" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <AppSidebar />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav className="hidden items-center gap-1.5 text-sm md:flex">
        {breadcrumbs.map((bc, i) => (
          <span key={bc.href} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-disabled" />}
            <button type="button" onClick={() => router.push(bc.href)}
              className={cn(
                'hover:text-text-primary',
                i === breadcrumbs.length - 1
                  ? 'font-semibold text-text-primary'
                  : 'text-text-muted'
              )}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Global search */}
      <form onSubmit={onSearchSubmit} className="relative ml-auto hidden md:block lg:ml-6 lg:mr-auto">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar solicitudes, personas, empresas…"
          className="h-9 w-64 rounded-lg border border-border bg-surface-muted pl-9 pr-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-400 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-brand-100 lg:w-80"
        />
      </form>

      {/* Quick actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Acciones</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Acciones rápidas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push('/requests/new')}>
            <Plus className="mr-2 h-4 w-4" /> Nueva solicitud
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/companies/new')}>
            <Plus className="mr-2 h-4 w-4" /> Crear empresa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/users/new')}>
            <Plus className="mr-2 h-4 w-4" /> Crear usuario
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/people/new')}>
            <Plus className="mr-2 h-4 w-4" /> Nueva persona
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label="Notificaciones" className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted">
            <Bell className="h-[18px] w-[18px]" />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
            <span className="text-sm font-semibold text-text-primary">Notificaciones</span>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllNotificationsRead}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">Sin notificaciones</p>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <button type="button" key={n.id}
                   onClick={() => markNotificationRead(n.id)}
                  className={cn(
                    'flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-3 text-left hover:bg-surface-muted last:border-0',
                    !n.read && 'bg-brand-50/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">{n.title}</span>
                    {!n.read && <span className="h-2 w-2 rounded-full bg-brand-600" />}
                  </div>
                  <span className="text-xs text-text-muted">{n.message}</span>
                  <span className="text-[10px] text-text-disabled">{formatDateTime(n.createdAt)}</span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Role switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="hidden h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm text-text-secondary hover:bg-surface-muted sm:flex">
            <ShieldCheck className="h-4 w-4 text-brand-600" />
            <span className="max-w-[140px] truncate">{currentUser ? ROLES[currentUser.role].short : ''}</span>
            <ChevronDown className="h-3.5 w-3.5 text-text-disabled" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Cambiar rol (demo)</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {ROLE_LIST.map((r) => (
            <DropdownMenuItem
              key={r.value}
              onClick={() => switchRole(r.value)}
              className={cn(
                currentUser?.role === r.value && 'bg-brand-50 text-brand-700'
              )}
            >
              {r.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* User switcher */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 hover:bg-surface-muted">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
              {userData ? initials(userData.firstName, userData.lastName) : '?'}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-text-disabled" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{userData?.firstName} {userData?.lastName}</span>
              <span className="text-xs font-normal text-text-muted">{userData?.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">Cambiar usuario (demo)</DropdownMenuLabel>
          {users.slice(0, 8).map((u) => (
            <DropdownMenuItem
              key={u.id}
              onClick={() => switchUser(u.id)}
              className={cn(currentUser?.userId === u.id && 'bg-brand-50')}
            >
              {u.firstName} {u.lastName}
              <span className="ml-auto text-[10px] text-text-muted">{ROLES[u.role].short}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              resetData();
            }}
            className="text-danger"
          >
            Restablecer datos del MVP
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setCurrentUser(null);
              router.push('/login');
            }}
          >
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Badge tone="brand" className="hidden lg:inline-flex">MVP Frontend</Badge>
    </header>
  );
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}
