import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  BookOpen,
  LayoutDashboard,
  ListChecks,
  Users,
  UserSquare,
  DollarSign,
  Tag,
  History,
  MessageSquare,
  StickyNote,
  Settings,
  UserCog,
  Smartphone,
  AlertTriangle,
  HelpCircle,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/instrucoes")({
  component: InstrucoesPage,
});

type Secao = {
  id: string;
  titulo: string;
  icon: React.ComponentType<{ className?: string }>;
  resumo: string;
  itens: { q: string; a: React.ReactNode }[];
};

const SECOES: Secao[] = [
  {
    id: "visao-geral",
    titulo: "Visão geral do sistema",
    icon: BookOpen,
    resumo: "Como o painel se conecta com o app do motorista e o fluxo geral.",
    itens: [
      {
        q: "O que é o Rota 013 Beta?",
        a: (
          <>
            É a central de operações da plataforma. O <b>Painel do Operador</b> é
            onde corridas são criadas, despachadas e acompanhadas em tempo real.
            O <b>App do Motorista</b> (rota <code>/motorista</code>) recebe as
            ofertas, mostra o trajeto e atualiza o status de cada corrida.
            Tudo é sincronizado em tempo real via banco de dados — quando você
            atualiza algo no painel, o motorista vê instantaneamente, e
            vice-versa.
          </>
        ),
      },
      {
        q: "Fluxo resumido de uma corrida",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Operador cria a corrida em <b>Dashboard → Nova Corrida</b>.</li>
            <li>Sistema dispara ofertas para motoristas elegíveis (modo Automático ou Manual).</li>
            <li>Motorista aceita no app → status muda para <b>Aceita</b>.</li>
            <li>Motorista atualiza progresso: <b>A caminho → Chegou → Em viagem → Finalizada</b>.</li>
            <li>Operador vê tudo no Dashboard e em <b>Corridas</b>.</li>
            <li>No fim do dia, o financeiro registra a diária do motorista.</li>
          </ol>
        ),
      },
      {
        q: "Quem pode fazer o quê (perfis)",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Administrador:</b> acesso total. Pode gerenciar usuários, tarifas, configurações e cobertura.</li>
            <li><b>Operador:</b> opera o dia a dia — corridas, motoristas, clientes, financeiro, chat e histórico.</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "dashboard",
    titulo: "Dashboard",
    icon: LayoutDashboard,
    resumo: "Painel central com mapa, corridas ao vivo e ações rápidas.",
    itens: [
      {
        q: "O que aparece no Dashboard?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Mapa ao vivo:</b> posição dos motoristas online e corridas ativas.</li>
            <li><b>Cards de resumo:</b> corridas em andamento, motoristas disponíveis, pendências.</li>
            <li><b>Botão Nova Corrida:</b> abre o modal de cadastro.</li>
            <li><b>Alertas:</b> motoristas pedindo liberação de pagamento, corridas sem motorista, etc.</li>
          </ul>
        ),
      },
      {
        q: "Como criar uma nova corrida?",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Clique em <b>Nova Corrida</b>.</li>
            <li>Busque o cliente por telefone ou nome (autocomplete). Se não existir, cadastre na hora.</li>
            <li>Preencha <b>origem</b> e <b>destino</b> (autocomplete sugere bairros conhecidos).</li>
            <li>Selecione a <b>tarifa</b> (PG &gt; PG, PG &gt; SV, etc.) — o valor é calculado automaticamente.</li>
            <li>Ajuste <b>desconto</b> ou <b>cobrança adicional</b> se necessário.</li>
            <li>Escolha <b>forma de pagamento</b>.</li>
            <li>Escolha o modo de despacho: <b>Automático</b> (sistema oferece) ou <b>Manual</b> (você escolhe o motorista).</li>
            <li>Confirme — a corrida vai para "Aguardando motorista".</li>
          </ol>
        ),
      },
      {
        q: "Diferença entre modo Automático e Manual",
        a: (
          <>
            <b>Automático:</b> o sistema oferta para todos os motoristas elegíveis
            (online, sem corrida em aberto e não pausados). O primeiro a aceitar
            fica com a corrida.
            <br />
            <b>Manual:</b> você escolhe um motorista específico — só ele recebe a
            oferta. Útil para clientes que pedem um motorista de preferência.
          </>
        ),
      },
    ],
  },
  {
    id: "corridas",
    titulo: "Corridas",
    icon: ListChecks,
    resumo: "Lista de corridas ativas e gestão de status.",
    itens: [
      {
        q: "Status possíveis de uma corrida",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><Badge variant="secondary">Aguardando</Badge> — criada, sem motorista ainda.</li>
            <li><Badge>Aceita</Badge> — motorista aceitou, indo buscar o cliente.</li>
            <li><Badge>A caminho</Badge> — motorista a caminho da origem.</li>
            <li><Badge>Chegou</Badge> — motorista no local da coleta.</li>
            <li><Badge>Em viagem</Badge> — cliente a bordo.</li>
            <li><Badge>Parada</Badge> — parada técnica solicitada pelo cliente.</li>
            <li><Badge variant="outline">Finalizada</Badge> — concluída com sucesso.</li>
            <li><Badge variant="destructive">Cancelada</Badge> — cancelada por operador, motorista ou cliente.</li>
          </ul>
        ),
      },
      {
        q: "Como abrir a navegação no Waze para o motorista?",
        a: (
          <>
            Cada card de corrida tem um botão de Waze que abre o trajeto. Ao
            usá-lo, o status da corrida avança automaticamente, sinalizando que
            o motorista está em movimento.
          </>
        ),
      },
      {
        q: "Cancelamento de corrida",
        a: (
          <>
            Use o botão <b>Cancelar</b> no card. Informe o motivo (cliente
            desistiu, motorista não localizado, endereço errado). Esse registro
            entra no histórico e ajuda a identificar padrões.
          </>
        ),
      },
      {
        q: "Por que um motorista não recebe nova oferta?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Está <b>pausado</b> (veja seção Motoristas).</li>
            <li>Está <b>offline</b> (app fechado/sem conexão).</li>
            <li>Já tem corrida em andamento — só recebe nova oferta após finalizar a atual.</li>
            <li>No modo Manual, ele não foi o escolhido.</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "motoristas",
    titulo: "Motoristas",
    icon: Users,
    resumo: "Cadastro, status, pausa/retomada e documentos.",
    itens: [
      {
        q: "Cadastrar um novo motorista",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Clique em <b>Novo Motorista</b>.</li>
            <li>Preencha nome, telefone (com DDD), moto, placa e foto.</li>
            <li>O sistema gera o código (ex.: M0104).</li>
            <li>O motorista entra no app usando o telefone cadastrado e o PIN.</li>
          </ol>
        ),
      },
      {
        q: "Status do motorista",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Online/Disponível:</b> recebendo ofertas.</li>
            <li><b>Ocupado:</b> com corrida em andamento.</li>
            <li><b>Offline:</b> app fechado/sem conexão.</li>
            <li><b>Pausado:</b> bloqueado pelo operador, não recebe ofertas.</li>
          </ul>
        ),
      },
      {
        q: "Pausar / retomar um motorista",
        a: (
          <>
            Use os botões <b>Pausar</b> (âmbar) e <b>Retomar</b> (verde) no card.
            Ao pausar, opcionalmente registre um motivo (ex.: "almoço",
            "advertência", "documento vencido"). O motorista <b>não vê</b> que
            está pausado — ele simplesmente para de receber novas ofertas. Use
            isso em vez de mandar ele "ficar offline" quando quiser controle.
          </>
        ),
      },
      {
        q: "Excluir / desativar motorista",
        a: (
          <>
            Para um afastamento curto, prefira <b>Pausar</b>. Exclusão definitiva
            deve ser feita com cuidado, pois apaga o vínculo com o histórico
            (use apenas para cadastros duplicados ou de teste).
          </>
        ),
      },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes",
    icon: UserSquare,
    resumo: "Base de clientes com histórico de corridas.",
    itens: [
      {
        q: "Cadastro rápido durante a chamada",
        a: (
          <>
            Você pode cadastrar o cliente direto no modal de Nova Corrida — não
            precisa ir até a aba Clientes. Basta digitar o telefone: se não
            existir, aparece a opção "Cadastrar como novo".
          </>
        ),
      },
      {
        q: "Endereço favorito do cliente",
        a: (
          <>
            Toda corrida de um cliente fica salva no histórico dele. Da próxima
            vez, os endereços anteriores aparecem como sugestão, agilizando o
            atendimento.
          </>
        ),
      },
    ],
  },
  {
    id: "financeiro",
    titulo: "Financeiro",
    icon: DollarSign,
    resumo: "Diárias, cobranças extras e relatórios.",
    itens: [
      {
        q: "Como funciona a diária?",
        a: (
          <>
            Cada motorista paga uma <b>diária fixa</b> (valor configurado em
            Configurações). O dia operacional começa às <b>6h da manhã</b> e vai
            até as 6h do dia seguinte. Use o campo de busca por código/nome para
            achar o motorista rápido. Clique em <b>Marcar Pago</b> para
            registrar.
          </>
        ),
      },
      {
        q: "Cobranças extras (uniforme, manutenção, etc.)",
        a: (
          <>
            No painel <b>Cobranças Extras</b> você cria uma cobrança vinculada
            ao motorista. Exemplo: camiseta R$50 cobrada R$10 por dia.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><b>Categorias:</b> Uniforme/Camiseta, Itens cliente (toca, capa), Manutenção, Outro.</li>
              <li><b>Forma de cobrança:</b> por dia, fixa ou avulsa.</li>
              <li>Ao marcar a diária, um modal mostra extras pendentes e sugere o valor do dia. Você pode editar.</li>
              <li>Quando o saldo zera, a cobrança vira <b>quitada</b> automaticamente.</li>
              <li>O motorista vê o saldo devedor e o extrato no app dele, na aba Pagamentos.</li>
            </ul>
          </>
        ),
      },
      {
        q: "Pagamento parcial",
        a: (
          <>
            Sim — você pode lançar qualquer valor, mesmo abaixo da sugestão.
            Cada pagamento gera uma linha no extrato com data e operador
            responsável.
          </>
        ),
      },
      {
        q: "Relatórios e PDF",
        a: (
          <>
            Use os atalhos (Hoje, 7 dias, 30 dias, Mês) ou intervalo
            personalizado. Filtre por motorista e tipo. O botão <b>Exportar PDF</b>{" "}
            gera um relatório imprimível.
          </>
        ),
      },
    ],
  },
  {
    id: "tarifas",
    titulo: "Tarifas",
    icon: Tag,
    resumo: "Tabela de preços entre regiões (apenas Admin).",
    itens: [
      {
        q: "Como adicionar uma tarifa nova?",
        a: (
          <>
            Em <b>Tarifas</b>, clique em adicionar. Defina origem, destino e
            valor. O nome curto (ex.: PG &gt; SV) aparece no modal de Nova
            Corrida para o operador escolher rapidamente.
          </>
        ),
      },
      {
        q: "Reajuste de valores",
        a: (
          <>
            Edite a linha da tarifa. O novo valor passa a valer para <b>corridas
            criadas depois</b> — corridas já abertas mantêm o valor original.
          </>
        ),
      },
    ],
  },
  {
    id: "historico",
    titulo: "Histórico",
    icon: History,
    resumo: "Auditoria completa de corridas finalizadas/canceladas.",
    itens: [
      {
        q: "O que entra no histórico?",
        a: (
          <>
            Todas as corridas finalizadas e canceladas, com cliente, motorista,
            trajeto, valor, forma de pagamento e timeline de status. Use
            filtros por data, motorista, cliente ou tipo. Exportável em PDF.
          </>
        ),
      },
    ],
  },
  {
    id: "chat-mural",
    titulo: "Chat e Mural",
    icon: MessageSquare,
    resumo: "Comunicação com motoristas.",
    itens: [
      {
        q: "Chat motoristas",
        a: (
          <>
            Conversa em tempo real (1 a 1) com cada motorista. Útil para
            esclarecer endereço, combinar parada, alertar sobre cliente
            difícil. O motorista vê no app dele.
          </>
        ),
      },
      {
        q: "Mural",
        a: (
          <>
            Avisos públicos para <b>todos os motoristas</b>. Use para mudanças
            de tarifa, evento na cidade, manutenção do sistema, mensagens
            motivacionais. Aparece no topo do app deles.
          </>
        ),
      },
      {
        q: "Mensagens (templates WhatsApp)",
        a: (
          <>
            Templates prontos para enviar ao cliente via WhatsApp (ex.: "seu
            motorista está chegando"). Edite e salve em <b>Mensagens</b>.
          </>
        ),
      },
    ],
  },
  {
    id: "config",
    titulo: "Configurações e Usuários",
    icon: Settings,
    resumo: "Parâmetros do sistema (apenas Admin).",
    itens: [
      {
        q: "Configurações principais",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Valor da diária</b> padrão.</li>
            <li><b>Nome da empresa</b> e dados que aparecem em PDFs.</li>
            <li><b>Tema</b> claro/escuro.</li>
          </ul>
        ),
      },
      {
        q: "Criar novo operador",
        a: (
          <>
            Em <b>Usuários</b>, clique em adicionar. Defina nome, email/usuário,
            senha inicial e perfil (Operador ou Administrador). Operador <b>não
            vê</b> tarifas, configurações, usuários nem cobertura.
          </>
        ),
      },
    ],
  },
  {
    id: "app-motorista",
    titulo: "App do Motorista — dúvidas frequentes",
    icon: Smartphone,
    resumo: "O que responder quando o motorista ligar com dúvida.",
    itens: [
      {
        q: '"Não estou recebendo corridas"',
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Verifique no painel se ele está <b>Online</b>. Se Offline, pedir para abrir o app e checar internet.</li>
            <li>Veja se está <b>Pausado</b> — se sim, retome.</li>
            <li>Confirme se ele <b>não tem corrida em aberto</b> (só recebe nova após finalizar).</li>
            <li>Confirme que a diária do dia foi paga (em alguns fluxos, sem diária ele fica bloqueado).</li>
            <li>Peça para fechar e abrir o app, ou puxar para atualizar.</li>
          </ol>
        ),
      },
      {
        q: '"O app não abriu a oferta / perdi a corrida"',
        a: (
          <>
            Pode ser bateria/conexão. A oferta tem tempo limite — se ele não
            aceitar, vai pro próximo. Oriente a manter o app aberto, som ligado
            e o celular com bateria.
          </>
        ),
      },
      {
        q: '"Aceitei mas o cliente não está no endereço"',
        a: (
          <>
            Oriente a marcar <b>Chegou</b> e aguardar alguns minutos. Use o
            chat para acionar o operador, que confirma o local por telefone com
            o cliente.
          </>
        ),
      },
      {
        q: '"Como vejo quanto devo da camiseta/manutenção?"',
        a: (
          <>
            Na aba <b>Pagamentos</b> do app aparece o saldo total e cada item
            (total, pago, saldo). Toque para ver o extrato detalhado de cada
            cobrança.
          </>
        ),
      },
      {
        q: '"Esqueci a senha / não consigo entrar"',
        a: (
          <>
            Em <b>Motoristas</b>, gere um novo PIN para ele ou redefina pelo
            cadastro. Confirme o telefone — é a chave de login.
          </>
        ),
      },
      {
        q: '"Quero ficar offline mas continuar logado"',
        a: (
          <>
            No próprio app há a opção de mudar status para offline. Se preferir,
            o operador pode <b>pausar</b> — o motorista nem precisa saber, e ele
            simplesmente para de receber ofertas.
          </>
        ),
      },
      {
        q: '"Como cancelo uma corrida?"',
        a: (
          <>
            Oriente a sempre <b>contatar o operador antes</b>. Cancelamentos
            seguidos prejudicam a operação. Quando inevitável, registre o
            motivo.
          </>
        ),
      },
    ],
  },
  {
    id: "boas-praticas",
    titulo: "Boas práticas e atalhos do operador",
    icon: AlertTriangle,
    resumo: "Dicas para não travar a operação.",
    itens: [
      {
        q: "Antes de despachar",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirme telefone e ponto de referência com o cliente.</li>
            <li>Veja se há motorista próximo no mapa antes de prometer ETA.</li>
            <li>Em horário de pico, prefira modo <b>Automático</b>.</li>
          </ul>
        ),
      },
      {
        q: "Cliente reclamou do motorista",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Registre tudo no <b>histórico</b> (campo de observação).</li>
            <li>Use o chat para conversar com o motorista.</li>
            <li>Casos graves: <b>pause</b> o motorista e converse off-line.</li>
          </ul>
        ),
      },
      {
        q: "Fim de turno / passagem de plantão",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Confira corridas em aberto — nenhuma deve ficar "Aguardando" sem motivo.</li>
            <li>Confirme com o próximo operador motoristas pausados e o porquê.</li>
            <li>Faça um resumo no chat ou mural se houver algo crítico.</li>
          </ul>
        ),
      },
    ],
  },
];

