/**
 * Botão de pânico do app do motociclista.
 * - Botão flutuante fixo (canto inferior direito, acima da bottom-nav).
 * - Long press 2s ou duplo toque para confirmar (evita acidentes).
 * - Envia localização atual ao painel.
 */
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, X } from "lucide-react";
import { motoristaEnviarAlerta } from "@/lib/motorista.functions";

export function PanicButton({
  codigo,
  token,
  corridaId,
  onToast,
}: {
  codigo: string;
  token: string;
  corridaId?: number | null;
  onToast: (msg: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const holdTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const enviar = useServerFn(motoristaEnviarAlerta);

  const obterPosicao = (): Promise<{ lat: number | null; lng: number | null }> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({ lat: null, lng: null });
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { timeout: 4000, enableHighAccuracy: true },
      );
    });

  const dispararPanico = async () => {
    if (enviando) return;
    setEnviando(true);
    try {
      const pos = await obterPosicao();
      await enviar({
        data: {
          codigo,
          token,
          tipo: "panico",
          corridaId: corridaId ?? null,
          lat: pos.lat,
          lng: pos.lng,
        },
      });
      onToast("🚨 Alerta de pânico enviado à central");
      setConfirmando(false);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Erro ao enviar alerta");
    } finally {
      setEnviando(false);
      setProgresso(0);
    }
  };

  const iniciarHold = () => {
    setProgresso(0);
    const inicio = Date.now();
    holdTimer.current = setInterval(() => {
      const p = Math.min(100, ((Date.now() - inicio) / 2000) * 100);
      setProgresso(p);
      if (p >= 100) {
        finalizarHold(true);
      }
    }, 50);
  };

  const finalizarHold = (disparar: boolean) => {
    if (holdTimer.current) clearInterval(holdTimer.current);
    holdTimer.current = null;
    if (disparar) {
      dispararPanico();
    } else {
      setProgresso(0);
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        aria-label="Botão de pânico"
        className="fixed right-3 z-40 h-12 w-12 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-lg flex items-center justify-center border-2 border-white active:scale-95 transition"
        style={{ bottom: "calc(var(--moto-bottom-nav-h, 64px) + env(safe-area-inset-bottom) + 12px)" }}
      >
        <AlertTriangle className="h-5 w-5" />
      </button>

      {confirmando && (
        <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-2xl max-w-sm w-full p-5 border-2 border-red-600">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2 text-red-600 font-bold text-lg">
                <AlertTriangle className="h-6 w-6" /> Alerta de Pânico
              </div>
              <button
                onClick={() => setConfirmando(false)}
                disabled={enviando}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Pressione e <b>segure por 2 segundos</b> o botão abaixo para enviar
              um alerta urgente à central com sua localização atual.
            </p>
            <button
              type="button"
              disabled={enviando}
              onPointerDown={iniciarHold}
              onPointerUp={() => finalizarHold(false)}
              onPointerLeave={() => finalizarHold(false)}
              onPointerCancel={() => finalizarHold(false)}
              className="relative w-full h-14 rounded-lg bg-red-600 text-white font-bold text-base overflow-hidden active:scale-[0.98] transition disabled:opacity-60"
            >
              <span
                className="absolute inset-y-0 left-0 bg-red-800 transition-all"
                style={{ width: `${progresso}%` }}
              />
              <span className="relative">
                {enviando ? "Enviando…" : "SEGURAR PARA ENVIAR"}
              </span>
            </button>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              Use somente em emergência real. A central será notificada imediatamente.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Botão "Comportamento suspeito" — registra ocorrência sem alarmar.
 * Pode ser usado dentro do card da corrida ativa.
 */
export function ReportarSuspeitoButton({
  codigo,
  token,
  corridaId,
  onToast,
}: {
  codigo: string;
  token: string;
  corridaId?: number | null;
  onToast: (msg: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [obs, setObs] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviar = useServerFn(motoristaEnviarAlerta);

  const submit = async () => {
    setEnviando(true);
    try {
      const pos = await new Promise<{ lat: number | null; lng: number | null }>(
        (resolve) => {
          if (!navigator.geolocation) return resolve({ lat: null, lng: null });
          navigator.geolocation.getCurrentPosition(
            (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
            () => resolve({ lat: null, lng: null }),
            { timeout: 4000 },
          );
        },
      );
      await enviar({
        data: {
          codigo,
          token,
          tipo: "suspeito",
          corridaId: corridaId ?? null,
          lat: pos.lat,
          lng: pos.lng,
          observacao: obs.trim() || undefined,
        },
      });
      onToast("Aviso enviado à central");
      setAberto(false);
      setObs("");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Erro ao enviar");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="text-xs px-2 py-1 rounded border border-amber-500 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950"
      >
        ⚠️ Reportar suspeito
      </button>
      {aberto && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card rounded-xl shadow-xl max-w-sm w-full p-4">
            <div className="font-semibold mb-2">Reportar comportamento suspeito</div>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Descreva o que aconteceu (opcional)"
              rows={3}
              className="w-full text-sm border rounded p-2 bg-background"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <button
                onClick={() => setAberto(false)}
                disabled={enviando}
                className="px-3 py-1.5 text-sm rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={enviando}
                className="px-3 py-1.5 text-sm rounded bg-amber-600 text-white"
              >
                {enviando ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
