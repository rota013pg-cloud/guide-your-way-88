/**
 * Notificador global do painel: sino com badge + popover com prévia
 * das últimas mensagens recebidas no chat dos motoristas. Toca toast quando
 * chega mensagem nova (autor = motorista) e o operador não está no chat.
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

type Msg = {
  id: number;
  motorista_codigo: string;
  autor: string;
  autor_nome: string | null;
  texto: string;
  criado_em: string;
  lido: boolean;
};

export function ChatNotifier() {
  const [naoLidas, setNaoLidas] = useState<Msg[]>([]);
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const noChat = pathname === "/chat-motoristas";
  const noChatRef = useRef(noChat);
  noChatRef.current = noChat;

  const recarregar = async () => {
    try {
      const { data } = await supabase
        .from("chat_motorista")
        .select("id,motorista_codigo,autor,autor_nome,texto,criado_em,lido")
        .eq("autor", "motorista")
        .eq("lido", false)
        .order("criado_em", { ascending: false })
        .limit(20);
      setNaoLidas((data as Msg[]) ?? []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    recarregar();
    const ch = supabase
      .channel("chat-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_motorista" },
        (payload) => {
          const m = payload.new as Msg;
          if (m.autor !== "motorista") return;
          recarregar();
          if (!noChatRef.current) {
            toast.message(`💬 ${m.autor_nome ?? m.motorista_codigo}`, {
              description: m.texto.length > 120 ? m.texto.slice(0, 120) + "…" : m.texto,
              action: {
                label: "Abrir",
                onClick: () => navigate({ to: "/chat-motoristas" }),
              },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_motorista" },
        () => recarregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [navigate]);

  // Recarregar quando o operador entra no chat (mensagens marcadas como lidas)
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
          aria-label={`Notificações${total ? ` (${total} não lidas)` : ""}`}
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
            <MessageSquare className="h-4 w-4" /> Mensagens dos motoristas
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
                to="/chat-motoristas"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 border-b border-border last:border-0 hover:bg-muted/60 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">
                    {m.autor_nome ?? m.motorista_codigo}
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
            to="/chat-motoristas"
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
