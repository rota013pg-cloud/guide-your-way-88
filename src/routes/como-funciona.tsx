import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { MessageSquare, ShieldCheck, Clock, MapPinned, BadgeCheck, Bike } from "lucide-react";

export const Route = createFileRoute("/como-funciona")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Como funciona — Rota013 para clientes" },
      {
        name: "description",
        content:
          "Peça sua corrida de moto pela plataforma Rota013. Cadastro pelo site, acompanhamento em tempo real e motociclistas verificados.",
      },
      { property: "og:title", content: "Como funciona — Rota013" },
      {
        property: "og:description",
        content:
          "Solicite corridas pela plataforma web Rota013. Sem WhatsApp, sem espera — tudo direto pelo app no navegador.",
      },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: ComoFuncionaPage,
});

function ComoFuncionaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-block text-xs uppercase tracking-widest text-primary mb-4">
              TRANSPORTE POR MOTOCICLETAS
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Solicite corridas com motocicletas,{" "}
              <span className="italic text-primary">direto pelo site.</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Na Rota013 você solicita corridas direto pelo site ou pode
              solicitar via WhatsApp direto pela central.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/cliente/cadastro">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  Criar minha conta
                </Button>
              </Link>
              <Link to="/cliente/login">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-3xl mt-12 grid grid-cols-3 gap-3">
            <Stat label="Atendimento humanizado" />
            <Stat label={<>Cliente<br/>Satisfeito</>} />
            <Stat label="Menos atrasos" />
          </div>
        </section>

        {/* Como funciona */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">Como a Rota013 funciona</h2>
              <p className="mt-3 text-muted-foreground">
                Um fluxo simples, agora 100% digital, com a central humana acompanhando.
              </p>
            </div>
            <div className="grid md:grid-cols-5 sm:grid-cols-2 gap-4">
              <Step n="1" title="Cadastro" desc="Crie sua conta gratuita pelo site em menos de 1 minuto." />
              <Step n="2" title="Pedido" desc="Informe origem e destino direto na plataforma e confirme o valor." />
              <Step n="3" title="Localização" desc="A central encontra um motociclista parceiro próximo de você." />
              <Step n="4" title="Confirmação" desc="Receba os dados do motociclista, modelo e placa da moto em tempo real." />
              <Step n="5" title="Finalização" desc="Pagamento direto ao motociclista (Pix, dinheiro ou cartão)." />
            </div>
          </div>
        </section>

        {/* Vantagens */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">Vantagens para quem anda</h2>
              <p className="mt-3 text-muted-foreground">
                Mais do que chamar uma corrida: suporte, organização e segurança.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ValueCard icon={<MessageSquare className="size-5" />} title="Atendimento humanizado" desc="Central de verdade acompanhando do início ao fim da corrida." />
              <ValueCard icon={<ShieldCheck className="size-5" />} title="Menos cancelamentos" desc="A central intermedia para reduzir falhas e desencontros." />
              <ValueCard icon={<Clock className="size-5" />} title="Corridas agendadas" desc="Ideal para trabalho, consultas, rodoviária e eventos." />
              <ValueCard icon={<MapPinned className="size-5" />} title="Acompanhamento em tempo real" desc="Informação atualizada do tempo de chegada do motociclista" />
              <ValueCard icon={<BadgeCheck className="size-5" />} title="Motociclistas verificados" desc="Documentação em dia e dados enviados antes da corrida." />
              <ValueCard icon={<Bike className="size-5" />} title="Motos revisadas" desc="Motociclistas parceiros com motos revisadas e adequadas." />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-16 border-t border-border/60">
          <div className="mx-auto max-w-3xl text-center rounded-2xl border border-primary/40 bg-card p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold">
              Precisa se deslocar com rapidez?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Entre na plataforma Rota013 e solicite sua corrida em segundos.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/cliente/cadastro">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  Criar minha conta
                </Button>
              </Link>
              <Link to="/cliente/login">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  Entrar agora
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function Stat({ label }: { label: string | React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="text-sm font-semibold text-primary">{label}</div>
    </div>
  );
}

function Step({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
        {n}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function ValueCard({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="text-primary">{icon}</div>
      <div className="mt-2 font-semibold">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{desc}</div>
    </div>
  );
}
