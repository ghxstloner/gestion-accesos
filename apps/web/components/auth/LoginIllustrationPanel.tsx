import Image from 'next/image';

/**
 * Panel derecho del login: muestra la imagen institucional de la Ciudad de
 * Panamá como protagonista sobre una composición corporativa sobria.
 */
export function LoginIllustrationPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-brand-950">
      {/* Foto protagonista */}
      <Image
        src="/panama.jpg"
        alt="Ciudad de Panamá"
        fill
        priority
        sizes="(min-width: 1024px) 55vw, 100vw"
        className="object-cover"
      />

      {/* Superposiciones institucionales para dar profundidad y legibilidad */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-950/85 via-brand-950/35 to-brand-950/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-950/55 to-transparent"
        aria-hidden="true"
      />

      {/* Encabezado discreto del panel */}
      <div className="absolute left-0 top-0 flex w-full items-center justify-between px-10 py-8 xl:px-14">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-300" aria-hidden="true" />
          Sistema de Gestión de Accesos
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
          SGA
        </span>
      </div>

      {/* Bloque institucional inferior */}
      <div className="absolute bottom-0 left-0 w-full px-10 py-10 xl:px-14">
        <h2 className="max-w-md text-balance text-2xl font-bold leading-snug text-white xl:text-[28px]">
          Gestión de carnés y permisos de acceso
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
          Plataforma institucional para administrar solicitudes, revisiones,
          aprobaciones y emisión de carnés permanentes y permisos temporales.
        </p>
      </div>
    </div>
  );
}
