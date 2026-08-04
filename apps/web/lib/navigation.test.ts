import { describe, it, expect } from "vitest";
import { getNavGroups } from "@/lib/navigation";
import type { Role } from "@/lib/types";

/**
 * Authorization regression tests for navigation scoping.
 *
 * The frontend must hide global-only routes (Companies, Catalogs, Settings,
 * Issuance, Custody, Alerts, Audit) from COMPANY_ADMIN. The backend already
 * enforces scoping at the data layer, but UI hiding prevents accidental
 * access attempts and makes auth-scoping transparent to the user.
 */
function hrefs(role: Role): string[] {
  return getNavGroups(role).flatMap((g) => g.items.map((i) => i.href));
}

const GLOBAL_ONLY = [
  "/companies",
  "/catalogs",
  "/settings",
  "/issuance",
  "/custody",
  "/alerts",
  "/audit",
];

describe("navigation scoping", () => {
  it("ADMIN_GENERAL sees global routes", () => {
    const seen = hrefs("ADMIN_GENERAL");
    expect(seen).toEqual(expect.arrayContaining(GLOBAL_ONLY));
    expect(seen).toContain("/reports");
  });

  it("ADMIN_EMPRESA never sees global-only routes (server-side scope)", () => {
    const seen = hrefs("ADMIN_EMPRESA");
    for (const href of GLOBAL_ONLY) {
      expect(seen).not.toContain(href);
    }
  });

  it("ADMIN_EMPRESA sees its own operational routes", () => {
    const seen = hrefs("ADMIN_EMPRESA");
    expect(seen).toContain("/requests");
    expect(seen).toContain("/requests/new");
    expect(seen).toContain("/authorized-signers");
    expect(seen).toContain("/reports"); // scoped server-side
  });

  it("SOLICITANTE only sees requests + dashboard", () => {
    const seen = hrefs("SOLICITANTE");
    expect(seen).toEqual(
      expect.arrayContaining(["/dashboard", "/requests", "/requests/new"]),
    );
    expect(seen).not.toContain("/issuance");
    expect(seen).not.toContain("/audit");
  });

  it("EMISOR_CARNE has issuance + custody but not audit/admin", () => {
    const seen = hrefs("EMISOR_CARNE");
    expect(seen).toContain("/issuance");
    expect(seen).toContain("/custody");
    expect(seen).not.toContain("/audit");
    expect(seen).not.toContain("/companies");
    expect(seen).not.toContain("/users");
  });
});
