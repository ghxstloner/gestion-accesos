"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import {
  getAccessToken,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/auth-session";
import { mapBackendRoleToFrontend } from "@/lib/role-mapping";
import type { AuthenticatedProfile } from "@/lib/types";

/** Respuesta de `POST /auth/login` según el backend. */
export interface AuthLoginResponse {
  accessToken: string;
  user: AuthenticatedProfile;
}

export interface UseLoginInput {
  documentType: string;
  documentNumber: string;
  password: string;
}

/**
 * Mutación de login contra el backend.
 *
 * 1. Llama a `POST /api/v1/auth/login`.
 * 2. Persiste el access token en memoria.
 * 3. Devuelve el perfil del usuario + el rol mapeado al vocabulario del store.
 */
export function useLoginMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ documentType, documentNumber, password }: UseLoginInput) => {
      const data = await apiFetch<AuthLoginResponse>("/auth/login", {
        method: "POST",
        json: { documentType, documentNumber, password },
      });
      setAccessToken(data.accessToken);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data.user);
    },
  });
}

export function useCurrentSessionQuery(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["auth", "me"],
    retry: false,
    queryFn: async () => {
      if (!getAccessToken()) {
        const restored = await refreshAccessToken();
        if (!restored) {
          const error = new Error("No active session") as Error & {
            status: number;
          };
          error.status = 401;
          throw error;
        }
      }
      return apiFetch<AuthenticatedProfile>("/auth/me");
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      try {
        await apiFetch<void>("/auth/logout", { method: "POST" });
      } catch {
        /* no-op */
      }
      setAccessToken(null);
    },
    onSettled: () => {
      queryClient.removeQueries({ queryKey: ["auth"] });
    },
  });
}

export function useChangePasswordMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (newPassword: string) =>
      apiFetch<AuthenticatedProfile>("/auth/change-password", {
        method: "POST",
        json: { newPassword },
      }),
    onSuccess: (profile) => queryClient.setQueryData(["auth", "me"], profile),
  });
}

export function buildCurrentUser(user: AuthenticatedProfile) {
  return {
    userId: user.id,
    role: mapBackendRoleToFrontend(user.roles),
    profile: user,
  };
}
