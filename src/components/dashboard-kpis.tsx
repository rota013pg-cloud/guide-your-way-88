/**
 * Card de KPIs da operação (últimos 7 dias) para o dashboard.
 */
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Clock, Send, XCircle, AlertTriangle, DollarSign } from "lucide-react";
import { getDashboardKpis } from "@/lib/kpis.functions";

function formatSegundos(s: number): string {
  if (!s || s < 1) return "—";
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m < 60) return sec ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function DashboardKpis() {
  const fn = useServerFn(getDashboardKpis);
  const { data } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: () => fn(),
    refetchInterval: 30000,
    staleTime: 30000,
  });

  const ocor = data?.ocorrenciasPorNivel ?? { 1: 0, 2: 0, 3: 0, 4: 0 };
  const totalOcor = (ocor[1] ?? 0) + (ocor[2] ?? 0) + (ocor[3] ?? 0) + (ocor[4] ?? 0);

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">KPIs — últimos 7 dias</h2>
        <span className="text-[10px] text-muted-foreground uppercase">atualiza a cada 30s</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi
          icon={<Clock className="h-4 w-4 text-primary" />}
          label="Atendimento médio"
          value={formatSegundos(data?.tempoMedioAtendimento ?? 0)}
          hint="criada → aceita"
        />
        <Kpi
          icon={<Send className="h-4 w-4 text-primary" />}
          label="Distribuição média"
          value={formatSegundos(data?.tempoMedioDistribuicao ?? 0)}
          hint="criada → 1ª oferta"
        />
        <Kpi
          icon={<XCircle className="h-4 w-4 text-destructive" />}
          label="Taxa cancelamento"
          value={`${(data?.taxaCancelamento ?? 0).toFixed(1)}%`}
          hint={`${data?.canceladas ?? 0} de ${data?.total ?? 0}`}
        />
        <Kpi
          icon={<AlertTriangle className="h-4 w-4 text-warning" />}
          label="Ocorrências"
          value={String(totalOcor)}
          hint={`N1 ${ocor[1]} · N2 ${ocor[2]} · N3 ${ocor[3]} · N4 ${ocor[4]}`}
        />
        <Kpi
          icon={<DollarSign className="h-4 w-4 text-warning" />}
          label="Inadimplência hoje"
          value={String(data?.inadimplenciaHoje ?? 0)}
          hint="motociclistas em cobrança"
        />
      </div>
    </Card>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}<span>{label}</span>
      </div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}
