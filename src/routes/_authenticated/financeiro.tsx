import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Loader2, FileDown, Trash2, Wallet, Plus, Minus, ShieldAlert, Unlock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  listarFinanceiroHoje,
  marcarDiariaPaga,
  removerPagamento,
  relatorioFinanceiro,
  adicionarCreditosDiaria,
  removerCreditoDiaria,
} from "@/lib/financeiro.functions";
import { listarCobrancasHoje, liberarMotorista, bloquearMotorista } from "@/lib/cobranca.functions";
import { supabase } from "@/integrations/supabase/client";
// pdf-lib é pesado e só precisa ao clicar "Gerar PDF" — import dinâmico.

export const Route = createFileRoute("/_authenticated/financeiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Financeiro — Rota 013 Beta" }] }),
  component: FinanceiroPage,
});

const brl = (v: number | null | undefined) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

function hojeISO() {
  const d = new Date();
  d.setHours(d.getHours() - 3); // BRT
  return d.toISOString().slice(0, 10);
}

function FinanceiroPage() {
  const listarFn = useServerFn(listarFinanceiroHoje);
  const marcarFn = useServerFn(marcarDiariaPaga);
  const removerFn = useServerFn(removerPagamento);
  const relatorioFn = useServerFn(relatorioFinanceiro);
  const addCreditosFn = useServerFn(adicionarCreditosDiaria);
  const remCreditoFn = useServerFn(removerCreditoDiaria);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["financeiro", "hoje"],
    queryFn: () => listarFn(),
    refetchInterval: 15000,
  });

  const marcar = useMutation({
    mutationFn: (codigo: string) => marcarFn({ data: { motoristaCodigo: codigo } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(r.jaExistia ? "Diária já estava registrada hoje" : "Diária registrada ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remover = useMutation({
    mutationFn: (id: number) => removerFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Pagamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCreditos = useMutation({
    mutationFn: (v: { motoristaCodigo: string; dias: number }) =>
      addCreditosFn({ data: v }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success(`+${r.novosCreditos} créditos · ${brl(r.valorPago)} registrado`);
      setCredOpen(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remCredito = useMutation({
    mutationFn: (codigo: string) => remCreditoFn({ data: { motoristaCodigo: codigo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("1 crédito removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [credOpen, setCredOpen] = useState<{ codigo: string; nome: string } | null>(null);
  const [credDias, setCredDias] = useState(5);

  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [gerando, setGerando] = useState(false);

  const gerarRelatorio = async () => {
    setGerando(true);
    try {
      const [{ gerarPdfFinanceiro, baixarPdf }, r] = await Promise.all([
        import("@/lib/financeiro-pdf"),
        relatorioFn({ data: { de, ate } }),
      ]);
      const bytes = await gerarPdfFinanceiro(r);
      baixarPdf(bytes, `financeiro-${de}-a-${ate}.pdf`);
      toast.success("Relatório gerado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Diárias do dia operacional (corte às 06h) e relatórios por período.
        </p>
      </div>

      {/* ─── Cards de resumo ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Diárias pagas</div>
          <div className="text-2xl font-bold mt-1">{data?.pagas ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Pendentes</div>
          <div className="text-2xl font-bold mt-1">{data?.pendentes ?? "—"}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total arrecadado</div>
          <div className="text-2xl font-bold mt-1 text-primary">{brl(data?.total ?? 0)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Valor da diária</div>
          <div className="text-2xl font-bold mt-1">{brl(data?.valorDiaria ?? 0)}</div>
        </Card>
      </div>

      {/* ─── Tabela motoristas × diária do dia ─── */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Diárias de hoje</h2>
          <p className="text-xs text-muted-foreground">
            Dia operacional: {data?.diaOp ?? "—"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Diária</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data?.linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    Nenhum motorista cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {data?.linhas.map((l) => {
                const online = ["Online", "Em corrida"].includes(l.status);
                return (
                  <TableRow key={l.codigo}>
                    <TableCell className="font-mono text-xs">{l.codigo}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l.nome}</div>
                      <div className="text-xs text-muted-foreground">{l.telefone ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-muted-foreground"}`}
                        />
                        {l.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {l.pago ? (
                        <div className="flex flex-col">
                          <Badge variant="default" className="w-fit">
                            ✅ Paga {brl(l.valorPago)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground mt-0.5">
                            por {l.operador ?? "—"}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {l.creditos > 0 ? (
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono">
                            {l.creditos}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            title="Remover 1 crédito"
                            onClick={() => {
                              if (!confirm(`Remover 1 crédito de ${l.nome}?`)) return;
                              remCredito.mutate(l.codigo);
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setCredDias(5);
                            setCredOpen({ codigo: l.codigo, nome: l.nome });
                          }}
                          title="Adicionar pagamento adiantado"
                        >
                          <Wallet className="h-4 w-4 mr-1" /> Adiantar
                        </Button>
                        {l.pago ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (!confirm(`Remover diária de ${l.nome}?`)) return;
                              remover.mutate(l.pagamentoId!);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => marcar.mutate(l.codigo)}
                            disabled={marcar.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Marcar pago
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* ─── Relatório ─── */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Relatório por período (PDF)</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label htmlFor="rel-de" className="text-xs">De</Label>
            <Input
              id="rel-de"
              type="date"
              value={de}
              onChange={(e) => setDe(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label htmlFor="rel-ate" className="text-xs">Até</Label>
            <Input
              id="rel-ate"
              type="date"
              value={ate}
              onChange={(e) => setAte(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={gerarRelatorio} disabled={gerando}>
            {gerando ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-2" />
            )}
            Gerar PDF
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          O relatório usa o <b>dia operacional</b> (corte às 06h) — uma data inicial = data final gera o relatório do dia.
        </p>
      </Card>

      {/* ─── Modal: Adicionar créditos adiantados ─── */}
      <Dialog open={!!credOpen} onOpenChange={(v) => !v && setCredOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pagamento adiantado de diárias</DialogTitle>
          </DialogHeader>
          {credOpen && (
            <div className="space-y-3">
              <div className="text-sm">
                Motorista: <b>{credOpen.nome}</b> ({credOpen.codigo})
              </div>
              <div>
                <Label htmlFor="cred-dias" className="text-xs">Quantidade de diárias</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setCredDias((d) => Math.max(1, d - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    id="cred-dias"
                    type="number"
                    min={1}
                    max={60}
                    value={credDias}
                    onChange={(e) => setCredDias(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
                    className="w-24 text-center"
                  />
                  <Button
                    type="button" variant="outline" size="icon"
                    onClick={() => setCredDias((d) => Math.min(60, d + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="text-sm bg-muted/50 rounded p-3">
                Valor total: <b>{brl((data?.valorDiaria ?? 0) * credDias)}</b>
                <div className="text-xs text-muted-foreground mt-1">
                  O sistema vai dar baixa automática de 1 crédito na primeira corrida de cada novo dia.
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCredOpen(null)}>Cancelar</Button>
            <Button
              onClick={() => credOpen && addCreditos.mutate({ motoristaCodigo: credOpen.codigo, dias: credDias })}
              disabled={addCreditos.isPending}
            >
              {addCreditos.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Registrar pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
