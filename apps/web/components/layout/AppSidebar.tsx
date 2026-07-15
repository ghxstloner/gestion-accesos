"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import { getNavGroups } from "@/lib/navigation";
import { ROLES } from "@/lib/constants";
import { useSettingsQuery } from "@/hooks/api-hooks";
import { Building2 } from "lucide-react";
import { resolveApiAsset } from "@/lib/api-config";

export function AppSidebar() {
  const pathname = usePathname();
  const currentUser = useSgaStore((s) => s.currentUser);
  const userData = useCurrentUserData();
  const { data: settings } = useSettingsQuery();
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sga-sidebar-collapsed") === "1";
  });

  useEffect(() => {
    localStorage.setItem("sga-sidebar-collapsed", collapsed ? "1" : "0");
  }, [collapsed]);

  if (!currentUser) return null;

  const groups = getNavGroups(currentUser.role);
  const width = collapsed ? "w-[72px]" : "w-60";

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-white/15 bg-brand-600 text-white transition-all duration-200",
        width,
      )}
    >
      {/* Logo */}
      <div className="h-24 shrink-0 border-b border-white/15 p-2">
        <Link
          href="/dashboard"
          aria-label="Ir al dashboard"
          className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm"
        >
          {settings?.logoUrl ? (
            <Image
              src={resolveApiAsset(settings.logoUrl)}
              alt="Logo de la empresa"
              fill
              sizes={collapsed ? "56px" : "224px"}
              className="object-contain p-2"
              unoptimized
            />
          ) : (
            <Building2
              className={cn(
                "text-brand-600",
                collapsed ? "h-8 w-8" : "h-12 w-12",
              )}
            />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            {!collapsed && (
              <p className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[.16em] text-white/35">
                {group.label}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                      collapsed && "justify-center",
                      active
                        ? "bg-white text-brand-950 shadow-lg shadow-black/10"
                        : "text-white/65 hover:bg-white/8 hover:text-white",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
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
          "flex items-center gap-2 border-t border-white/10 py-3 text-xs font-medium text-white/50 hover:bg-white/5 hover:text-white",
          collapsed ? "justify-center px-2" : "px-5",
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
      <div className={cn("border-t border-white/10 p-3", collapsed && "px-2")}>
        <div
          className={cn(
            "flex items-center gap-2.5",
            collapsed && "justify-center",
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-300 text-xs font-bold text-brand-950">
            {userData ? initials(userData.firstName, userData.lastName) : "?"}
          </div>
          {!collapsed && userData && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">
                {userData.firstName} {userData.lastName}
              </p>
              <p className="truncate text-[10px] text-white/45">
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
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}
