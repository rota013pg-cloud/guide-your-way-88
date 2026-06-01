import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MapLeaflet, type MapMotorista } from "@/components/map-leaflet";
import { NovaCorridaDialog } from "@/components/nova-corrida-dialog";
import { LogOut, MapPin, Users, ListChecks, CheckCircle2, XCircle, UserPlus } from "lucide-react";
import {
  decideDashboardAuth,
  decideDashboardAuthError,
  withSessionTimeout,
  type DashboardAuthDecision,
} from "@/lib/auth-redirect";



export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({ meta: [{ title: "Painel — Rota 013 Beta" }] }),
  component: DashboardPage,
});

type AuthState = "checking" | "redirecting" | "ready";


type Motorista = { codigo: string; nome: string; moto: string | null; placa: string | null; status: string };
type Corrida = {
  id: number; cliente: string | null; origem: string; destino: string | null;
  status: string; valor_final: number; motorista: string | null; motorista_codigo: string | null;
  criado_em: string;
};
type Gps = { motorista_codigo: string; lat: number; lng: number; criado_em: string };

function DashboardPage() {
  const navigate = useNavigate();
  const [authState, setAuthState] = useState<AuthState>("checking");
  const ready = authState === "ready";
  const [email, setEmail] = useState<string>("");
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [gps, setGps] = useState<Gps[]>([]);

  const [redirectReason, setRedirectReason] = useState<DashboardAuthDecision extends { kind: "redirect"; search: { reason: infer R } } ? R : never | null>(null as never);
  const [redirectMessage, setRedirectMessage] = useState<string>("");

  useEffect(() => {
    const applyDecision = (decision: DashboardAuthDecision) => {
      if (decision.kind === "redirect") {
        setRedirectReason(decision.search.reason as never);
        setRedirectMessage(decision.message);
        setAuthState("redirecting");
        toast.error(decision.message);
        setTimeout(() => {
          navigate({
            to: decision.to,
            replace: decision.replace,
            search: decision.search as never,
          });
        }, decision.delayMs);
        return;
      }
      setEmail(decision.email);
      setAuthState("ready");
    };

    withSessionTimeout(supabase.auth.getSession())
      .then(({ data, error }) => {
        if (error) {
          applyDecision(decideDashboardAuthError(error));
          return;
        }
        applyDecision(decideDashboardAuth(data.session));
      })
      .catch((err) => {
        applyDecision(decideDashboardAuthError(err));
      });
  }, [navigate]);



  const carregar = async () => {
    const [m, c, g] = await Promise.all([
      supabase.from("motoristas").select("codigo,nome,moto,placa,status").order("nome"),
      supabase.from("corridas").select("id,cliente,origem,destino,status,valor_final,motorista,motorista_codigo,criado_em").order("criado_em", { ascending: false }).limit(50),
      supabase.from("motorista_gps").select("motorista_codigo,lat,lng,criado_em").order("criado_em", { ascending: false }).limit(200),
    ]);
    if (m.data) setMotoristas(m.data as Motorista[]);
    if (c.data) setCorridas(c.data as Corrida[]);
    if (g.data) setGps(g.data as Gps[]);
  };

  useEffect(() => {
    if (!ready) return;
    carregar();
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "corridas" }, carregar)
      .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, carregar)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "motorista_gps" }, carregar)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ready]);

  const online = useMemo(() => motoristas.filter((m) => m.status === "Online" || m.status === "Em corrida"), [motoristas]);
  const offline = useMemo(() => motoristas.filter((m) => m.status === "Offline"), [motoristas]);
  const ativas = useMemo(() => corridas.filter((c) => !["Finalizada", "Cancelada"].includes(c.status)), [corridas]);
  const finalizadasHoje = useMemo(() => {
    const hoje = new Date().toDateString();
    return corridas.filter((c) => c.status === "Finalizada" && new Date(c.criado_em).toDateString() === hoje);
  }, [corridas]);

  const mapaMotoristas: MapMotorista[] = useMemo(() => {
    const ultimoPorCodigo = new Map<string, Gps>();
    for (const g of gps) {
      if (!ultimoPorCodigo.has(g.motorista_codigo)) ultimoPorCodigo.set(g.motorista_codigo, g);
    }
    return online
      .map((m) => {
        const p = ultimoPorCodigo.get(m.codigo);
        if (!p) return null;
        return { codigo: m.codigo, nome: m.nome, lat: Number(p.lat), lng: Number(p.lng), status: m.status };
      })
      .filter((x): x is MapMotorista => x !== null);
  }, [gps, online]);

  if (!ready) {
    const redirecting = authState === "redirecting";
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-6">
        <div className={`flex h-16 w-16 items-center justify-center rounded-full font-black text-2xl ${redirecting ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground animate-pulse"}`}>
          {redirecting ? "!" : "R"}
        </div>
        <div className="text-center space-y-2 max-w-sm">
          <h2 className="font-bold text-lg">
            {redirecting ? "Sessão não encontrada" : "Rota 013 Beta"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {redirecting
              ? "Você precisa entrar para acessar o painel. Redirecionando para o login..."
              : "Verificando sessão..."}
          </p>
        </div>
        <div className="h-1.5 w-48 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full w-2/3 animate-[pulse_1.2s_ease-in-out_infinite] ${redirecting ? "bg-destructive" : "bg-primary"}`} />
        </div>
      </div>
    );
  }


  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

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

  const corStatus = (s: string) => {
    if (s === "Pendente") return "bg-warning text-warning-foreground";
    if (s === "Ofertada") return "bg-warning text-warning-foreground";
    if (s === "Finalizada") return "bg-success text-success-foreground";
    if (s === "Cancelada") return "bg-destructive text-destructive-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card sticky top-0 z-30">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-black text-primary-foreground text-lg">R</div>
            <div>
              <h1 className="font-bold leading-tight">Rota 013 Beta</h1>
              <p className="text-xs text-muted-foreground">Painel do operador</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5"><Users className="h-4 w-4 text-success" /><span className="font-semibold">{online.length}</span><span className="text-muted-foreground">online</span></div>
              <div className="flex items-center gap-1.5"><ListChecks className="h-4 w-4 text-primary" /><span className="font-semibold">{ativas.length}</span><span className="text-muted-foreground">ativas</span></div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-success" /><span className="font-semibold">{finalizadasHoje.length}</span><span className="text-muted-foreground">hoje</span></div>
            </div>
            <Button variant="outline" size="sm" onClick={sair}>
              <LogOut className="h-4 w-4 md:mr-2" /><span className="hidden md:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 md:p-6 grid gap-4 md:gap-6 lg:grid-cols-[1fr_400px]">
        {/* Coluna esquerda — Mapa + ações */}
        <div className="space-y-4 md:space-y-6">
          <Card className="p-0 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="font-semibold">Mapa em tempo real</h2>
              </div>
              <Badge variant="secondary">{mapaMotoristas.length} no mapa</Badge>
            </div>
            <div className="h-[400px] md:h-[480px]">
              <MapLeaflet motoristas={mapaMotoristas} />
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
                  corStatus={corStatus(c.status)}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Coluna direita — Ações + listas */}
        <div className="space-y-4 md:space-y-6">
          <Card className="p-4">
            <NovaCorridaDialog onCriada={carregar} />
          </Card>

          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Motoristas online</h2>
              <Badge className="bg-success text-success-foreground">{online.length}</Badge>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto">
              {online.length === 0 && <p className="text-sm text-muted-foreground">Nenhum motorista online.</p>}
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

          <p className="text-xs text-muted-foreground text-center">Conectado como <span className="text-foreground">{email}</span></p>
        </div>
      </main>
    </div>
  );
}

