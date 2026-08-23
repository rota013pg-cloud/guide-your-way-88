/**
 * Notificador do painel: toca um som (+ toast) quando um motociclista fica
 * ONLINE. Faz polling leve na tabela `motoristas` (mesmo padrão do
 * NovaSolicitacaoNotifier). Respeita o liga/desliga dos alertas sonoros.
 * Não renderiza UI.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { playMotoristaOnline } from "@/lib/notification-sound";
import { getAlertasSom } from "@/lib/alertas-som";

export function MotoristaOnlineNotifier() {
  const onlineIds = useRef<Set<string>>(new Set());
  const primeiraCarga = useRef(true);

  useEffect(() => {
    let cancelado = false;

    const carregar = async () => {
      const { data } = await supabase
        .from("motoristas")
        .select("codigo, nome, status")
        .eq("status", "Online");
      if (cancelado) return;
      const lista = (data ?? []) as Array<{ codigo: string; nome: string | null; status: string }>;
      const atuais = new Set(lista.map((m) => m.codigo));

      if (!primeiraCarga.current) {
        const novos = lista.filter((m) => !onlineIds.current.has(m.codigo));
        if (novos.length > 0) {
          if (getAlertasSom()) {
            try {
              playMotoristaOnline();
            } catch {
              /* ignore */
            }
          }
          const m = novos[0];
          const extra = novos.length > 1 ? ` (+${novos.length - 1})` : "";
          toast.success(`🟢 ${m.nome ?? m.codigo} ficou online${extra}`);
        }
      }
      primeiraCarga.current = false;
      onlineIds.current = atuais;
    };

    void carregar();
    const id = window.setInterval(carregar, 6000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, []);

  return null;
}
