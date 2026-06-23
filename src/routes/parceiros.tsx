import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { DollarSign, Clock, ClipboardList, Handshake, ShieldCheck, MapPin } from "lucide-react";

export const Route = createFileRoute("/parceiros")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Seja parceiro Rota013 — 100% dos ganhos das corridas" },
      {
        name: "description",
        content:
          "Trabalhe como motociclista parceiro Rota013 em Praia Grande. Você fica com 100% do valor de cada corrida. Diária fixa, horário livre.",
      },
      { property: "og:title", content: "Seja parceiro Rota013" },
      {
        property: "og:description",
        content:
          "100% dos ganhos para o motociclista. Sem comissão, sem fidelidade. Cadastre-se agora.",
      },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: ParceirosPage,
});

const WHATS_MOT = "https://wa.me/5513978120209?text=Ol%C3%A1!%20Tenho%20interesse%20em%20ser%20motociclista%20parceiro%20da%20Rota013.";

function ParceirosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-4xl text-center">
            <div className="inline-block text-xs uppercase tracking-widest text-primary mb-4">
              🔥 Vagas abertas — Praia Grande e Litoral Sul
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight leading-tight">
              Trabalhe livre.{" "}
              <span className="italic text-primary">Ganhe tudo.</span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
              Na Rota013 você não divide o valor das corridas com nenhuma plataforma.
              Trabalha no seu horário, aceita as corridas que quiser e recebe{" "}
              <strong className="text-foreground">100% do valor direto do passageiro.</strong>
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={WHATS_MOT} target="_blank" rel="noreferrer">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  📲 Falar com a central agora
                </Button>
              </a>
              <a href="#como-funciona">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  Ver como funciona
                </Button>
              </a>
            </div>
          </div>

          <div className="mx-auto max-w-3xl mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat top="100%" label="dos ganhos para você" />
            <Stat top="0%" label="de comissão" />
            <Stat top="Livre" label="para escolher horários" />
            <Stat top="R$ 20,00" label="diária fixa única" />
          </div>
        </section>

        {/* Quanto pode ganhar */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-4xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">Quanto você pode ganhar?</h2>
              <p className="mt-3 text-muted-foreground">
                Em outras plataformas você perde de 20% a 30% por corrida. Na Rota013, zero.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-border bg-card p-6">
                <div className="text-sm text-muted-foreground">Outras plataformas</div>
                <div className="mt-2 text-xl font-semibold">Corrida de R$ 15,00</div>
                <div className="mt-4 text-destructive">A plataforma fica: − R$ 3,75 a R$ 4,50</div>
                <div className="mt-2 text-muted-foreground">Você recebe:</div>
                <div className="text-2xl font-bold">R$ 10,50 — R$ 11,25</div>
              </div>
              <div className="rounded-2xl border border-primary/50 bg-card p-6">
                <div className="text-sm text-primary">Rota013</div>
                <div className="mt-2 text-xl font-semibold">Corrida de R$ 15,00</div>
                <div className="mt-4 text-success">A plataforma fica: R$ 0,00</div>
                <div className="mt-2 text-muted-foreground">Você recebe:</div>
                <div className="text-2xl font-bold text-primary">R$ 15,00 inteiros 🏆</div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-lg">
                <strong>10 corridas/dia</strong> × R$ 13,00 médio ={" "}
                <strong>R$ 130,00/dia</strong>
              </p>
              <p className="mt-1 text-muted-foreground">
                <strong>20 dias/mês</strong> = <strong className="text-primary">R$ 2.600,00/mês</strong> líquido
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Taxa fixa <strong>R$ 20,00/dia</strong>. Em 2 ou 3 corridas você já paga a
                taxa — o restante é todo seu.
              </p>
            </div>
          </div>
        </section>

        {/* Como funciona */}
        <section id="como-funciona" className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">Como funciona para o motociclista?</h2>
              <p className="mt-3 text-muted-foreground">
                Simples, direto e transparente. A central organiza, você trabalha.
              </p>
            </div>
            <div className="grid md:grid-cols-5 sm:grid-cols-2 gap-4">
              <Step n="1" title="Cadastro" desc="Entre em contato com a central pelo WhatsApp e faça seu cadastro como parceiro." />
              <Step n="2" title="Corrida disponível" desc="Instale o aplicativo e faça o login. Quando estiver on-line e surgirem corridas próximas a você, estas serão ofertadas no seu aplicativo." />
              <Step n="3" title="Você decide" desc="Aceita ou não. Sem punição, sem nota negativa, sem pressão." />
              <Step n="4" title="Realiza a corrida" desc="Pega o passageiro, faz o trajeto e recebe o valor na entrega." />
              <Step n="5" title="Avisa a central" desc="Ao finalizar, comunica a central. Pronto — próxima corrida." />
            </div>
          </div>
        </section>

        {/* Por que */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-5xl">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold">
                Por que ser parceiro <span className="text-primary">Rota013</span>?
              </h2>
              <p className="mt-3 text-muted-foreground">
                Tudo pensado para o motociclista trabalhar bem e ganhar mais.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
              <ValueCard icon={<DollarSign className="size-5" />} title="100% dos ganhos" desc="Valor integral de cada corrida. Sem percentual para a plataforma." />
              <ValueCard icon={<Clock className="size-5" />} title="Horário livre" desc="Trabalha quando quiser. Sem metas obrigatórias." />
              <ValueCard icon={<ClipboardList className="size-5" />} title="Corridas organizadas" desc="Nome do cliente, origem, destino e valor antes de aceitar." />
              <ValueCard icon={<Handshake className="size-5" />} title="Sem fidelidade" desc="Trabalhe em outras plataformas ao mesmo tempo." />
              <ValueCard icon={<ShieldCheck className="size-5" />} title="Central intermediando" desc="A central filtra demanda e garante o bom funcionamento." />
              <ValueCard icon={<MapPin className="size-5" />} title="Corridas locais" desc="Trabalhe perto de casa. Menos deslocamento vazio." />
            </div>
          </div>
        </section>

        {/* Requisitos */}
        <section className="px-5 py-14 border-t border-border/60">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center">
              O que você precisa para entrar?
            </h2>
            <p className="mt-3 text-muted-foreground text-center">
              Requisitos simples. Se você tem moto e responsabilidade, tem tudo.
            </p>
            <ul className="mt-8 grid sm:grid-cols-2 gap-3">
              {[
                "Moto própria em bom estado",
                "CNH categoria A",
                "WhatsApp ativo",
                "Residir no litoral sul de SP",
                "Responsabilidade e pontualidade",
                "Vontade de trabalhar",
              ].map((r) => (
                <li key={r} className="rounded-xl border border-border bg-card p-4 text-sm">
                  ✅ {r}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA final */}
        <section className="px-5 py-16 border-t border-border/60">
          <div className="mx-auto max-w-3xl text-center rounded-2xl border border-primary/40 bg-card p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-bold">
              Pronto para trabalhar e ganhar <span className="text-primary">100%</span>?
            </h2>
            <p className="mt-3 text-muted-foreground">
              Fale com a central agora pelo WhatsApp e comece ainda essa semana.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a href={WHATS_MOT} target="_blank" rel="noreferrer">
                <Button size="lg" className="rounded-xl w-full sm:w-auto">
                  📲 Quero ser motociclista parceiro
                </Button>
              </a>
              <Link to="/como-funciona">
                <Button size="lg" variant="outline" className="rounded-xl w-full sm:w-auto">
                  Como funciona para o cliente
                </Button>
              </Link>
            </div>
            <div className="mt-4 text-sm text-muted-foreground">(13) 97812-0209</div>
          </div>
        </section>
      </main>

      <SiteFooter />
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