function CorridaAtivaCard({
  c, motoristasOnline, onAtribuir, onFinalizar, onCancelar, corStatus,
}: {
  c: Corrida; motoristasOnline: Motorista[]; onAtribuir: (cod: string) => void;
  onFinalizar: () => void; onCancelar: () => void; corStatus: string;
}) {
  return (
    <div className="rounded-lg border border-border p-3 space-y-2 hover:border-primary/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm truncate">{c.cliente ?? "Sem cliente"}</div>
          <div className="text-xs text-muted-foreground truncate">📍 {c.origem}</div>
          {c.destino && <div className="text-xs text-muted-foreground truncate">🏁 {c.destino}</div>}
        </div>
        <div className="text-right shrink-0">
          <Badge className={corStatus}>{c.status}</Badge>
          <div className="text-sm font-bold text-primary mt-1">R$ {Number(c.valor_final).toFixed(2)}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        {!c.motorista_codigo ? (
          <Select onValueChange={onAtribuir}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <div className="flex items-center gap-1.5"><UserPlus className="h-3 w-3" /><SelectValue placeholder="Atribuir motorista..." /></div>
            </SelectTrigger>
            <SelectContent>
              {motoristasOnline.filter((m) => m.status === "Online").length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum motorista disponível</div>
              )}
              {motoristasOnline.filter((m) => m.status === "Online").map((m) => (
                <SelectItem key={m.codigo} value={m.codigo}>{m.nome} ({m.codigo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-xs flex-1 truncate">🏍️ <span className="font-medium">{c.motorista}</span></div>
        )}
        {c.motorista_codigo && (
          <Button size="sm" variant="default" className="h-8 px-2" onClick={onFinalizar}>
            <CheckCircle2 className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 px-2" onClick={onCancelar}>
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
