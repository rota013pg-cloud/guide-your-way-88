import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapLeaflet, type MapMotorista } from "@/components/map-leaflet";
import { NovaCorridaDialog } from "@/components/nova-corrida-dialog";
import { ErrorBoundary } from "@/components/error-boundary";
import { DashboardKpis } from "@/components/dashboard-kpis";
import { MapPin, Users, ListChecks, CheckCircle2, XCircle, UserPlus, DollarSign, Rocket } from "lucide-react";
import { dispararOfertas, lancarCorridaAgendada } from "@/lib/corridas.functions";
import { marcarStaleOffline } from "@/lib/motoristas.functions";


export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel — Rota 013" }] }),
  component: DashboardPage,
});

type Motorista = { codigo: string; nome: string; moto: string | null; placa: string | null; status: string };
type Corrida = {
  id: number; cliente: string | null; origem: string; destino: string | null;
  status: string; valor_final: number; motorista: string | null; motorista_codigo: string | null;
  criado_em: string; eta_coleta_segundos: number | null; eta_chegada_em: string | null;
};
type Gps = { motorista_codigo: string; lat: number; lng: number; criado_em: string };

function DashboardPage() {
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [gps, setGps] = useState<Gps[]>([]);
  const [travadosPagto, setTravadosPagto] = useState<{ status: string }[]>([]);

  const staleFn = useServerFn(marcarStaleOffline);

  const carregar = async () => {
    // Antes de ler, força auto-offline de motoristas sem ping de GPS recente.
    // Cobre o caso de app fechado / celular bloqueado, em que o cliente não
    // consegue avisar o servidor antes de ser suspenso pelo SO.
    try { await staleFn(); } catch { /* silencioso */ }

    const hojeOp = new Date();
    if (hojeOp.getHours() < 6) hojeOp.setDate(hojeOp.getDate() - 1);
    const dia = hojeOp.toISOString().slice(0, 10);
    const [m, c, g, cob] = await Promise.all([
      supabase.from("motoristas").select("codigo,nome,moto,placa,status").order("nome"),
      supabase.from("corridas").select("id,cliente,origem,destino,status,valor_final,motorista,motorista_codigo,criado_em,eta_coleta_segundos,eta_chegada_em").order("criado_em", { ascending: false }).limit(50),
      supabase.from("motorista_gps").select("motorista_codigo,lat,lng,criado_em").order("criado_em", { ascending: false }).limit(200),
      supabase.from("motorista_cobranca").select("status").eq("dia_op", dia).in("status", ["Pendente", "Aguardando", "Bloqueado"]),
    ]);
    if (m.data) setMotoristas(m.data as Motorista[]);
    if (c.data) setCorridas(c.data as Corrida[]);
    if (g.data) setGps(g.data as Gps[]);
    if (cob.data) setTravadosPagto(cob.data as { status: string }[]);
  };

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "corridas" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, carregar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "motorista_gps" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "motorista_cobranca" }, carregar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "corrida_status_log" }, (payload) => {
        const log = payload.new as { status: string; corrida_id: number; observacao: string | null };
        if (log.status === "Reofertando") {
          toast.warning(`Corrida #${log.corrida_id}: ${log.observacao ?? "nenhum motociclista aceitou — reofertando"}`);
        }
      })
      .subscribe((status) => {
        console.log("[dashboard realtime]", status);
      });
    // Fallback polling — garante atualização mesmo se o realtime cair
    const poll = setInterval(carregar, 5000);
    // Recarrega ao voltar para a aba
    const onVis = () => { if (document.visibilityState === "visible") carregar(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const online = useMemo(() => motoristas.filter((m) => m.status === "Online" || m.status === "Em corrida"), [motoristas]);
  const offline = useMemo(() => motoristas.filter((m) => m.status === "Offline"), [motoristas]);
  const ativas = useMemo(() => corridas.filter((c) => !["Finalizada", "Cancelada"].includes(c.status)), [corridas]);
  const finalizadasHoje = useMemo(() => {
    const hoje = new Date().toDateString();
    return corridas.filter((c) => c.status === "Finalizada" && new Date(c.criado_em).toDateString() === hoje);
  }, [corridas]);

  const mapaMotoristas: MapMotorista[] = useMemo(() => {
    const ultimoPorCodigo = new Map<string, Gps>();
    for (const g of gps) if (!ultimoPorCodigo.has(g.motorista_codigo)) ultimoPorCodigo.set(g.motorista_codigo, g);
    return online
      .map((m) => {
        const p = ultimoPorCodigo.get(m.codigo);
        if (!p) return null;
        return { codigo: m.codigo, nome: m.nome, lat: Number(p.lat), lng: Number(p.lng), status: m.status };
      })
      .filter((x): x is MapMotorista => x !== null);
  }, [gps, online]);

  const atribuir = async (id: number, motoristaCodigo: string) => {
    const mot = motoristas.find((m) => m.codigo === motoristaCodigo);
    if (!mot) return;
    const { error } = await supabase.from("corridas").update({
      motorista_codigo: mot.codigo, motorista: mot.nome, status: "Aceita",
    }).eq("id", id);
    if (error) toast.error(error.message); else toast.success(`Atribuída a ${mot.nome}`);
  };

  const finalizar = async (id: number) => {
    const { error } = await supabase.from("corridas").update({
      status: "Finalizada", finalizada_em: new Date().toISOString(),
    }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Corrida finalizada");
  };

  const cancelar = async (id: number) => {
    const { error } = await supabase.from("corridas").update({ status: "Cancelada" }).eq("id", id);
    if (error) toast.error(error.message); else toast("Corrida cancelada");
  };

  const ofertasFn = useServerFn(dispararOfertas);
  const lancarFn = useServerFn(lancarCorridaAgendada);

  const reofertar = async (id: number) => {
    const resp = window.prompt("Oferecer novamente para quantos motociclistas mais próximos?", "5");
    if (resp === null) return;
    const qtd = parseInt(resp, 10);
    if (!Number.isFinite(qtd) || qtd < 1 || qtd > 50) {
      toast.error("Informe um número entre 1 e 50.");
      return;
    }
    try {
      const r: any = await ofertasFn({ data: { corridaId: id, quantidade: qtd, reofertar: true } });
      if (r?.ofertados > 0) toast.success(`Reofertada para ${r.ofertados} motociclista(s).`);
      else toast.warning(r?.motivo ?? "Nenhum motociclista disponível.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao reofertar.");
    }
  };

  const lancarAgora = async (id: number) => {
    try {
      await lancarFn({ data: { corridaId: id } });
      await ofertasFn({ data: { corridaId: id } }).catch(() => {});
      toast.success("Corrida lançada.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao lançar.");
    }
  };

  const corStatus = (s: string) => {
    if (s === "Pendente" || s === "Ofertada") return "bg-warning text-warning-foreground";
    if (s === "Finalizada") return "bg-success text-success-foreground";
    if (s === "Cancelada") return "bg-destructive text-destructive-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-success" /><span className="font-semibold">{online.length}</span><span className="text-muted-foreground">online</span></div>
          <div className="flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" /><span className="font-semibold">{ativas.length}</span><span className="text-muted-foreground">ativas</span></div>
          <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /><span className="font-semibold">{finalizadasHoje.length}</span><span className="text-muted-foreground">hoje</span></div>
          <div className="flex items-center gap-1.5" title="Apps de motociclista travados na tela de pagamento da diária">
            <DollarSign className={`h-4 w-4 ${travadosPagto.length ? "text-warning" : "text-muted-foreground"}`} />
            <span className="font-semibold">{travadosPagto.length}</span>
            <span className="text-muted-foreground">app{travadosPagto.length === 1 ? "" : "s"} pagto.</span>
          </div>
        </div>
      </div>

      <DashboardKpis />

      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">

        <div className="space-y-4">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Mapa em tempo real</h2>
              </div>
              <Badge variant="secondary">{mapaMotoristas.length} no mapa</Badge>
            </div>
            <div className="h-[400px] md:h-[480px]">
              <ErrorBoundary label="o mapa">
                <MapLeaflet motoristas={mapaMotoristas} />
              </ErrorBoundary>
            </div>
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Corridas ativas</h2>
              <Badge>{ativas.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {ativas.length === 0 && <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma corrida ativa.</p>}
              {ativas.map((c) => (
                <CorridaAtivaCard
                  key={c.id} c={c} motoristasOnline={online}
                  onAtribuir={(cod) => atribuir(c.id, cod)}
                  onFinalizar={() => finalizar(c.id)}
                  onCancelar={() => cancelar(c.id)}
                  onReofertar={() => reofertar(c.id)}
                  onLancarAgora={() => lancarAgora(c.id)}
                  corStatus={corStatus(c.status)}
                />
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <NovaCorridaDialog onCriada={carregar} />
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Motociclistas online</h2>
              <Badge className="bg-success text-success-foreground">{online.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {online.length === 0 && <p className="text-sm text-muted-foreground">Nenhum motociclista online.</p>}
              {online.map((m) => (
                <div key={m.codigo} className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-accent/30 transition-colors">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{m.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.codigo} · {m.moto} {m.placa ? `· ${m.placa}` : ""}</div>
                  </div>
                  <Badge className={m.status === "Em corrida" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}>
                    {m.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Card>

          {offline.length > 0 && (
            <Card className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-muted-foreground">Offline</h2>
                <Badge variant="secondary">{offline.length}</Badge>
              </div>
              <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                {offline.map((m) => (
                  <div key={m.codigo} className="flex items-center justify-between rounded-md p-2 text-sm opacity-60">
                    <span className="truncate">{m.nome}</span>
                    <span className="text-xs text-muted-foreground">{m.codigo}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function CorridaAtivaCard({
  c, motoristasOnline, onAtribuir, onFinalizar, onCancelar, onReofertar, onLancarAgora, corStatus,
}: {
  c: Corrida; motoristasOnline: Motorista[]; onAtribuir: (cod: string) => void;
  onFinalizar: () => void; onCancelar: () => void;
  onReofertar: () => void; onLancarAgora: () => void; corStatus: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted-foreground">#{c.id}</span>
            <div className="font-semibold text-sm truncate">{c.cliente ?? "Sem cliente"}</div>
          </div>
          <div className="text-xs text-muted-foreground truncate">📍 {c.origem}</div>
          {c.destino && <div className="text-xs text-muted-foreground truncate">🏁 {c.destino}</div>}
          {c.eta_coleta_segundos != null && c.eta_coleta_segundos > 0 && (c.status === "Aceita" || c.status === "A caminho") && (
            <div className="text-[11px] font-medium text-primary">
              ⏱ Coleta em ~{Math.max(1, Math.round(c.eta_coleta_segundos / 60))} min
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <Badge className={corStatus}>{c.status}</Badge>
          <div className="text-sm font-bold text-primary mt-1">R$ {Number(c.valor_final).toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 flex-wrap">
        {!c.motorista_codigo ? (
          <Select onValueChange={onAtribuir}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-[140px]">
              <div className="flex items-center gap-1.5"><UserPlus className="h-3 w-3" /><SelectValue placeholder="Atribuir motociclista..." /></div>
            </SelectTrigger>
            <SelectContent>
              {motoristasOnline.filter((m) => m.status === "Online").length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum motociclista disponível</div>
              )}
              {motoristasOnline.filter((m) => m.status === "Online").map((m) => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.nome} ({m.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs flex-1 truncate">🏍️ <span className="font-medium">{c.motorista}</span></div>
        )}
        {(c.status === "Ofertada" || c.status === "Pendente") && !c.motorista_codigo && (
          <Button size="sm" variant="secondary" className="h-8 px-2" onClick={onReofertar} title="Oferecer novamente">
            <Rocket className="h-3.5 w-3.5" />
          </Button>
        )}
        {c.status === "Agendada" && (
          <Button size="sm" variant="default" className="h-8 px-2" onClick={onLancarAgora} title="Lançar agora">
            <Rocket className="h-3.5 w-3.5" />
          </Button>
        )}
        {c.motorista_codigo && (
          <Button size="sm" variant="default" className="h-8 px-2" onClick={onFinalizar} title="Finalizar">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={onCancelar} title="Cancelar">
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
