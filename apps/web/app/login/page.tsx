import type { Metadata } from "next";
import Image from "next/image";

import { LoginForm } from "@/components/auth/LoginForm";
import { LoginIllustrationPanel } from "@/components/auth/LoginIllustrationPanel";
import { ProviderBranding } from "@/components/auth/ProviderBranding";

export const metadata: Metadata = {
  title: "Iniciar sesión — SGA",
  description:
    "Acceso institucional al Sistema de Gestión de Accesos del Aeropuerto Internacional de Tocumen.",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#edf3fb] lg:flex-row">
      {/* Panel izquierdo — formulario */}
      <div className="relative flex w-full flex-col overflow-hidden lg:min-h-screen lg:w-1/2">
        <div className="pointer-events-none absolute -left-24 top-36 h-72 w-72 rounded-full bg-brand-200/35 blur-3xl" />
        {/* Cabecera institucional */}
        <header className="relative z-10 flex items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
          <Image
            src="/tocumen.png"
            alt="Aeropuerto Internacional de Tocumen, S.A."
            width={1538}
            height={778}
            priority
            className="h-9 w-auto sm:h-10"
          />
          <div className="flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-2 shadow-sm backdrop-blur-xl">
            <span className="text-[10px] font-semibold uppercase tracking-[.16em] text-text-muted">
              Powered by
            </span>
            <Image
              src="/logo_flow.png"
              alt="FlowHR"
              width={92}
              height={32}
              className="h-5 w-auto object-contain"
            />
          </div>
        </header>

        {/* Formulario centrado */}
        <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-8 sm:px-8 lg:px-10">
          <div className="premium-card w-full max-w-[470px] rounded-[28px] border border-white bg-white p-6 sm:p-9">
            <LoginForm />
          </div>
        </main>

        {/* Imagen compacta en móvil (entre el formulario y la marca) */}
        <div className="relative h-40 w-full overflow-hidden bg-brand-600 sm:h-52 lg:hidden">
          <Image
            src="/panama.jpg"
            alt="Ciudad de Panamá"
            fill
            className="object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-600/80 via-brand-600/20 to-transparent"
            aria-hidden="true"
          />
        </div>

        {/* Pie — identidad del proveedor tecnológico */}
        <footer className="relative z-10 px-6 py-5 sm:px-10 lg:px-12">
          <ProviderBranding />
        </footer>
      </div>

      {/* Panel derecho — ilustración (escritorio) */}
      <aside className="hidden lg:flex lg:min-h-screen lg:w-1/2 lg:p-3 lg:pl-0">
        <LoginIllustrationPanel />
      </aside>
    </div>
  );
}
