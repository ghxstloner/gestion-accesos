'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSgaStore } from '@/lib/store';

export default function Home() {
  const router = useRouter();
  const currentUser = useSgaStore((s) => s.currentUser);

  useEffect(() => {
    if (currentUser) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [currentUser, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-sm text-text-muted">Cargando…</div>
    </div>
  );
}
