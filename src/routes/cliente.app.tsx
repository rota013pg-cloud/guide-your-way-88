import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bike, Car, LogOut } from "lucide-react";
import { useCliente } from "@/lib/cliente-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha conta — Rota 013" }] }),
  component: ClienteAppPage,
});

function ClienteAppPage() {
  const navigate = useNavigate();
  const { cliente, loading, logout } = useCliente();

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground">Olá,</p>
          <p className="font-semibold">{cliente.nome}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={sair} aria-label="Sair">
          <LogOut className="size-5" />
        </Button>
      </header>

      <main className="px-5 py-6 space-y-4">
        <h1 className="text-2xl font-bold">Pedir corrida</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o tipo de corrida que você precisa agora.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <TipoCard
            icon={<Bike className="size-8" />}
            title="Mototáxi"
            desc="Mais rápido"
            onClick={() => toast.info("Em breve: pedido de mototáxi.")}
          />
          <TipoCard
            icon={<Car className="size-8" />}
            title="Táxi"
            desc="Mais conforto"
            onClick={() => toast.info("Em breve: pedido de táxi.")}
          />
        </div>

        <Card className="p-4 rounded-2xl">
          <p className="text-sm font-semibold mb-2">Seus dados</p>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>Código: <span className="text-foreground font-mono">{cliente.codigo}</span></p>
            {cliente.email && <p>E-mail: <span className="text-foreground">{cliente.email}</span></p>}
            {cliente.telefone && <p>Telefone: <span className="text-foreground">{cliente.telefone}</span></p>}
          </div>
        </Card>
      </main>
    </div>
  );
}

function TipoCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-border bg-card p-5 text-left active:scale-[0.98] transition"
    >
      <div className="text-primary">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}
