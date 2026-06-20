import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatNotifier } from "@/components/chat-notifier";
import { ChatClienteNotifier } from "@/components/chat-cliente-notifier";
import { CobrancaNotifier } from "@/components/cobranca-notifier";
import { AlertaNotifier } from "@/components/alerta-notifier";
import { NovaSolicitacaoNotifier } from "@/components/nova-solicitacao-notifier";
import { ModoAutomaticoToggle } from "@/components/modo-automatico-toggle";

import { useAlertasAgendadas } from "@/hooks/use-alertas-agendadas";
import {
  decideDashboardAuth,
  decideDashboardAuthError,
  withSessionTimeout,
  type DashboardAuthDecision,
} from "@/lib/auth-redirect";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({
    meta: [
      { name: "application-name", content: "Rota 013 Operador" },
      { name: "apple-mobile-web-app-title", content: "Rota 013 Operador" },
    ],
    links: [{ rel: "manifest", href: "/manifest-operador.webmanifest" }],
  }),
  component: AuthenticatedLayout,
});

type AuthState = "checking" | "redirecting" | "ready";

function AuthenticatedLayout() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const [email, setEmail] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  const [redirectReason, setRedirectReason] = useState<"unauthenticated" | "session_error" | "timeout" | null>(null);

  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  useAlertasAgendadas(15);


  useEffect(() => {
    const apply = (decision: DashboardAuthDecision) => {
      if (decision.kind === "redirect") {
        setRedirectReason(decision.search.reason);
        setRedirectMessage(decision.message);
        setAuthState("redirecting");
        toast.error(decision.message);
        setTimeout(() => {
          navigate({
            to: decision.to,
            replace: decision.replace,
            search: { ...decision.search, from: currentPath } as never,
          });
        }, decision.delayMs);
        return;
      }
      setEmail(decision.email);
      setAuthState("ready");
    };

    withSessionTimeout(supabase.auth.getSession())
      .then(({ data, error }) => {
        if (error) apply(decideDashboardAuthError(error));
        else apply(decideDashboardAuth(data.session));
      })
      .catch((err) => apply(decideDashboardAuthError(err)));
  }, [navigate, currentPath]);

  if (authState !== "ready") {
    const redirecting = authState === "redirecting";
    const titulo =
      redirectReason === "timeout"
        ? "Verificação demorou demais"
        : redirectReason === "session_error"
        ? "Falha ao verificar sessão"
        : redirecting
        ? "Sessão não encontrada"
        : "Rota 013";
    const subtitulo = redirecting
      ? `${redirectMessage} Redirecionando para o login...`
      : "Verificando sessão...";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full font-black text-2xl ${redirecting ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground animate-pulse"}`}>
          {redirecting ? "!" : "R"}
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="font-bold text-lg">{titulo}</h2>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full w-2/3 animate-[pulse_1.2s_ease-in-out_infinite] ${redirecting ? "bg-destructive" : "bg-primary"}`} />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="app-header-safe flex items-center gap-2 border-b border-border bg-card px-3 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <ModoAutomaticoToggle />
            <CobrancaNotifier />
            <ChatNotifier />
            <ChatClienteNotifier />
            <AlertaNotifier />
            <NovaSolicitacaoNotifier />


            {email && !email.endsWith("@painel.local") && (
              <span className="text-xs text-muted-foreground truncate max-w-[40ch]">{email}</span>
            )}
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
