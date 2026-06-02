import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { listarHistorico } from "@/lib/historico.functions";

export const Route = createFileRoute("/_authenticated/historico")({
  ssr: false,
  head: () => ({ meta: [{ title: "Histórico — Rota 013 Beta" }] }),
  component: HistoricoPage,
});

const brl = (v: number | null | undefined) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

function hojeISO() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Finalizada: "default",
  Cancelada: "destructive",
  "Em viagem": "secondary",
  "A caminho": "secondary",
  Chegou: "secondary",
  Pendente: "outline",
  Aceita: "outline",
};

function HistoricoPage() {
  const listarFn = useServerFn(listarHistorico);

  const [de, setDe] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    d.setHours(d.getHours() - 3);
    return d.toISOString().slice(0, 10);
  });
  const [ate, setAte] = useState(hojeISO());
  const [status, setStatus] = useState<string>("Todos");
  const [motorista, setMotorista] = useState<string>("__all");

  const { data, isLoading } = useQuery({
    queryKey: ["historico", de, ate, status, motorista],
    queryFn: () =>
      listarFn({
        data: {
          de,
          ate,
          status: status as "Todos",
          motorista: motorista === "__all" ? undefined : motorista,
        },
      }),
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Histórico</h1>
        <p className="text-sm text-muted-foreground">
          Corridas registradas no período selecionado.
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="h-de" className="text-xs">De</Label>
            <Input id="h-de" type="date" value={de} onChange={(e) => setDe(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label htmlFor="h-ate" className="text-xs">Até</Label>
            <Input id="h-ate" type="date" value={ate} onChange={(e) => setAte(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos</SelectItem>
                <SelectItem value="Finalizada">Finalizada</SelectItem>
                <SelectItem value="Cancelada">Cancelada</SelectItem>
                <SelectItem value="Em viagem">Em viagem</SelectItem>
                <SelectItem value="A caminho">A caminho</SelectItem>
                <SelectItem value="Chegou">Chegou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Motorista</Label>
            <Select value={motorista} onValueChange={setMotorista}>
              <SelectTrigger className="w-52"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">Todos</SelectItem>
                {data?.motoristas.map((m) => (
                  <SelectItem key={m.codigo} value={m.codigo}>
                    {m.codigo} — {m.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total registros</div>
          <div className="text-2xl font-bold mt-1">{data?.lista.length ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Finalizadas</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{data?.totalFinalizadas ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Canceladas</div>
          <div className="text-2xl font-bold mt-1 text-destructive">{data?.totalCanceladas ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Valor finalizadas</div>
          <div className="text-2xl font-bold mt-1 text-primary">{brl(data?.totalValor ?? 0)}</div>
        </Card>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">#</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Trajeto</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && (data?.lista.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                    Sem registros no período/filtro selecionado.
                  </TableCell>
                </TableRow>
              )}
              {data?.lista.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">#{r.id}</TableCell>
                  <TableCell className="text-xs">{fmtData(r.criado_em)}</TableCell>
                  <TableCell className="text-sm">{r.cliente ?? "—"}</TableCell>
                  <TableCell className="text-sm">
                    {r.motorista ?? "—"}
                    {r.motorista_codigo && (
                      <span className="text-xs text-muted-foreground ml-1">({r.motorista_codigo})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs max-w-[260px]">
                    <div className="truncate">{r.origem}</div>
                    <div className="truncate text-muted-foreground">→ {r.destino ?? "—"}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[r.status] ?? "outline"} className="text-[10px]">
                      {r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {brl(Number(r.valor_final))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {(data?.lista.length ?? 0) >= 500 && (
          <div className="p-3 text-xs text-muted-foreground border-t">
            Exibindo as 500 corridas mais recentes do período. Refine os filtros para ver mais.
          </div>
        )}
      </Card>
    </div>
  );
}
