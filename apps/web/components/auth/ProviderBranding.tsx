import Image from 'next/image';

/**
 * Identidad secundaria del proveedor tecnológico del SGA.
 * Se presenta de forma discreta al pie del panel del formulario.
 */
export function ProviderBranding() {
  return (
    <div className="flex flex-col gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted">Desarrollado por</span>
        <Image
          src="/logo_amaxonia.png"
          alt="Amaxonia — proveedor tecnológico"
          width={1080}
          height={666}
          className="h-[18px] w-auto opacity-80"
        />
      </div>
      <p className="text-xs text-text-muted">
        &copy; {new Date().getFullYear()} Aeropuerto Internacional de Tocumen, S.A.
      </p>
    </div>
  );
}
