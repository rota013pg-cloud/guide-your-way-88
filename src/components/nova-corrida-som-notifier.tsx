/**
 * Notificador SONORO de nova corrida no painel — toca a voz "Nova corrida!"
 * (mesmo mp3 do app do motociclista) sempre que surge uma corrida NOVA no
 * sistema, em QUALQUER modo (inclusive Automático), para a central acompanhar.
 *
 * Diferente do NovaSolicitacaoNotifier (que abre o popup Registrar/Descartar só
 * para pedidos "aguardando registro" no modo manual), este aqui NÃO abre popup:
 * só toca o som + um aviso leve. Para não tocar em dobro com o popup, ele ignora
 * as corridas com `aguardando_registro = true` (essas já tocam pelo popup).
 *
 * Só renderiza nada (null). Respeita o liga/desliga dos alertas sonoros.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { playOfertaSom, ensureOfertaAudio } from "@/lib/notification-sound";
import { getAlertasSom } from "@/lib/alertas-som";
import { ensureNotificationPermission, showDesktopNotification } from "@/lib/desktop-notification";

type Row = {
  id: number;
  cliente: string | null;
  origem: string | null;
  aguardando_registro: boolean;
};

export function NovaCorridaSomNotifier() {
  const idsVistos = useRef<Set<number>>(new Set());
  const primeiraCarga = useRef(true);

  useEffect(() => {
    ensureNotificationPermission();
    // Prepara a voz "Nova corrida!" para poder tocar a partir do polling.
    ensureOfertaAudio();
    let cancelado = false;

    const carregar = async () => {
      const { data } = await supabase
        .from("corridas")
        .select("id, cliente, origem, aguardando_registro")
        .order("criado_em", { ascending: false })
        .limit(30);
      if (cancelado) return;
      const lista = (data ?? []) as Row[];

      if (!primeiraCarga.current) {
        // Corridas NOVAS (id nunca visto) que NÃO são "aguardando registro"
        // (essas já tocam pelo popup). Cobre modo automático + criadas no painel.
        const novas = lista.filter(
          (c) => !idsVistos.current.has(c.id) && c.aguardando_registro === false,
        );
        if (novas.length > 0) {
          if (getAlertasSom()) {
            try {
              playOfertaSom();
            } catch {
              /* ignore */
            }
          }
          const c = novas[0];
          const extra = novas.length > 1 ? ` (+${novas.length - 1})` : "";
          toast.success(`🏍️ Nova corrida — ${c.cliente ?? "cliente"}${extra}`);
          showDesktopNotification({
            id: `corrida-${c.id}`,
            title: "🏍️ Nova corrida",
            body: `${c.cliente ?? "Cliente"} — ${c.origem ?? ""}`,
            tag: "nova-corrida",
          });
        }
      }
      primeiraCarga.current = false;
      // Marca TODOS os ids (inclusive os "aguardando registro"): assim, se uma
      // corrida mudar de aguardando_registro=true para false depois (ex.: o
      // operador descartar), ela não é tratada como "nova" e não toca de novo.
      lista.forEach((c) => idsVistos.current.add(c.id));
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
