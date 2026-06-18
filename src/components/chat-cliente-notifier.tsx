/**
 * Notificador global do painel para chat com CLIENTES.
 * Sino com badge + popover, toast, som (playChatBeep) e notificação
 * desktop (Web Notifications) quando o operador não está na tela de chat.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Bell, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { playChatBeep } from "@/lib/notification-sound";
import { ensureNotificationPermission, showDesktopNotification } from "@/lib/desktop-notification";

type Msg = {
  id: number;
  cliente_codigo: string;
  autor: string;
  autor_nome: string | null;
  texto: string;
  criado_em: string;
  lido: boolean;
};

export function ChatClienteNotifier() {
  const [naoLidas, setNaoLidas] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const noChat = pathname === "/chat-clientes";
  const noChatRef = useRef(noChat);
  noChatRef.current = noChat;

  const recarregar = async () => {
    try {
      const { data } = await supabase
        .from("chat_cliente")
        .select("id,cliente_codigo,autor,autor_nome,texto,criado_em,lido")
        .eq("autor", "cliente")
        .eq("lido", false)
        .order("criado_em", { ascending: false })
        .limit(20);
      setNaoLidas((data as Msg[]) ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    ensureNotificationPermission();
    recarregar();
    const ch = supabase
      .channel("chat-cliente-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_cliente" },
        (payload) => {
          const m = payload.new as Msg;
          if (m.autor !== "cliente") return;
          recarregar();
          if (!noChatRef.current) {
            playChatBeep();
            const nome = m.autor_nome ?? m.cliente_codigo;
            const preview = m.texto.length > 120 ? m.texto.slice(0, 120) + "…" : m.texto;
            showDesktopNotification({
              id: `cli-${m.id}`,
              title: `💬 ${nome}`,
              body: preview,
              tag: `chat-cliente-${m.cliente_codigo}`,
              onClick: () => navigate({ to: "/chat-clientes" }),
            });
            toast.custom(
              (id) => (
                <button
                  onClick={() => {
                    toast.dismiss(id);
                    navigate({ to: "/chat-clientes" });
                  }}
                  className="flex items-start gap-3 w-[340px] max-w-[88vw] rounded-lg border border-border bg-card text-card-foreground shadow-lg p-3 text-left hover:bg-muted/40 transition"
                >
                  <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0">
                    {(nome[0] ?? "C").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold truncate">💬 {nome}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5 whitespace-pre-wrap break-words">
                      {preview}
                    </div>
                  </div>
                </button>
              ),
              { duration: 6000 },
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_cliente" },
        () => recarregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  useEffect(() => {
    if (noChat) recarregar();
  }, [noChat]);

  const total = naoLidas.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Mensagens de clientes${total ? ` (${total} não lidas)` : ""}`}
        >
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full"
            >
              {total > 9 ? "9+" : total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MessageSquare className="h-4 w-4" /> Mensagens dos clientes
          </div>
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground">{total} não lida{total > 1 ? "s" : ""}</span>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {total === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Sem novas mensagens.
            </div>
          ) : (
            naoLidas.map((m) => (
              <Link
                key={m.id}
                to="/chat-clientes"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 border-b border-border last:border-0 hover:bg-muted/60 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">
                    {m.autor_nome ?? m.cliente_codigo}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(m.criado_em).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                  {m.texto}
                </div>
              </Link>
            ))
          )}
        </div>
        <div className="border-t border-border px-3 py-2 text-right">
          <Link
            to="/chat-clientes"
            onClick={() => setOpen(false)}
            className="text-xs text-primary hover:underline"
          >
            Abrir chat completo →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