function InstrucoesPage() {
  const [busca, setBusca] = useState("");

  const secoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return SECOES;
    return SECOES.map((s) => ({
      ...s,
      itens: s.itens.filter((i) => {
        const texto = (i.q + " " + JSON.stringify(i.a)).toLowerCase();
        return texto.includes(termo) || s.titulo.toLowerCase().includes(termo);
      }),
    })).filter((s) => s.itens.length > 0);
  }, [busca]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2.5">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Manual do Operador</h1>
          <p className="text-sm text-muted-foreground">
            Guia completo de operação do Rota 013 Beta — fluxos do painel,
            atendimento ao motorista e respostas para dúvidas comuns.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no manual… (ex.: pausar, diária, cobrança, oferta)"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-9"
        />
      </div>

      {secoesFiltradas.length === 0 && (
        <div className="text-center text-sm text-muted-foreground py-12">
          Nenhum resultado para "{busca}".
        </div>
      )}

      <div className="grid gap-4">
        {secoesFiltradas.map((secao) => {
          const Icon = secao.icon;
          return (
            <Card key={secao.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Icon className="h-5 w-5 text-primary" />
                  {secao.titulo}
                </CardTitle>
                <p className="text-xs text-muted-foreground">{secao.resumo}</p>
              </CardHeader>
              <CardContent>
                <Accordion type="multiple" className="w-full">
                  {secao.itens.map((item, idx) => (
                    <AccordionItem key={idx} value={`${secao.id}-${idx}`}>
                      <AccordionTrigger className="text-left text-sm font-medium">
                        <span className="flex items-center gap-2">
                          <HelpCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                          {item.q}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="text-center text-xs text-muted-foreground pt-4">
        Não encontrou a resposta? Fale com o administrador ou registre a dúvida
        no chat interno.
      </div>
    </div>
  );
}
