'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSgaStore, useStoreHydrated } from '@/lib/store';
import { buildCurrentUser, useCurrentSessionQuery } from '@/hooks/auth-hooks';
import { AppSidebar } from './AppSidebar';
import { AppHeader } from './AppHeader';

export function AppShell({ children }: { children: React.ReactNode }) {
  const currentUser = useSgaStore((s) => s.currentUser);
  const hydrated = useStoreHydrated();
  const router = useRouter();
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const session = useCurrentSessionQuery(hydrated);

  // El backend valida la cookie httpOnly y devuelve la proyección canónica de
  // la sesión. El store local sólo permite compartirla entre componentes.
  useEffect(() => {
    if (session.data) {
      setCurrentUser(buildCurrentUser(session.data));
    } else if (hydrated && session.isError && !session.isFetching) {
      setCurrentUser(null);
      router.replace('/login');
    }
  }, [
    hydrated,
    router,
    session.data,
    session.isError,
    session.isFetching,
    setCurrentUser,
  ]);

  if (!hydrated || session.isLoading || !currentUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-sm text-text-muted">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:flex">
        <AppSidebar />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
