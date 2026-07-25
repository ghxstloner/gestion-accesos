"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useCreateWorkflowDefinitionMutation } from "@/hooks/workflow-hooks";
import type { WorkflowRequestType } from "@/lib/workflow-types";

const schema = z.object({
  key: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(100, "Máximo 100 caracteres")
    .regex(
      /^[a-z0-9_]+$/i,
      "Solo letras, números y guion bajo. Sin espacios ni acentos.",
    ),
  name: z
    .string()
    .min(3, "Mínimo 3 caracteres")
    .max(255, "Máximo 255 caracteres"),
  description: z.string().optional(),
  requestType: z.enum([
    "NEW_PERSONNEL",
    "TEMPORARY_PERSONNEL",
    "VEHICLE",
    "EQUIPMENT",
  ]),
});
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

const REQUEST_TYPE_OPTIONS: {
  value: WorkflowRequestType;
  label: string;
}[] = [
  { value: "NEW_PERSONNEL", label: "Persona nueva (permanente)" },
  { value: "TEMPORARY_PERSONNEL", label: "Persona temporal" },
  { value: "VEHICLE", label: "Vehículo" },
  { value: "EQUIPMENT", label: "Equipo / herramienta" },
];

export default function NewWorkflowPage() {
  const router = useRouter();
  const createMutation = useCreateWorkflowDefinitionMutation();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      key: "",
      name: "",
      description: "",
      requestType: "TEMPORARY_PERSONNEL",
    },
  });

  const requestType = watch("requestType");

  const onSubmit = async (values: FormValues) => {
    try {
      const created = await createMutation.mutateAsync({
        key: values.key,
        name: values.name,
        description: values.description || undefined,
        requestType: values.requestType,
      });
      toast({ title: "Flujo creado", description: created.name });
      router.push(`/workflows/${created.id}`);
    } catch (e) {
      toast({
        title: "No se pudo crear el flujo",
        description: (e as Error).message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.push("/workflows")}>
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Button>
      <PageHeader
        title="Nuevo flujo de trabajo"
        description="Define la metadata inicial. Después podrás diseñar el grafo en el editor."
      />

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mx-auto max-w-2xl space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="space-y-1.5">
          <Label htmlFor="key">Código único *</Label>
          <Input
            id="key"
            placeholder="ej: persona_temporal_default"
            {...register("key")}
          />
          <p className="text-xs text-text-muted">
            Identificador estable. Una vez publicado no se podrá cambiar.
          </p>
          {errors.key && (
            <p className="text-xs text-danger">{errors.key.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="name">Nombre *</Label>
          <Input
            id="name"
            placeholder="ej: Persona temporal — estándar"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-danger">{errors.name.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción</Label>
          <Textarea
            id="description"
            rows={3}
            placeholder="Resumen del propósito del flujo…"
            {...register("description")}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Tipo de solicitud *</Label>
          <Select
            value={requestType}
            onValueChange={(v) =>
              setValue("requestType", v as WorkflowRequestType)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/workflows")}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creando…" : "Crear flujo"}
          </Button>
        </div>
      </form>
    </div>
  );
}
