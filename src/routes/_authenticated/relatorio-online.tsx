import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { operadorRelatorioOnline, type LinhaRankingOnline } from "@/lib/relatorios.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, RefreshCw, Trophy } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/relatorio-online")({
  head: () => ({ meta: [{ title: "Relatório de tempo online — Rota013" }] }),
  component: RelatorioOnlinePage,
});

type Periodo = "hoje" | "7dias" | "mes" | "custom";

function formatDuracao(seg: number): string {
  const s = Math.max(0, Math.floor(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rs = s % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${rs}s`;
  return `${rs}s`;
}

function toIsoLocal(d: Date): string {
  return d.toISOString();
}

// data (yyyy-mm-dd) -> Date local no início/fim do dia
function diaParaData(dia: string, fimDoDia: boolean): Date {
  const [y, m, d] = dia.split("-").map(Number);
  return fimDoDia ? new Date(y, m - 1, d, 23, 59, 59, 999) : new Date(y, m - 1, d, 0, 0, 0, 0);
}

function calcularIntervalo(periodo: Periodo, deDia: string, ateDia: string): { deIso: string; ateIso: string } {
  const agora = new Date();
  if (periodo === "hoje") {
    const de = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    return { deIso: toIsoLocal(de), ateIso: toIsoLocal(agora) };
  }
  if (periodo === "7dias") {
    const base = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
    base.setDate(base.getDate() - 6);
    return { deIso: toIsoLocal(base), ateIso: toIsoLocal(agora) };
  }
  if (periodo === "mes") {
    const de = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
    return { deIso: toIsoLocal(de), ateIso: toIsoLocal(agora) };
  }
  // custom
  const de = deDia ? diaParaData(deDia, false) : new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
  const ate = ateDia ? diaParaData(ateDia, true) : agora;
  return { deIso: toIsoLocal(de), ateIso: toIsoLocal(ate) };
}

function hojeYmd(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function RelatorioOnlinePage() {
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [deDia, setDeDia] = useState<string>(hojeYmd());
  const [ateDia, setAteDia] = useState<string>(hojeYmd());
  const [busca, setBusca] = useState("");
  const [ranking, setRanking] = useState<LinhaRankingOnline[]>([]);
  const [totalGeralSeg, setTotalGeralSeg] = useState(0);
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { deIso, ateIso } = calcularIntervalo(periodo, deDia, ateDia);
      const r = await operadorRelatorioOnline({ data: { deIso, ateIso } });
      setRanking(r.ranking);
      setTotalGeralSeg(r.totalGeralSeg);
    } catch (e) {
      if (!(e instanceof Error && /unauthorized|authorization header/i.test(e.message))) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      }
    } finally {
      setCarregando(false);
    }
  };

  // Recarrega ao trocar o período (exceto custom, que espera o botão Aplicar).
  useEffect(() => {
    if (periodo !== "custom") carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const filtrados = useMemo(() => {
    if (!busca) return ranking;
    const q = busca.toLowerCase();
    return ranking.filter(
      (r) => r.nome.toLowerCase().includes(q) || r.codigo.toLowerCase().includes(q),
    );
  }, [ranking, busca]);

  const btn = (p: Periodo, label: string) => (
    <Button
      key={p}
      variant={periodo === p ? "default" : "outline"}
      size="sm"
      onClick={() => setPeriodo(p)}
    >
      {label}
    </Button>
  );

  return (
    <div className="p-3 lg:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
        <h1 className="text-base md:text-2xl font-bold flex items-center gap-2 min-w-0">
          <Clock className="h-5 w-5 md:h-6 md:w-6 shrink-0" />
          <span className="truncate">Tempo online</span>
        </h1>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className={`h-4 w-4 md:mr-1 ${carregando ? "animate-spin" : ""}`} />
          <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Quanto tempo cada motociclista ficou online no período. Sessões abertas
        contam até agora. O registro vale a partir da ativação deste relatório —
        não há histórico anterior.
      </p>

      {/* Filtros de período */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {btn("hoje", "Hoje")}
        {btn("7dias", "7 dias")}
        {btn("mes", "Mês")}
        {btn("custom", "Período")}
      </div>

      {periodo === "custom" && (
        <div className="flex flex-wrap items-end gap-2 mb-3">
          <label className="text-xs text-muted-foreground">
            De
            <Input type="date" value={deDia} max={ateDia} onChange={(e) => setDeDia(e.target.value)} className="mt-1" />
          </label>
          <label className="text-xs text-muted-foreground">
            Até
            <Input type="date" value={ateDia} min={deDia} max={hojeYmd()} onChange={(e) => setAteDia(e.target.value)} className="mt-1" />
          </label>
          <Button size="sm" onClick={carregar} disabled={carregando}>
            Aplicar
          </Button>
        </div>
      )}

      <Input
        placeholder="Buscar motociclista por nome ou código..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4 max-w-md"
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Motociclistas com atividade</div>
          <div className="text-xl font-bold">{ranking.length}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Tempo online somado</div>
          <div className="text-xl font-bold">{formatDuracao(totalGeralSeg)}</div>
        </Card>
        <Card className="p-3">
          <div className="text-[11px] text-muted-foreground">Online agora</div>
          <div className="text-xl font-bold text-success">
            {ranking.filter((r) => r.online).length}
          </div>
        </Card>
      </div>

      {filtrados.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {carregando ? "Carregando..." : "Nenhum tempo online registrado neste período."}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 w-10">#</th>
                  <th className="px-3 py-2">Motociclista</th>
                  <th className="px-3 py-2 text-right">Tempo online</th>
                  <th className="px-3 py-2 text-right hidden sm:table-cell">Sessões</th>
                  <th className="px-3 py-2 text-right hidden md:table-cell">Última vez</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => {
                  const pos = ranking.indexOf(r) + 1;
                  return (
                    <tr key={r.codigo} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2 font-semibold text-muted-foreground">
                        {pos <= 3 ? (
                          <Trophy
                            className={`h-4 w-4 ${pos === 1 ? "text-yellow-500" : pos === 2 ? "text-zinc-400" : "text-amber-700"}`}
                          />
                        ) : (
                          pos
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium truncate">{r.nome}</span>
                          <span className="text-[11px] text-muted-foreground shrink-0">({r.codigo})</span>
                          {r.online && (
                            <Badge className="bg-success text-success-foreground shrink-0 text-[10px]">online</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatDuracao(r.totalSeg)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums hidden sm:table-cell">{r.sessoes}</td>
                      <td className="px-3 py-2 text-right text-xs text-muted-foreground hidden md:table-cell">
                        {r.online
                          ? "agora"
                          : r.ultimoFimIso
                          ? new Date(r.ultimoFimIso).toLocaleString("pt-BR")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
