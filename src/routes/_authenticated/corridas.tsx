import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Rocket } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { listarCorridasRecentes, lancarCorridaAgendada, dispararOfertas } from "@/lib/corridas.functions";
import { CorridaTimeline } from "@/components/corrida-timeline";
import { NovaCorridaDialog } from "@/components/nova-corrida-dialog";

export const Route = createFileRoute("/_authenticated/corridas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Corridas — Rota 013 Beta" }] }),
  component: CorridasPage,
});

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" => {
  if (s === "Finalizada") return "secondary";
  if (s === "Cancelada") return "destructive";
  if (s === "Pendente" || s === "Agendada") return "outline";
  return "default";
};

function CorridasPage() {
  const fetchFn = useServerFn(listarCorridasRecentes);
  const [aberta, setAberta] = useState<any | null>(null);

  const { data: corridas = [], isLoading } = useQuery({
    queryKey: ["corridas-recentes"],
    queryFn: () => fetchFn({ data: { limite: 100 } }),
    refetchInterval: 8000,
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Corridas</h1>
        <p className="text-sm text-muted-foreground">
          {corridas.length} últimas — clique para ver o histórico de status.
        </p>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="hidden md:table-cell">Origem → Destino</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Despacho</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && corridas.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma corrida ainda.</TableCell></TableRow>
            )}
            {corridas.map((c: any) => (
              <TableRow key={c.id} onClick={() => setAberta(c)} className="cursor-pointer">
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>
                  <div className="font-medium">{c.cliente || "—"}</div>
                  <div className="text-xs text-muted-foreground">{c.cliente_codigo || c.telefone_cliente || ""}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[320px]">
                  {c.origem}{c.destino ? ` → ${c.destino}` : ""}
                  {Array.isArray(c.paradas) && c.paradas.length > 0 && (
                    <span className="ml-1 text-xs italic">({c.paradas.length} parada{c.paradas.length > 1 ? "s" : ""})</span>
                  )}
                </TableCell>
                <TableCell><Badge variant="outline">{c.modelo}</Badge></TableCell>
                <TableCell><Badge variant="outline">{c.despacho}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                <TableCell className="text-right font-bold">R$ {Number(c.valor_final).toFixed(0)},00</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Sheet open={!!aberta} onOpenChange={(v) => !v && setAberta(null)}>
        <SheetContent className="overflow-y-auto">
          {aberta && (
            <>
              <SheetHeader>
                <SheetTitle>Corrida #{aberta.id}</SheetTitle>
                <SheetDescription>
                  {aberta.cliente || "Sem cliente"} · {aberta.modelo} · {aberta.despacho}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Origem</div>
                  <div>{aberta.origem}</div>
                </div>
                {Array.isArray(aberta.paradas) && aberta.paradas.length > 0 && (
                  <div>
                    <div className="text-xs text-muted-foreground">Paradas</div>
                    <ol className="list-decimal list-inside">
                      {aberta.paradas.map((p: any, i: number) => (
                        <li key={i}>
                          {p.endereco}
                          {p.concluida_em && (
                            <span className="text-xs text-muted-foreground ml-2">
                              ✓ {new Date(p.concluida_em).toLocaleTimeString("pt-BR")}
                            </span>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                {aberta.destino && (
                  <div>
                    <div className="text-xs text-muted-foreground">Destino</div>
                    <div>{aberta.destino}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Valor</div>
                    <div className="font-bold">R$ {Number(aberta.valor_final).toFixed(0)},00</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pagamento</div>
                    <div>{aberta.pagamento ?? "—"}</div>
                  </div>
                </div>
                {aberta.motorista && (
                  <div>
                    <div className="text-xs text-muted-foreground">Motorista</div>
                    <div>{aberta.motorista} <span className="font-mono text-xs">({aberta.motorista_codigo})</span></div>
                  </div>
                )}
                {aberta.observacoes && (
                  <div>
                    <div className="text-xs text-muted-foreground">Observações</div>
                    <div>{aberta.observacoes}</div>
                  </div>
                )}
                <div>
                  <div className="text-xs text-muted-foreground mb-2">Histórico de status</div>
                  <CorridaTimeline corridaId={aberta.id} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
