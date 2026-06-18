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
import { useCliente } from "@/lib/cliente-auth";
import { LogoRota013 } from "@/components/logo-rota013";

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

  if (loading || !cliente) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
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
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="size-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="border-b border-border p-4 text-left">
              <Link
                to="/cliente/app"
                onClick={() => setDrawerOpen(false)}
                aria-label="Início"
                className="inline-flex items-center"
              >
                <LogoRota013 className="text-3xl" />
              </Link>
              <SheetTitle className="truncate mt-2">{cliente.nome}</SheetTitle>
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
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                      active ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="size-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border p-2">
              <button
                onClick={sair}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive hover:bg-destructive/10"
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

        <Button variant="ghost" size="icon" aria-label="Falar com a central" asChild>
          <Link to="/cliente/app/chat">
            <MessageCircle className="size-5" />
          </Link>
        </Button>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur">
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
      className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </Link>
  );
}
