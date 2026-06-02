import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/** Toca um beep curto sem assets externos. */
function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start();
    osc.stop(ctx.currentTime + 0.7);
  } catch {
    /* noop */
  }
}

/**
 * Periodicamente verifica corridas agendadas próximas do horário
 * (`agendada_para <= now() + alerta_antes_min`) e ainda não alertadas.
 * Exibe toast + beep e marca `alerta_disparado=true`.
 */
export function useAlertasAgendadas(alertaAntesMin = 15) {
  const lastRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancel = false;

    const checar = async () => {
      const limite = new Date(Date.now() + alertaAntesMin * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("corridas")
        .select("id, cliente, origem, destino, agendada_para")
        .eq("modelo", "Agendada")
        .eq("status", "Agendada")
        .eq("alerta_disparado", false)
        .lte("agendada_para", limite)
        .limit(20);
      if (cancel || error || !data?.length) return;

      for (const c of data) {
        if (lastRef.current.has(c.id)) continue;
        lastRef.current.add(c.id);
        const hora = c.agendada_para
          ? new Date(c.agendada_para).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
          : "";
        toast.warning(`Corrida agendada #${c.id} às ${hora}`, {
          description: `${c.cliente ?? "Cliente"} · ${c.origem}${c.destino ? ` → ${c.destino}` : ""}`,
          duration: 12000,
        });
        beep();
        await supabase.from("corridas").update({ alerta_disparado: true }).eq("id", c.id);
      }
    };

    checar();
    const t = setInterval(checar, 30_000);
    return () => { cancel = true; clearInterval(t); };
  }, [alertaAntesMin]);
}
