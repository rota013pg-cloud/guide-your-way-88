import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Bike,
  ClipboardList,
  Home,
  KeyRound,
  LogOut,
  Menu,
  MessageCircle,
  User,
} from "lucide-react";
import { useCliente, getClienteToken } from "@/lib/cliente-auth";
import { LogoRota013 } from "@/components/logo-rota013";
import { supabase } from "@/integrations/supabase/client";
import { ensureAudioUnlock, playChatBeep } from "@/lib/notification-sound";
import { ensureNotificationPermission, showDesktopNotification } from "@/lib/desktop-notification";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Rota 013 — Mototáxi" }],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: ClienteAppLayout,
});

function ClienteAppLayout() {
  const navigate = useNavigate();
  const { cliente, loading, logout } = useCliente();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !cliente) navigate({ to: "/cliente/login", replace: true });
  }, [loading, cliente, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const lockPortrait = () => {
      const orientation = window.screen?.orientation as ScreenOrientation | undefined;
      if (!orientation || typeof orientation.lock !== "function") return;
      void orientation.lock("portrait-primary").catch(() => undefined);
    };
    lockPortrait();
    window.addEventListener("touchend", lockPortrait, { passive: true });
    window.addEventListener("click", lockPortrait);
    document.addEventListener("visibilitychange", lockPortrait);
    return () => {
      window.removeEventListener("touchend", lockPortrait);
      window.removeEventListener("click", lockPortrait);
      document.removeEventListener("visibilitychange", lockPortrait);
    };
  }, []);




  // Notificação global: som + desktop notif quando chega msg da central
  // e o cliente NÃO está na tela de chat. Usa polling (Realtime anon removido).
  useEffect(() => {
    if (!cliente) return;
    ensureAudioUnlock();
    ensureNotificationPermission();
    const token = getClienteToken();
    if (!token) return;
    let cancelado = false;
    let timeoutId: number | undefined;
    let consultando = false;
    let ultimoId = 0;
    let primeiraCarga = true;

    const checar = async () => {
      if (consultando) return;
      consultando = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      try {
        const { data, error } = await supabase.rpc("cliente_listar_mensagens", { _token: token });
        if (cancelado || error || !data) return;
        const lista = data as Array<{
          id: number;
          autor: string;
          autor_nome: string | null;
          texto: string;
        }>;
        const novos = lista.filter((m) => m.id > ultimoId && m.autor === "central");
        ultimoId = lista.reduce((acc, m) => (m.id > acc ? m.id : acc), ultimoId);
        if (primeiraCarga) {
          primeiraCarga = false;
          return;
        }
        if (window.location.pathname.startsWith("/cliente/app/chat")) return;
        for (const m of novos) {
          playChatBeep();
          const nome = m.autor_nome ?? "Central";
          const preview = m.texto.length > 120 ? m.texto.slice(0, 120) + "…" : m.texto;
          showDesktopNotification({
            id: `cli-glob-${m.id}`,
            title: `💬 ${nome}`,
            body: preview,
            tag: "chat-cliente-central",
            onClick: () => navigate({ to: "/cliente/app/chat" }),
          });
          toast.custom(
            (id) => (
              <button
                onClick={() => {
                  toast.dismiss(id);
                  navigate({ to: "/cliente/app/chat" });
                }}
                className="flex items-start gap-3 w-[340px] max-w-[88vw] rounded-lg border border-border bg-card text-card-foreground shadow-lg p-3 text-left hover:bg-muted/40 transition"
              >
                <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                  {(nome[0] ?? "C").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">💬 {nome}</div>
                  <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap break-words">
                    {preview}
                  </div>
                </div>
              </button>
            ),
            { duration: 6000 },
          );
        }
      } finally {
        consultando = false;
        if (!cancelado) timeoutId = window.setTimeout(checar, document.hidden ? 10000 : 3000);
      }
    };
    void checar();
    const checarAgora = () => void checar();
    window.addEventListener("focus", checarAgora);
    document.addEventListener("visibilitychange", checarAgora);
    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("focus", checarAgora);
      document.removeEventListener("visibilitychange", checarAgora);
    };
  }, [cliente, navigate]);

  if (loading || !cliente) {
    return (
      <div className="theme-cliente flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const sair = async () => {
    await logout();
    navigate({ to: "/cliente", replace: true });
  };

  const menuItems: { to: string; label: string; icon: typeof Home; exact?: boolean }[] = [
    { to: "/cliente/app", label: "Solicitar Corrida", icon: Bike, exact: true },
    { to: "/cliente/app/historico", label: "Histórico de Corridas", icon: ClipboardList },
    { to: "/cliente/app/perfil", label: "Meus Dados", icon: User },
    { to: "/cliente/app/senha", label: "Alterar Senha", icon: KeyRound },
    { to: "/cliente/app/chat", label: "Falar com a Central", icon: MessageCircle },
  ];

  return (
    <div className="theme-cliente flex h-[100dvh] flex-col bg-background text-foreground overflow-hidden">
      {/* Header */}
      <header className="app-header-safe shrink-0 z-30 flex items-center justify-between border-b hairline bg-background/85 backdrop-blur-xl px-4 py-3">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu" className="text-foreground hover:bg-card hover:text-[color:var(--gold-soft)]">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="theme-cliente w-72 p-0 flex flex-col bg-card border-r hairline">
            <SheetHeader className="border-b hairline p-4 text-left">
              <Link
                to="/cliente/app"
                onClick={() => setDrawerOpen(false)}
                aria-label="Início"
                className="inline-flex items-center"
              >
                <LogoRota013 className="text-3xl" />
              </Link>
              <SheetTitle className="truncate mt-2 font-display tracking-tight">{cliente.nome}</SheetTitle>
              <p className="text-xs text-muted-foreground truncate">{cliente.email ?? cliente.telefone ?? cliente.codigo}</p>
            </SheetHeader>
            <nav className="flex-1 p-2">
              {menuItems.map((item) => {
                const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                      active
                        ? "bg-[color:var(--accent)] text-[color:var(--gold-soft)] font-semibold"
                        : "text-foreground/85 hover:bg-[color:var(--muted)] hover:text-foreground"
                    }`}
                  >
                    <Icon className={`size-5 ${active ? "text-[color:var(--gold)]" : ""}`} />
                    {item.label}
                  </Link>
                );
              })}
      </nav>

      {/* Fallback de trava de orientação para iOS (manifest/lock API não bloqueiam fora do fullscreen) */}
      <div className="rotate-lock-overlay" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <line x1="12" y1="18" x2="12" y2="18" />
        </svg>
        <p className="text-base font-medium">Gire o aparelho para o modo retrato</p>
        <p className="text-sm text-muted-foreground">Este app funciona apenas em pé.</p>
      </div>
            <div className="border-t hairline p-2">
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
              >
                <LogOut className="size-5" />
                Sair
              </button>
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/cliente/app" aria-label="Início" className="inline-flex items-center">
          <LogoRota013 className="text-2xl" />
        </Link>

        <Button variant="ghost" size="icon" aria-label="Falar com a central" asChild className="text-foreground hover:bg-card hover:text-[color:var(--gold-soft)]">
          <Link to="/cliente/app/chat">
            <MessageCircle className="size-5" />
          </Link>
        </Button>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="app-bottom-nav-safe shrink-0 z-30 border-t hairline bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-md items-center justify-around">
          <BottomTab to="/cliente/app" icon={Home} label="Início" active={pathname === "/cliente/app"} />
          <BottomTab
            to="/cliente/app/historico"
            icon={ClipboardList}
            label="Histórico"
            active={pathname.startsWith("/cliente/app/historico")}
          />
          <BottomTab
            to="/cliente/app/perfil"
            icon={User}
            label="Perfil"
            active={pathname.startsWith("/cliente/app/perfil")}
          />
        </div>
      </nav>
    </div>
  );
}

function BottomTab({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: typeof Home;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold uppercase tracking-wider transition-colors ${
        active ? "text-[color:var(--gold)]" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  );
}
