import type { Notification, ActivityEvent } from '@/lib/types';

export const mockNotifications: Notification[] = [
  {
    id: 'nt_1',
    title: 'Nueva solicitud recibida',
    message: 'SGA-2026-000118 — Copa Airlines envió una solicitud de carné permanente.',
    type: 'info',
    read: false,
    createdAt: '2026-07-12T14:10:00Z',
  },
  {
    id: 'nt_2',
    title: 'Documentos aprobados',
    message: 'SGA-2026-000112 — Los documentos fueron aprobados por el revisor.',
    type: 'success',
    read: false,
    createdAt: '2026-07-12T11:30:00Z',
  },
  {
    id: 'nt_3',
    title: 'Solicitud devuelta',
    message: 'SGA-2026-000104 — Se requiere corregir la fotografía del beneficiario.',
    type: 'warning',
    read: true,
    createdAt: '2026-07-11T16:45:00Z',
  },
  {
    id: 'nt_4',
    title: 'Carné entregado',
    message: 'SGA-2026-000098 — El carné fue entregado a Carlos Vargas.',
    type: 'success',
    read: true,
    createdAt: '2026-07-10T10:00:00Z',
  },
];

export const mockActivity: ActivityEvent[] = [
  {
    id: 'ac_1',
    action: 'Creó empresa',
    entity: 'Company',
    entityId: 'co_mcd',
    actor: 'Roberto Méndez',
    timestamp: '2026-07-10T09:30:00Z',
  },
  {
    id: 'ac_2',
    action: 'Aprobó solicitud',
    entity: 'Request',
    entityId: 'rq_112',
    actor: 'Daniela Cruz',
    timestamp: '2026-07-12T11:30:00Z',
  },
  {
    id: 'ac_3',
    action: 'Registró persona',
    entity: 'Person',
    entityId: 'pe_008',
    actor: 'Roberto Méndez',
    timestamp: '2026-07-11T15:20:00Z',
  },
  {
    id: 'ac_4',
    action: 'Envió solicitud',
    entity: 'Request',
    entityId: 'rq_118',
    actor: 'Andrés Pino',
    timestamp: '2026-07-12T14:10:00Z',
  },
  {
    id: 'ac_5',
    action: 'Inició confección',
    entity: 'Request',
    entityId: 'rq_099',
    actor: 'Patricia Salas',
    timestamp: '2026-07-11T08:15:00Z',
  },
];
