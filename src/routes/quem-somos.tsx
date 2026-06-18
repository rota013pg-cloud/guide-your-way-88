import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/quem-somos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Quem somos — Rota013" },
      {
        name: "description",
        content:
          "A Rota013 nasceu para profissionalizar o transporte por moto no Litoral Sul de SP, conectando passageiros e mototaxistas com tecnologia simples e confiável.",
      },
      { property: "og:title", content: "Quem somos — Rota013" },
      {
        property: "og:description",
        content:
          "Conheça a história, missão e propósito da Rota013, plataforma de mobilidade do Litoral Sul de SP.",
      },
    ],
  }),
  component: QuemSomosPage,
});

function QuemSomosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Quem somos
            </h1>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              A Rota013 é uma plataforma de mobilidade criada para organizar e
              profissionalizar o serviço de mobilidade urbana e táxi no Litoral Sul de
              São Paulo. Conectamos passageiros, motoristas e operadores em uma
              única central, com tecnologia simples, transparente e construída
              localmente.
            </p>

            <div className="mt-12 grid gap-6 md:grid-cols-3">
              <Card title="Missão">
                Levar mobilidade rápida, segura e acessível para quem vive e
                visita o Litoral Sul de SP.
              </Card>
              <Card title="Visão">
                Ser a principal central de transporte por moto e táxi da
                região, referência em confiança e eficiência.
              </Card>
              <Card title="Propósito">
                Gerar renda digna para motoristas locais e devolver tempo e
                tranquilidade ao passageiro.
              </Card>
            </div>

            <div className="mt-12 rounded-2xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">Fala com a gente</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                E-mail:{" "}
                <a className="text-foreground underline" href="mailto:contato@rota013.com.br">
                  contato@rota013.com.br
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
