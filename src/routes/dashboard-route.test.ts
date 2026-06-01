import { describe, it, expect } from "vitest";
import { routeTree } from "@/routeTree.gen";

/**
 * Verifica se a rota /dashboard está sendo gerada corretamente pelo
 * routeTree do TanStack Router, aninhada sob o layout _authenticated.
 */
describe("routeTree — /dashboard", () => {
  // routesById é o índice mais confiável para asserções estruturais
  const routesById = (routeTree as any).routesById as Record<string, any>;

  it("registra a rota /_authenticated/dashboard no routeTree", () => {
    expect(routesById).toBeDefined();
    expect(routesById["/_authenticated/dashboard"]).toBeDefined();
  });

  it("expõe /dashboard como fullPath público", () => {
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

  it("possui um componente lazy/configurado para a rota dashboard", () => {
    const route = routesById["/_authenticated/dashboard"];
    // O TanStack Router guarda a definição em `options` (component/lazyFn).
    const opts = route.options ?? {};
    const hasComponent =
      typeof opts.component === "function" ||
      typeof opts.lazyFn === "function" ||
      typeof route.component === "function";
    expect(hasComponent).toBe(true);
  });
});
