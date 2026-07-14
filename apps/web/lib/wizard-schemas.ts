/**
 * Per-step Zod validation for the new/edit request wizard at
 * `app/(app)/requests/new/page.tsx`.
 *
 * The wizard keeps its state inside plain `useState` hooks (not RHF) so we
 * validate by computing a snapshot object per step and running the matching
 * schema through `schema.safeParse(snapshot)`. `validateStep` returns
 * `{ ok, errors }` where `errors` is a `Record<field, message>` ready to be
 * surfaced inline.
 *
 * Schemas are intentionally lenient on optional fields but strict on the
 * contract requirements documented in the spec (§13 Wizard Zod per-step):
 *   1. Tipo seleccionado
 *   2. Empresa + firmante + motivo + fechas/horarios + endDate>=startDate
 *   3. ≥1 persona, exactamente un principal
 *   4. VEHÍCULO: ≥1 vehículo; HERRAMIENTA: ≥1 herramienta
 *   5. ≥1 punto de acceso
 *   6. ≥1 zona; cada zona con justificación; sin duplicados
 *   7. ≥1 documento
 *   8. declaración aceptada
 */

import { z } from 'zod';
import type {
  AccessZoneSelection,
  DocumentItem,
  RequestType,
  Tool,
  Vehicle,
} from '@/lib/types';

export interface WizardSnapshot {
  type: RequestType | '';
  companyId: string;
  signerId: string;
  reason: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  selectedPersonIds: string[];
  primaryPersonId?: string;
  vehicles: Vehicle[];
  tools: Tool[];
  accessPoints: string[];
  zones: AccessZoneSelection[];
  documents: DocumentItem[];
  declaration: boolean;
}

export type StepErrors = Partial<Record<keyof WizardSnapshot | 'root', string>>;

/* ---------------- Step schemas ---------------- */

const step1 = z.object({
  type: z.enum(
    ['CARNE_PERMANENTE', 'PERMISO_PERSONA', 'PERMISO_VEHICULO', 'PERMISO_HERRAMIENTA'],
    { message: 'Seleccione un tipo de solicitud.' }
  ),
});

const step2 = z
  .object({
    companyId: z.string().min(1, 'La empresa es obligatoria.'),
    signerId: z.string().min(1, 'Seleccione un firmante autorizado.'),
    reason: z.string().min(1, 'Indique el motivo de la visita.'),
    startDate: z.string().min(1, 'Fecha inicial requerida.'),
    endDate: z.string().min(1, 'Fecha final requerida.'),
    startTime: z.string().min(1, 'Hora inicial requerida.'),
    endTime: z.string().min(1, 'Hora final requerida.'),
  })
  .refine((d) => !d.startDate || !d.endDate || d.endDate >= d.startDate, {
    path: ['endDate'],
    message: 'La fecha final no puede ser anterior a la inicial.',
  })
  .refine(
    (d) =>
      !d.startDate ||
      !d.endDate ||
      d.startDate !== d.endDate ||
      !d.startTime ||
      !d.endTime ||
      d.endTime >= d.startTime,
    { path: ['endTime'], message: 'La hora final no puede ser anterior a la inicial.' }
  );

const step3 = z
  .object({
    type: z.string(),
    selectedPersonIds: z.array(z.string()),
    primaryPersonId: z.string().optional(),
  })
  .refine((d) => d.selectedPersonIds.length >= 1, {
    path: ['selectedPersonIds'],
    message: 'Seleccione al menos una persona.',
  })
  .refine(
    (d) =>
      !d.primaryPersonId ||
      d.selectedPersonIds.includes(d.primaryPersonId) ||
      d.selectedPersonIds.length === 1,
    {
      path: ['primaryPersonId'],
      message: 'La persona principal debe estar en la selección.',
    }
  )
  .refine(
    // For vehicular/tool permits (no person travelling) beneficiary list is
    // STILL required because the spec mandates ≥1 responsable.
    (d) => d.selectedPersonIds.length >= 1,
    { path: ['selectedPersonIds'], message: 'Seleccione al menos una persona responsable.' }
  );

