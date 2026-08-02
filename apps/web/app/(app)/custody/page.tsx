'use client';

import { useState } from 'react';
import {
  Archive,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Inbox,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageSkeleton } from '@/components/shared/LoadingSkeletons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  type CustodyResponse,
  useCustodyListQuery,
  useReturnCustodyMutation,
} from '@/hooks/api-workflow-hooks';
import { formatDateTime } from '@/lib/constants';

export default function CustodyPage() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'RETURNED' | 'OVERDUE'>(
    'ACTIVE',
  );
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCustodyListQuery({
    status: activeTab,
    search: search || undefined,
  });

  if (isLoading) return <PageSkeleton variant="table" />;

  const records = data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Custodia temporal"
        description="Documentos de identidad recibidos en custodia durante la emisión de carnés temporales"
      />

      <CustodyMetrics records={records} />

      <Input
        placeholder="Buscar por titular, documento o permiso temporal..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-md"
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as typeof activeTab)}
      >
        <TabsList>
          <TabsTrigger value="ACTIVE">
            Activos
          </TabsTrigger>
          <TabsTrigger value="OVERDUE">Vencidos</TabsTrigger>
          <TabsTrigger value="RETURNED">Devueltos</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <CustodyList records={records} activeStatus={activeTab} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CustodyMetrics({ records }: { records: CustodyResponse[] }) {
  // Compute counts across all tabs by re-fetching under each status. For
  // simplicity we only show counts for the current tab plus the global total.
  const active = records.filter((r) => r.status === 'ACTIVE').length;
  const overdue = records.filter((r) => r.status === 'OVERDUE').length;
  const returned = records.filter((r) => r.status === 'RETURNED').length;
  const total = active + overdue + returned;
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Metric label="Total" value={total} icon={Archive} />
      <Metric label="Activos" value={active} icon={Clock} />
      <Metric label="Vencidos" value={overdue} icon={AlertTriangle} />
      <Metric label="Devueltos" value={returned} icon={CheckCircle2} />
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">{label}</span>
        <Icon className="h-4 w-4 text-brand-600" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function CustodyList({
  records,
  activeStatus,
}: {
  records: CustodyResponse[];
  activeStatus: 'ACTIVE' | 'OVERDUE' | 'RETURNED';
}) {
  if (!records.length) {
    return (
      <div className="mt-4">
        <EmptyState
          icon={Inbox}
          title={
            activeStatus === 'ACTIVE'
              ? 'Sin custodia activa'
              : activeStatus === 'OVERDUE'
                ? 'Sin custodia vencida'
                : 'Sin devoluciones registradas'
          }
        />
      </div>
    );
  }
  return (
    <div className="mt-4 space-y-2">
      {records.map((record) => (
        <CustodyRow key={record.id} record={record} />
      ))}
    </div>
  );
}

function CustodyRow({ record }: { record: CustodyResponse }) {
  const [returnOpen, setReturnOpen] = useState(false);
  const depositOpen = !record.returnTime && record.status !== 'ACTIVE';
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-medium">
              {record.holderName ?? 'Titular sin nombre'}
            </p>
            <StatusBadge status={record.status} />
          </div>
          <p className="text-xs text-text-muted">
            Documento: {record.documentType} ·{' '}
            <code>{record.documentIdentifier}</code>
            {record.temporaryPermitRef && (
              <> · Permiso temporal: <code>{record.temporaryPermitRef}</code></>
            )}
          </p>
          <p className="text-xs text-text-muted">
            Recibido {formatDateTime(record.depositTime)}
            {record.expectedReturnAt && (
              <>
                {' '}· Devolución esperada:{' '}
                {formatDateTime(record.expectedReturnAt)}
              </>
            )}
          </p>
          {record.depositNotes && (
            <p className="text-xs">Notas: {record.depositNotes}</p>
          )}
        </div>
        <div className="flex gap-2">
          {!record.returnTime && (
            <Button size="sm" onClick={() => setReturnOpen(true)}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Registrar devolución
            </Button>
          )}
        </div>
      </div>
      <ReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        custodyId={record.id}
      />
      {depositOpen && (
        <p className="mt-2 text-xs text-amber-600">
          Esta custodia figura activa sin fecha de devolución esperada.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: CustodyResponse['status'] }) {
  const styles: Record<CustodyResponse['status'], string> = {
    ACTIVE: 'bg-blue-50 text-blue-700',
    OVERDUE: 'bg-amber-50 text-amber-700',
    RETURNED: 'bg-emerald-50 text-emerald-700',
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function ReturnDialog({
  open,
  onOpenChange,
  custodyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  custodyId: string;
}) {
  const returnMutation = useReturnCustodyMutation();
  const [form, setForm] = useState({
    returnReceivedBy: '',
    returnCondition: '',
    notes: '',
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar devolución</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Entregado a (nombre) *</Label>
            <Input
              value={form.returnReceivedBy}
              onChange={(e) =>
                setForm((v) => ({ ...v, returnReceivedBy: e.target.value }))
              }
            />
          </div>
          <div>
            <Label>Estado del documento</Label>
            <Textarea
              value={form.returnCondition}
              onChange={(e) =>
                setForm((v) => ({ ...v, returnCondition: e.target.value }))
              }
              placeholder="En buen estado, con manchas, deteriorado..."
            />
          </div>
          <div>
            <Label>Notas</Label>
            <Textarea
              value={form.notes}
              onChange={(e) =>
                setForm((v) => ({ ...v, notes: e.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!form.returnReceivedBy.trim() || returnMutation.isPending}
            onClick={async () => {
              try {
                await returnMutation.mutateAsync({
                  custodyId,
                  returnReceivedBy: form.returnReceivedBy.trim(),
                  returnCondition: form.returnCondition.trim() || null,
                  notes: form.notes.trim() || null,
                });
                toast({ title: 'Devolución registrada' });
                onOpenChange(false);
                setForm({ returnReceivedBy: '', returnCondition: '', notes: '' });
              } catch (err) {
                toast({
                  title: 'Error',
                  description:
                    err instanceof Error ? err.message : undefined,
                  variant: 'destructive',
                });
              }
            }}
          >
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
