import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  operadorListarConversasCliente,
  operadorListarChatCliente,
  operadorEnviarMensagemCliente,
  adminApagarMensagemCliente,
  adminApagarConversaCliente,
} from "@/lib/chat-cliente.functions";
import { useRole } from "@/hooks/use-role";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat-clientes")({
  head: () => ({ meta: [{ title: "Chat clientes — Rota013" }] }),
  component: ChatClientesPage,
});

type Conversa = Awaited<ReturnType<typeof operadorListarConversasCliente>>["conversas"][number];
type Mensagem = Awaited<ReturnType<typeof operadorListarChatCliente>>["mensagens"][number];

function ChatClientesPage() {
  const { isAdmin } = useRole();
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [busca, setBusca] = useState("");
  const [apagando, setApagando] = useState<number | null>(null);
  const [apagandoConversa, setApagandoConversa] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const isAuthError = (e: unknown) =>
    e instanceof Error && /unauthorized|authorization header/i.test(e.message);

  const carregarConversas = async () => {
    try {
      const { conversas } = await operadorListarConversasCliente();
      setConversas(conversas);
    } catch (e) {
      if (isAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Erro ao carregar");
    }
  };

  const carregarMensagens = async (codigo: string) => {
    try {
      const { mensagens } = await operadorListarChatCliente({ data: { clienteCodigo: codigo } });
      setMensagens(mensagens);
      setTimeout(() => fimRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } catch (e) {
      if (isAuthError(e)) return;
      toast.error(e instanceof Error ? e.message : "Erro ao carregar mensagens");
    }
  };

  useEffect(() => {
    carregarConversas();
    const channel = supabase
      .channel("chat-clientes-painel")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_cliente" }, (payload) => {
        carregarConversas();
        const codigo = (payload.new as any)?.cliente_codigo ?? (payload.old as any)?.cliente_codigo;
        if (codigo && codigo === selecionado) carregarMensagens(codigo);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado]);

  useEffect(() => {
    if (selecionado) carregarMensagens(selecionado);
  }, [selecionado]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!selecionado || !texto.trim()) return;
    setEnviando(true);
    try {
      await operadorEnviarMensagemCliente({ data: { clienteCodigo: selecionado, texto: texto.trim() } });
      setTexto("");
      await carregarMensagens(selecionado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  const conversasFiltradas = conversas.filter((c) =>
    !busca || c.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
    c.cliente_codigo.toLowerCase().includes(busca.toLowerCase()),
  );

  const apagar = async (id: number) => {
    if (!confirm("Apagar esta mensagem?")) return;
    setApagando(id);
    try {
      await adminApagarMensagemCliente({ data: { id } });
      if (selecionado) await carregarMensagens(selecionado);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar");
    } finally {
      setApagando(null);
    }
  };

  const apagarConversa = async () => {
    if (!selecionado) return;
    if (!confirm("Apagar TODA a conversa com este cliente? Esta ação não pode ser desfeita.")) return;
    setApagandoConversa(true);
    try {
      await adminApagarConversaCliente({ data: { clienteCodigo: selecionado } });
      setSelecionado(null);
      setMensagens([]);
      await carregarConversas();
      toast.success("Conversa apagada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao apagar conversa");
    } finally {
      setApagandoConversa(false);
    }
  };

  const conversaAtual = conversas.find((c) => c.cliente_codigo === selecionado);

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6" /> Chat com clientes
        </h1>
        <Button variant="outline" size="sm" onClick={carregarConversas}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-160px)]">
        <Card className="p-3 flex flex-col overflow-hidden">
          <Input
            placeholder="Buscar cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="mb-3"
          />
          <div className="flex-1 overflow-y-auto space-y-1 -mx-1 px-1">
            {conversasFiltradas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma conversa.</p>
            )}
            {conversasFiltradas.map((c) => (
              <button
                key={c.cliente_codigo}
                onClick={() => setSelecionado(c.cliente_codigo)}
                className={`w-full text-left rounded-md px-3 py-2 border transition ${
                  selecionado === c.cliente_codigo
                    ? "bg-primary/10 border-primary/40"
                    : "bg-background border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm truncate">{c.cliente_codigo} — {c.cliente_nome}</span>
                  {c.nao_lidas > 0 && (
                    <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                      {c.nao_lidas}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">{c.ultima_msg}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {new Date(c.ultima_em).toLocaleString("pt-BR")}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          {!selecionado ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              Selecione uma conversa
            </div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div>
                  <div className="font-semibold">{selecionado} - {conversaAtual?.cliente_nome}</div>
                  {conversaAtual?.telefone && (
                    <div className="text-xs text-muted-foreground">{conversaAtual.telefone}</div>
                  )}
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={apagarConversa}
                    disabled={apagandoConversa}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {apagandoConversa ? "Apagando..." : "Apagar conversa"}
                  </Button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-muted/20">
                {mensagens.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">Sem mensagens ainda.</p>
                )}
                {mensagens.map((m) => {
                  const meu = m.autor === "central";
                  return (
                    <div key={m.id} className={`flex ${meu ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                          meu ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] opacity-70 flex-1">
                            {m.autor_nome ?? (meu ? "Central" : "Cliente")}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => apagar(m.id)}
                              disabled={apagando === m.id}
                              className="opacity-50 hover:opacity-100 transition disabled:opacity-30"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap break-words">{m.texto}</div>
                        <div className="text-[10px] opacity-60 mt-1 text-right">
                          {new Date(m.criado_em).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={fimRef} />
              </div>
              <form onSubmit={enviar} className="flex gap-2 p-3 border-t border-border">
                <Input
                  placeholder="Mensagem..."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  disabled={enviando}
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
