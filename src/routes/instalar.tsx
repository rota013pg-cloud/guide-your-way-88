import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";
import { Share, Plus, MoreVertical, Smartphone } from "lucide-react";

export const Route = createFileRoute("/instalar")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Instalar o app — Rota013" },
      {
        name: "description",
        content:
          "Adicione o Rota013 à tela inicial do seu celular e use como aplicativo: passo a passo para iPhone e Android.",
      },
      { property: "og:title", content: "Instalar o app — Rota013" },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: InstalarPage,
});

function InstalarPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl">
            <div className="flex items-center gap-3">
              <Smartphone className="size-8 text-primary" />
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
                Instalar o Rota013 no seu celular
              </h1>
            </div>
            <p className="mt-4 text-muted-foreground">
              O Rota013 funciona como aplicativo direto pelo navegador. Em
              poucos toques você adiciona à tela inicial e abre como qualquer
              outro app — sem baixar nada da loja.
            </p>

            <div className="mt-10 grid gap-6 md:grid-cols-2">
              <Cartao titulo="iPhone (Safari)">
                <Passo n={1}>
                  Abra <strong>www.rota013.com.br</strong> no <strong>Safari</strong>.
                </Passo>
                <Passo n={2}>
                  Toque no botão <Share className="inline size-4 mb-0.5" />{" "}
                  <strong>Compartilhar</strong> na barra inferior.
                </Passo>
                <Passo n={3}>
                  Role e toque em{" "}
                  <strong>“Adicionar à Tela de Início”</strong>.
                </Passo>
                <Passo n={4}>
                  Confirme em <strong>Adicionar</strong>. Pronto, o ícone do
                  Rota013 vai aparecer junto dos seus apps.
                </Passo>
              </Cartao>

              <Cartao titulo="Android (Chrome)">
                <Passo n={1}>
                  Abra <strong>www.rota013.com.br</strong> no <strong>Chrome</strong>.
                </Passo>
                <Passo n={2}>
                  Toque no menu <MoreVertical className="inline size-4 mb-0.5" />{" "}
                  no canto superior direito.
                </Passo>
                <Passo n={3}>
                  Toque em{" "}
                  <strong>
                    “Adicionar à tela inicial” <Plus className="inline size-4 mb-0.5" />
                  </strong>
                  .
                </Passo>
                <Passo n={4}>
                  Confirme em <strong>Adicionar</strong>. O ícone aparece na
                  sua tela inicial.
                </Passo>
              </Cartao>
            </div>

            <p className="mt-10 text-xs text-muted-foreground">
              Dica: depois de instalado, abra pelo ícone — ele roda em tela
              cheia, igual a um app nativo.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Cartao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold text-lg">{titulo}</h2>
      <ol className="mt-4 space-y-3">{children}</ol>
    </div>
  );
}

function Passo({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-muted-foreground">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-semibold text-xs">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
