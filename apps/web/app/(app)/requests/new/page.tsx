'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, ArrowRight, Save, Send, Check, X, Plus, Trash2, Search,
  IdCard, User, Car, Wrench, MapPin, FileText, ShieldCheck, UploadCloud,
} from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader, FormSection } from '@/components/shared/PageHeader';
import { Stepper, type Step } from '@/components/shared/Stepper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PersonForm } from '@/components/shared/PersonForm';
import { ZONE_COLOR_META, SECURITY_ZONES, ACCESS_POINTS, DOCUMENT_TYPES, formatBytes, genId } from '@/lib/constants';
import type { AccessRequest, AccessZoneSelection, DocumentItem, RequestType, Vehicle, Tool, ZoneColor } from '@/lib/types';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const STEPS: Step[] = [
  { id: 1, label: 'Tipo de solicitud' },
  { id: 2, label: 'Información general' },
  { id: 3, label: 'Beneficiarios' },
  { id: 4, label: 'Vehículos / Equipos' },
  { id: 5, label: 'Puntos de acceso' },
  { id: 6, label: 'Zonas de seguridad' },
  { id: 7, label: 'Documentos' },
  { id: 8, label: 'Revisión y envío' },
];

const requestTypes: { value: RequestType; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { value: 'CARNE_PERMANENTE', label: 'Carné permanente', icon: IdCard, desc: 'Carné permanente para personal' },
  { value: 'PERMISO_PERSONA', label: 'Permiso temporal para persona', icon: User, desc: 'Acceso temporal de persona' },
  { value: 'PERMISO_VEHICULO', label: 'Permiso temporal para vehículo', icon: Car, desc: 'Acceso temporal de vehículo' },
  { value: 'PERMISO_HERRAMIENTA', label: 'Permiso temporal para herramienta o equipo', icon: Wrench, desc: 'Acceso temporal de herramienta/equipo' },
];

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const companies = useSgaStore((s) => s.companies);
  const people = useSgaStore((s) => s.people);
  const signers = useSgaStore((s) => s.authorizedSigners);
  const existingDraft = useSgaStore((s) => (editId ? s.requests.find((r) => r.id === editId) ?? null : null));
  const createDraftRequest = useSgaStore((s) => s.createDraftRequest);
  const updateRequest = useSgaStore((s) => s.updateRequest);
  const submitRequest = useSgaStore((s) => s.submitRequest);
  const addPerson = useSgaStore((s) => s.addPerson);

  const [step, setStep] = useState(1);
  const [confirmExit, setConfirmExit] = useState(false);
  const [personDialogOpen, setPersonDialogOpen] = useState(false);

  // Form state
  const [type, setType] = useState<RequestType | ''>('');
  const [general, setGeneral] = useState({
    companyId: role === 'ADMIN_EMPRESA' && userData ? userData.companyId : '',
    signerId: '',
    reason: '',
    serviceCompany: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    observations: '',
  });
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [primaryPersonId, setPrimaryPersonId] = useState<string | undefined>(undefined);
  const [personExtras, setPersonExtras] = useState<Record<string, any>>({});
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [accessPoints, setAccessPoints] = useState<string[]>([]);
  const [zones, setZones] = useState<AccessZoneSelection[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [declaration, setDeclaration] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const hydrated = useRef(false);

  const isCompanyAdmin = role === 'ADMIN_EMPRESA';
  const availableSigners = signers.filter((s) => s.companyId === general.companyId && s.status === 'ACTIVE');
  const availablePeople = people.filter((p) => p.companyId === general.companyId && p.status === 'ACTIVE');

  // Hydrate from an existing draft once (edit mode)
  useEffect(() => {
    if (hydrated.current) return;
    if (!editId || !existingDraft) return;
    if (existingDraft.status !== 'BORRADOR' && existingDraft.status !== 'DEVUELTA_PARA_CORRECCION') {
      // No editable in wizard mode — redirect to detail view
      router.replace(`/requests/${existingDraft.id}`);
      return;
    }
    hydrated.current = true;
    setType(existingDraft.type);
    setGeneral({
      companyId: existingDraft.companyId,
      signerId: existingDraft.signerId ?? '',
      reason: existingDraft.reason,
      serviceCompany: existingDraft.serviceCompany ?? '',
      startDate: existingDraft.startDate,
      endDate: existingDraft.endDate,
      startTime: existingDraft.startTime,
      endTime: existingDraft.endTime,
      observations: existingDraft.observations ?? '',
    });
    setSelectedPersonIds(existingDraft.personIds);
    setPrimaryPersonId(existingDraft.primaryPersonId);
    setPersonExtras(existingDraft.personExtras ?? {});
    setVehicles(existingDraft.vehicles);
    setTools(existingDraft.tools);
    setAccessPoints(existingDraft.accessPoints);
    setZones(existingDraft.zones);
    setDocuments(existingDraft.documents);
    setDraftId(existingDraft.id);
  }, [editId, existingDraft, router]);

  // Auto-save draft
  useEffect(() => {
    if (!type) return;
    const timer = setTimeout(() => {
      if (draftId) {
        updateRequest(draftId, {
          type: type as RequestType,
          companyId: general.companyId,
          signerId: general.signerId || undefined,
          reason: general.reason,
          serviceCompany: general.serviceCompany,
          startDate: general.startDate,
          endDate: general.endDate,
          startTime: general.startTime,
          endTime: general.endTime,
          observations: general.observations,
          personIds: selectedPersonIds,
          primaryPersonId,
          vehicles,
          tools,
          accessPoints,
          zones,
          documents,
        });
      } else {
        const req = createDraftRequest({
          type: type as RequestType,
          companyId: general.companyId,
          createdBy: userData?.id ?? '',
          reason: general.reason,
          startDate: general.startDate,
          endDate: general.endDate,
          startTime: general.startTime,
          endTime: general.endTime,
          observations: general.observations,
          personIds: selectedPersonIds,
          primaryPersonId,
          vehicles,
          tools,
          accessPoints,
          zones,
          documents,
        });
        setDraftId(req.id);
      }
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, general, selectedPersonIds, primaryPersonId, vehicles, tools, accessPoints, zones, documents]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1: return !!type;
      case 2: return general.companyId && general.signerId && general.reason && general.startDate && general.endDate && general.startTime && general.endTime;
      case 3: return selectedPersonIds.length > 0;
      case 4:
        if (type === 'PERMISO_VEHICULO') return vehicles.length > 0;
        if (type === 'PERMISO_HERRAMIENTA') return tools.length > 0;
        return true;
      case 5: return accessPoints.length > 0;
      case 6: return zones.length > 0;
      case 7: return documents.length > 0;
      case 8: return declaration;
      default: return true;
    }
  }, [step, type, general, selectedPersonIds, vehicles, tools, accessPoints, zones, documents, declaration]);

  const handleNext = () => {
    if (!canProceed) {
      toast({ title: 'Complete los campos requeridos', variant: 'destructive' });
      return;
    }
    if (step < 8) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSaveDraft = () => {
    toast({ title: 'Borrador guardado', description: 'Puede continuar más tarde' });
    router.push('/requests');
  };

  const handleSubmit = () => {
    if (!draftId) return;
    if (!declaration) {
      toast({ title: 'Debe aceptar la declaración de veracidad', variant: 'destructive' });
      return;
    }
    submitRequest(draftId);
    toast({ title: 'Solicitud enviada', description: 'La solicitud ha sido registrada' });
    router.push(`/requests/${draftId}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={editId ? `Editar solicitud ${existingDraft?.number ?? ''}`.trim() : 'Nueva solicitud'}
        description={existingDraft?.status === 'DEVUELTA_PARA_CORRECCION' ? 'Corrija las observaciones y reenvíe la solicitud' : 'Creación de solicitud de carné o permiso de acceso'}
        actions={
          <Button variant="outline" onClick={() => setConfirmExit(true)}>
            <ArrowLeft className="mr-2 h-4 w-4" />Salir
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-surface p-4">
        <Stepper steps={STEPS} current={step} onStepClick={(id) => id <= step && setStep(id)} />
      </div>

      <div className="rounded-xl border border-border bg-surface p-6">
        {/* Step 1: Type */}
        {step === 1 && (
          <FormSection title="Tipo de solicitud" description="Seleccione el tipo de solicitud que desea crear">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {requestTypes.map((rt) => {
                const selected = type === rt.value;
                const Icon = rt.icon;
                return (
                  <button
                    key={rt.value}
                    onClick={() => setType(rt.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                      selected ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-border hover:border-brand-300 hover:bg-surface-muted'
                    )}
                  >
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', selected ? 'bg-brand-600 text-white' : 'bg-surface-muted text-text-muted')}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className={cn('text-sm font-medium', selected ? 'text-brand-700' : 'text-text-primary')}>{rt.label}</p>
                      <p className="text-xs text-text-muted">{rt.desc}</p>
                    </div>
                    {selected && <Check className="h-5 w-5 text-brand-600" />}
                  </button>
                );
              })}
            </div>
          </FormSection>
        )}

        {/* Step 2: General info */}
        {step === 2 && (
          <FormSection title="Información general" description="Datos de la solicitud">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Empresa solicitante" required>
                <Select value={general.companyId} onValueChange={(v) => setGeneral({ ...general, companyId: v })} disabled={isCompanyAdmin}>
                  <SelectTrigger><SelectValue placeholder="Empresa" /></SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => <SelectItem key={c.id} value={c.id}>{c.tradeName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Firmante autorizado" required>
                <Select value={general.signerId} onValueChange={(v) => setGeneral({ ...general, signerId: v })}>
                  <SelectTrigger><SelectValue placeholder="Firmante" /></SelectTrigger>
                  <SelectContent>
                    {availableSigners.map((s) => {
                      const p = people.find((x) => x.id === s.personId);
                      return <SelectItem key={s.id} value={s.id}>{p ? `${p.firstName} ${p.firstLastName}` : '—'} — {s.position}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Motivo de visita o actividad" required>
                <Input value={general.reason} onChange={(e) => setGeneral({ ...general, reason: e.target.value })} placeholder="Motivo" />
              </Field>
              <Field label="Empresa de asistencia / servicios">
                <Input value={general.serviceCompany} onChange={(e) => setGeneral({ ...general, serviceCompany: e.target.value })} placeholder="Si aplica" />
              </Field>
              <Field label="Fecha inicial" required>
                <Input type="date" value={general.startDate} onChange={(e) => setGeneral({ ...general, startDate: e.target.value })} />
              </Field>
              <Field label="Fecha final" required>
                <Input type="date" value={general.endDate} onChange={(e) => setGeneral({ ...general, endDate: e.target.value })} />
              </Field>
              <Field label="Horario desde" required>
                <Input type="time" value={general.startTime} onChange={(e) => setGeneral({ ...general, startTime: e.target.value })} />
              </Field>
              <Field label="Horario hasta" required>
                <Input type="time" value={general.endTime} onChange={(e) => setGeneral({ ...general, endTime: e.target.value })} />
              </Field>
            </div>
            <Field label="Observaciones">
              <Textarea value={general.observations} onChange={(e) => setGeneral({ ...general, observations: e.target.value })} rows={3} placeholder="Observaciones generales" />
            </Field>
          </FormSection>
        )}

        {/* Step 3: Beneficiaries */}
        {step === 3 && (
          <FormSection title="Beneficiarios" description="Seleccione las personas que serán beneficiarias del acceso">
            <div className="mb-4 flex items-center justify-between">
              <div className="relative max-w-sm flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
                <Input placeholder="Buscar por nombre o identificación…" className="pl-9" />
              </div>
              <Button variant="outline" onClick={() => setPersonDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />Crear persona
              </Button>
            </div>

            {availablePeople.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <p className="text-sm text-text-muted">No hay personas disponibles para esta empresa.</p>
                <Button className="mt-3" variant="outline" onClick={() => setPersonDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />Crear persona
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {availablePeople.map((p) => {
                  const selected = selectedPersonIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
                        selected ? 'border-brand-400 bg-brand-50' : 'border-border hover:bg-surface-muted'
                      )}
                      onClick={() => {
                        if (selected) {
                          setSelectedPersonIds(selectedPersonIds.filter((x) => x !== p.id));
                          if (primaryPersonId === p.id) setPrimaryPersonId(undefined);
                        } else {
                          setSelectedPersonIds([...selectedPersonIds, p.id]);
                          if (!primaryPersonId) setPrimaryPersonId(p.id);
                        }
                      }}
                    >
                      <input type="checkbox" checked={selected} readOnly className="h-4 w-4 rounded border-border-strong accent-brand-600" />
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {p.firstName[0]}{p.firstLastName[0]}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{p.firstName} {p.firstLastName}</p>
                        <p className="text-xs text-text-muted">{p.idNumber} · {p.position}</p>
                      </div>
                      {selected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setPrimaryPersonId(p.id); }}
                          className={cn(
                            'rounded-full border px-2 py-0.5 text-xs font-medium',
                            primaryPersonId === p.id ? 'border-brand-500 bg-brand-600 text-white' : 'border-border text-text-muted hover:bg-surface-muted'
                          )}
                        >
                          {primaryPersonId === p.id ? 'Principal' : 'Marcar principal'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Permanent card extras */}
            {type === 'CARNE_PERMANENTE' && selectedPersonIds.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-border-subtle pt-6">
                <h4 className="text-sm font-semibold text-text-primary">Información del carné permanente</h4>
                {selectedPersonIds.map((pid) => {
                  const p = people.find((x) => x.id === pid);
                  if (!p) return null;
                  const extra = personExtras[pid] ?? {};
                  return (
                    <div key={pid} className="rounded-lg border border-border p-4">
                      <p className="mb-3 text-sm font-medium text-text-primary">{p.firstName} {p.firstLastName}</p>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Departamento">
                          <Input value={extra.department ?? ''} onChange={(e) => setPersonExtras({ ...personExtras, [pid]: { ...extra, department: e.target.value } })} />
                        </Field>
                        <Field label="Cargo">
                          <Input value={extra.position ?? ''} onChange={(e) => setPersonExtras({ ...personExtras, [pid]: { ...extra, position: e.target.value } })} />
                        </Field>
                        <Field label="Años de servicio">
                          <Input type="number" value={extra.yearsOfService ?? ''} onChange={(e) => setPersonExtras({ ...personExtras, [pid]: { ...extra, yearsOfService: e.target.value } })} />
                        </Field>
                        <div className="flex items-end gap-4">
                          <label className="flex items-center gap-2 text-sm text-text-secondary">
                            <input type="checkbox" checked={extra.reusePhoto ?? false} onChange={(e) => setPersonExtras({ ...personExtras, [pid]: { ...extra, reusePhoto: e.target.checked } })} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
                            Reutilizar foto
                          </label>
                          <label className="flex items-center gap-2 text-sm text-text-secondary">
                            <input type="checkbox" checked={extra.emergencyPersonnel ?? false} onChange={(e) => setPersonExtras({ ...personExtras, [pid]: { ...extra, emergencyPersonnel: e.target.checked } })} className="h-4 w-4 rounded border-border-strong accent-brand-600" />
                            Personal de emergencia
                          </label>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </FormSection>
        )}

        {/* Step 4: Vehicles / Tools */}
        {step === 4 && (
          <FormSection title="Vehículos y equipos" description={
            type === 'PERMISO_VEHICULO' ? 'Registre los vehículos de la solicitud' :
            type === 'PERMISO_HERRAMIENTA' ? 'Registre las herramientas o equipos de la solicitud' :
            'Registre vehículos o equipos si aplica'
          }>
            {(type === 'PERMISO_VEHICULO' || type !== 'PERMISO_HERRAMIENTA') && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">Vehículos</h4>
                  <Button variant="outline" size="sm" onClick={() => setVehicles([...vehicles, { id: genId('vh'), make: '', model: '', plate: '', color: '', year: new Date().getFullYear(), description: '' }])}>
                    <Plus className="mr-1.5 h-4 w-4" />Agregar vehículo
                  </Button>
                </div>
                {vehicles.map((v, i) => (
                  <div key={v.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted">Vehículo {i + 1}</span>
                      <button onClick={() => setVehicles(vehicles.filter((x) => x.id !== v.id))} className="text-danger hover:bg-danger-soft rounded p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Marca"><Input value={v.make} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, make: e.target.value } : x))} /></Field>
                      <Field label="Modelo"><Input value={v.model} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, model: e.target.value } : x))} /></Field>
                      <Field label="Matrícula"><Input value={v.plate} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, plate: e.target.value } : x))} /></Field>
                      <Field label="Color"><Input value={v.color} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, color: e.target.value } : x))} /></Field>
                      <Field label="Año"><Input type="number" value={v.year} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, year: Number(e.target.value) } : x))} /></Field>
                      <Field label="Descripción"><Input value={v.description ?? ''} onChange={(e) => setVehicles(vehicles.map((x) => x.id === v.id ? { ...x, description: e.target.value } : x))} /></Field>
                    </div>
                  </div>
                ))}
                {vehicles.length === 0 && <p className="text-sm text-text-muted">Sin vehículos registrados.</p>}
              </div>
            )}

            {(type === 'PERMISO_HERRAMIENTA' || (type !== 'PERMISO_VEHICULO' && type !== 'PERMISO_PERSONA' && type !== 'CARNE_PERMANENTE')) && (
              <div className="space-y-4 border-t border-border-subtle pt-6">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-text-primary">Herramientas / Equipos</h4>
                  <Button variant="outline" size="sm" onClick={() => setTools([...tools, { id: genId('tl'), make: '', type: '', serialNumber: '', description: '', quantity: 1 }])}>
                    <Plus className="mr-1.5 h-4 w-4" />Agregar equipo
                  </Button>
                </div>
                {tools.map((t, i) => (
                  <div key={t.id} className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-medium text-text-muted">Equipo {i + 1}</span>
                      <button onClick={() => setTools(tools.filter((x) => x.id !== t.id))} className="text-danger hover:bg-danger-soft rounded p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Marca"><Input value={t.make} onChange={(e) => setTools(tools.map((x) => x.id === t.id ? { ...x, make: e.target.value } : x))} /></Field>
                      <Field label="Tipo"><Input value={t.type} onChange={(e) => setTools(tools.map((x) => x.id === t.id ? { ...x, type: e.target.value } : x))} /></Field>
                      <Field label="Número de serie"><Input value={t.serialNumber} onChange={(e) => setTools(tools.map((x) => x.id === t.id ? { ...x, serialNumber: e.target.value } : x))} /></Field>
                      <Field label="Cantidad"><Input type="number" min={1} value={t.quantity} onChange={(e) => setTools(tools.map((x) => x.id === t.id ? { ...x, quantity: Number(e.target.value) } : x))} /></Field>
                      <Field label="Descripción" className="sm:col-span-2 lg:col-span-3"><Input value={t.description ?? ''} onChange={(e) => setTools(tools.map((x) => x.id === t.id ? { ...x, description: e.target.value } : x))} /></Field>
                    </div>
                  </div>
                ))}
                {tools.length === 0 && <p className="text-sm text-text-muted">Sin equipos registrados.</p>}
              </div>
            )}
          </FormSection>
        )}

        {/* Step 5: Access points */}
        {step === 5 && (
          <FormSection title="Puntos de acceso" description="Seleccione los puntos de acceso autorizados">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {ACCESS_POINTS.map((ap) => {
                const selected = accessPoints.includes(ap);
                return (
                  <button
                    key={ap}
                    onClick={() => setAccessPoints(selected ? accessPoints.filter((x) => x !== ap) : [...accessPoints, ap])}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border p-3 text-left text-sm transition-colors',
                      selected ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border text-text-secondary hover:bg-surface-muted'
                    )}
                  >
                    <MapPin className={cn('h-4 w-4', selected ? 'text-brand-600' : 'text-text-muted')} />
                    <span className="flex-1">{ap}</span>
                    {selected && <Check className="h-4 w-4 text-brand-600" />}
                  </button>
                );
              })}
            </div>
          </FormSection>
        )}

        {/* Step 6: Zones */}
        {step === 6 && (
          <FormSection title="Zonas y niveles de seguridad" description="Seleccione las zonas y áreas de acceso. Agregue una justificación por cada área.">
            <div className="space-y-4">
              {SECURITY_ZONES.map((zone) => {
                const meta = ZONE_COLOR_META[zone.color];
                return (
                  <div key={zone.color} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-2.5" style={{ backgroundColor: meta.soft }}>
                      <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.hex }} />
                      <span className="text-sm font-semibold" style={{ color: meta.hex }}>Zona {meta.label}</span>
                    </div>
                    <div className="divide-y divide-border-subtle">
                      {zone.areas.map((area) => {
                        const selected = zones.find((z) => z.zoneColor === zone.color && z.areaCode === area.code);
                        return (
                          <div key={area.code} className="p-3">
                            <button
                              onClick={() => {
                                if (selected) {
                                  setZones(zones.filter((z) => !(z.zoneColor === zone.color && z.areaCode === area.code)));
                                } else {
                                  setZones([...zones, { zoneColor: zone.color, areaCode: area.code, areaName: area.name, justification: '' }]);
                                }
                              }}
                              className={cn(
                                'flex w-full items-center gap-2.5 text-left',
                                selected ? 'text-brand-700' : 'text-text-secondary'
                              )}
                            >
                              <input type="checkbox" checked={!!selected} readOnly className="h-4 w-4 rounded border-border-strong accent-brand-600" />
                              <span className="text-sm font-medium">{area.code}</span>
                              <span className="text-sm">{area.name}</span>
                            </button>
                            {selected && (
                              <Input
                                value={selected.justification}
                                onChange={(e) => setZones(zones.map((z) => z.zoneColor === zone.color && z.areaCode === area.code ? { ...z, justification: e.target.value } : z))}
                                placeholder="Justificación del acceso"
                                className="mt-2 ml-6 text-xs"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </FormSection>
        )}

        {/* Step 7: Documents */}
        {step === 7 && (
          <FormSection title="Documentos" description="Adjunte los documentos requeridos (simulado)">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {DOCUMENT_TYPES.map((docType) => {
                const doc = documents.find((d) => d.type === docType);
                return (
                  <div key={docType} className={cn('rounded-lg border-2 border-dashed p-4 text-center', doc ? 'border-success/40 bg-success-soft/30' : 'border-border hover:border-brand-300')}>
                    {doc ? (
                      <div>
                        <FileText className="mx-auto h-8 w-8 text-success" />
                        <p className="mt-2 text-sm font-medium text-text-primary">{doc.name}</p>
                        <p className="text-xs text-text-muted">{formatBytes(doc.size)} · {doc.type}</p>
                        <div className="mt-2 flex justify-center gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setDocuments(documents.map((d) => d.id === doc.id ? { ...d, name: `${docType}_reemplazo.pdf`, size: 200_000 + Math.floor(Math.random() * 100000), uploadedAt: new Date().toISOString() } : d))}>
                            Reemplazar
                          </Button>
                          <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDocuments(documents.filter((d) => d.id !== doc.id))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const newDoc: DocumentItem = {
                            id: genId('doc'),
                            name: `${docType.toLowerCase().replace(/\s+/g, '_')}.pdf`,
                            type: docType,
                            size: 200_000 + Math.floor(Math.random() * 200000),
                            uploadedAt: new Date().toISOString(),
                            status: 'PENDIENTE',
                          };
                          setDocuments([...documents, newDoc]);
                        }}
                        className="flex h-full w-full flex-col items-center justify-center"
                      >
                        <UploadCloud className="h-8 w-8 text-text-muted" />
                        <p className="mt-2 text-sm font-medium text-text-secondary">{docType}</p>
                        <p className="text-xs text-text-muted">Click para adjuntar</p>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </FormSection>
        )}

        {/* Step 8: Review & Submit */}
        {step === 8 && (
          <FormSection title="Revisión y envío" description="Revise la información antes de enviar">
            <div className="space-y-4">
              <ReviewBlock title="Tipo de solicitud">
                {requestTypes.find((rt) => rt.value === type)?.label}
              </ReviewBlock>
              <ReviewBlock title="Información general">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span><span className="text-text-muted">Empresa:</span> {companies.find((c) => c.id === general.companyId)?.tradeName}</span>
                  <span><span className="text-text-muted">Firmante:</span> {(() => {
                    const s = signers.find((x) => x.id === general.signerId);
                    const p = s ? people.find((x) => x.id === s.personId) : null;
                    return p ? `${p.firstName} ${p.firstLastName}` : '—';
                  })()}</span>
                  <span><span className="text-text-muted">Motivo:</span> {general.reason}</span>
                  <span><span className="text-text-muted">Vigencia:</span> {general.startDate} — {general.endDate}</span>
                  <span><span className="text-text-muted">Horario:</span> {general.startTime} — {general.endTime}</span>
                </div>
              </ReviewBlock>
              <ReviewBlock title="Beneficiarios">
                {selectedPersonIds.map((pid) => {
                  const p = people.find((x) => x.id === pid);
                  return p ? <div key={pid} className="text-sm">{p.firstName} {p.firstLastName} {primaryPersonId === pid && <span className="text-brand-600 font-medium">(Principal)</span>}</div> : null;
                })}
              </ReviewBlock>
              {vehicles.length > 0 && (
                <ReviewBlock title="Vehículos">
                  {vehicles.map((v) => <div key={v.id} className="text-sm">{v.make} {v.model} — {v.plate}</div>)}
                </ReviewBlock>
              )}
              {tools.length > 0 && (
                <ReviewBlock title="Equipos">
                  {tools.map((t) => <div key={t.id} className="text-sm">{t.make} {t.type} — {t.serialNumber} (x{t.quantity})</div>)}
                </ReviewBlock>
              )}
              <ReviewBlock title="Puntos de acceso">
                <div className="flex flex-wrap gap-1.5">
                  {accessPoints.map((ap) => <span key={ap} className="rounded-md border border-border bg-surface-muted px-2 py-0.5 text-xs">{ap}</span>)}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Zonas de seguridad">
                <div className="flex flex-wrap gap-1.5">
                  {zones.map((z) => {
                    const meta = ZONE_COLOR_META[z.zoneColor];
                    return <span key={`${z.zoneColor}-${z.areaCode}`} className="rounded-md border px-2 py-0.5 text-xs" style={{ backgroundColor: meta.soft, color: meta.hex, borderColor: meta.hex + '40' }}>{meta.label} - {z.areaCode}</span>;
                  })}
                </div>
              </ReviewBlock>
              <ReviewBlock title="Documentos">
                {documents.length === 0 ? <span className="text-sm text-text-muted">Sin documentos</span> : documents.map((d) => <div key={d.id} className="text-sm">{d.name} ({d.type})</div>)}
              </ReviewBlock>

              <div className="rounded-lg border border-border bg-surface-muted p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={declaration} onChange={(e) => setDeclaration(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-border-strong accent-brand-600" />
                  <span className="text-sm text-text-secondary">
                    Declaro que la información proporcionada es veraz y que los documentos adjuntos son auténticos. Acepto los términos y condiciones del proceso de solicitud de accesos.
                  </span>
                </label>
              </div>
            </div>
          </FormSection>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={step === 1 ? () => setConfirmExit(true) : handlePrev} disabled={step === 1 && false}>
          <ArrowLeft className="mr-2 h-4 w-4" />{step === 1 ? 'Salir' : 'Anterior'}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft}>
            <Save className="mr-2 h-4 w-4" />Guardar borrador
          </Button>
          {step < 8 ? (
            <Button onClick={handleNext} disabled={!canProceed}>
              Siguiente <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={!declaration}>
              <Send className="mr-2 h-4 w-4" />Enviar solicitud
            </Button>
          )}
        </div>
      </div>

      {/* Exit confirmation */}
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Abandonar la solicitud?</AlertDialogTitle>
            <AlertDialogDescription>
              Si abandona ahora, los cambios no guardados se perderán. El borrador se guarda automáticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push('/requests')}>Salir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Quick person creation dialog */}
      <Dialog open={personDialogOpen} onOpenChange={setPersonDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>Crear persona</DialogTitle>
          </DialogHeader>
          <PersonForm
            defaultValues={{ companyId: general.companyId }}
            onSubmit={(payload) => {
              const p = addPerson(payload);
              return p.id;
            }}
            onSaved={() => {
              toast({ title: 'Persona creada' });
              setPersonDialogOpen(false);
            }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPersonDialogOpen(false)}>Cancelar</Button>
            <Button type="submit" form="person-form">Guardar persona</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, required, children, className }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 flex items-center gap-1 text-sm font-medium text-text-primary">
        {label}{required && <span className="text-danger">*</span>}
      </Label>
      {children}
    </div>
  );
}

function ReviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h4>
      <div className="text-text-primary">{children}</div>
    </div>
  );
}
