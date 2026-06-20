/**
 * Toggle do Modo Automático no header do painel.
 * Qualquer operador autenticado pode ligar/desligar.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import {
  lerModoAutomatico,
  definirModoAutomatico,
} from "@/lib/modo-automatico.functions";

export function ModoAutomaticoToggle() {
  const ler = useServerFn(lerModoAutomatico);
  const definir = useServerFn(definirModoAutomatico);
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    const carregar = async () => {
      try {
        const r = await ler({ data: undefined });
        if (!cancelado) setAtivo(r.ativo);
      } catch {
        if (!cancelado) setAtivo(false);
      }
    };
    void carregar();
    const id = window.setInterval(carregar, 15000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, [ler]);

  const alternar = async (proximo: boolean) => {
    if (ativo === null) return;
    setSalvando(true);
    const anterior = ativo;
    setAtivo(proximo);
    try {
      await definir({ data: { ativo: proximo } });
      toast.success(proximo ? "Modo Automático LIGADO" : "Modo Automático desligado");
    } catch (e) {
      setAtivo(anterior);
      toast.error("Não foi possível alterar o modo automático.");
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className={`hidden sm:flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition ${
        ativo
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border bg-muted/40 text-muted-foreground"
      }`}
      title="Modo Automático: aceita solicitações completas automaticamente e responde ao chat do cliente."
    >
      <Bot className={`size-3.5 ${ativo ? "animate-pulse" : ""}`} />
      <span className="font-medium">Auto</span>
      <Switch
        checked={!!ativo}
        disabled={ativo === null || salvando}
        onCheckedChange={alternar}
        aria-label="Modo Automático"
      />
    </div>
  );
}
