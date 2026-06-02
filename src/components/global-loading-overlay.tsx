import { useEffect, useState } from "react";
import { useIsMutating, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

/**
 * Overlay global de "Aguarde..." exibido sempre que houver:
 *  - uma mutation em andamento (qualquer escrita via react-query / server fn), ou
 *  - uma query carregando pela primeira vez (sem dados em cache ainda).
 *
 * Refetches em background (polling) NÃO disparam o overlay para evitar flicker.
 * Há um pequeno delay para não piscar em respostas instantâneas.
 */
export function GlobalLoadingOverlay() {
  const isMutating = useIsMutating();
  const queryClient = useQueryClient();
  const [initialFetching, setInitialFetching] = useState(0);
  const [visible, setVisible] = useState(false);

  // Observa o cache para contar queries em "primeiro carregamento"
  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const recompute = () => {
      const count = cache.getAll().filter((q) => {
        return q.state.fetchStatus === "fetching" && q.state.data === undefined;
      }).length;
      setInitialFetching(count);
    };
    recompute();
    const unsub = cache.subscribe(recompute);
    return () => unsub();
  }, [queryClient]);

  const active = isMutating > 0 || initialFetching > 0;

  // Delay para evitar piscar em requisições rápidas
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 250);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-busy="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/60 backdrop-blur-sm pointer-events-auto"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-5 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium text-foreground">Aguarde...</p>
      </div>
    </div>
  );
}
