import type { Metadata } from 'next';
import Image from 'next/image';

import { LoginForm } from '@/components/auth/LoginForm';
import { LoginIllustrationPanel } from '@/components/auth/LoginIllustrationPanel';
import { ProviderBranding } from '@/components/auth/ProviderBranding';

export const metadata: Metadata = {
  title: 'Iniciar sesión — SGA',
  description:
    'Acceso institucional al Sistema de Gestión de Accesos del Aeropuerto Internacional de Tocumen.',
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      {/* Panel izquierdo — formulario */}
      <div className="flex w-full flex-col lg:min-h-screen lg:w-[45%] lg:border-r lg:border-border-subtle xl:w-[46%]">
        {/* Cabecera institucional */}
        <header className="flex items-center justify-between gap-4 px-6 py-6 sm:px-10 lg:px-12">
          <Image
            src="/tocumen.png"
            alt="Aeropuerto Internacional de Tocumen, S.A."
            width={1538}
            height={778}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <span className="inline-flex items-center rounded-full border border-border-subtle bg-surface-muted px-3 py-1 text-xs font-medium text-text-secondary">
            Sistema SGA
          </span>
        </header>

        {/* Formulario centrado */}
        <main className="flex flex-1 items-center justify-center px-6 py-8 sm:px-10 lg:px-12">
          <div className="w-full max-w-[420px]">
            <LoginForm />
          </div>
        </main>

        {/* Imagen compacta en móvil (entre el formulario y la marca) */}
        <div className="relative h-44 w-full overflow-hidden bg-brand-950 sm:h-56 lg:hidden">
          <Image
            src="/panama.jpg"
            alt="Ciudad de Panamá"
            fill
            className="object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/80 via-brand-950/20 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Pie — identidad del proveedor tecnológico */}
        <footer className="px-6 py-6 sm:px-10 lg:px-12">
          <ProviderBranding />
        </footer>
      </div>

      {/* Panel derecho — ilustración (escritorio) */}
      <aside className="hidden lg:flex lg:min-h-screen lg:w-[55%] xl:w-[54%]">
        <LoginIllustrationPanel />
      </aside>
    </div>
  );
}
