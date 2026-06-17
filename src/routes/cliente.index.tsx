import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Bike, Car, MapPin, Clock, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/cliente/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rota 013 — Mototáxi e Táxi em Praia Grande" },
      {
        name: "description",
        content:
          "Peça mototáxi ou táxi em Praia Grande pelo Rota 013. Rápido, seguro e com motoristas cadastrados.",
      },
      { property: "og:title", content: "Rota 013 — Mototáxi e Táxi em Praia Grande" },
      {
        property: "og:description",
        content: "Peça sua corrida em segundos. Mototáxi e táxi em Praia Grande.",
      },
    ],
  }),
  component: ClienteLanding,
});

function ClienteLanding() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-5 py-4">
        <span className="logo-r013 text-3xl">
          R013<span>.</span>
        </span>
        <Link to="/cliente/login">
          <Button variant="ghost" size="sm" className="rounded-xl">
            Entrar
          </Button>
        </Link>
      </header>

      <main className="px-5 pb-12">
        <section className="pt-6 pb-10">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Sua corrida em <span className="text-primary">Praia Grande</span>, em
            segundos.
          </h1>
          <p className="mt-3 text-muted-foreground">
            Peça mototáxi ou táxi com motoristas cadastrados pelo Rota 013.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link to="/cliente/cadastro">
              <Button size="lg" className="w-full rounded-xl">
                Criar minha conta
              </Button>
            </Link>
            <Link to="/cliente/login">
              <Button size="lg" variant="outline" className="w-full rounded-xl">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <FeatureCard icon={<Bike className="size-6" />} title="Mototáxi" desc="Mais rápido no trânsito" />
          <FeatureCard icon={<Car className="size-6" />} title="Táxi" desc="Conforto pra família" />
          <FeatureCard icon={<MapPin className="size-6" />} title="Praia Grande" desc="Cobertura total" />
          <FeatureCard icon={<Clock className="size-6" />} title="24h" desc="A qualquer hora" />
        </section>

        <section className="mt-8 rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="size-6 text-primary shrink-0 mt-0.5" />
            <div>
              <h2 className="font-semibold">Motoristas cadastrados</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Todos os motoristas do Rota 013 passam por cadastro e verificação de
                documentos.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-primary">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <div className="text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
