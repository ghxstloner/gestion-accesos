'use client';

import { Check, LockKeyhole, Plus } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { Role } from '@/lib/types';

export const PERMISSION_CATALOG = [
  ['companies.read', 'Ver empresas'], ['companies.manage', 'Administrar empresas'],
  ['users.read', 'Ver usuarios'], ['users.manage', 'Administrar usuarios'],
  ['people.read', 'Ver personas'], ['people.manage', 'Administrar personas'],
  ['signers.read', 'Ver firmantes'], ['signers.manage', 'Administrar firmantes'],
  ['catalogs.read', 'Ver catálogos'], ['catalogs.manage', 'Administrar catálogos'],
  ['requests.create', 'Crear solicitudes'], ['requests.read.own', 'Ver solicitudes propias'],
  ['requests.read.company', 'Ver solicitudes de empresa'], ['requests.read.all', 'Ver todas las solicitudes'],
  ['requests.submit', 'Enviar solicitudes'], ['requests.review', 'Revisar solicitudes'],
  ['requests.approve', 'Aprobar solicitudes'], ['requests.reject', 'Rechazar solicitudes'],
  ['requests.return', 'Devolver solicitudes'], ['issuance.read', 'Ver emisión'],
  ['issuance.manage', 'Gestionar emisión'], ['audit.read', 'Ver auditoría'], ['settings.manage', 'Administrar configuración'],
] as const;

const ALL = PERMISSION_CATALOG.map(([code]) => code);
export const ROLE_PERMISSION_CODES: Record<Role, readonly string[]> = {
  ADMIN_GENERAL: ALL,
  ADMIN_EMPRESA: ['companies.read','users.read','users.manage','people.read','people.manage','signers.read','signers.manage','catalogs.read','requests.create','requests.read.company','requests.submit','requests.review','requests.return','issuance.read'],
  SOLICITANTE: ['companies.read','people.read','signers.read','catalogs.read','requests.create','requests.read.own','requests.submit'],
  REVISOR: ['companies.read','users.read','people.read','signers.read','catalogs.read','requests.read.all','requests.review','requests.return'],
  JEFE_DOCUMENTOS: ['companies.read','users.read','people.read','signers.read','catalogs.read','requests.read.all','requests.review','requests.approve','requests.reject','requests.return','issuance.read'],
  EMISOR_CARNE: ['companies.read','people.read','catalogs.read','issuance.read','issuance.manage','requests.read.all'],
};

export function PermissionMatrix({ role, additional, onChange }: { role: Role; additional: string[]; onChange: (permissions: string[]) => void }) {
  const inherited = new Set(ROLE_PERMISSION_CODES[role]);
  const toggle = (code: string) => onChange(additional.includes(code) ? additional.filter((item) => item !== code) : [...additional, code]);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface-muted/50">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-white px-4 py-3">
        <div><p className="text-sm font-bold text-text-primary">Permisos efectivos</p><p className="text-xs text-text-muted">Los incluidos por el rol están protegidos.</p></div>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">{inherited.size + additional.filter((p) => !inherited.has(p)).length} activos</span>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3">
        {PERMISSION_CATALOG.map(([code, label]) => {
          const locked = inherited.has(code);
          const checked = locked || additional.includes(code);
          return <label key={code} className={cn('flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2 transition', locked ? 'cursor-not-allowed border-brand-100 bg-brand-50/70' : 'cursor-pointer border-border bg-white hover:border-brand-300')}>
            <Checkbox checked={checked} disabled={locked} onCheckedChange={() => !locked && toggle(code)} />
            <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-text-primary">{label}</span><span className="block truncate text-[10px] text-text-muted">{code}</span></span>
            {locked ? <LockKeyhole className="h-3.5 w-3.5 text-brand-600" /> : checked ? <Check className="h-3.5 w-3.5 text-success" /> : <Plus className="h-3.5 w-3.5 text-text-disabled" />}
          </label>;
        })}
      </div>
    </div>
  );
}
