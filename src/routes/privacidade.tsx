import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-header";

export const Route = createFileRoute("/privacidade")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Rota013" },
      {
        name: "description",
        content:
          "Como a Rota013 coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — Rota013" },
    ],
    links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />
      <main className="flex-1">
        <section className="px-5 pt-12 pb-14 md:pt-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              Política de Privacidade
            </h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Versão preliminar — alinhada à LGPD (Lei 13.709/2018). O texto
              definitivo será publicado pelo responsável legal da Rota013.
            </p>

            <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
              <Section title="Dados que coletamos">
                Nome, CPF, telefone, e-mail, endereço e localização durante o
                uso do serviço. Para motoristas, também documentos de
                habilitação e do veículo.
              </Section>
              <Section title="Como usamos">
                Para criar e manter sua conta, conectar passageiros e
                motoristas, processar pagamentos, atender obrigações legais e
                melhorar o serviço.
              </Section>
              <Section title="Compartilhamento">
                Compartilhamos apenas o necessário para a execução da corrida
                (passageiro ↔ motorista) e com provedores de tecnologia que
                operam para nós (hospedagem, mapas, mensagens), todos
                obrigados ao sigilo.
              </Section>
              <Section title="Seus direitos (LGPD)">
                Acesso, correção, exclusão, portabilidade e revogação de
                consentimento. Solicitações podem ser enviadas para
                contato@rota013.com.br.
              </Section>
              <Section title="Segurança">
                Adotamos medidas técnicas e organizacionais para proteger seus
                dados contra acesso não autorizado, perda ou divulgação
                indevida.
              </Section>
              <Section title="Retenção">
                Mantemos seus dados enquanto sua conta estiver ativa e pelo
                prazo legal exigido após o encerramento.
              </Section>
              <Section title="Contato do encarregado (DPO)">
                contato@rota013.com.br
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
