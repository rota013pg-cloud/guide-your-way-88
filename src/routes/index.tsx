import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Truck, Users } from "lucide-react";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rota013 — Transporte e logística" },
      {
        name: "description",
        content:
          "Plataforma Rota013 para clientes e operadores. Acesse sua área e acompanhe suas operações.",
      },
      { property: "og:title", content: "Rota013 — Transporte e logística" },
      {
        property: "og:description",
        content:
          "Plataforma Rota013 para clientes e operadores. Acesse sua área e acompanhe suas operações.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Se acessar via subdomínio do operador, vai direto pro login do operador
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host.startsWith("operador.")) {
        navigate({ to: "/login", replace: true });
        return;
      }
    }
    setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <header className="px-6 py-5 border-b">
        <h1 className="text-xl font-bold tracking-tight">Rota013</h1>
      </header>

      <section className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full text-center space-y-10">
          <div className="space-y-4">
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Bem-vindo ao Rota013
            </h2>
            <p className="text-lg text-muted-foreground">
              Escolha sua área de acesso para continuar.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-lg mx-auto">
            <Link to="/cliente" className="block">
              <Button
                size="lg"
                className="w-full h-auto py-6 flex-col gap-2 text-base"
              >
                <Users className="w-6 h-6" />
                Sou Cliente
              </Button>
            </Link>

            <Link to="/login" className="block">
              <Button
                size="lg"
                variant="outline"
                className="w-full h-auto py-6 flex-col gap-2 text-base"
              >
                <Truck className="w-6 h-6" />
                Sou Operador
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="px-6 py-6 border-t text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Rota013
      </footer>
    </main>
  );
}
