import { cn } from "@/lib/utils";

type NodeKind = "start" | "end" | "human" | "system" | "decision";

const BASE_BORDER: Record<NodeKind, string> = {
  start: "border-emerald-300",
  end: "border-rose-300",
  human: "border-brand-300",
  system: "border-slate-300",
  decision: "border-amber-300",
};

const BASE_BG: Record<NodeKind, string> = {
  start: "bg-emerald-50",
  end: "bg-rose-50",
  human: "bg-brand-50",
  system: "bg-slate-50",
  decision: "bg-amber-50",
};

/**
 * Clases base para cualquier nodo de workflow. Centraliza el estilo (tamaño,
 * borde, fondo, hover y selección). El flag `invalid` pinta el borde en rojo
 * para señalar errores de validación del GraphValidator.
 */
export function nodeBaseClass(opts: {
  type: NodeKind;
  selected?: boolean;
  invalid?: boolean;
}): string {
  return cn(
    "min-w-[200px] max-w-[260px] rounded-xl border-2 px-3 py-2.5 shadow-sm transition-shadow",
    BASE_BG[opts.type],
    opts.invalid
      ? "border-danger ring-2 ring-danger/30"
      : opts.selected
        ? "border-brand-500 ring-2 ring-brand-300"
        : BASE_BORDER[opts.type],
    "hover:shadow-md",
  );
}
