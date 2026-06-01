import { describe, it, expect } from "vitest";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";

/**
 * Verifica se a rota /dashboard está sendo gerada corretamente pelo
 * routeTree do TanStack Router, aninhada sob o layout _authenticated,
 * e se o router consegue resolvê-la a partir da URL pública /dashboard.
 */
describe("routeTree — /dashboard", () => {
  const router = createRouter({ routeTree });
  const routesById = router.routesById as Record<string, any>;

  it("registra a rota /_authenticated/dashboard no routeTree", () => {
    expect(routesById["/_authenticated/dashboard"]).toBeDefined();
  });

  it("expõe /dashboard como path/fullPath público", () => {
    const route = routesById["/_authenticated/dashboard"];
    expect(route.fullPath).toBe("/dashboard");
    expect(route.path).toBe("/dashboard");
  });

  it("aninha o dashboard sob o layout _authenticated", () => {
    const route = routesById["/_authenticated/dashboard"];
    expect(route.parentRoute?.id).toBe("/_authenticated");
  });

  it("layout _authenticated lista o dashboard entre seus filhos", () => {
    const layout = routesById["/_authenticated"];
    const childIds = (layout.children ?? []).map((c: any) => c.id);
    expect(childIds).toContain("/_authenticated/dashboard");
  });

  it("router consegue casar a URL /dashboard com o layout autenticado + dashboard", () => {
    const match = router.matchRoutes("/dashboard", {});
    const matchedIds = match.map((m: any) => m.routeId);
    expect(matchedIds).toContain("/_authenticated");
    expect(matchedIds).toContain("/_authenticated/dashboard");
  });

  it("possui um componente configurado para a rota dashboard", () => {
    const route = routesById["/_authenticated/dashboard"];
    const opts = route.options ?? {};
    const hasComponent =
      typeof opts.component === "function" ||
      typeof opts.lazyFn === "function" ||
      typeof route.component === "function";
    expect(hasComponent).toBe(true);
  });
});
