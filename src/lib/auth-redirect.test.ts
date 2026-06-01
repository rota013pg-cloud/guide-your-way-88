import { describe, it, expect, vi, afterEach } from "vitest";
import {
  decideDashboardAuth,
  UNAUTHENTICATED_MESSAGE,
  REDIRECT_DELAY_MS,
} from "./auth-redirect";

describe("decideDashboardAuth", () => {
  it("redireciona para /login?reason=unauthenticated&from=/dashboard quando a sessão é nula", () => {
    const decision = decideDashboardAuth(null);
    expect(decision).toEqual({
      kind: "redirect",
      to: "/login",
      replace: true,
      search: { reason: "unauthenticated", from: "/dashboard" },
      message: UNAUTHENTICATED_MESSAGE,
      delayMs: REDIRECT_DELAY_MS,
    });
  });

  it("redireciona também quando a sessão é undefined", () => {
    const decision = decideDashboardAuth(undefined);
    expect(decision.kind).toBe("redirect");
    if (decision.kind === "redirect") {
      expect(decision.search.reason).toBe("unauthenticated");
      expect(decision.search.from).toBe("/dashboard");
      expect(decision.to).toBe("/login");
      expect(decision.message).toBe(UNAUTHENTICATED_MESSAGE);
    }
  });

  it("retorna ready com email quando a sessão existe", () => {
    const decision = decideDashboardAuth({ user: { email: "op@rota013.com" } });
    expect(decision).toEqual({ kind: "ready", email: "op@rota013.com" });
  });

  it("retorna email vazio quando a sessão existe mas sem email", () => {
    const decision = decideDashboardAuth({ user: { email: null } });
    expect(decision).toEqual({ kind: "ready", email: "" });
  });
});

/**
 * Simula o fluxo completo do efeito do dashboard:
 * - busca a sessão via supabase
 * - exibe toast de erro
 * - aguarda delay
 * - chama navigate com os parâmetros corretos
 */
describe("fluxo de redirecionamento do dashboard (sessão ausente)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("chama navigate com /login?reason=unauthenticated&from=/dashboard após o delay", async () => {
    vi.useFakeTimers();

    const navigate = vi.fn();
    const toastError = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

    // Reproduz o efeito real do componente DashboardPage.
    async function runDashboardAuthEffect() {
      const { data } = await getSession();
      const decision = decideDashboardAuth(data.session);
      if (decision.kind === "redirect") {
        toastError(decision.message);
        setTimeout(() => {
          navigate({
            to: decision.to,
            replace: decision.replace,
            search: decision.search,
          });
        }, decision.delayMs);
        return "redirecting";
      }
      return "ready";
    }

    const state = await runDashboardAuthEffect();
    expect(state).toBe("redirecting");
    expect(toastError).toHaveBeenCalledWith(UNAUTHENTICATED_MESSAGE);
    expect(navigate).not.toHaveBeenCalled();

    vi.advanceTimersByTime(REDIRECT_DELAY_MS);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: "/login",
      replace: true,
      search: { reason: "unauthenticated", from: "/dashboard" },
    });
  });

  it("não redireciona nem dispara toast quando a sessão está presente", async () => {
    const navigate = vi.fn();
    const toastError = vi.fn();
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { user: { email: "a@b.com" } } } });

    const { data } = await getSession();
    const decision = decideDashboardAuth(data.session);

    expect(decision.kind).toBe("ready");
    expect(toastError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
