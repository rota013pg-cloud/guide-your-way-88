import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Zap, ShieldCheck, Handshake, Smartphone, Waves, CheckCircle2, LogIn } from "lucide-react";
import { LogoRota013 } from "@/components/logo-rota013";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rota013 — Mobilidade Urbana rápido e confiável em Praia Grande" },
      {
        name: "description",
        content:
          "Central de mobilidade urbana por motocicletas no Litoral Sul de SP. Conheça nossa missão, visão e valores.",
      },
      { property: "og:title", content: "Rota013 — Quem somos" },
      {
        property: "og:description",
        content:
          "Conectamos passageiros e motoristas parceiros em Praia Grande e região com tecnologia, agilidade e segurança.",
      },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: IndexPage,
});

function IndexPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host.startsWith("operador.")) {
        navigate({ to: "/login", replace: true });
        return;
      }
      if (host.startsWith("app.")) {
        navigate({ to: "/motorista", replace: true });
        return;
      }
    }
    setReady(true);
  }, [navigate]);

  if (!ready) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 pt-12 pb-14 md:pt-20 md:pb-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="flex justify-center mb-6">
              <LogoRota013 className="text-6xl md:text-7xl" />
            </div>
            <div className="inline-block text-xs uppercase tracking-widest text-primary mb-4">
              🏍️ Praia Grande & Litoral Sul de SP
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Mobilidade urbana por motocicletas{" "}
              <span className="text-primary italic">rápida</span> e confiável.
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Conectamos clientes e motoristas parceiros com agilidade, segurança e
              tecnologia. Atendemos Praia Grande e região com a rapidez que você precisa.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/cliente/login">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  🛵 Quero ser cliente
                </Button>
              </Link>
              <Link to="/parceiros">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  💼 Quero trabalhar conosco
                </Button>
              </Link>
            </div>
          </div>

          <div className="mx-auto max-w-3xl mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat top="100%" label="Para o motorista" />
            <Stat top="24h" label="Disponibilidade" />
            <Stat top="013" label="DDD da região" />
            <Stat top="Rápido" label="Atendimento direto" />
          </div>
        </section>

        {/* Essência */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <div className="text-xs uppercase tracking-widest text-primary mb-2">
                Quem somos
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Nossa <span className="italic text-primary">essência</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <EssenceCard
                n="01"
                title="Missão"
                desc="Oferecer transporte ágil e seguro conectando clientes a motoristas parceiros qualificados no Litoral Sul de SP — com tecnologia, respeito e eficiência em cada corrida."
              />
              <EssenceCard
                n="02"
                title="Visão"
                desc="Ser a central de mobilidade urbana por motocicletas de referência em Praia Grande e região, reconhecida pela excelência no atendimento e pela valorização dos parceiros."
              />
              <EssenceCard
                n="03"
                title="Propósito"
                desc="Mobilidade urbana de qualidade deve ser acessível a todos. Conectamos pessoas com agilidade, tratamos parceiros com dignidade e construímos uma comunidade sólida na região."
              />
            </div>
          </div>
        </section>

        {/* Valores */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <div className="text-xs uppercase tracking-widest text-primary mb-2">
                O que nos guia
              </div>
              <h2 className="text-3xl md:text-4xl font-bold">
                Nossos <span className="italic text-primary">valores</span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ValueCard icon={<Zap className="size-5" />} title="Agilidade" desc="Respostas rápidas e atendimento eficiente. Seu tempo é precioso." />
              <ValueCard icon={<ShieldCheck className="size-5" />} title="Segurança" desc="Motoristas verificados, documentação em dia e conduta profissional." />
              <ValueCard icon={<Handshake className="size-5" />} title="Parceria" desc="O motorista recebe 100% das corridas. A diária fixa garante sustentabilidade." />
              <ValueCard icon={<Smartphone className="size-5" />} title="Tecnologia" desc="App para motoristas, painel em tempo real, rastreamento e comunicação integrada." />
              <ValueCard icon={<Waves className="size-5" />} title="Regional" desc="Somos da Baixada Santista. Conhecemos cada rua e atalho da região." />
              <ValueCard icon={<CheckCircle2 className="size-5" />} title="Transparência" desc="Preços claros, sem surpresas. Motorista e cliente sabem o que esperar." />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-16 border-t border-border/60">
          <div className="mx-auto max-w-3xl text-center rounded-2xl border border-border bg-card p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold">
              Pronto para começar?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Peça sua corrida agora ou venha trabalhar com a gente.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/como-funciona">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  Como funciona para o cliente
                </Button>
              </Link>
              <Link to="/parceiros">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  Seja motorista parceiro
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />

      {/* Floating login button */}
      <Link
        to="/login"
        aria-label="Acessar painel do operador"
        className="fixed bottom-5 right-5 z-50 group"
      >
        <span className="absolute inset-0 rounded-full bg-primary/60 animate-ping" />
        <span className="relative flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-primary-foreground font-semibold shadow-lg shadow-primary/40 transition-transform hover:scale-110">
          <LogIn className="size-5" />
          <span className="hidden sm:inline">Login</span>
        </span>
      </Link>
    </div>
  );
}

function Stat({ top, label }: { top: string; label: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <div className="text-2xl font-bold text-primary">{top}</div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

function EssenceCard({ n, title, desc }: { n: string; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="text-xs font-mono text-primary mb-2">{n}</div>
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{desc}</p>
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
