"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Lista de errores de validación del GraphValidator. Visible arriba del canvas
 * cuando hay problemas. Cuando el grafo es válido muestra un badge verde.
 */
export function ValidationSummary({
  errors,
  valid,
  saving,
}: {
  errors: string[];
  valid: boolean;
  saving?: boolean;
}) {
  if (saving) return null;
  if (valid) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
        <CheckCircle2 className="h-4 w-4" />
        Grafo válido para guardar / publicar.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-danger/30 bg-rose-50 px-3 py-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-danger">
        <AlertTriangle className="h-4 w-4" />
        {errors.length} problema{errors.length === 1 ? "" : "s"} de validación
      </div>
      <ul className="mt-1 list-disc pl-8 text-xs text-rose-800">
        {errors.slice(0, 8).map((e, i) => (
          <li key={i}>{e}</li>
        ))}
        {errors.length > 8 && (
          <li className="text-rose-600">… y {errors.length - 8} más</li>
        )}
      </ul>
    </div>
  );
}
