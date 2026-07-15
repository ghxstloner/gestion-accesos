"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clock,
  Eye,
  IdCard,
  PackageCheck,
  Play,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { EmptyState } from "@/components/shared/EmptyState";
import { RequestTypeBadge } from "@/components/shared/RequestTypeBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompaniesQuery, usePeopleQuery } from "@/hooks/api-hooks";
import {
  type CredentialResponse,
  type RequestListItem,
  useCredentialTransitionMutation,
  useCredentialsQuery,
  useDeliverCredentialMutation,
  useIssueCredentialMutation,
  useRequestsQuery,
} from "@/hooks/api-workflow-hooks";
import { toFrontendRequestType } from "@/lib/request-mapping";
import { formatDateTime } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

interface IssuanceRow {
  request: RequestListItem;
  credential?: CredentialResponse;
}

const CREDENTIAL_TYPE_BY_REQUEST: Record<string, string> = {
  PERMANENT_CARD: "PERMANENT_CARD",
  TEMPORARY_PERSON: "TEMPORARY_PERSON_PASS",
  TEMPORARY_VEHICLE: "TEMPORARY_VEHICLE_PASS",
  TEMPORARY_EQUIPMENT: "TEMPORARY_EQUIPMENT_PASS",
};

export default function IssuancePage() {
  const router = useRouter();
  const { data: requestPage, isLoading: requestsLoading } = useRequestsQuery({
    pageSize: 200,
  });
  const { data: credentialPage, isLoading: credentialsLoading } =
    useCredentialsQuery();
  const { data: companies = [] } = useCompaniesQuery();
  const { data: people = [] } = usePeopleQuery();
  const issueCredential = useIssueCredentialMutation();
  const deliverCredential = useDeliverCredentialMutation();
  const [delivery, setDelivery] = useState<IssuanceRow | null>(null);
  const [deliveryForm, setDeliveryForm] = useState({
    name: "",
    identification: "",
    observations: "",
  });

  const rows = useMemo(() => {
    const requests = requestPage?.items ?? [];
    const credentials = credentialPage?.items ?? [];
    return requests
      .filter(
        (request) =>
          request.status === "APPROVED" ||
          credentials.some((credential) => credential.requestId === request.id),
      )
      .map((request) => ({
        request,
        credential: credentials.find(
          (credential) => credential.requestId === request.id,
        ),
      }));
  }, [credentialPage, requestPage]);

  const pending = rows.filter(
    (row) => !row.credential || row.credential.status === "PENDING_PRODUCTION",
  );
  const production = rows.filter(
    (row) => row.credential?.status === "IN_PRODUCTION",
  );
  const ready = rows.filter(
    (row) => row.credential?.status === "READY_FOR_DELIVERY",
  );
  const delivered = rows.filter(
    (row) => row.credential?.status === "DELIVERED",
  );

  if (requestsLoading || credentialsLoading) {
    return <PageSkeleton variant="table" />;
  }

  const handleIssue = (row: IssuanceRow) => {
    const requestType = row.request.requestTypeCode ?? "";
    issueCredential.mutate(
      {
        requestId: row.request.id,
        credentialType: CREDENTIAL_TYPE_BY_REQUEST[requestType],
        personId: row.request.primaryPersonId,
        expiresAt: row.request.validUntil,
      },
      { onSuccess: () => toast({ title: "Credencial creada" }) },
    );
  };

  const handleDelivery = () => {
    if (
      !delivery?.credential ||
      !deliveryForm.name.trim() ||
      !deliveryForm.identification.trim()
    ) {
      toast({
        title: "Nombre e identificación son obligatorios",
        variant: "destructive",
      });
      return;
    }
    deliverCredential.mutate(
      {
        id: delivery.credential.id,
        receivedByName: deliveryForm.name.trim(),
        receivedByIdentification: deliveryForm.identification.trim(),
        observations: deliveryForm.observations.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast({ title: "Entrega registrada" });
          setDelivery(null);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Emisión de credenciales"
        description="Confección y entrega de solicitudes aprobadas"
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric label="Pendientes" value={pending.length} icon={Clock} />
        <Metric label="En confección" value={production.length} icon={IdCard} />
        <Metric
          label="Listas para entrega"
          value={ready.length}
          icon={PackageCheck}
        />
        <Metric label="Entregadas" value={delivered.length} icon={Check} />
      </div>
      <Tabs defaultValue="pending">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="pending">
            Pendientes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="production">
            En confección ({production.length})
          </TabsTrigger>
          <TabsTrigger value="ready">Listas ({ready.length})</TabsTrigger>
          <TabsTrigger value="delivered">
            Entregadas ({delivered.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pending">
          <IssuanceRows
            rows={pending}
            companies={companies}
            people={people}
            empty="Sin solicitudes pendientes"
            onView={(id) => router.push(`/requests/${id}`)}
            action={(row) =>
              row.credential ? (
                <CredentialTransition
                  credential={row.credential}
                  transition="start_production"
                  label="Iniciar confección"
                  icon={Play}
                />
              ) : (
                <Button size="sm" onClick={() => handleIssue(row)}>
                  <IdCard className="mr-2 h-4 w-4" />
                  Crear credencial
                </Button>
              )
            }
          />
        </TabsContent>
        <TabsContent value="production">
          <IssuanceRows
            rows={production}
            companies={companies}
            people={people}
            empty="Sin credenciales en confección"
            onView={(id) => router.push(`/requests/${id}`)}
            action={(row) =>
              row.credential && (
                <CredentialTransition
                  credential={row.credential}
                  transition="mark_ready"
                  label="Marcar lista"
                  icon={Check}
                />
              )
            }
          />
        </TabsContent>
        <TabsContent value="ready">
          <IssuanceRows
            rows={ready}
            companies={companies}
            people={people}
            empty="Sin credenciales listas"
            onView={(id) => router.push(`/requests/${id}`)}
            action={(row) => (
              <Button
                size="sm"
                onClick={() => {
                  setDeliveryForm({
                    name: "",
                    identification: "",
                    observations: "",
                  });
                  setDelivery(row);
                }}
              >
                <Send className="mr-2 h-4 w-4" />
                Registrar entrega
              </Button>
            )}
          />
        </TabsContent>
        <TabsContent value="delivered">
          <IssuanceRows
            rows={delivered}
            companies={companies}
            people={people}
            empty="Sin credenciales entregadas"
            onView={(id) => router.push(`/requests/${id}`)}
          />
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(delivery)}
        onOpenChange={(open) => !open && setDelivery(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre de quien recibe</Label>
              <Input
                value={deliveryForm.name}
                onChange={(event) =>
                  setDeliveryForm((value) => ({
                    ...value,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Identificación</Label>
              <Input
                value={deliveryForm.identification}
                onChange={(event) =>
                  setDeliveryForm((value) => ({
                    ...value,
                    identification: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea
                value={deliveryForm.observations}
                onChange={(event) =>
                  setDeliveryForm((value) => ({
                    ...value,
                    observations: event.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelivery(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDelivery}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CredentialTransition({
  credential,
  transition,
  label,
  icon: Icon,
}: {
  credential: CredentialResponse;
  transition: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const mutation = useCredentialTransitionMutation(credential.id);
  return (
    <Button
      size="sm"
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(
          { transition },
          { onSuccess: () => toast({ title: label }) },
        )
      }
    >
      <Icon className="mr-2 h-4 w-4" />
      {label}
    </Button>
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

function IssuanceRows({
  rows,
  companies,
  people,
  empty,
  onView,
  action,
}: {
  rows: IssuanceRow[];
  companies: { id: string; tradeName: string }[];
  people: { id: string; firstName: string; firstLastName: string }[];
  empty: string;
  onView: (id: string) => void;
  action?: (row: IssuanceRow) => React.ReactNode;
}) {
  if (!rows.length)
    return (
      <div className="mt-4">
        <EmptyState icon={IdCard} title={empty} />
      </div>
    );
  return (
    <div className="mt-4 space-y-2">
      {rows.map((row) => {
        const company = companies.find(
          (item) => item.id === row.request.companyId,
        );
        const person = people.find(
          (item) => item.id === row.request.primaryPersonId,
        );
        return (
          <div
            key={row.request.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center"
          >
            <RequestTypeBadge
              type={toFrontendRequestType(row.request.requestTypeCode)}
            />
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {row.request.requestNumber ?? "Borrador"}
              </p>
              <p className="truncate text-xs text-text-muted">
                {company?.tradeName ?? "—"} ·{" "}
                {person ? `${person.firstName} ${person.firstLastName}` : "—"}
              </p>
              {row.credential && (
                <p className="mt-1 text-xs text-text-muted">
                  {row.credential.credentialNumber} ·{" "}
                  {formatDateTime(row.credential.updatedAt)}
                </p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onView(row.request.id)}
            >
              <Eye className="mr-2 h-4 w-4" />
              Ver
            </Button>
            {action?.(row)}
          </div>
        );
      })}
    </div>
  );
}
