import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  operadorChatCorridaConversas,
  operadorChatCorridaListar,
  operadorChatCorridaEnviar,
  operadorChatCorridaRemover,
} from "@/lib/chat-corrida.functions";
import { MidiaMensagem } from "@/lib/chat-midia";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, Bike, RefreshCw, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat-corridas")({
  head: () => ({ meta: [{ title: "Chat corridas — Rota013" }] }),
  component: ChatCorridasPage,
});

type Conversa = Awaited<ReturnType<typeof operadorChatCorridaConversas>>["conversas"][number];
type Mensagem = Awaited<ReturnType<typeof operadorChatCorridaListar>>["mensagens"][number];

function ChatCorridasPage() {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionado, setSelecionado] = useState<number | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [removendo, setRemovendo] = useState<number | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const selRef = useRef<number | null>(null);
  selRef.current = selecionado;

  const isAuthError = (e: unknown) =>
    e instanceof Error && /unauthorized|authorization header/i.test(e.message);

  const carregarConversas = async () => {
    try {
      const { conversas } = await operadorChatCorridaConversas();
      setConversas(conversas);
    } catch (e) {
      if (isAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
  };

  const carregarMensagens = async (corridaId: number, scroll = true) => {
    try {
      const { mensagens } = await operadorChatCorridaListar({ data: { corridaId } });
      setMensagens(mensagens);
      if (scroll) setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      if (isAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Erro ao carregar mensagens");
    }
  };

  // Polling das conversas (não há realtime para chat_corrida).
  useEffect(() => {
    carregarConversas();
    const id = window.setInterval(carregarConversas, 5000);
    return () => window.clearInterval(id);
  }, []);

  // Polling das mensagens da conversa aberta.
  useEffect(() => {
    if (selecionado == null) return;
    carregarMensagens(selecionado);
    const id = window.setInterval(() => {
      if (selRef.current != null) carregarMensagens(selRef.current, false);
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (selecionado == null || !texto.trim()) return;
    setEnviando(true);
    try {
      await operadorChatCorridaEnviar({ data: { corridaId: selecionado, texto: texto.trim() } });
      setTexto("");
      await carregarMensagens(selecionado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const remover = async (id: number) => {
    if (!confirm('Remover esta mensagem? Ela vira "Mensagem removida pela central" para os dois lados.')) return;
    setRemovendo(id);
    try {
      await operadorChatCorridaRemover({ data: { id } });
      if (selecionado != null) await carregarMensagens(selecionado, false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover");
    } finally {
      setRemovendo(null);
    }
  };

  const conversasFiltradas = conversas.filter((c) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      String(c.corridaId).includes(q) ||
      c.clienteNome.toLowerCase().includes(q) ||
      c.motoristaNome.toLowerCase().includes(q)
    );
  });

  const conversaAtual = conversas.find((c) => c.corridaId === selecionado);

  return (
    <div className="p-3 lg:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
        <h1 className="text-base md:text-2xl font-bold flex items-center gap-2 min-w-0">
          <Bike className="h-5 w-5 md:h-6 md:w-6 shrink-0" />
          <span className="truncate">Chat corridas</span>
        </h1>
        <Button variant="outline" size="sm" onClick={carregarConversas}>
          <RefreshCw className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] gap-4 h-[calc(100dvh-180px)] md:h-[calc(100vh-160px)]">
        <Card className={`p-3 flex flex-col overflow-hidden ${selecionado != null ? "hidden md:flex" : ""}`}>
          <Input
            placeholder="Buscar por corrida, cliente ou motociclista..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-3"
          />
          <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
            {conversasFiltradas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa de corrida.</p>
            )}
            {conversasFiltradas.map((c) => (
              <button
                key={c.corridaId}
                onClick={() => setSelecionado(c.corridaId)}
                className={`w-full text-left rounded-md px-3 py-2 border transition ${
                  selecionado === c.corridaId
                    ? "bg-primary/10 border-primary/40"
                    : "bg-background border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">
                    #{c.corridaId} · {c.clienteNome} ↔ {c.motoristaNome}
                  </span>
                  <Badge variant={c.ativa ? "default" : "secondary"} className="h-5 px-1.5 text-[10px] shrink-0">
                    {c.ativa ? "Ativa" : c.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_msg}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.ultima_em).toLocaleString("pt-BR")}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className={`flex flex-col overflow-hidden ${selecionado == null ? "hidden md:flex" : ""}`}>
          {selecionado == null ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="px-3 md:px-4 py-3 border-b border-border flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-9 w-9 shrink-0"
                  onClick={() => setSelecionado(null)}
                  aria-label="Voltar"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="min-w-0">
                  <div className="font-semibold text-sm md:text-base truncate">
                    Corrida #{selecionado} · {conversaAtual?.clienteNome} ↔ {conversaAtual?.motoristaNome}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {conversaAtual?.ativa ? "Em andamento" : `Encerrada (${conversaAtual?.status ?? "—"})`}
                    {conversaAtual?.origem ? ` · ${conversaAtual.origem}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {mensagens.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens ainda.</p>
                )}
                {mensagens.map((m) => {
                  const meu = m.autor === "central";
                  const alinhar = m.autor === "cliente" ? "justify-start" : m.autor === "motociclista" ? "justify-end" : "justify-center";
                  const rotulo =
                    m.autor === "central" ? `${m.autor_nome ?? "Central"} · Central`
                    : m.autor === "cliente" ? `${m.autor_nome ?? "Cliente"} · Cliente`
                    : `${m.autor_nome ?? "Motociclista"} · Motociclista`;
                  return (
                    <div key={m.id} className={`flex ${alinhar}`}>
                      <div
                        className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${
                          m.autor === "motociclista"
                            ? "bg-primary/15 border border-primary/30"
                            : m.autor === "central"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : "bg-card border border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] opacity-70 flex-1">{rotulo}</span>
                          {!m.removida && !meu && (
                            <button
                              onClick={() => remover(m.id)}
                              disabled={removendo === m.id}
                              title="Remover mensagem"
                              className="opacity-50 hover:opacity-100 transition disabled:opacity-30"
                            >
                              <EyeOff className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        {m.removida ? (
                          <div className="italic opacity-70">Mensagem removida pela central</div>
                        ) : (
                          <>
                            {m.midia_url && (
                              <div className="mb-1">
                                <MidiaMensagem url={m.midia_url} tipo={m.midia_tipo} nome={m.midia_nome} />
                              </div>
                            )}
                            {m.texto && <div className="whitespace-pre-wrap break-words">{m.texto}</div>}
                          </>
                        )}
                        <div className="text-[10px] opacity-60 mt-1 text-right">
                          {new Date(m.criado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>

              <form onSubmit={enviar} className="flex items-center gap-1 p-3 border-t border-border">
                <Input
                  placeholder={conversaAtual?.ativa ? "Intervir na conversa..." : "Enviar mensagem..."}
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={enviando}
                  className="min-w-0"
                />
                <Button type="submit" disabled={enviando || !texto.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
