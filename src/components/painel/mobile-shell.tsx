import { ReactNode, useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ListChecks,
  Users,
  MessageSquare,
  MoreHorizontal,
  UserSquare,
  StickyNote,
  DollarSign,
  Tag,
  History,
  Settings,
  UserCog,
  BookOpen,
  ScrollText,
  LogOut,
  Sun,
  Moon,
  Bike,
  UserCircle2,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LogoRota013 } from "@/components/logo-rota013";
import { ModoAutomaticoToggle } from "@/components/modo-automatico-toggle";
import { CobrancaNotifier } from "@/components/cobranca-notifier";
import { ChatNotifier } from "@/components/chat-notifier";
import { ChatClienteNotifier } from "@/components/chat-cliente-notifier";
import { AlertaNotifier } from "@/components/alerta-notifier";
import { NovaSolicitacaoNotifier } from "@/components/nova-solicitacao-notifier";
import { useRole } from "@/hooks/use-role";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const moreItems: NavItem[] = [
  { title: "Clientes", url: "/clientes", icon: UserSquare },
  { title: "Chat motociclistas", url: "/chat-motociclistas", icon: MessageSquare },
  { title: "Chat clientes", url: "/chat-clientes", icon: MessageSquare },
  { title: "Mural", url: "/mural", icon: StickyNote },
  { title: "Financeiro", url: "/financeiro", icon: DollarSign },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Tarifas", url: "/tarifas", icon: Tag, adminOnly: true },
  { title: "Termos e Condições", url: "/termos-config", icon: MessageSquare, adminOnly: true },
  { title: "Usuários", url: "/usuarios", icon: UserCog, adminOnly: true },
  { title: "Configurações", url: "/configuracoes", icon: Settings, adminOnly: true },
  { title: "Instruções", url: "/instrucoes", icon: BookOpen },
  { title: "Log de Auditoria", url: "/audit-log", icon: ScrollText, adminOnly: true },
];

const ROUTE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/corridas": "Corridas",
  "/motociclistas": "Motociclistas",
  "/clientes": "Clientes",
  "/chat-motociclistas": "Chat motociclistas",
  "/chat-clientes": "Chat clientes",
  "/mural": "Mural",
  "/financeiro": "Financeiro",
  "/historico": "Histórico",
  "/tarifas": "Tarifas",
  "/termos-config": "Termos",
  "/usuarios": "Usuários",
  "/configuracoes": "Configurações",
  "/instrucoes": "Instruções",
  "/audit-log": "Auditoria",
};

export function MobileShell({ children, email }: { children: ReactNode; email: string }) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { isAdmin } = useRole();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const [chatsOpen, setChatsOpen] = useState(false);

  const title = ROUTE_TITLES[currentPath] ?? "Painel";
  const isActive = (url: string) => currentPath === url;
  const isChat = currentPath.startsWith("/chat-");

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/operador/login", replace: true });
  };

  return (
    <div className="flex min-h-dvh w-full flex-col bg-background text-foreground">
      {/* Top App Bar */}
      <header className="app-header-safe sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <LogoRota013 className="text-lg shrink-0" />
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-muted-foreground">
          {title}
        </div>
        <ModoAutomaticoToggle />
        <CobrancaNotifier />
        <ChatNotifier />
        <ChatClienteNotifier />
        <AlertaNotifier />
        <NovaSolicitacaoNotifier />
      </header>

      {/* Conteúdo */}
      <main className="flex-1 min-w-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="grid grid-cols-5">
          <NavTab to="/dashboard" icon={LayoutDashboard} label="Início" active={isActive("/dashboard")} />
          <NavTab to="/corridas" icon={ListChecks} label="Corridas" active={isActive("/corridas")} />
          <NavTab to="/motociclistas" icon={Users} label="Motos" active={isActive("/motociclistas")} />
          <li>
            <button
              type="button"
              onClick={() => setChatsOpen(true)}
              aria-label="Abrir chats"
              className={cn(
                "flex h-16 w-full min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-[0.96]",
                isChat ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MessageSquare className="h-5 w-5" />
              <span>Chats</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-label="Mais opções"
              className="flex h-16 w-full min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition active:scale-[0.96]"
            >
              <MoreHorizontal className="h-5 w-5" />
              <span>Mais</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Sheet de Chats */}
      <Sheet open={chatsOpen} onOpenChange={setChatsOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader>
            <SheetTitle>Abrir chat</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link
              to="/chat-motociclistas"
              onClick={() => setChatsOpen(false)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-5 text-center transition active:scale-[0.98]"
            >
              <Bike className="h-7 w-7 text-primary" />
              <span className="text-sm font-semibold">Motociclistas</span>
            </Link>
            <Link
              to="/chat-clientes"
              onClick={() => setChatsOpen(false)}
              className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-muted/40 p-5 text-center transition active:scale-[0.98]"
            >
              <UserCircle2 className="h-7 w-7 text-primary" />
              <span className="text-sm font-semibold">Clientes</span>
            </Link>
          </div>
        </SheetContent>
      </Sheet>

      {/* Sheet "Mais" */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="right" className="w-[88vw] max-w-sm p-0 flex flex-col">
          <SheetHeader className="border-b border-border p-4">
            <SheetTitle className="flex items-center gap-2">
              <LogoRota013 className="text-lg" />
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-2">
            <ul className="flex flex-col">
              {moreItems
                .filter((i) => !i.adminOnly || isAdmin)
                .map((item) => (
                  <li key={item.url}>
                    <Link
                      to={item.url}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-3 text-sm transition",
                        isActive(item.url)
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-muted",
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
          <div className="border-t border-border p-3 space-y-2">
            {email && !email.endsWith("@painel.local") && (
              <div className="px-1 text-xs text-muted-foreground truncate">{email}</div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={toggle} className="flex-1">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span className="ml-2">{theme === "dark" ? "Claro" : "Escuro"}</span>
              </Button>
              <Button variant="destructive" size="sm" onClick={sair} className="flex-1">
                <LogOut className="h-4 w-4" />
                <span className="ml-2">Sair</span>
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NavTab({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  active: boolean;
}) {
  return (
    <li>
      <Link
        to={to}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-16 min-h-11 flex-col items-center justify-center gap-1 text-[11px] font-medium transition active:scale-[0.96]",
          active ? "text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
        <span>{label}</span>
      </Link>
    </li>
  );
}
