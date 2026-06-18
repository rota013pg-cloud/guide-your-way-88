/**
 * Pure helpers that decide what should happen when a protected page
 * inspects the current Supabase session. Extracted from the dashboard
 * so the behavior can be unit-tested without rendering React or
 * mocking the router.
 */

export type AuthSessionLike = { user?: { email?: string | null } | null } | null | undefined;

export type AuthRedirectReason = "unauthenticated" | "session_error" | "timeout";

export type DashboardAuthDecision =
  | {
      kind: "redirect";
      to: "/operador/login";
      replace: true;
      search: { reason: AuthRedirectReason; from: "/dashboard" };
      message: string;
      delayMs: number;
    }
  | {
      kind: "ready";
      email: string;
    };

export const AUTH_MESSAGES: Record<AuthRedirectReason, string> = {
  unauthenticated: "Sessão expirada. Faça login para continuar.",
  session_error:
    "Não foi possível verificar sua sessão. Faça login novamente para continuar.",
  timeout:
    "A verificação da sessão demorou demais. Faça login novamente para continuar.",
};

export const UNAUTHENTICATED_MESSAGE = AUTH_MESSAGES.unauthenticated;
export const REDIRECT_DELAY_MS = 900;
export const SESSION_CHECK_TIMEOUT_MS = 8000;

function makeRedirect(reason: AuthRedirectReason): DashboardAuthDecision {
  return {
    kind: "redirect",
    to: "/operador/login",
    replace: true,
    search: { reason, from: "/dashboard" },
    message: AUTH_MESSAGES[reason],
    delayMs: REDIRECT_DELAY_MS,
  };
}


export function decideDashboardAuth(session: AuthSessionLike): DashboardAuthDecision {
  if (!session) return makeRedirect("unauthenticated");
  return { kind: "ready", email: session.user?.email ?? "" };
}

export function decideDashboardAuthError(error: unknown): DashboardAuthDecision {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const reason: AuthRedirectReason = message.includes("timeout") ? "timeout" : "session_error";
  return makeRedirect(reason);
}

/**
 * Wraps a session-check promise with a timeout. Rejects with an Error
 * whose message contains "timeout" so callers can route it to
 * `decideDashboardAuthError` and get the right reason.
 */
export function withSessionTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = SESSION_CHECK_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Session check timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
