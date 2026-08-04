import { describe, it, expect, vi } from "vitest";
import { downloadAuditCsv } from "@/hooks/api-hooks";

/**
 * Tests para el helper `downloadAuditCsv` — verifica URL, Bearer header
 * asociado al token y propagación de errores HTTP/SMTP al invocador.
 */
describe("downloadAuditCsv", () => {
  function fakeFetch(body: unknown, status = 200): typeof fetch {
    return vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      blob: async () => body,
    })) as unknown as typeof fetch;
  }

  it("hits the export endpoint with the querystring token", async () => {
    const f = fakeFetch(new Blob(["x"]));
    await downloadAuditCsv("page=1&pageSize=10000", {
      fetchImpl: f,
      baseUrl: "http://api.test/api/v1",
      token: "tok-abc",
    });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://api.test/api/v1/audit/export?page=1&pageSize=10000",
    );
    const auth = (init.headers as Headers).get("Authorization");
    expect(auth).toBe("Bearer tok-abc");
  });

  it("omits Authorization when there is no token", async () => {
    const f = fakeFetch(new Blob(["x"]));
    await downloadAuditCsv("", {
      fetchImpl: f,
      baseUrl: "http://api.test/api/v1",
      token: null,
    });
    const init = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect((init.headers as Headers).get("Authorization")).toBeNull();
  });

  it("throws on non-2xx response", async () => {
    const f = fakeFetch(new Blob(["x"]), 403);
    await expect(
      downloadAuditCsv("", {
        fetchImpl: f,
        baseUrl: "http://api.test/api/v1",
        token: "tok",
      }),
    ).rejects.toThrow("API 403");
  });

  it("invokes the trigger callback with the filename on success", async () => {
    const trigger = vi.fn();
    const f = fakeFetch(new Blob(["x"]));
    await downloadAuditCsv("page=1", {
      fetchImpl: f,
      baseUrl: "http://api.test/api/v1",
      token: null,
      trigger,
    });
    expect(trigger).toHaveBeenCalledTimes(1);
    const [, filename] = trigger.mock.calls[0];
    expect(filename).toMatch(/^audit-\d{4}-\d{2}-\d{2}T.*\.csv$/);
  });
});
