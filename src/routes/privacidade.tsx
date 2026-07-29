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
          "Como a Rota013 coleta, usa e protege seus dados pessoais, incluindo como solicitar a exclusão dos seus dados, em conformidade com a LGPD.",
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
              Esta Política de Privacidade explica como a <strong>ROTA 013 LTDA</strong> ("Rota 013",
              "nós") coleta, usa, compartilha e protege os dados pessoais dos usuários dos aplicativos
              Rota 013 (cliente e motociclista), em conformidade com a Lei Geral de Proteção de Dados
              (LGPD — Lei nº 13.709/2018). Última atualização: julho de 2026.
            </p>

            <div className="mt-10 space-y-6 text-muted-foreground leading-relaxed">
              <Section title="Dados que coletamos">
                Nome, CPF, telefone, e-mail, endereço e localização durante o uso do serviço.
                Coletamos também identificadores do dispositivo e tokens de notificação. Para
                motociclistas, coletamos ainda documentos de habilitação e do veículo.
              </Section>
              <Section title="Como usamos">
                Para criar e manter sua conta, conectar passageiros e motociclistas, permitir o
                acompanhamento da corrida em tempo real, enviar notificações, atender obrigações
                legais e melhorar o serviço.
              </Section>
              <Section title="Localização">
                Usamos a localização durante o uso do serviço para conectar você ao motociclista e
                acompanhar o trajeto. No aplicativo do motociclista, a localização pode ser coletada
                <strong> em segundo plano</strong> (mesmo com o app fechado ou a tela bloqueada)
                enquanto ele está online, para que a central e o cliente acompanhem a corrida. A
                coleta em segundo plano cessa quando o motociclista fica offline.
              </Section>
              <Section title="Compartilhamento">
                Compartilhamos apenas o necessário para a execução da corrida (passageiro ↔
                motociclista) e com provedores de tecnologia que operam para nós (hospedagem, mapas,
                mensagens e notificações), todos obrigados ao sigilo. Não vendemos seus dados.
              </Section>

              <Section title="Exclusão dos seus dados">
                Você pode solicitar a exclusão da sua conta e dos seus dados pessoais a qualquer
                momento, por qualquer uma destas formas:
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>
                    <strong>Pelo aplicativo:</strong> faça login, acesse <strong>Meus Dados
                    (Perfil)</strong>, role até <strong>Excluir conta</strong> e toque em{" "}
                    <strong>Excluir minha conta</strong>. A exclusão é imediata.
                  </li>
                  <li>
                    <strong>Por e-mail:</strong> envie um pedido para{" "}
                    <strong>contato@rota013.com.br</strong> a partir do e-mail cadastrado na sua
                    conta. Concluímos a remoção em até 30 dias.
                  </li>
                </ul>
                <p className="mt-2">
                  Ao excluir, seus dados pessoais (nome, e-mail, telefone, CPF, endereço, senha,
                  sessões ativas e tokens de notificação) são apagados ou anonimizados de forma
                  permanente. O histórico de corridas pode ser mantido de forma anonimizada (sem
                  identificar você) para cumprimento de obrigações legais e fiscais. Instruções
                  detalhadas em{" "}
                  <a
                    href="/excluir-conta"
                    className="text-primary font-medium underline underline-offset-2"
                  >
                    rota013.com.br/excluir-conta
                  </a>
                  .
                </p>
              </Section>

              <Section title="Seus direitos (LGPD)">
                Você tem direito de acesso, correção, exclusão, portabilidade e revogação do
                consentimento sobre seus dados. Para exercer esses direitos, escreva para{" "}
                <strong>contato@rota013.com.br</strong> ou use as opções descritas na seção
                "Exclusão dos seus dados" acima.
              </Section>
              <Section title="Segurança">
                Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso
                não autorizado, perda ou divulgação indevida.
              </Section>
              <Section title="Retenção">
                Mantemos seus dados pessoais enquanto sua conta estiver ativa. Após a exclusão, os
                dados pessoais são removidos; registros anonimizados podem ser mantidos pelo prazo
                exigido pela legislação aplicável.
              </Section>
              <Section title="Contato do encarregado (DPO)">
                Dúvidas sobre esta política ou sobre seus dados: <strong>contato@rota013.com.br</strong>.
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