const step4 = z
  .object({
    type: z.string(),
    vehicles: z.array(z.any()),
    tools: z.array(z.any()),
  })
  .superRefine((d, ctx) => {
    if (d.type === 'PERMISO_VEHICULO') {
      if (d.vehicles.length === 0) {
        ctx.addIssue({
          path: ['vehicles'],
          code: 'custom',
          message: 'Agregue al menos un vehículo.',
        });
      }
      const plates = d.vehicles.map((v: Vehicle) => v.plate.trim());
      const dup = plates.filter((p: string, i: number) => p && plates.indexOf(p) !== i);
      if (dup.length > 0) {
        ctx.addIssue({
          path: ['vehicles'],
          code: 'custom',
          message: `Matrículas duplicadas: ${[...new Set(dup)].join(', ')}.`,
        });
      }
    }
    if (d.type === 'PERMISO_HERRAMIENTA') {
      if (d.tools.length === 0) {
        ctx.addIssue({
          path: ['tools'],
          code: 'custom',
          message: 'Agregue al menos una herramienta o equipo.',
        });
      }
      const serials = d.tools.map((t: Tool) => t.serialNumber.trim());
      const dupS = serials.filter((s: string, i: number) => s && serials.indexOf(s) !== i);
      if (dupS.length > 0) {
        ctx.addIssue({
          path: ['tools'],
          code: 'custom',
          message: `Números de serie duplicados: ${[...new Set(dupS)].join(', ')}.`,
        });
      }
      const badQty = (d.tools as Tool[]).filter((t) => !Number.isFinite(t.quantity) || t.quantity < 1);
      if (badQty.length > 0) {
        ctx.addIssue({
          path: ['tools'],
          code: 'custom',
          message: 'Todas las cantidades deben ser ≥ 1.',
        });
      }
    }
  });

const step5 = z.object({
  accessPoints: z
    .array(z.string())
    .min(1, 'Seleccione al menos un punto de acceso.'),
});

const step6 = z
  .object({
    zones: z.array(z.any()),
  })
  .superRefine((d, ctx) => {
    if (d.zones.length === 0) {
      ctx.addIssue({
        path: ['zones'],
        code: 'custom',
        message: 'Seleccione al menos una zona de seguridad.',
      });
      return;
    }
    // Duplicates by (zoneColor, areaCode)
    const keys = d.zones.map((z: AccessZoneSelection) => `${z.zoneColor}-${z.areaCode}`);
    const seen = new Set<string>();
    keys.forEach((k: string, i: number) => {
      if (seen.has(k)) {
        ctx.addIssue({
          path: ['zones', i],
          code: 'custom',
          message: 'Zona duplicada.',
        });
      }
      seen.add(k);
    });
    // Missing justification
    d.zones.forEach((z: AccessZoneSelection, i: number) => {
      if (!z.justification.trim()) {
        ctx.addIssue({
          path: ['zones', i, 'justification'],
          code: 'custom',
          message: 'Justifique el acceso a esta área.',
        });
      }
    });
  });

const step7 = z.object({
  documents: z
    .array(z.any())
    .min(1, 'Adjunte al menos un documento.'),
});

const step8 = z.object({
  declaration: z.literal(true, {
    message: 'Debe aceptar la declaración de veracidad.',
  }),
});

export interface StepValidationResult {
  ok: boolean;
  errors: StepErrors;
}

/**
 * Validate a wizard snapshot against the schema for the given step.
 * Returns `{ ok, errors }` keyed by snapshot-field name. When the schema
 * reports a list/aggregate error (e.g. `selectedPersonIds`), the message
 * lands on the matching top-level key so the wizard can render it inline.
 */
export function validateStep(step: number, snap: WizardSnapshot): StepValidationResult {
  let schema: z.ZodTypeAny;
  let input: Record<string, unknown>;
  switch (step) {
    case 1:
      schema = step1;
      input = { type: snap.type };
      break;
    case 2:
      schema = step2;
      input = {
        companyId: snap.companyId,
        signerId: snap.signerId,
        reason: snap.reason,
        startDate: snap.startDate,
        endDate: snap.endDate,
        startTime: snap.startTime,
        endTime: snap.endTime,
      };
      break;
    case 3:
      schema = step3;
      input = {
        type: snap.type,
        selectedPersonIds: snap.selectedPersonIds,
        primaryPersonId: snap.primaryPersonId,
      };
      break;
    case 4:
      schema = step4;
      input = {
        type: snap.type,
        vehicles: snap.vehicles,
        tools: snap.tools,
      };
      break;
    case 5:
      schema = step5;
      input = { accessPoints: snap.accessPoints };
      break;
    case 6:
      schema = step6;
      input = { zones: snap.zones };
      break;
    case 7:
      schema = step7;
      input = { documents: snap.documents };
      break;
    case 8:
      schema = step8;
      input = { declaration: snap.declaration };
      break;
    default:
      return { ok: true, errors: {} };
  }

  const result = schema.safeParse(input);
  if (result.success) {
    return { ok: true, errors: {} };
  }
  const errors: StepErrors = {};
  for (const issue of result.error.issues) {
    const key = (issue.path[0] as keyof WizardSnapshot | undefined) ?? 'root';
    if (!errors[key]) {
      errors[key] = issue.message;
    }
  }
  return { ok: false, errors };
}
