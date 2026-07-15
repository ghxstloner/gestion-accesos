'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, ChartNoAxesCombined } from 'lucide-react';
import type { AccessRequest } from '@/lib/types';

const PRIMARY = 'var(--app-primary)';
const COLORS = [PRIMARY, '#16a34a', '#f59e0b', '#ef4444', '#64748b'];

export function RequestAnalytics({ requests }: { requests: AccessRequest[] }) {
  const { trend, distribution, approvalRate } = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('es-PA', { month: 'short' }).replace('.', ''), total: 0, approved: 0 };
    });
    const approvedStatuses = new Set(['APROBADA', 'EN_CONFECCION', 'LISTA_PARA_ENTREGA', 'ENTREGADA']);
    requests.forEach((request) => {
      const created = new Date(request.createdAt);
      const month = months.find((item) => item.key === `${created.getFullYear()}-${created.getMonth()}`);
      if (month) { month.total += 1; if (approvedStatuses.has(request.status)) month.approved += 1; }
    });
    const groups = [
      { name: 'Aprobadas', value: requests.filter((request) => approvedStatuses.has(request.status)).length },
      { name: 'En revisión', value: requests.filter((request) => ['EN_REVISION_DOCUMENTAL', 'DOCUMENTOS_APROBADOS', 'PENDIENTE_APROBACION'].includes(request.status)).length },
      { name: 'Borradores', value: requests.filter((request) => request.status === 'BORRADOR').length },
      { name: 'Devueltas', value: requests.filter((request) => request.status === 'DEVUELTA_PARA_CORRECCION').length },
      { name: 'Otras', value: requests.filter((request) => !approvedStatuses.has(request.status) && !['EN_REVISION_DOCUMENTAL', 'DOCUMENTOS_APROBADOS', 'PENDIENTE_APROBACION', 'BORRADOR', 'DEVUELTA_PARA_CORRECCION'].includes(request.status)).length },
    ].filter((item) => item.value > 0);
    const approved = requests.filter((request) => approvedStatuses.has(request.status)).length;
    return { trend: months, distribution: groups, approvalRate: requests.length ? Math.round((approved / requests.length) * 100) : 0 };
  }, [requests]);

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.8fr)]">
      <section className="premium-card min-w-0 rounded-2xl border border-border bg-white p-5">
        <div className="mb-5 flex items-start justify-between gap-3"><div><p className="flex items-center gap-2 text-sm font-bold text-text-primary"><ChartNoAxesCombined className="h-4 w-4 text-brand-600" />Flujo de solicitudes</p><p className="mt-1 text-xs text-text-muted">Volumen creado y aprobado durante los últimos seis meses.</p></div><span className="rounded-full bg-brand-50 px-3 py-1 text-[10px] font-bold text-brand-700">6 meses</span></div>
        <div className="h-64 min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ left: -18, right: 8, top: 8, bottom: 0 }}>
              <defs><linearGradient id="requestsGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={PRIMARY} stopOpacity={0.28} /><stop offset="100%" stopColor={PRIMARY} stopOpacity={0.02} /></linearGradient></defs>
              <CartesianGrid vertical={false} stroke="#e8eef7" strokeDasharray="4 4" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 14, border: '1px solid #dbeafe', boxShadow: '0 14px 35px rgba(30,58,138,.12)', fontSize: 12 }} />
              <Area type="monotone" dataKey="total" name="Creadas" stroke={PRIMARY} strokeWidth={2.5} fill="url(#requestsGradient)" />
              <Area type="monotone" dataKey="approved" name="Aprobadas" stroke="#16a34a" strokeWidth={2} fill="transparent" strokeDasharray="5 4" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="premium-card min-w-0 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-start justify-between"><div><p className="flex items-center gap-2 text-sm font-bold text-text-primary"><Activity className="h-4 w-4 text-brand-600" />Estado operativo</p><p className="mt-1 text-xs text-text-muted">Distribución actual del flujo.</p></div><div className="text-right"><p className="text-2xl font-extrabold text-brand-700">{approvalRate}%</p><p className="text-[10px] text-text-muted">aprobación</p></div></div>
        <div className="mt-2 h-44 min-w-0">
          {distribution.length ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={distribution} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={3} stroke="none">{distribution.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #dbeafe', fontSize: 12 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-xs text-text-muted">Sin datos todavía</div>}
        </div>
        <div className="grid grid-cols-2 gap-2">{distribution.map((item, index) => <div key={item.name} className="flex min-w-0 items-center gap-2 text-[10px] text-text-muted"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} /><span className="truncate">{item.name}</span><span className="ml-auto font-bold text-text-primary">{item.value}</span></div>)}</div>
      </section>
    </div>
  );
}
