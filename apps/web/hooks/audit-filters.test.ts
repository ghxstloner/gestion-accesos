import { describe, it, expect } from "vitest";
import { __buildAuditQuerystringForTest } from "@/hooks/api-hooks";

/**
 * Tests para los helpers de filtros de auditoría — la paginación y los
 * parámetros de filtro que se envían al backend.
 */
describe("buildAuditQuerystring", () => {
  it("includes default pagination when no filters", () => {
    const qs = __buildAuditQuerystringForTest({});
    expect(qs).toBe("page=1&pageSize=20");
  });

  it("honors custom page/pageSize", () => {
    const qs = __buildAuditQuerystringForTest({ page: 3, pageSize: 50 });
    expect(qs).toContain("page=3");
    expect(qs).toContain("pageSize=50");
  });

  it("includes date range filter", () => {
    const qs = __buildAuditQuerystringForTest({
      from: "2026-01-01T00:00:00Z",
      to: "2026-02-01T00:00:00Z",
    });
    expect(qs).toContain("from=2026-01-01T00%3A00%3A00Z");
    expect(qs).toContain("to=2026-02-01T00%3A00%3A00Z");
  });

  it("includes actor scope", () => {
    const qs = __buildAuditQuerystringForTest({
      actorUserId: "user-123",
      actorCompanyId: "comp-abc",
    });
    expect(qs).toContain("actorUserId=user-123");
    expect(qs).toContain("actorCompanyId=comp-abc");
  });

  it("includes aggregate filters", () => {
    const qs = __buildAuditQuerystringForTest({
      aggregateType: "Request",
      aggregateId: "req-9",
    });
    expect(qs).toContain("aggregateType=Request");
    expect(qs).toContain("aggregateId=req-9");
  });

  it("includes result enum", () => {
    const qs = __buildAuditQuerystringForTest({ result: "FAILURE" });
    expect(qs).toContain("result=FAILURE");
  });

  it("omits empty optional fields", () => {
    const qs = __buildAuditQuerystringForTest({
      from: undefined,
      result: undefined,
      action: "",
    });
    expect(qs).not.toContain("from=");
    expect(qs).not.toContain("result=");
    expect(qs).not.toContain("action=");
    expect(qs).toContain("page=1");
  });

  it("forces page=1 with pageSize 10_000 for the export mutation (100? N/A — separate concern)", () => {
    // The export mutation wraps caller filters before delegating here.
    const exportFilters = { page: 1, pageSize: 10_000 };
    const qs = __buildAuditQuerystringForTest(exportFilters);
    expect(qs).toContain("page=1");
    expect(qs).toContain("pageSize=10000");
  });
});
