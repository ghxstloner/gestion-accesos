"use client";

import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Search,
  Bell,
  Plus,
  Menu,
  ChevronDown,
  Building2,
  Users,
  ClipboardList,
  UserRound,
} from "lucide-react";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import { ROLES } from "@/lib/constants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/constants";
import { useLogoutMutation } from "@/hooks/auth-hooks";
import { resolveApiAsset } from "@/lib/api-config";
import {
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationsQuery,
} from "@/hooks/api-hooks";

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  companies: "Empresas",
  users: "Usuarios",
  people: "Personas",
  "authorized-signers": "Firmantes autorizados",
  requests: "Solicitudes",
  reviews: "Bandeja de revisión",
  issuance: "Emisión de carnés",
  catalogs: "Catálogos",
  new: "Nuevo",
  login: "Iniciar sesión",
};

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useSgaStore((s) => s.currentUser);
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const userData = useCurrentUserData();
  const { data: notifications = [] } = useNotificationsQuery();
  const markNotificationRead = useMarkNotificationReadMutation();
  const markAllNotificationsRead = useMarkAllNotificationsReadMutation();
  const logoutMutation = useLogoutMutation();
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const searchablePath =
      ["/requests", "/companies", "/users", "/people"].find((path) =>
        pathname.startsWith(path),
      ) ?? "/requests";
    router.push(`${searchablePath}?search=${encodeURIComponent(q)}`);
    setSearchFocused(false);
  };

  const breadcrumbs = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts.map((part, i) => {
      const label = routeLabels[part] ?? part;
      const href = "/" + parts.slice(0, i + 1).join("/");
      return { label, href };
    });
  }, [pathname]);

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setCurrentUser(null);
        router.push("/login");
      },
      onError: () => {
        // Aún si falla el logout remoto, cerramos la sesión local.
        setCurrentUser(null);
        router.push("/login");
      },
    });
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 lg:px-6">
      {/* Mobile menu */}
      <Sheet>
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label="Menú"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <AppSidebar />
        </SheetContent>
      </Sheet>

      {/* Product identity belongs to the navbar, not the company logo area. */}
      <div className="flex min-w-0 shrink-0 items-center gap-2.5">
        <span className="flex h-8 items-center rounded-lg bg-brand-600 px-2.5 text-xs font-extrabold tracking-[.08em] text-white">
          SGA
        </span>
        <div className="hidden min-w-0 leading-tight xl:block">
          <p className="truncate text-xs font-bold text-text-primary">
            Sistema de Gestión de Accesos
          </p>
          <p className="text-[10px] text-text-muted">
            Administración y control
          </p>
        </div>
      </div>

      <div className="hidden h-7 w-px shrink-0 bg-border lg:block" />

      {/* Breadcrumbs */}
      <nav className="hidden items-center gap-1.5 text-sm md:flex">
        {breadcrumbs.map((bc, i) => (
          <span key={bc.href} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3.5 w-3.5 text-text-disabled" />
            )}
            <button
              type="button"
              onClick={() => router.push(bc.href)}
              className={cn(
                "hover:text-text-primary",
                i === breadcrumbs.length - 1
                  ? "font-semibold text-text-primary"
                  : "text-text-muted",
              )}
            >
              {bc.label}
            </button>
          </span>
        ))}
      </nav>

      {/* Global search */}
      <form
        onSubmit={onSearchSubmit}
        className="relative ml-auto hidden md:block lg:ml-6 lg:mr-auto"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
          placeholder="Buscar en todo el sistema…"
          className="h-10 w-64 rounded-xl border border-border bg-surface-muted pl-9 pr-3 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-400 focus:bg-surface focus:outline-none focus:ring-3 focus:ring-brand-100 lg:w-96"
        />
        {searchFocused && search.trim() && (
          <div className="premium-card absolute left-0 top-12 z-50 w-full overflow-hidden rounded-2xl border border-border bg-white p-2">
            <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[.14em] text-text-muted">
              Buscar “{search.trim()}” en
            </p>
            {[
              {
                path: "/requests",
                label: "Solicitudes",
                icon: ClipboardList,
                permission: "requests",
              },
              {
                path: "/people",
                label: "Personas",
                icon: UserRound,
                permission: "people.read",
              },
              {
                path: "/companies",
                label: "Empresas",
                icon: Building2,
                permission: "companies.read",
              },
              {
                path: "/users",
                label: "Usuarios",
                icon: Users,
                permission: "users.read",
              },
            ]
              .filter(
                (item) =>
                  item.permission === "requests" ||
                  currentUser?.profile?.permissions.some((p) =>
                    p.startsWith(item.permission),
                  ),
              )
              .map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    router.push(
                      `${item.path}?search=${encodeURIComponent(search.trim())}`,
                    );
                    setSearchFocused(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-text-secondary hover:bg-brand-50 hover:text-brand-800"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <item.icon className="h-4 w-4" />
                  </span>
                  {item.label}
                  <ChevronRight className="ml-auto h-4 w-4 text-text-disabled" />
                </button>
              ))}
          </div>
        )}
      </form>

      {/* Quick actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Acciones</span>
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Acciones rápidas</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/requests/new")}>
            <Plus className="mr-2 h-4 w-4" /> Nueva solicitud
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/companies/new")}>
            <Plus className="mr-2 h-4 w-4" /> Crear empresa
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/users/new")}>
            <Plus className="mr-2 h-4 w-4" /> Crear usuario
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push("/people/new")}>
            <Plus className="mr-2 h-4 w-4" /> Nueva persona
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Notificaciones"
            className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border text-text-muted hover:bg-surface-muted"
          >
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
            <span className="text-sm font-semibold text-text-primary">
              Notificaciones
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllNotificationsRead.mutate()}
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Marcar todas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Sin notificaciones
              </p>
            ) : (
              notifications.slice(0, 8).map((n) => (
                <button
                  type="button"
                  key={n.id}
                  onClick={() => markNotificationRead.mutate(n.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-3 text-left hover:bg-surface-muted last:border-0",
                    !n.readAt && "bg-brand-50/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-text-primary">
                      {n.title}
                    </span>
                    {!n.readAt && (
                      <span className="h-2 w-2 rounded-full bg-brand-600" />
                    )}
                  </div>
                  <span className="text-xs text-text-muted">{n.message}</span>
                  <span className="text-[10px] text-text-disabled">
                    {formatDateTime(n.createdAt)}
                  </span>
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* User menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 hover:bg-surface-muted"
          >
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-xs font-semibold text-brand-700 ring-2 ring-brand-100">
              {userData?.photoUrl ? (
                <Image
                  src={resolveApiAsset(userData.photoUrl)}
                  alt="Foto de perfil"
                  fill
                  sizes="32px"
                  className="object-cover"
                  unoptimized
                />
              ) : userData ? (
                initials(userData.firstName, userData.lastName)
              ) : (
                "?"
              )}
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-text-disabled" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">
                {userData?.firstName} {userData?.lastName}
              </span>
              <span className="text-xs font-normal text-text-muted">
                {userData?.email}
              </span>
              {currentUser && (
                <span className="mt-1 text-[11px] font-medium text-brand-700">
                  {ROLES[currentUser.role].label}
                </span>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? "Cerrando sesión…" : "Cerrar sesión"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
