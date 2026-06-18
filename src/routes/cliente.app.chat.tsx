import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken, useCliente } from "@/lib/cliente-auth";
import { toast } from "sonner";
import { ensureAudioUnlock, playChatBeep } from "@/lib/notification-sound";
import { ensureNotificationPermission, showDesktopNotification } from "@/lib/desktop-notification";

export const Route = createFileRoute("/cliente/app/chat")({
  ssr: false,
  component: ChatPage,
});

type Mensagem = {
  id: number;
  cliente_codigo: string;
  autor: "cliente" | "central";
  autor_nome: string | null;
  texto: string;
  criado_em: string;
};

function ChatPage() {
  const { cliente } = useCliente();
  const [whatsapp, setWhatsapp] = useState<string>("5513900000000");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const ultimoIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // desbloqueia áudio + pede permissão de notificação
  useEffect(() => {
    ensureAudioUnlock();
    ensureNotificationPermission();
  }, []);

  // carrega WhatsApp configurado
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("app_config").select("config_json").eq("id", 1).maybeSingle();
      const cfg = (data?.config_json as Record<string, unknown> | null) ?? {};
      const w = typeof cfg.whatsappCentral === "string" ? cfg.whatsappCentral : "";
      if (w) setWhatsapp(w.replace(/\D/g, ""));
    })();
  }, []);


  // carrega mensagens via polling (Realtime anon removido por segurança)
  useEffect(() => {
    const token = getClienteToken();
    if (!token || !cliente) return;
    let cancelado = false;
    let timeoutId: number | undefined;
    let consultando = false;
    let primeiraCarga = true;

    const carregar = async () => {
      if (consultando) return;
      consultando = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
      try {
        const { data, error } = await supabase.rpc("cliente_listar_mensagens", { _token: token });
        if (cancelado || error || !data) return;
        const lista = data as unknown as Mensagem[];
        const novosDaCentral = lista.filter((m) => m.id > ultimoIdRef.current && m.autor === "central");
        ultimoIdRef.current = lista.reduce((acc, m) => (m.id > acc ? m.id : acc), ultimoIdRef.current);
        setMensagens(lista);
        if (!primeiraCarga) {
          for (const novo of novosDaCentral) {
            playChatBeep();
            const preview = novo.texto.length > 120 ? novo.texto.slice(0, 120) + "…" : novo.texto;
            showDesktopNotification({
              id: `cli-msg-${novo.id}`,
              title: `💬 ${novo.autor_nome ?? "Central"}`,
              body: preview,
              tag: "chat-cliente-central",
            });
          }
        }
        primeiraCarga = false;
      } finally {
        consultando = false;
        if (!cancelado) timeoutId = window.setTimeout(carregar, document.hidden ? 10000 : 2000);
      }
    };
    void carregar();
    const carregarAgora = () => void carregar();
    window.addEventListener("focus", carregarAgora);
    document.addEventListener("visibilitychange", carregarAgora);
    return () => {
      cancelado = true;
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener("focus", carregarAgora);
      document.removeEventListener("visibilitychange", carregarAgora);
    };
  }, [cliente]);

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t) return;
    const token = getClienteToken();
    if (!token) return;
    setSending(true);
    try {
      const { error } = await supabase.rpc("cliente_enviar_mensagem", { _token: token, _texto: t });
      if (error) throw error;
      setTexto("");
      const { data } = await supabase.rpc("cliente_listar_mensagens", { _token: token });
      if (data) {
        const lista = data as unknown as Mensagem[];
        ultimoIdRef.current = lista.reduce((acc, m) => (m.id > acc ? m.id : acc), ultimoIdRef.current);
        setMensagens(lista);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-3 flex flex-col" style={{ minHeight: "calc(100vh - 8rem)" }}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Central</h2>
        <Button asChild variant="outline" size="sm" className="rounded-xl gap-2">
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Abrir WhatsApp"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
              <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1s-.5-.2-.7.1-.8 1-1 1.2-.4.2-.7 0c-.3-.2-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1s0-.5.1-.6.3-.3.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.7.4-.3.3-1 1-1 2.4s1 2.8 1.2 3 2 3 4.8 4.2c.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.3c1.4.8 3 1.3 4.7 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
            </svg>
            WhatsApp
          </a>
        </Button>
      </div>

      <Card ref={scrollRef as never} className="flex-1 rounded-2xl p-3 overflow-y-auto space-y-2 max-h-[60vh]">
        {mensagens.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-12">
            <MessageCircle className="size-10 mx-auto mb-2" />
            <p>Fale com a Central de Atendimento.</p>
          </div>
        )}
        {mensagens.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.autor === "cliente" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                m.autor === "cliente"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-muted text-foreground rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{m.texto}</p>
              <p className="text-[10px] opacity-70 mt-0.5 text-right">
                {new Date(m.criado_em).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
      </Card>

      <form onSubmit={enviar} className="flex gap-2">
        <Input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="rounded-xl"
          disabled={sending}
        />
        <Button type="submit" className="rounded-xl" size="icon" disabled={sending || !texto.trim()}>
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  );
}
