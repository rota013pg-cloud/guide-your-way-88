import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/excluir-conta")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exclusão de conta — Rota 013" },
      {
        name: "description",
        content:
          "Como excluir sua conta no aplicativo Rota 013 e o que acontece com seus dados.",
      },
      { property: "og:title", content: "Exclusão de conta — Rota 013" },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: ExcluirContaPage,
});

function ExcluirContaPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Exclusão de conta
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Aplicativo <strong>Rota 013</strong>, desenvolvido por <strong>ROTA 013 LTDA</strong>.
              Esta página explica como solicitar a exclusão da sua conta e o que acontece com seus dados.
            </p>

            <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
              <Section title="Como excluir sua conta pelo aplicativo">
                <ol className="list-decimal pl-5 space-y-1 mt-1">
                  <li>Abra o app Rota 013 e faça login.</li>
                  <li>Toque no menu e acesse <strong>Meus Dados</strong> (Perfil).</li>
                  <li>Role até a seção <strong>Excluir conta</strong>.</li>
                  <li>Toque em <strong>Excluir minha conta</strong> e confirme.</li>
                </ol>
                <p className="mt-2">
                  A exclusão é imediata: seu acesso é encerrado e seus dados pessoais são removidos.
                </p>
              </Section>

              <Section title="Como solicitar por e-mail">
                Se preferir, envie um pedido de exclusão para <strong>contato@rota013.com.br</strong>,
                a partir do e-mail cadastrado na sua conta. Concluímos a remoção em até 30 dias.
              </Section>

              <Section title="Quais dados são excluídos">
                Seus dados pessoais são apagados ou anonimizados de forma permanente: nome, e-mail,
                telefone, CPF e endereço. Também são removidos a senha de acesso, as sessões ativas
                e os tokens de notificação do dispositivo. Após a exclusão, não é mais possível
                entrar na conta.
              </Section>

              <Section title="Quais dados são mantidos e por quê">
                O histórico de corridas é mantido de forma <strong>anonimizada</strong> (sem
                identificar você), pois é necessário para registros operacionais e para o
                cumprimento de obrigações legais e fiscais.
              </Section>

              <Section title="Período de retenção">
                Os dados pessoais são removidos imediatamente no momento da exclusão. Os registros
                anonimizados de corridas podem ser mantidos pelo prazo exigido pela legislação
                aplicável (por exemplo, obrigações fiscais), sem qualquer dado que identifique você.
              </Section>

              <Section title="Contato">
                Dúvidas sobre exclusão de conta ou privacidade: <strong>contato@rota013.com.br</strong>.
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
      <div className="mt-2 text-sm">{children}</div>
    </div>
  );
}
