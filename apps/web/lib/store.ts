"use client";

import { useMemo } from "react";
import { create } from "zustand";
import type { CurrentUser, User } from "@/lib/types";
import { ROLES } from "@/lib/constants";

interface SessionState {
  currentUser: CurrentUser | null;
  _hasHydrated: boolean;
  setCurrentUser: (user: CurrentUser | null) => void;
}

/**
 * Client-side session projection only. Business entities live exclusively in
 * the backend and React Query cache; this store never owns domain data.
 */
export const useSgaStore = create<SessionState>()((set) => ({
  currentUser: null,
  _hasHydrated: true,
  setCurrentUser: (currentUser) =>
    set((state) => {
      const previous = state.currentUser;
      if (
        previous === currentUser ||
        (previous?.profile === currentUser?.profile &&
          previous?.role === currentUser?.role)
      ) {
        return state;
      }
      return { currentUser };
    }),
}));

export function useCurrentUser() {
  return useSgaStore((state) => state.currentUser);
}

export function useCurrentUserData(): User | null {
  const current = useSgaStore((state) => state.currentUser);

  return useMemo(() => {
    if (!current?.profile) return null;
    return {
      id: current.profile.id,
      companyId: current.profile.companyId ?? "",
      firstName: current.profile.firstName,
      lastName: current.profile.lastName,
      email: current.profile.email,
      status: current.profile.status as User["status"],
      role: current.role,
      lastAccess: current.profile.lastAccessAt,
      createdAt: current.profile.createdAt,
      photoUrl: current.profile.photoUrl ?? undefined,
      mustChangePassword: current.profile.mustChangePassword,
    };
  }, [current]);
}

export function useStoreHydrated(): boolean {
  return useSgaStore((state) => state._hasHydrated);
}

export function useRoleLabel(role?: string) {
  if (!role) return "";
  return ROLES[role as keyof typeof ROLES]?.label ?? role;
}
