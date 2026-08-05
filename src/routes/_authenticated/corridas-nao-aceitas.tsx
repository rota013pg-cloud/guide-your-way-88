import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { operadorListarCorridasNaoAceitas } from "@/lib/corridas.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CircleSlash, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/corridas-nao-aceitas")({
  head: () => ({ meta: [{ title: "Corridas não aceitas — Rota013" }] }),
  component: CorridasNaoAceitasPage,
});

type Corrida = Awaited<ReturnType<typeof operadorListarCorridasNaoAceitas>>["corridas"][number];

const brl = (v: number | null) => (v == null ? "—" : `R$ ${Number(v).toFixed(2).replace(".", ",")}`);

function rotuloOferta(status: string): { label: string; variant: "secondary" | "destructive" | "default" } {
  switch (status) {
    case "expirada": return { label: "Não respondeu", variant: "secondary" };
    case "recusada": return { label: "Recusou", variant: "destructive" };
    case "cancelada": return { label: "Cancelada", variant: "secondary" };
    case "pendente": return { label: "Pendente", variant: "default" };
    case "aceita": return { label: "Aceitou", variant: "default" };
    default: return { label: status, variant: "secondary" };
  }
}

function CorridasNaoAceitasPage() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const { corridas } = await operadorListarCorridasNaoAceitas({ data: {} });
      setCorridas(corridas);
    } catch (e) {
      if (!(e instanceof Error && /unauthorized|authorization header/i.test(e.message))) {
        toast.error(e instanceof Error ? e.message : "Erro ao carregar");
      }
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    const id = window.setInterval(carregar, 15000);
    return () => window.clearInterval(id);
  }, []);

  const filtradas = corridas.filter((c) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return (
      String(c.corridaId).includes(q) ||
      c.cliente.toLowerCase().includes(q) ||
      (c.origem ?? "").toLowerCase().includes(q) ||
      c.ofertas.some((o) => o.nome.toLowerCase().includes(q) || o.codigo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 lg:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
        <h1 className="text-base md:text-2xl font-bold flex items-center gap-2 min-w-0">
          <CircleSlash className="h-5 w-5 md:h-6 md:w-6 shrink-0" />
          <span className="truncate">Corridas não aceitas</span>
        </h1>
        <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
          <RefreshCw className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Atualizar</span>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground mb-3">
        Corridas que foram encerradas por falta de aceite. Abaixo, os motociclistas que receberam a oferta e não aceitaram.
      </p>

      <Input
        placeholder="Buscar por corrida, cliente, origem ou motociclista..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="mb-4 max-w-md"
      />

      {filtradas.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {carregando ? "Carregando..." : "Nenhuma corrida não aceita registrada."}
        </Card>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {filtradas.map((c) => (
          <Card key={c.corridaId} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold text-sm truncate">#{c.corridaId} · {c.cliente}</div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  📍 {c.origem ?? "—"} {c.destino ? `→ 🏁 ${c.destino}` : ""}
                </div>
              </div>
              <Badge variant="destructive" className="shrink-0 text-[10px]">Não aceita</Badge>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span>Valor: <b className="text-foreground">{brl(c.valor)}</b></span>
              {c.rodadas != null && <span>Rodadas: <b className="text-foreground">{c.rodadas}</b></span>}
              {c.quando && <span>{new Date(c.quando).toLocaleString("pt-BR")}</span>}
            </div>

            <div className="mt-2 text-xs text-muted-foreground">{c.motivo}</div>

            <div className="mt-3 border-t border-border pt-2">
              <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                Ofertada a {c.ofertas.length} motociclista{c.ofertas.length !== 1 ? "s" : ""}
              </div>
              {c.ofertas.length === 0 ? (
                <div className="text-xs text-muted-foreground">Nenhum motociclista foi ofertado (ninguém online).</div>
              ) : (
                <ul className="space-y-1">
                  {c.ofertas.map((o, i) => {
                    const r = rotuloOferta(o.status);
                    return (
                      <li key={`${o.codigo}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{o.nome} <span className="text-muted-foreground">({o.codigo})</span></span>
                        <Badge variant={r.variant} className="shrink-0 text-[10px]">{r.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
