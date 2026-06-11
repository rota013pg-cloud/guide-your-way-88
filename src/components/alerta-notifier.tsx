/**
 * Notificador crítico de pânico/comportamento suspeito.
 * Abre modal full-screen quando há alertas abertos e toca som contínuo.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Phone, MapPin, Check } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  listarAlertasAbertos,
  marcarAlertaAtendido,
  type AlertaMotorista,
} from "@/lib/alertas.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { playChatBeep } from "@/lib/notification-sound";

export function AlertaNotifier() {
  const [alertas, setAlertas] = useState<AlertaMotorista[]>([]);
  const [open, setOpen] = useState(false);
  const listar = useServerFn(listarAlertasAbertos);
  const atender = useServerFn(marcarAlertaAtendido);
  const beepRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const recarregar = async () => {
    try {
      const data = await listar();
      setAlertas(data);
      if (data.length > 0) setOpen(true);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    recarregar();
    const ch = supabase
      .channel("alerta-notifier")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "motorista_alertas" },
        () => {
          recarregar();
          playChatBeep();
          toast.error("🚨 ALERTA DE PÂNICO recebido!", { duration: 8000 });
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "motorista_alertas" },
        () => recarregar(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Beep contínuo enquanto modal está aberto com alertas
  useEffect(() => {
    if (open && alertas.some((a) => a.tipo === "panico")) {
      beepRef.current = setInterval(() => playChatBeep(), 3000);
    }
    return () => {
      if (beepRef.current) clearInterval(beepRef.current);
      beepRef.current = null;
    };
  }, [open, alertas]);

  const handleAtender = async (id: number) => {
    try {
      await atender({ data: { id } });
      toast.success("Alerta marcado como atendido");
      recarregar();
    } catch (e) {
      toast.error("Erro ao atender alerta");
    }
  };

  if (alertas.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl border-destructive border-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive text-xl">
            <AlertTriangle className="h-6 w-6 animate-pulse" />
            Alertas críticos ({alertas.length})
          </DialogTitle>
          <DialogDescription>
            Alertas enviados por motociclistas. Atenda imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-3">
          <Button asChild variant="destructive" size="sm">
            <a href="tel:190"><Phone className="h-3 w-3 mr-1" /> 190 Polícia</a>
          </Button>
          <Button asChild variant="destructive" size="sm">
            <a href="tel:192"><Phone className="h-3 w-3 mr-1" /> 192 SAMU</a>
          </Button>
          <Button asChild variant="destructive" size="sm">
            <a href="tel:193"><Phone className="h-3 w-3 mr-1" /> 193 Bombeiros</a>
          </Button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-2">
          {alertas.map((a) => (
            <div
              key={a.id}
              className="border rounded-lg p-3 bg-destructive/5 border-destructive/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={a.tipo === "panico" ? "destructive" : "secondary"}>
                      {a.tipo === "panico" ? "🚨 PÂNICO" : "⚠️ Suspeito"}
                    </Badge>
                    <span className="font-semibold">
                      {a.motorista_codigo} — {a.motorista_nome ?? "?"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.criado_em).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                  </div>
                  {a.observacao && (
                    <p className="text-sm mt-1">{a.observacao}</p>
                  )}
                  {a.latitude != null && a.longitude != null && (
                    <a
                      href={`https://www.google.com/maps?q=${a.latitude},${a.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                      <MapPin className="h-3 w-3" /> Abrir localização no mapa
                    </a>
                  )}
                  {a.corrida_id && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Corrida #{a.corrida_id}
                    </div>
                  )}
                </div>
                <Button size="sm" onClick={() => handleAtender(a.id)}>
                  <Check className="h-4 w-4 mr-1" /> Atendido
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
