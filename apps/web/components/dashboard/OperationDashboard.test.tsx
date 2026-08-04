import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { UseQueryResult } from "@tanstack/react-query";
import { OperationDashboard, ScopeBadge } from "@/components/dashboard/OperationDashboard";
import type { DashboardSummaryResponse } from "@/hooks/api-hooks";

/**
 * Tests para OperationDashboard — verifica que muestra los indicadores
 * agregados del endpoint, el indicador de scope visible (GLOBAL vs COMPANY)
 * y los estados de carga/vacío/error.
 */

function withProviders(node: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return <QueryClientProvider client={qc}>{node}</QueryClientProvider>;
}

// Mock the data hook to drive deterministic scenarios.
vi.mock("@/hooks/api-hooks", async (orig) => {
  const actual = await orig<typeof import("@/hooks/api-hooks")>();
  return {
    ...actual,
    useDashboardSummaryQuery: vi.fn(),
  };
});

import { useDashboardSummaryQuery } from "@/hooks/api-hooks";
const mocked = vi.mocked(useDashboardSummaryQuery);

function setReturn(overrides: Partial<UseQueryResult<DashboardSummaryResponse>>) {
  mocked.mockReturnValue(overrides as unknown as UseQueryResult<DashboardSummaryResponse>);
}
function setSummary(
  overrides: Partial<DashboardSummaryResponse> = {},
) {
  const base: DashboardSummaryResponse = {
    pendingRequests: 3,
    pendingIssuance: 1,
    nearExpiryCredentials: 2,
    overdueCustody: 1,
    criticalAlerts: 0,
    overdueSlaTasks: 0,
    recentActivity: [],
    nearExpiryDays: 30,
    scope: "GLOBAL",
    ...overrides,
  };
  setReturn({ data: base, isLoading: false, isError: false, refetch: vi.fn() });
}

beforeEach(() => mocked.mockReset());

describe("OperationDashboard", () => {
  it("renders skeleton while loading", () => {
    setReturn({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    const { container } = render(
      withProviders(<OperationDashboard title="Dash" />),
    );
    // Skeleton is a div-based placeholder; assert at least no indicators leak.
    expect(screen.queryByText("Solicitudes pendientes")).toBeNull();
    expect(container).toBeTruthy();
  });

  it("renders all 6 indicators and GLOBAL scope badge when loaded", async () => {
    setSummary();
    render(withProviders(<OperationDashboard title="Dash" />));
    expect(screen.getByText("Solicitudes pendientes")).toBeInTheDocument();
    expect(screen.getByText("Credenciales en emisión")).toBeInTheDocument();
    expect(screen.getByText("Vencen en 30 días")).toBeInTheDocument();
    expect(screen.getByText("Custodia atrasada")).toBeInTheDocument();
    expect(screen.getByText("Tareas SLA atrasadas")).toBeInTheDocument();
    expect(screen.getByText("Alertas críticas abiertas")).toBeInTheDocument();
    expect(await screen.findByText(/Scope: Global/i)).toBeInTheDocument();
  });

  it("shows empty state when every counter is zero", () => {
    setSummary({
      pendingRequests: 0,
      pendingIssuance: 0,
      nearExpiryCredentials: 0,
      overdueCustody: 0,
      criticalAlerts: 0,
      overdueSlaTasks: 0,
    });
    render(withProviders(<OperationDashboard title="Dash" />));
    expect(screen.getByText(/Sin pendientes operativos/i)).toBeInTheDocument();
  });

  it("renders error UI with retry button when query fails", () => {
    setReturn({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    });
    render(withProviders(<OperationDashboard title="Dash" />));
    expect(screen.getByText(/No se pudo cargar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reintentar/i })).toBeInTheDocument();
  });

  it("shows company scope notice when scope is COMPANY (not GLOBAL)", async () => {
    setSummary({ scope: "COMPANY" });
    const { container } = render(
      withProviders(<OperationDashboard title="Dash" />),
    );
    await waitFor(() =>
      expect(container.textContent).toMatch(/acotados a su empresa/i),
    );
    expect(container.textContent).not.toMatch(/Scope: Global/i);
  });

  it("renders recent activity rows when activity exists", () => {
    setSummary({
      recentActivity: [
        {
          id: "1",
          actorUserId: "user-1",
          action: "request.created",
          aggregateType: "Request",
          aggregateId: "req-1",
          occurredAt: "2026-01-01T10:00:00Z",
        },
      ],
    });
    render(withProviders(<OperationDashboard title="Dash" />));
    expect(screen.getByText(/user-1/)).toBeInTheDocument();
    expect(screen.getByText(/request.created/)).toBeInTheDocument();
  });
});

describe("ScopeBadge", () => {
  it("GLOBAL -> Scope: Global", () => {
    const { container } = render(<ScopeBadge scope="GLOBAL" />);
    expect(container.textContent).toMatch(/Scope: Global/i);
  });
  it("COMPANY -> Scope: Empresa", () => {
    const { container } = render(<ScopeBadge scope="COMPANY" />);
    expect(container.textContent).toMatch(/Scope: Empresa/i);
  });
  it("OWN -> Scope: Personal", () => {
    const { container } = render(<ScopeBadge scope="OWN" />);
    expect(container.textContent).toMatch(/Scope: Personal/i);
  });
});
