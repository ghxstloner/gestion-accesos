import Image from "next/image";

/**
 * Panel derecho del login: muestra la imagen institucional de la Ciudad de
 * Panamá como protagonista sobre una composición corporativa sobria.
 */
export function LoginIllustrationPanel() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[28px] bg-brand-600">
      {/* Foto protagonista */}
      <Image
        src="/panama.jpg"
        alt="Ciudad de Panamá"
        fill
        priority
        sizes="(min-width: 1024px) 55vw, 100vw"
        className="object-cover transition-transform duration-[2s] hover:scale-[1.02]"
      />

      {/* Superposiciones institucionales para dar profundidad y legibilidad */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-brand-600/85 via-brand-600/35 to-brand-600/30"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand-600/55 to-transparent"
        aria-hidden="true"
      />

      {/* Encabezado discreto del panel */}
      <div className="absolute left-0 top-0 flex w-full items-center justify-between px-10 py-8 xl:px-14">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <span
            className="h-1.5 w-1.5 rounded-full bg-brand-300"
            aria-hidden="true"
          />
          Sistema de Gestión de Accesos
        </span>
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
          SGA
        </span>
      </div>

      {/* Bloque institucional inferior */}
      <div className="absolute bottom-0 left-0 w-full px-10 py-10 xl:px-14 xl:py-14">
        <span className="mb-4 inline-flex rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[.18em] text-white backdrop-blur-md">
          Control inteligente
        </span>
        <h2 className="font-display max-w-lg text-balance text-4xl leading-[1.05] text-white xl:text-5xl">
          Accesos seguros. Operaciones fluidas.
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">
          Una experiencia integrada para solicitudes, revisiones y emisión de
          credenciales aeroportuarias.
        </p>
      </div>
    </div>
  );
}
