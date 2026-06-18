import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken } from "@/lib/cliente-auth";
import { Bike, Calendar, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app/historico")({
  ssr: false,
  component: HistoricoPage,
});

type Corrida = {
  id: number;
  origem: string | null;
  destino: string | null;
  status: string;
  tipo: string | null;
  valor_final: number | null;
  criado_em: string;
  motorista: string | null;
};

function HistoricoPage() {
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getClienteToken();
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc("cliente_listar_corridas", { _token: token });
      if (error) {
        toast.error("Não foi possível carregar o histórico.");
      } else {
        setCorridas((data ?? []) as unknown as Corrida[]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="text-2xl font-bold">Histórico</h2>

      {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!loading && corridas.length === 0 && (
        <Card className="p-8 rounded-2xl text-center">
          <Bike className="size-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Você ainda não fez nenhuma corrida.</p>
        </Card>
      )}

      <div className="space-y-3">
        {corridas.map((c) => (
          <Card key={c.id} className="p-4 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(c.criado_em)}
              </span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex gap-2">
                <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
                <span className="line-clamp-2">{c.origem ?? "—"}</span>
              </div>
              <div className="flex gap-2">
                <MapPin className="size-4 text-destructive shrink-0 mt-0.5" />
                <span className="line-clamp-2">{c.destino ?? "—"}</span>
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border text-sm">
              <span className="text-muted-foreground">{c.motorista ?? "Sem motorista"}</span>
              <span className="font-semibold">
                {c.valor_final != null ? `R$ ${Number(c.valor_final).toFixed(2)}` : "—"}
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (["finalizada", "concluida"].includes(status)) return "default";
  if (["cancelada", "recusada"].includes(status)) return "destructive";
  return "secondary";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
