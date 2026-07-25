"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Save,
  Send,
  AlertCircle,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/shared/StatusBadge";
import { ValidationSummary } from "./ValidationSummary";

/**
 * Barra superior del editor: título, indicador de cambios sin guardar,
 * estado de validación, botones Guardar / Publicar / Volver.
 * El modo read-only (PUBLISHED) oculta los botones.
 */
export function EditorToolbar({
  title,
  versionLabel,
  dirty,
  readOnly,
  validationErrors,
  validationValid,
  saving,
  publishing,
  canPublish,
  onSave,
  onPublish,
}: {
  title: string;
  versionLabel: string;
  dirty: boolean;
  readOnly: boolean;
  validationErrors: string[];
  validationValid: boolean;
  saving: boolean;
  publishing: boolean;
  canPublish: boolean;
  onSave: () => void;
  onPublish: () => void;
}) {
  return (
    <div className="space-y-3 border-b border-border bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/workflows">
              <ArrowLeft className="h-4 w-4" />
              Volver
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
            <p className="text-xs text-text-muted">{versionLabel}</p>
          </div>
          {dirty && (
            <Badge tone="warning">
              <AlertCircle className="mr-1 h-3 w-3" />
              Cambios sin guardar
            </Badge>
          )}
          {readOnly && (
            <Badge tone="neutral">
              <Lock className="mr-1 h-3 w-3" />
              Solo lectura
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!readOnly && (
            <Button
              onClick={onSave}
              disabled={saving || !dirty || !validationValid}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {saving ? "Guardando…" : "Guardar borrador"}
            </Button>
          )}
          {!readOnly && canPublish && (
            <Button
              variant="default"
              onClick={onPublish}
              disabled={publishing || !validationValid || dirty}
              title={
                dirty
                  ? "Guarda el borrador antes de publicar"
                  : !validationValid
                    ? "El grafo no es válido"
                    : "Publicar como nueva versión inmutable"
              }
            >
              {publishing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Publicar
            </Button>
          )}
        </div>
      </div>
      <ValidationSummary
        errors={validationErrors}
        valid={validationValid}
        saving={saving}
      />
    </div>
  );
}
