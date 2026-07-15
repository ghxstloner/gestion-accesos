'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSgaStore, useStoreHydrated } from '@/lib/store';
import { buildCurrentUser, useCurrentSessionQuery } from '@/hooks/auth-hooks';

export default function Home() {
  const router = useRouter();
  const hydrated = useStoreHydrated();
  const setCurrentUser = useSgaStore((s) => s.setCurrentUser);
  const session = useCurrentSessionQuery(hydrated);

  useEffect(() => {
    if (!hydrated || session.isPending || session.isFetching) return;
    if (session.data) {
      setCurrentUser(buildCurrentUser(session.data));
      router.replace('/dashboard');
    } else {
      setCurrentUser(null);
      router.replace('/login');
    }
  }, [
    hydrated,
    router,
    session.data,
    session.isPending,
    session.isFetching,
    setCurrentUser,
  ]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-sm text-text-muted">Cargando…</div>
    </div>
  );
}
