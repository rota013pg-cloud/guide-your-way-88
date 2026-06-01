import { describe, it, expect } from "vitest";
import { z } from "zod";
import { fallback } from "@tanstack/zod-adapter";

const loginSearchSchema = z.object({
  reason: fallback(
    z.enum(["unauthenticated", "expired", "session_error", "timeout"]).optional(),
    "unauthenticated",
  ),
  from: fallback(z.string().max(500).optional(), "/dashboard"),
});

type LoginSearch = z.infer<typeof loginSearchSchema>;

describe("login search params sanitização", () => {
  it("reason ausente permanece undefined", () => {
    const result = loginSearchSchema.parse({});
    expect(result.reason).toBeUndefined();
    expect(result.from).toBeUndefined();
  });

  it("reason válido é preservado", () => {
    const result = loginSearchSchema.parse({ reason: "timeout" });
    expect(result.reason).toBe("timeout");
  });

  it("reason inválido cai em 'unauthenticated' com fallback", () => {
    const result = loginSearchSchema.parse({ reason: "hacked" });
    expect(result.reason).toBe("unauthenticated");
  });

  it("from válido é preservado", () => {
    const result = loginSearchSchema.parse({ from: "/dashboard/settings" });
    expect(result.from).toBe("/dashboard/settings");
  });

  it("from inválido (não-string) cai em '/dashboard'", () => {
    const result = loginSearchSchema.parse({ from: 12345 });
    expect(result.from).toBe("/dashboard");
  });

  it("from muito longo é truncado pelo max(500)", () => {
    const long = "a".repeat(501);
    // z.string().max(500) falha, então fallback entra
    const result = loginSearchSchema.parse({ from: long });
    expect(result.from).toBe("/dashboard");
  });

  it("reason array inválido cai em 'unauthenticated'", () => {
    const result = loginSearchSchema.parse({ reason: ["unauthenticated"] });
    expect(result.reason).toBe("unauthenticated");
  });

  it("ambos presentes e válidos são preservados", () => {
    const result = loginSearchSchema.parse({ reason: "expired", from: "/dashboard/profile" });
    expect(result.reason).toBe("expired");
    expect(result.from).toBe("/dashboard/profile");
  });
});
