import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Rota 013 Beta" }] }),
  component: DashboardPage,
});

type Motorista = { codigo: string; nome: string; moto: string | null; status: string };
type Corrida = { id: number; cliente: string | null; origem: string; destino: string | null; status: string; valor_final: number; motorista: string | null };

function DashboardPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [motoristas, setMotoristas] = useState<Motorista[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setReady(true);
    });
  }, [navigate]);

  useEffect(() => {
    if (!ready) return;
    const load = async () => {
      const [m, c] = await Promise.all([
        supabase.from("motoristas").select("codigo,nome,moto,status").order("nome"),
        supabase.from("corridas").select("id,cliente,origem,destino,status,valor_final,motorista").order("criado_em", { ascending: false }).limit(20),
      ]);
      if (m.data) setMotoristas(m.data as Motorista[]);
      if (c.data) setCorridas(c.data as Corrida[]);
    };
    load();
    const ch = supabase
      .channel("dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "corridas" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "motoristas" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [ready]);

  if (!ready) return null;

  const online = motoristas.filter((m) => m.status === "Online" || m.status === "Em corrida");
  const ativas = corridas.filter((c) => !["Finalizada", "Cancelada"].includes(c.status));
  const historico = corridas.filter((c) => ["Finalizada", "Cancelada"].includes(c.status));

  const sair = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  const corStatus = (s: string) => {
    if (s === "Pendente") return "bg-warning text-warning-foreground";
    if (s === "Finalizada") return "bg-success text-success-foreground";
    if (s === "Cancelada") return "bg-destructive text-destructive-foreground";
    return "bg-primary text-primary-foreground";
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary font-black text-primary-foreground">R</div>
            <div>
              <h1 className="font-bold leading-tight">Rota 013 Beta</h1>
              <p className="text-xs text-muted-foreground">Painel do operador</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={sair}>Sair</Button>
        </div>
      </header>

      <main className="p-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-1">Mapa em tempo real</h2>
            <p className="text-sm text-muted-foreground mb-4">Vai entrar aqui na próxima fase (Leaflet + pins dos motoristas online).</p>
            <div className="h-72 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground">
              🗺️ Mapa Leaflet — Fase 1
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Histórico de corridas</h2>
              <Badge variant="secondary">{historico.length}</Badge>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {historico.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.cliente}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.origem} → {c.destino}</div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className="font-semibold">R$ {Number(c.valor_final).toFixed(2)}</div>
                    <div className="text-xs text-muted-foreground">{c.motorista ?? "—"}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-3">Ações rápidas</h2>
            <Button className="w-full" disabled>＋ Nova corrida (Fase 1)</Button>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Motoristas online</h2>
              <Badge>{online.length}</Badge>
            </div>
            <div className="space-y-2">
              {online.map((m) => (
                <div key={m.codigo} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div>
                    <div className="font-medium text-sm">{m.nome}</div>
                    <div className="text-xs text-muted-foreground">{m.codigo} · {m.moto}</div>
                  </div>
                  <Badge className={m.status === "Em corrida" ? "bg-warning text-warning-foreground" : "bg-success text-success-foreground"}>
                    {m.status}
                  </Badge>
                </div>
              ))}
              {online.length === 0 && <p className="text-sm text-muted-foreground">Nenhum motorista online.</p>}
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Corridas ativas</h2>
              <Badge>{ativas.length}</Badge>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {ativas.map((c) => (
                <div key={c.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium truncate">{c.cliente}</span>
                    <Badge className={corStatus(c.status)}>{c.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">→ {c.destino}</div>
                  <div className="text-xs text-muted-foreground mt-1">{c.motorista ?? "Aguardando motorista"}</div>
                </div>
              ))}
              {ativas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma corrida ativa.</p>}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
