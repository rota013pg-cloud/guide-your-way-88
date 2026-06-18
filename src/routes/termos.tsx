import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/termos")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Rota013" },
      {
        name: "description",
        content:
          "Termos de Uso da plataforma Rota013: regras para passageiros, motoristas e operadores.",
      },
      { property: "og:title", content: "Termos de Uso — Rota013" },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl prose prose-invert prose-sm md:prose-base">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Termos de Uso
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Versão preliminar — substituiremos pelo texto definitivo enviado
              pelo responsável legal da Rota013.
            </p>

            <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
              <Section title="1. Aceitação">
                Ao se cadastrar e utilizar a plataforma Rota013, o usuário
                declara que leu, compreendeu e concorda com estes Termos de
                Uso e com a Política de Privacidade.
              </Section>
              <Section title="2. Serviço">
                A Rota013 é uma plataforma tecnológica que conecta passageiros
                a motoristas autônomos credenciados. A Rota013 não presta
                diretamente o serviço de transporte.
              </Section>
              <Section title="3. Cadastro">
                O usuário se compromete a fornecer dados verdadeiros, completos
                e atualizados, incluindo nome, CPF, telefone, e-mail e endereço.
              </Section>
              <Section title="4. Responsabilidades">
                O usuário se compromete a usar a plataforma de forma lícita,
                respeitando motoristas, operadores e demais passageiros.
              </Section>
              <Section title="5. Cancelamento">
                O usuário pode encerrar sua conta a qualquer momento solicitando
                pelo e-mail contato@rota013.com.br.
              </Section>
              <Section title="6. Alterações">
                A Rota013 pode atualizar estes Termos a qualquer momento, com
                aviso prévio aos usuários cadastrados.
              </Section>
              <Section title="7. Foro">
                Fica eleito o foro da comarca da sede da Rota013 para dirimir
                quaisquer controvérsias.
              </Section>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 text-sm">{children}</p>
    </div>
  );
}
