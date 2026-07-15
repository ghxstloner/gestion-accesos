/**
 * Identidad secundaria del proveedor tecnológico del SGA.
 * Se presenta de forma discreta al pie del panel del formulario.
 */
export function ProviderBranding() {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2 text-xs text-text-muted"><span className="h-2 w-2 rounded-full bg-success" /> Conexión protegida</div>
      <p className="text-xs text-text-muted">
        &copy; {new Date().getFullYear()} Aeropuerto Internacional de Tocumen, S.A.
      </p>
    </div>
  );
}
