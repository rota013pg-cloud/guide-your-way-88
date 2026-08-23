/**
 * Botão de liga/desliga dos alertas sonoros do painel (motociclista online +
 * nova corrida). A preferência fica no navegador do operador. Ao ligar, toca
 * um som — que também serve de gesto para liberar o áudio no navegador.
 */
import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAlertasSom, setAlertasSom, ALERTAS_SOM_EVENTO } from "@/lib/alertas-som";
import { playMotoristaOnline } from "@/lib/notification-sound";

export function SomAlertasToggle() {
  const [ativo, setAtivo] = useState(true);

  useEffect(() => {
    setAtivo(getAlertasSom());
    const sync = () => setAtivo(getAlertasSom());
    window.addEventListener(ALERTAS_SOM_EVENTO, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ALERTAS_SOM_EVENTO, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const alternar = () => {
    const novo = !ativo;
    setAtivo(novo);
    setAlertasSom(novo);
    if (novo) {
      try {
        playMotoristaOnline();
      } catch {
        /* ignore */
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={alternar}
      aria-label={ativo ? "Desligar sons de alerta" : "Ligar sons de alerta"}
      title={ativo ? "Sons de alerta: ligados" : "Sons de alerta: desligados"}
    >
      {ativo ? (
        <Bell className="h-5 w-5" />
      ) : (
        <BellOff className="h-5 w-5 text-muted-foreground" />
      )}
    </Button>
  );
}
