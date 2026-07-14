'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Save, Power, Pencil, Mail, Phone, Building2, MapPin, IdCard, Calendar, User } from 'lucide-react';
import { useSgaStore, useCurrentUserData } from '@/lib/store';
import { PageHeader, DetailSection } from '@/components/shared/PageHeader';
import { EntityStatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { PersonForm } from '@/components/shared/PersonForm';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { formatDate, calcAge, ID_TYPES, GENDERS, CIVIL_STATUSES } from '@/lib/constants';
import type { Person } from '@/lib/types';

export default function PersonDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const person = useSgaStore((s) => s.people.find((p) => p.id === id));
  const companies = useSgaStore((s) => s.companies);
  const requests = useSgaStore((s) => s.requests.filter((r) => r.personIds.includes(id)));
  const updatePerson = useSgaStore((s) => s.updatePerson);
  const togglePersonStatus = useSgaStore((s) => s.togglePersonStatus);
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const [editing, setEditing] = useState(false);

  // Company admins can only view/edit people of their own company
  const isCompanyAdminScoped = role === 'ADMIN_EMPRESA' && (!userData || person?.companyId !== userData.companyId);
  if (isCompanyAdminScoped) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/people')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">No tiene permiso para ver esta persona.</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => router.push('/people')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
        <p className="text-sm text-text-muted">Persona no encontrada.</p>
      </div>
    );
  }

  const company = companies.find((c) => c.id === person.companyId);
  const age = calcAge(person.birthDate);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${person.firstName} ${person.firstLastName}`}
        description={`${person.idNumber} · ${person.position}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.push('/people')}><ArrowLeft className="mr-2 h-4 w-4" />Volver</Button>
            <Button variant="outline" onClick={() => setEditing((e) => !e)}>
              {editing ? <><Save className="mr-2 h-4 w-4" />Guardar</> : <><Pencil className="mr-2 h-4 w-4" />Editar</>}
            </Button>
            <ConfirmDialog
              trigger={<Button variant="outline"><Power className="mr-2 h-4 w-4" />{person.status === 'ACTIVE' ? 'Desactivar' : 'Activar'}</Button>}
              title={person.status === 'ACTIVE' ? 'Desactivar persona' : 'Activar persona'}
              description={`¿Confirmar acción sobre ${person.firstName} ${person.firstLastName}?`}
              destructive={person.status === 'ACTIVE'}
              onConfirm={() => { togglePersonStatus(id); toast({ title: 'Estado actualizado' }); }}
            />
          </div>
        }
      />

      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">
          {person.firstName[0]}{person.firstLastName[0]}
        </div>
        <div>
          <EntityStatusBadge status={person.status} />
          <p className="mt-1 text-xs text-text-muted">Registrado el {formatDate(person.createdAt)}</p>
        </div>
      </div>

      {editing ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <PersonForm
            defaultValues={person}
            onSubmit={(payload) => {
              updatePerson(id, payload);
              return id;
            }}
            onSaved={() => {
              setEditing(false);
              toast({ title: 'Persona actualizada' });
            }}
          />
          <div className="mt-6 flex justify-end gap-2 border-t border-border-subtle pt-4">
            <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
            <Button type="submit" form="person-form"><Save className="mr-2 h-4 w-4" />Guardar</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <DetailSection title="Información personal" className="lg:col-span-2">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <InfoItem icon={User} label="Nombre completo" value={`${person.firstName} ${person.middleName ?? ''} ${person.firstLastName} ${person.secondLastName ?? ''}`.trim()} />
              <InfoItem icon={IdCard} label="Identificación" value={`${ID_TYPES.find((t) => t.value === person.idType)?.label}: ${person.idNumber}`} />
              <InfoItem icon={IdCard} label="Seguro social" value={person.socialSecurityNumber || '—'} />
              <InfoItem icon={Calendar} label="Fecha de nacimiento" value={`${formatDate(person.birthDate)} (${age} años)`} />
              <InfoItem icon={User} label="Género" value={GENDERS.find((g) => g.value === person.gender)?.label ?? '—'} />
              <InfoItem icon={User} label="Estado civil" value={CIVIL_STATUSES.find((c) => c.value === person.civilStatus)?.label ?? '—'} />
              <InfoItem icon={User} label="Nacionalidad" value={person.nationality} />
              <InfoItem icon={User} label="Tipo de sangre" value={person.bloodType ?? '—'} />
              <InfoItem icon={User} label="Padecimiento físico" value={person.physicalAilment ?? '—'} />
            </dl>
          </DetailSection>

          <div className="space-y-6">
            <DetailSection title="Contacto">
              <dl className="space-y-4">
                <InfoItem icon={Mail} label="Correo" value={person.email} />
                <InfoItem icon={Phone} label="Teléfono" value={person.phone || '—'} />
                <InfoItem icon={Phone} label="Celular" value={person.mobile} />
                <InfoItem icon={MapPin} label="Dirección" value={person.address} />
              </dl>
            </DetailSection>

            <DetailSection title="Información laboral">
              <dl className="space-y-4">
                <InfoItem icon={Building2} label="Empresa" value={company?.tradeName ?? '—'} />
                <InfoItem icon={Building2} label="Departamento" value={person.department} />
                <InfoItem icon={Building2} label="Cargo" value={person.position} />
                <InfoItem icon={Calendar} label="Años de servicio" value={`${person.yearsOfService}`} />
                <InfoItem icon={User} label="Trabajó antes en aeropuerto" value={person.workedAtAirportBefore ? 'Sí' : 'No'} />
                <InfoItem icon={Building2} label="Empresa anterior" value={person.previousCompany ?? '—'} />
                <InfoItem icon={IdCard} label="Tuvo carné anterior" value={person.hadPreviousCard ? 'Sí' : 'No'} />
                <InfoItem icon={IdCard} label="Reutiliza fotografía" value={person.reusePhoto ? 'Sí' : 'No'} />
              </dl>
            </DetailSection>
          </div>
        </div>
      )}

      {!editing && (
        <DetailSection title="Solicitudes relacionadas">
          {requests.length === 0 ? (
            <p className="text-sm text-text-muted">Sin solicitudes relacionadas.</p>
          ) : (
            <div className="space-y-1">
              {requests.map((r) => (
                <button key={r.id} onClick={() => router.push(`/requests/${r.id}`)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-surface-muted">
                  <span className="text-sm font-medium text-text-primary">{r.number}</span>
                  <span className="flex-1 truncate text-xs text-text-muted">{r.reason}</span>
                  <span className="text-xs text-text-muted">{formatDate(r.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </DetailSection>
      )}
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium text-text-muted"><Icon className="h-3.5 w-3.5" />{label}</dt>
      <dd className="mt-1 text-sm text-text-primary">{value}</dd>
    </div>
  );
}
