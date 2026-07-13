import type { Role } from '@/lib/types';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  FileCheck2,
  ClipboardList,
  IdCard,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const allGroups: Record<Role, NavGroup[]> = {
  ADMIN_GENERAL: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Administración',
      items: [
        { label: 'Empresas', href: '/companies', icon: Building2 },
        { label: 'Usuarios', href: '/users', icon: Users },
        { label: 'Personas', href: '/people', icon: UserCog },
        { label: 'Firmantes autorizados', href: '/authorized-signers', icon: ShieldCheck },
        { label: 'Catálogos', href: '/catalogs', icon: Settings },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
        { label: 'Bandeja de revisión', href: '/reviews', icon: FileCheck2 },
        { label: 'Emisión de carnés', href: '/issuance', icon: IdCard },
      ],
    },
  ],
  ADMIN_EMPRESA: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Gestión',
      items: [
        { label: 'Personas', href: '/people', icon: UserCog },
        { label: 'Firmantes autorizados', href: '/authorized-signers', icon: ShieldCheck },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
        { label: 'Nueva solicitud', href: '/requests/new', icon: ClipboardList },
      ],
    },
  ],
  SOLICITANTE: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Mis solicitudes', href: '/requests', icon: ClipboardList },
        { label: 'Nueva solicitud', href: '/requests/new', icon: ClipboardList },
      ],
    },
  ],
  REVISOR: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Bandeja de revisión', href: '/reviews', icon: FileCheck2 },
        { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
      ],
    },
  ],
  JEFE_DOCUMENTOS: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Bandeja de revisión', href: '/reviews', icon: FileCheck2 },
        { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
        { label: 'Emisión de carnés', href: '/issuance', icon: IdCard },
      ],
    },
  ],
  EMISOR_CARNE: [
    {
      label: 'General',
      items: [
        { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      ],
    },
    {
      label: 'Operación',
      items: [
        { label: 'Emisión de carnés', href: '/issuance', icon: IdCard },
        { label: 'Solicitudes', href: '/requests', icon: ClipboardList },
      ],
    },
  ],
};

export function getNavGroups(role: Role): NavGroup[] {
  return allGroups[role] ?? allGroups.ADMIN_GENERAL;
}
