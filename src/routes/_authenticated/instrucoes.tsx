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
  Settings,
  Smartphone,
  AlertTriangle,
  HelpCircle,
  Search,
  Bike,
  CircleSlash,
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
    resumo: "Como o painel, o app do cliente e o app do motociclista se conectam.",
    itens: [
      {
        q: "O que é o Rota 013 hoje?",
        a: (
          <>
            É uma plataforma de mobilidade por motocicleta com <b>dois aplicativos
            próprios</b> e uma <b>Central de Operações</b> (este painel):
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li><b>App do Cliente</b> — o passageiro se cadastra, pede a corrida, vê o valor antes, acompanha o motociclista no mapa e conversa pelo chat.</li>
              <li><b>App do Motociclista</b> — o parceiro fica online, recebe e aceita corridas, envia a localização em tempo real e usa chat e botão de emergência.</li>
              <li><b>Painel do Operador</b> — acompanha tudo em tempo real, apoia, monitora os chats, resolve ocorrências e cuida do financeiro.</li>
            </ul>
            Tudo é sincronizado: o que muda em um lado aparece no outro em segundos.
          </>
        ),
      },
      {
        q: "Fluxo resumido de uma corrida",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>O <b>cliente pede a corrida pelo app</b> (ou o operador cria pelo Dashboard).</li>
            <li>O sistema calcula o valor e <b>despacha automaticamente</b> para os motociclistas online mais próximos (por GPS).</li>
            <li>Se ninguém aceita, o sistema <b>reoferta</b> em rodadas para mais motociclistas.</li>
            <li>Um motociclista aceita → status <b>Aceita</b>; o app do cliente mostra os dados e a localização em tempo real.</li>
            <li>Progresso: <b>A caminho → Chegou → Em viagem → Finalizada</b>.</li>
            <li>Durante a corrida, cliente e motociclista podem conversar no <b>chat da corrida</b> (a central monitora).</li>
            <li>O operador acompanha tudo no Dashboard, em Corridas e em Corridas não aceitas.</li>
          </ol>
        ),
      },
      {
        q: "Quem pode fazer o quê (perfis)",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Administrador:</b> acesso total — usuários, tarifas, configurações, aprovação de motociclistas.</li>
            <li><b>Operador:</b> o dia a dia — acompanha corridas, motociclistas, clientes, financeiro, chats e histórico. Não aprova cadastros nem mexe em configurações críticas.</li>
          </ul>
        ),
      },
      {
        q: "O pagamento passa pela plataforma?",
        a: (
          <>
            Não. O pagamento da corrida é <b>direto ao motociclista</b> (PIX, dinheiro
            ou cartão), <b>antes</b> do início do deslocamento. A plataforma cobra
            apenas a <b>diária</b> do motociclista. A única exceção é a mediação de
            <b> reembolso</b> quando uma corrida paga não é concluída (ver Corridas).
          </>
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
            <li><b>Mapa ao vivo:</b> posição dos motociclistas online e corridas ativas.</li>
            <li><b>Cards de resumo:</b> corridas em andamento, motociclistas disponíveis, pendências.</li>
            <li><b>Botão Nova Corrida:</b> abre o modal para o operador criar uma corrida.</li>
            <li><b>Alertas:</b> motociclistas pedindo liberação de pagamento, corridas sem motociclista, etc.</li>
          </ul>
        ),
      },
      {
        q: "Preciso criar as corridas manualmente?",
        a: (
          <>
            Não necessariamente. Na maioria dos casos o <b>cliente cria a corrida pelo
            app</b> e o sistema despacha sozinho. O botão <b>Nova Corrida</b> é para
            quando o atendimento vem pela central (WhatsApp/telefone) ou para
            agendamentos.
          </>
        ),
      },
      {
        q: "Como criar uma nova corrida pelo painel?",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Clique em <b>Nova Corrida</b>.</li>
            <li>Busque o cliente por telefone ou nome. Se não existir, cadastre na hora.</li>
            <li>Preencha <b>origem</b> e <b>destino</b> (o autocomplete sugere endereços).</li>
            <li>O <b>valor</b> é calculado pela tabela de tarifas; ajuste desconto/adicional se necessário.</li>
            <li>Escolha a <b>forma de pagamento</b>.</li>
            <li>Escolha o despacho: <b>Automático</b> (sistema oferta aos mais próximos), <b>Manual</b> (você escolhe o motociclista) ou <b>WhatsApp</b>.</li>
            <li>Confirme — a corrida entra como <b>Pendente</b> e começa a ser ofertada.</li>
          </ol>
        ),
      },
      {
        q: "Modos de despacho",
        a: (
          <>
            <b>Automático:</b> oferta por proximidade (GPS) aos motociclistas online,
            sem corrida em aberto e não pausados. O primeiro a aceitar fica com a corrida.
            <br />
            <b>Manual:</b> você escolhe um ou mais motociclistas específicos — só eles recebem a oferta.
            <br />
            <b>WhatsApp:</b> gera o texto da corrida para você despachar pelo WhatsApp.
          </>
        ),
      },
    ],
  },
  {
    id: "corridas",
    titulo: "Corridas",
    icon: ListChecks,
    resumo: "Status, despacho automático, reofertas, cancelamento e reembolso.",
    itens: [
      {
        q: "Status possíveis de uma corrida",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><Badge variant="secondary">Pendente</Badge> — criada, aguardando despacho.</li>
            <li><Badge variant="secondary">Ofertada</Badge> — enviada aos motociclistas, aguardando aceite.</li>
            <li><Badge>Aceita</Badge> — motociclista aceitou.</li>
            <li><Badge>A caminho</Badge> — indo até a origem.</li>
            <li><Badge>Chegou</Badge> — no local da coleta.</li>
            <li><Badge>Em viagem</Badge> — cliente a bordo.</li>
            <li><Badge>Parada</Badge> — parada durante a corrida.</li>
            <li><Badge variant="outline">Finalizada</Badge> — concluída.</li>
            <li><Badge variant="destructive">Cancelada</Badge> — cancelada por operador, motociclista, cliente ou pelo sistema (sem aceite).</li>
          </ul>
        ),
      },
      {
        q: "Como funciona o despacho automático e as reofertas?",
        a: (
          <>
            A corrida é ofertada primeiro aos motociclistas online <b>mais próximos</b>
            da origem. Se ninguém aceitar em alguns segundos, o sistema <b>reoferta</b>
            automaticamente para mais motociclistas, em rodadas. Ele tenta até
            <b> 5 rodadas</b>; se ainda assim ninguém aceitar, a corrida é <b>encerrada
            automaticamente</b> e o cliente é avisado (ver <b>Corridas não aceitas</b>).
          </>
        ),
      },
      {
        q: "O cliente pediu, mas não tinha ninguém online — o que acontece?",
        a: (
          <>
            O sistema encerra a corrida na hora e o app do cliente mostra
            "Não localizamos nenhum motociclista online". Esse registro aparece na
            página <b>Corridas não aceitas</b>, com o motivo.
          </>
        ),
      },
      {
        q: "Cancelamento de corrida",
        a: (
          <>
            Use o botão <b>Cancelar</b> no card e registre o motivo. Todo cancelamento
            entra no histórico. Não há taxa de cancelamento; casos recorrentes são
            analisados.
          </>
        ),
      },
      {
        q: "Reembolso quando a corrida foi paga e não concluída",
        a: (
          <>
            Como o pagamento é antecipado ao motociclista, se uma corrida paga não é
            concluída, o <b>motociclista é o primeiro responsável</b> por devolver o
            valor. A central pode <b>tomar a frente</b>: ressarcir o cliente
            diretamente ou <b>designar outro motociclista</b> para concluir, e depois
            <b> recuperar o valor</b> do motociclista que não concluiu (desconto na
            diária, acordo). Registre sempre a ocorrência.
          </>
        ),
      },
      {
        q: "Por que um motociclista não recebe nova oferta?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Está <b>pausado</b> (veja seção Motociclistas).</li>
            <li>Está <b>offline</b> (app fechado/sem conexão) ou com a diária bloqueada.</li>
            <li>Já tem corrida em andamento — só recebe nova após finalizar.</li>
            <li>No modo Manual, ele não foi o escolhido.</li>
          </ul>
        ),
      },
    ],
  },
  {
    id: "corridas-nao-aceitas",
    titulo: "Corridas não aceitas",
    icon: CircleSlash,
    resumo: "Registro das corridas encerradas por falta de aceite.",
    itens: [
      {
        q: "Para que serve essa página?",
        a: (
          <>
            Lista as corridas que foram <b>encerradas porque nenhum motociclista
            aceitou</b> — seja porque não havia ninguém online na hora, seja porque
            ninguém aceitou após as 5 rodadas de oferta. Serve para você entender a
            demanda não atendida e agir (chamar mais gente pra ficar online, etc.).
          </>
        ),
      },
      {
        q: "O que dá para ver de cada corrida?",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Cliente, origem/destino, valor e nº de rodadas tentadas.</li>
            <li>O <b>motivo</b> do encerramento (ninguém online / ninguém aceitou após 5 rodadas).</li>
            <li>A lista de <b>quais motociclistas receberam a oferta e não aceitaram</b>, com a resposta de cada um (Não respondeu / Recusou).</li>
          </ul>
        ),
      },
      {
        q: "Como usar isso na prática?",
        a: (
          <>
            Se aparecerem muitas corridas não aceitas em um horário/bairro, é sinal de
            falta de motociclistas online ali. Use o <b>chat</b> ou o <b>mural</b> para
            chamar parceiros para a região.
          </>
        ),
      },
    ],
  },
  {
    id: "motociclistas",
    titulo: "Motociclistas",
    icon: Users,
    resumo: "Cadastro, login, status, pausa/retomada.",
    itens: [
      {
        q: "Cadastrar um novo motociclista",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Clique em <b>Novo Motociclista</b> (somente Administrador aprova cadastros).</li>
            <li>Preencha nome, telefone, CPF, moto, placa, cor e foto/documentos.</li>
            <li>O sistema gera o <b>código</b> (ex.: M0007) e uma <b>senha inicial</b>.</li>
            <li>O motociclista entra no app com o <b>código e a senha</b>.</li>
          </ol>
        ),
      },
      {
        q: "O sistema evita cadastro duplicado?",
        a: (
          <>
            Sim. Ao salvar, o sistema bloqueia se já existir outro motociclista com o
            mesmo <b>CPF</b>, <b>telefone</b> ou <b>placa</b>, mostrando um aviso com o
            código do cadastro que já usa aquele dado.
          </>
        ),
      },
      {
        q: "Como o motociclista faz login?",
        a: (
          <>
            Pelo <b>código</b> (ex.: M0007) e a <b>senha</b> — não é por e-mail. O
            sistema permite <b>um dispositivo por vez</b>: ao entrar em outro aparelho,
            aparece aviso de sessão ativa. Para trocar de aparelho, ele sai no anterior
            ou você dá suporte pelo painel.
          </>
        ),
      },
      {
        q: "Status do motociclista",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Online:</b> recebendo ofertas.</li>
            <li><b>Em corrida:</b> com corrida em andamento.</li>
            <li><b>Offline:</b> app fechado/sem conexão.</li>
            <li><b>Pausado:</b> bloqueado pelo operador — não recebe ofertas.</li>
          </ul>
        ),
      },
      {
        q: "Pausar / retomar um motociclista",
        a: (
          <>
            Use <b>Pausar</b> (âmbar) e <b>Retomar</b> (verde) no card. Pausado, ele
            simplesmente para de receber ofertas (não precisa ficar offline). Registre
            um motivo quando fizer sentido.
          </>
        ),
      },
      {
        q: "Resetar senha ou dispositivo",
        a: (
          <>
            No cadastro do motociclista o Administrador pode <b>redefinir a senha</b> e
            <b> resetar o dispositivo</b> (útil quando ele troca de celular e fica preso
            na trava de "sessão em outro dispositivo").
          </>
        ),
      },
    ],
  },
  {
    id: "clientes",
    titulo: "Clientes",
    icon: UserSquare,
    resumo: "Base de clientes e cadastro pelo app ou pela central.",
    itens: [
      {
        q: "Como o cliente é cadastrado?",
        a: (
          <>
            Na maioria dos casos o próprio cliente se cadastra no <b>App do Cliente</b>
            (nome, e-mail, senha, telefone, CPF; endereço é opcional). Você também pode
            cadastrar pela central, direto no modal de Nova Corrida.
          </>
        ),
      },
      {
        q: "Cadastro duplicado de cliente",
        a: (
          <>
            O sistema impede duas contas com o mesmo <b>e-mail</b>, <b>CPF</b> ou
            <b> telefone</b>, avisando na hora do cadastro.
          </>
        ),
      },
      {
        q: "Histórico e endereços do cliente",
        a: (
          <>
            Toda corrida fica no histórico do cliente. Endereços usados antes aparecem
            como sugestão, agilizando o próximo pedido.
          </>
        ),
      },
    ],
  },
  {
    id: "app-cliente",
    titulo: "App do Cliente — como funciona",
    icon: Smartphone,
    resumo: "O que o passageiro faz no app dele.",
    itens: [
      {
        q: "Como o cliente pede uma corrida?",
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Informa origem e destino no app.</li>
            <li>Vê o <b>valor</b> calculado e confirma.</li>
            <li>O sistema procura o motociclista mais próximo automaticamente.</li>
            <li>Ao ser aceita, o app mostra foto, nome, moto e placa, e a localização em tempo real.</li>
            <li>O pagamento é feito direto ao motociclista, antes de iniciar.</li>
          </ol>
        ),
      },
      {
        q: "O cliente fala com quem pelo chat?",
        a: (
          <>
            Fora de uma corrida, o chat do cliente é com a <b>Central</b>. <b>Durante a
            corrida</b>, o chat passa a ser <b>direto com o motociclista</b> (com a
            central monitorando); ao finalizar, volta a ser com a Central. Números de
            telefone nunca são compartilhados.
          </>
        ),
      },
      {
        q: "E se não achar motociclista?",
        a: (
          <>
            O app avisa que não há motociclista online no momento e encerra o pedido —
            e o caso fica registrado em <b>Corridas não aceitas</b> no painel.
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
            Cada motociclista paga uma <b>diária fixa</b>. Ela <b>começa na primeira
            corrida aceita do dia</b> e vale <b>até as 6h do dia seguinte</b>. O
            pagamento é por PIX com comprovante; o operador valida e libera o acesso.
            Se a diária não é paga, o app inicia bloqueado na próxima sessão.
          </>
        ),
      },
      {
        q: "Bloqueio automático",
        a: (
          <>
            Quando o faturamento do motociclista chega a ~50% acima do valor da diária,
            o app pode ser bloqueado para cobrança da próxima diária. Desbloqueio:
            PIX → comprovante → validação → liberação.
          </>
        ),
      },
      {
        q: "Cobranças extras (uniforme, manutenção, etc.)",
        a: (
          <>
            Em <b>Cobranças Extras</b> você cria uma cobrança vinculada ao motociclista.
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>Categorias: Uniforme/Camiseta, Itens do cliente, Manutenção, Outro.</li>
              <li>Forma: por dia, fixa ou avulsa.</li>
              <li>Ao marcar a diária, o modal mostra extras pendentes e sugere o valor do dia.</li>
              <li>Quando o saldo zera, vira <b>quitada</b> automaticamente.</li>
              <li>O motociclista vê o saldo e o extrato na aba <b>Taxas/Pagamentos</b> do app dele.</li>
            </ul>
          </>
        ),
      },
      {
        q: "Pagamento parcial e relatórios",
        a: (
          <>
            Pode lançar qualquer valor (mesmo abaixo da sugestão); cada pagamento vira
            uma linha no extrato. Use os atalhos de período (Hoje, 7 dias, Mês) ou
            intervalo personalizado e <b>Exportar PDF</b>.
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
        q: "Adicionar / reajustar tarifa",
        a: (
          <>
            Em <b>Tarifas</b>, defina origem, destino e valor. O reajuste vale para
            <b> corridas criadas depois</b> — corridas já abertas mantêm o valor original.
          </>
        ),
      },
    ],
  },
  {
    id: "historico",
    titulo: "Histórico",
    icon: History,
    resumo: "Auditoria de corridas finalizadas e canceladas.",
    itens: [
      {
        q: "O que entra no histórico?",
        a: (
          <>
            Todas as corridas finalizadas e canceladas, com cliente, motociclista,
            trajeto, valor, forma de pagamento e a linha do tempo dos status. Filtros
            por data, motociclista, cliente ou tipo. Exportável em PDF.
          </>
        ),
      },
    ],
  },
  {
    id: "chats",
    titulo: "Chats e Mural",
    icon: MessageSquare,
    resumo: "Os três chats do painel e os avisos gerais.",
    itens: [
      {
        q: "Chat motociclistas",
        a: (
          <>
            Conversa 1 a 1 com cada motociclista (a mesma que ele vê como "Central" no
            app dele). Útil para alinhar endereço, parada, avisos.
          </>
        ),
      },
      {
        q: "Chat clientes",
        a: (
          <>
            Conversa 1 a 1 com cada cliente, fora de corrida (o cliente vê como
            "Central" no app dele).
          </>
        ),
      },
      {
        q: "Chat corridas (novo)",
        a: (
          <>
            Mostra as conversas <b>diretas entre cliente e motociclista durante a
            corrida</b>. A central <b>monitora em tempo real</b>, pode <b>intervir</b>
            (enviar mensagem) e <b>remover</b> uma mensagem inadequada (ela vira
            "Mensagem removida pela central"). Após a corrida, a conversa fica como
            histórico.
          </>
        ),
      },
      {
        q: "Mural",
        a: (
          <>
            Avisos públicos para <b>todos os motociclistas</b> — mudança de tarifa,
            evento na cidade, manutenção, recados. Aparece no app deles.
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
            <li><b>WhatsApp da central</b> (usado nos apps e mensagens).</li>
            <li><b>Dados da empresa</b> (aparecem em PDFs) e <b>tema</b> claro/escuro.</li>
          </ul>
        ),
      },
      {
        q: "Criar novo operador",
        a: (
          <>
            Em <b>Usuários</b>, adicione nome, login, senha inicial e perfil (Operador
            ou Administrador). O Operador não vê tarifas, configurações nem usuários.
          </>
        ),
      },
    ],
  },
  {
    id: "app-motorista",
    titulo: "App do Motociclista — dúvidas frequentes",
    icon: Bike,
    resumo: "O que responder quando o motociclista ligar com dúvida.",
    itens: [
      {
        q: '"Não estou recebendo corridas"',
        a: (
          <ol className="list-decimal pl-5 space-y-1">
            <li>Confirme no painel se ele está <b>Online</b> (senão, abrir o app e checar internet).</li>
            <li>Veja se está <b>Pausado</b> — se sim, retome.</li>
            <li>Confirme que ele <b>não tem corrida em aberto</b>.</li>
            <li>Confirme que a <b>diária</b> foi paga (sem diária, o app inicia bloqueado).</li>
            <li>Peça para ele ativar o <b>rastreamento/localização</b> — sem localização "o tempo todo", ele não entra bem na fila de proximidade.</li>
          </ol>
        ),
      },
      {
        q: '"Não consigo entrar / esqueci a senha"',
        a: (
          <>
            Lembre que o login é por <b>código + senha</b> (não e-mail). No cadastro
            dele, o Administrador pode <b>redefinir a senha</b>. Se der "já logado em
            outro dispositivo", use <b>resetar dispositivo</b>.
          </>
        ),
      },
      {
        q: '"O app pede localização o tempo todo — é normal?"',
        a: (
          <>
            Sim. Para a central e o cliente acompanharem a corrida, o app coleta a
            localização <b>em segundo plano</b>, mas <b>só enquanto ele está online</b>.
            Ao ficar offline ou sair, para. Ele autoriza isso na primeira ativação.
          </>
        ),
      },
      {
        q: '"Posso falar com o passageiro?"',
        a: (
          <>
            Durante a corrida, sim — pelo <b>chat da corrida</b> no app (a central
            monitora). Fora da corrida, a conversa é só com a Central. O telefone do
            passageiro nunca é mostrado.
          </>
        ),
      },
      {
        q: '"Aceitei mas o cliente não está no endereço"',
        a: (
          <>
            Oriente a marcar <b>Chegou</b> e usar o chat da corrida para combinar o
            ponto. Se precisar, a central entra em contato com o cliente.
          </>
        ),
      },
      {
        q: '"Como vejo quanto devo (diária/camiseta)?"',
        a: (
          <>
            Na aba <b>Taxas/Pagamentos</b> do app aparece a diária e cada cobrança extra
            (total, pago, saldo), com extrato detalhado.
          </>
        ),
      },
    ],
  },
  {
    id: "boas-praticas",
    titulo: "Boas práticas do operador",
    icon: AlertTriangle,
    resumo: "Dicas para não travar a operação.",
    itens: [
      {
        q: "No dia a dia",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Fique de olho em <b>Corridas não aceitas</b> — indica falta de gente online.</li>
            <li>Monitore o <b>chat da corrida</b> quando houver risco de atrito.</li>
            <li>Registre toda ocorrência (reclamação, cancelamento, reembolso) — o histórico é a base das decisões.</li>
            <li>Prefira <b>pausar</b> a pedir para o motociclista "ficar offline" quando quiser controle.</li>
          </ul>
        ),
      },
      {
        q: "Reembolso e cancelamento",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Priorize a solução ao cliente: ressarcir ou designar novo motociclista.</li>
            <li>Depois, recupere o valor do motociclista responsável (desconto na diária/acordo).</li>
            <li>Força maior (acidente, clima, blitz) é tratada com bom senso, sem punição automática.</li>
          </ul>
        ),
      },
      {
        q: "Passagem de plantão",
        a: (
          <ul className="list-disc pl-5 space-y-1">
            <li>Confira corridas em aberto — nenhuma deve ficar "Pendente" sem motivo.</li>
            <li>Informe ao próximo operador os motociclistas pausados e o porquê.</li>
            <li>Deixe um resumo no chat/mural se houver algo crítico.</li>
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
    <div className="p-3 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary/10 p-2 md:p-2.5 shrink-0">
          <BookOpen className="h-5 w-5 md:h-6 md:w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-2xl font-bold tracking-tight">Manual do Operador</h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Guia de operação do Rota 013 — painel, app do cliente, app do
            motociclista e respostas para as dúvidas mais comuns.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar no manual… (ex.: reembolso, diária, chat, não aceita, login)"
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
