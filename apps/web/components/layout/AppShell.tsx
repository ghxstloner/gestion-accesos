"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useSgaStore, useStoreHydrated } from "@/lib/store";
import { buildCurrentUser, useCurrentSessionQuery } from "@/hooks/auth-hooks";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";
import { AppBootSkeleton } from "@/components/shared/LoadingSkeletons";

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = useSgaStore((s) => s.currentUser);
  const hydrated = useStoreHydrated();
  const router = useRouter();
  const pathname = usePathname();
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const session = useCurrentSessionQuery(hydrated);

  // El backend valida la cookie httpOnly y devuelve la proyección canónica de
  // la sesión. El store local sólo permite compartirla entre componentes.
  useEffect(() => {
    if (session.data) {
      setCurrentUser(buildCurrentUser(session.data));
    } else if (hydrated && session.isError && !session.isFetching) {
      setCurrentUser(null);
      router.replace("/login");
    }
  }, [
    hydrated,
    router,
    session.data,
    session.isError,
    session.isFetching,
    setCurrentUser,
  ]);

  useEffect(() => {
    if (
      currentUser?.profile?.mustChangePassword &&
      pathname !== "/change-password"
    )
      router.replace("/change-password");
  }, [currentUser, pathname, router]);

  if (!hydrated || session.isLoading || !currentUser) {
    return <AppBootSkeleton />;
  }

  if (pathname === "/change-password") return <>{children}</>;

  return (
    <div className="fixed inset-0 flex overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <AppSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="scrollbar-thin flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1480px] px-4 py-5 sm:px-6 sm:py-7 xl:px-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
