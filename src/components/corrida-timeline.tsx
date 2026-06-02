import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listarLogCorrida } from "@/lib/corridas.functions";
import { Loader2 } from "lucide-react";

export function CorridaTimeline({ corridaId }: { corridaId: number }) {
  const fetchLog = useServerFn(listarLogCorrida);
  const { data: logs, isLoading } = useQuery({
    queryKey: ["corrida-log", corridaId],
    queryFn: () => fetchLog({ data: { corridaId } }),
    refetchInterval: 5000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Carregando histórico…
      </div>
    );
  }
  if (!logs || logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Sem eventos registrados.</p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-3 py-1">
      {logs.map((l) => (
        <li key={l.id} className="ml-4">
          <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full bg-primary border border-background" />
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-sm font-medium">{l.status}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(l.criado_em).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            {l.motorista_codigo && (
              <span className="text-xs font-mono text-muted-foreground">
                · {l.motorista_codigo}
              </span>
            )}
          </div>
          {l.observacao && (
            <p className="text-xs text-muted-foreground mt-0.5">{l.observacao}</p>
          )}
        </li>
      ))}
    </ol>
  );
}
