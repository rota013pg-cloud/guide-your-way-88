/**
 * Pure helpers that decide what should happen when a protected page
 * inspects the current Supabase session. Extracted from the dashboard
 * so the behavior can be unit-tested without rendering React or
 * mocking the router.
 */

export type AuthSessionLike = { user?: { email?: string | null } | null } | null | undefined;

export type DashboardAuthDecision =
  | {
      kind: "redirect";
      to: "/login";
      replace: true;
      search: { reason: "unauthenticated"; from: "/dashboard" };
      message: string;
      delayMs: number;
    }
  | {
      kind: "ready";
      email: string;
    };

export const UNAUTHENTICATED_MESSAGE =
  "Sessão expirada. Faça login para continuar.";

export const REDIRECT_DELAY_MS = 900;

export function decideDashboardAuth(session: AuthSessionLike): DashboardAuthDecision {
  if (!session) {
    return {
      kind: "redirect",
      to: "/login",
      replace: true,
      search: { reason: "unauthenticated", from: "/dashboard" },
      message: UNAUTHENTICATED_MESSAGE,
      delayMs: REDIRECT_DELAY_MS,
    };
  }
  return { kind: "ready", email: session.user?.email ?? "" };
}
