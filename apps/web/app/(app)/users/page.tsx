"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Pencil,
  Power,
  KeyRound,
} from "lucide-react";
import { useSgaStore, useCurrentUserData } from "@/lib/store";
import {
  useCompaniesQuery,
  useToggleUserStatusMutation,
  useUsersQuery,
} from "@/hooks/api-hooks";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/shared/LoadingSkeletons";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { EntityStatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User } from "@/lib/types";
import { ROLES, formatDate, formatDateTime } from "@/lib/constants";
import { toast } from "@/hooks/use-toast";

export default function UsersPage() {
  const userData = useCurrentUserData();
  const role = useSgaStore((s) => s.currentUser?.role);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [companyFilter, setCompanyFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const scopedCompanyId =
    role === "ADMIN_EMPRESA" ? userData?.companyId : undefined;
  const { data: allUsers = [], isLoading: usersLoading } = useUsersQuery(
    scopedCompanyId || undefined,
  );
  const { data: companies = [], isLoading: companiesLoading } =
    useCompaniesQuery();
  const toggleUserStatus = useToggleUserStatusMutation();

  // Company admins are scoped to their own company
  const isCompanyAdmin = role === "ADMIN_EMPRESA" && userData;
  const users = useMemo(
    () =>
      isCompanyAdmin
        ? allUsers.filter((u) => u.companyId === userData!.companyId)
        : allUsers,
    [allUsers, isCompanyAdmin, userData],
  );

  const companyName = (cid: string) =>
    companies.find((c) => c.id === cid)?.tradeName ?? "—";

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        !search ||
        `${u.firstName} ${u.lastName} ${u.email}`
          .toLowerCase()
          .includes(search.toLowerCase());
      const matchesCompany =
        companyFilter === "ALL" || u.companyId === companyFilter;
      const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
      const matchesStatus = statusFilter === "ALL" || u.status === statusFilter;
      return matchesSearch && matchesCompany && matchesRole && matchesStatus;
    });
  }, [users, search, companyFilter, roleFilter, statusFilter]);

  if (usersLoading || companiesLoading) {
    return <PageSkeleton variant="table" />;
  }

  const columns: Column<User>[] = [
    {
      key: "name",
      header: "Usuario",
      sortable: true,
      sortValue: (r) => `${r.firstName} ${r.lastName}`,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
            {r.firstName[0]}
            {r.lastName[0]}
          </div>
          <div>
            <p className="font-medium text-text-primary">
              {r.firstName} {r.lastName}
            </p>
            <p className="text-xs text-text-muted">{r.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: "company",
      header: "Empresa",
      sortable: true,
      sortValue: (r) => companyName(r.companyId),
      cell: (r) => (
        <span className="text-text-secondary">{companyName(r.companyId)}</span>
      ),
    },
    {
      key: "role",
      header: "Rol",
      sortable: true,
      sortValue: (r) => r.role,
      cell: (r) => (
        <span className="text-text-secondary">{ROLES[r.role].label}</span>
      ),
    },
    {
      key: "lastAccess",
      header: "Último acceso",
      sortable: true,
      sortValue: (r) => r.lastAccess ?? "",
      cell: (r) => (
        <span className="text-text-muted">{formatDateTime(r.lastAccess)}</span>
      ),
    },
    {
      key: "createdAt",
      header: "Creado",
      sortable: true,
      sortValue: (r) => r.createdAt,
      cell: (r) => (
        <span className="text-text-muted">{formatDate(r.createdAt)}</span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      sortable: true,
      sortValue: (r) => r.status,
      cell: (r) => <EntityStatusBadge status={r.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios"
        description="Administración de usuarios del sistema"
        actions={
          <Link href="/users/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Crear usuario
            </Button>
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar usuario…"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {!isCompanyAdmin && (
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-48 h-9">
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todas las empresas</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.tradeName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44 h-9">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los roles</SelectItem>
              {Object.entries(ROLES).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="ACTIVE">Activo</SelectItem>
              <SelectItem value="BLOCKED">Bloqueado</SelectItem>
              <SelectItem value="INACTIVE">Inactivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(r) => router.push(`/users/${r.id}`)}
        emptyTitle="Sin usuarios"
        rowActions={(r) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Opciones"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-muted"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`/users/${r.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalle
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/users/${r.id}?edit=1`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push(`/users/${r.id}?resetPassword=1`)}
              >
                <KeyRound className="mr-2 h-4 w-4" />
                Restablecer contraseña
              </DropdownMenuItem>
              <ConfirmDialog
                trigger={
                  <button
                    type="button"
                    className="flex w-full items-center px-2 py-1.5 text-sm text-danger hover:bg-danger-soft"
                  >
                    <Power className="mr-2 h-4 w-4" />
                    {r.status === "ACTIVE" ? "Bloquear" : "Activar"}
                  </button>
                }
                title={
                  r.status === "ACTIVE" ? "Bloquear usuario" : "Activar usuario"
                }
                description={`¿Confirmar acción sobre ${r.firstName} ${r.lastName}?`}
                destructive={r.status === "ACTIVE"}
                onConfirm={async () => {
                  await toggleUserStatus.mutateAsync({
                    id: r.id,
                    activate: r.status !== "ACTIVE",
                  });
                  toast({ title: "Estado actualizado" });
                }}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </div>
  );
}
