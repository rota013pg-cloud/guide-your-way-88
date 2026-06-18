import { describe, it, expect, vi, afterEach } from "vitest";
import {
  decideDashboardAuth,
  decideDashboardAuthError,
  withSessionTimeout,
  AUTH_MESSAGES,
  UNAUTHENTICATED_MESSAGE,
  REDIRECT_DELAY_MS,
} from "./auth-redirect";

describe("decideDashboardAuth", () => {
  it("redireciona para /login?reason=unauthenticated&from=/dashboard quando a sessão é nula", () => {
    expect(decideDashboardAuth(null)).toEqual({
      kind: "redirect",
      to: "/operador/login",
      replace: true,
      search: { reason: "unauthenticated", from: "/dashboard" },
      message: UNAUTHENTICATED_MESSAGE,
      delayMs: REDIRECT_DELAY_MS,
    });
  });

  it("redireciona também quando a sessão é undefined", () => {
    const d = decideDashboardAuth(undefined);
    expect(d.kind).toBe("redirect");
    if (d.kind === "redirect") expect(d.search.reason).toBe("unauthenticated");
  });

  it("retorna ready com email quando a sessão existe", () => {
    expect(decideDashboardAuth({ user: { email: "op@rota013.com" } })).toEqual({
      kind: "ready",
      email: "op@rota013.com",
    });
  });

  it("retorna email vazio quando a sessão existe mas sem email", () => {
    expect(decideDashboardAuth({ user: { email: null } })).toEqual({
      kind: "ready",
      email: "",
    });
  });
});

describe("decideDashboardAuthError", () => {
  it("classifica erros genéricos de API como session_error", () => {
    const d = decideDashboardAuthError(new Error("Network failed"));
    expect(d.kind).toBe("redirect");
    if (d.kind === "redirect") {
      expect(d.search).toEqual({ reason: "session_error", from: "/dashboard" });
      expect(d.to).toBe("/operador/login");
      expect(d.message).toBe(AUTH_MESSAGES.session_error);
    }
  });

  it("classifica erros de timeout como reason=timeout", () => {
    const d = decideDashboardAuthError(new Error("Session check timeout after 8000ms"));
    expect(d.kind).toBe("redirect");
    if (d.kind === "redirect") {
      expect(d.search.reason).toBe("timeout");
      expect(d.message).toBe(AUTH_MESSAGES.timeout);
    }
  });

  it("trata valores não-Error como session_error", () => {
    const d = decideDashboardAuthError("boom");
    expect(d.kind).toBe("redirect");
    if (d.kind === "redirect") expect(d.search.reason).toBe("session_error");
  });
});

describe("withSessionTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("resolve quando a promise responde antes do timeout", async () => {
    const result = await withSessionTimeout(Promise.resolve("ok"), 100);
    expect(result).toBe("ok");
  });

  it("rejeita com Error contendo 'timeout' quando demora demais", async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 10000));
    const pending = withSessionTimeout(slow, 50);
    vi.advanceTimersByTime(60);
    await expect(pending).rejects.toThrow(/timeout/i);
  });

  it("propaga erros da promise original", async () => {
    await expect(withSessionTimeout(Promise.reject(new Error("api down")), 100)).rejects.toThrow("api down");
  });
});

describe("fluxo de redirecionamento do dashboard", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("redireciona com reason=unauthenticated quando a sessão está ausente", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const toastError = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

    const { data } = await getSession();
    const decision = decideDashboardAuth(data.session);
    if (decision.kind === "redirect") {
      toastError(decision.message);
      setTimeout(() => {
        navigate({ to: decision.to, replace: decision.replace, search: decision.search });
      }, decision.delayMs);
    }

    expect(toastError).toHaveBeenCalledWith(UNAUTHENTICATED_MESSAGE);
    vi.advanceTimersByTime(REDIRECT_DELAY_MS);
    expect(navigate).toHaveBeenCalledWith({
      to: "/operador/login",
      replace: true,
      search: { reason: "unauthenticated", from: "/dashboard" },
    });
  });

  it("redireciona com reason=session_error quando getSession lança", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const toastError = vi.fn();

    try {
      await withSessionTimeout(Promise.reject(new Error("API 500")), 1000);
    } catch (err) {
      const decision = decideDashboardAuthError(err);
      if (decision.kind === "redirect") {
        toastError(decision.message);
        setTimeout(() => {
          navigate({ to: decision.to, replace: decision.replace, search: decision.search });
        }, decision.delayMs);
      }
    }

    expect(toastError).toHaveBeenCalledWith(AUTH_MESSAGES.session_error);
    vi.advanceTimersByTime(REDIRECT_DELAY_MS);
    expect(navigate).toHaveBeenCalledWith({
      to: "/operador/login",
      replace: true,
      search: { reason: "session_error", from: "/dashboard" },
    });
  });

  it("redireciona com reason=timeout quando a verificação demora demais", async () => {
    vi.useFakeTimers();
    const navigate = vi.fn();
    const toastError = vi.fn();

    const slow = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 10000),
    );
    const pending = withSessionTimeout(slow, 50).catch((err) => {
      const decision = decideDashboardAuthError(err);
      if (decision.kind === "redirect") {
        toastError(decision.message);
        setTimeout(() => {
          navigate({ to: decision.to, replace: decision.replace, search: decision.search });
        }, decision.delayMs);
      }
    });

    vi.advanceTimersByTime(60);
    await pending;
    expect(toastError).toHaveBeenCalledWith(AUTH_MESSAGES.timeout);

    vi.advanceTimersByTime(REDIRECT_DELAY_MS);
    expect(navigate).toHaveBeenCalledWith({
      to: "/operador/login",
      replace: true,
      search: { reason: "timeout", from: "/dashboard" },
    });
  });

  it("não redireciona quando a sessão está presente", async () => {
    const navigate = vi.fn();
    const decision = decideDashboardAuth({ user: { email: "a@b.com" } });
    expect(decision.kind).toBe("ready");
    expect(navigate).not.toHaveBeenCalled();
  });
});
