import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
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
import { CheckCircle2, Loader2, FileDown, Trash2, Wallet, Plus, Minus, ShieldAlert, Unlock, Search } from "lucide-react";
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
import { CobrancasExtrasPanel, MarcarDiariaComExtrasDialog } from "@/components/cobrancas-extras-panel";
import { ComprovantesPendentesPanel } from "@/components/comprovantes-pendentes-panel";

// pdf-lib é pesado e só precisa ao clicar "Gerar PDF" — import dinâmico.

export const Route = createFileRoute("/_authenticated/financeiro")({
  ssr: false,
  head: () => ({ meta: [{ title: "Financeiro — Rota 013" }] }),
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
    mutationFn: (v: { codigo: string; valor?: number; extras?: { cobrancaId: number; valor: number }[] }) =>
      marcarFn({ data: { motoristaCodigo: v.codigo, valor: v.valor, extras: v.extras } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      qc.invalidateQueries({ queryKey: ["cobrancas-extras"] });
      const erros = r.extrasErro?.length ?? 0;
      toast.success(
        (r.jaExistia ? "Diária já registrada" : "Diária registrada ✓") +
        (r.extrasOk?.length ? ` · ${r.extrasOk.length} extra(s) lançado(s)` : "") +
        (erros ? ` · ${erros} extra(s) com erro` : ""),
      );
      setMarcarOpen(null);
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
  const [marcarOpen, setMarcarOpen] = useState<{ codigo: string; nome: string } | null>(null);
  const [busca, setBusca] = useState("");

  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [gerando, setGerando] = useState(false);

  const termoBusca = busca.trim().toLowerCase();
  const linhasFiltradas = useMemo(() => {
    if (!data?.linhas) return [];
    if (!termoBusca) return data.linhas;
    return data.linhas.filter(
      (l) =>
        l.codigo.toLowerCase().includes(termoBusca) ||
        l.nome.toLowerCase().includes(termoBusca),
    );
  }, [data?.linhas, termoBusca]);

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
    <div className="p-3 md:p-6 space-y-3 md:space-y-4">
      <div>
        <h1 className="text-lg md:text-2xl font-bold">Financeiro</h1>
        <p className="text-xs md:text-sm text-muted-foreground">
          Diárias do dia operacional (corte às 06h) e relatórios por período.
        </p>
      </div>

      <ComprovantesPendentesPanel />

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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="font-semibold">Diárias de hoje</h2>
              <p className="text-xs text-muted-foreground">
                Dia operacional: {data?.diaOp ?? "—"}
              </p>
            </div>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou nome…"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>
        {/* Mobile: cards */}
        <div className="md:hidden divide-y">
          {isLoading && (
            <div className="p-6 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
          )}
          {!isLoading && linhasFiltradas.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {busca.trim() ? "Nenhum motociclista encontrado." : "Nenhum motociclista cadastrado."}
            </div>
          )}
          {linhasFiltradas.map((l) => {
            const online = ["Online", "Em corrida"].includes(l.status);
            return (
              <div key={l.codigo} className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{l.codigo}</span>
                      <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-green-500" : "bg-muted-foreground"}`} />
                      <span className="text-xs text-muted-foreground truncate">{l.status}</span>
                    </div>
                    <div className="font-medium text-sm truncate">{l.nome}</div>
                    <div className="text-xs text-muted-foreground truncate">{l.telefone ?? "—"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    {l.pago ? (
                      <Badge variant="default" className="text-[10px]">✅ {brl(l.valorPago)}</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Pendente</Badge>
                    )}
                    {l.creditos > 0 && (
                      <div className="mt-1">
                        <Badge variant="outline" className="font-mono text-[10px]">{l.creditos} créd.</Badge>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-8 px-2 text-xs"
                    onClick={() => { setCredDias(5); setCredOpen({ codigo: l.codigo, nome: l.nome }); }}>
                    <Wallet className="h-3.5 w-3.5 mr-1" /> Adiantar
                  </Button>
                  {l.pago ? (
                    <Button size="sm" variant="ghost" className="h-8 px-2"
                      onClick={() => { if (confirm(`Remover diária de ${l.nome}?`)) remover.mutate(l.pagamentoId!); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <Button size="sm" className="h-8 px-2 text-xs"
                      onClick={() => setMarcarOpen({ codigo: l.codigo, nome: l.nome })} disabled={marcar.isPending}>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pago
                    </Button>
                  )}
                  {l.creditos > 0 && (
                    <Button size="sm" variant="ghost" className="h-8 px-2"
                      onClick={() => { if (confirm(`Remover 1 crédito de ${l.nome}?`)) remCredito.mutate(l.codigo); }}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: tabela */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Código</TableHead>
                <TableHead>Motociclista</TableHead>
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
              {!isLoading && linhasFiltradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    {busca.trim() ? "Nenhum motociclista encontrado." : "Nenhum motociclista cadastrado."}
                  </TableCell>
                </TableRow>
              )}
              {linhasFiltradas.map((l) => {
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
                            onClick={() => setMarcarOpen({ codigo: l.codigo, nome: l.nome })}
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

      {/* ─── Cobranças extras (camiseta, itens, manutenção…) ─── */}
      <CobrancasExtrasPanel
        motoristas={(data?.linhas ?? []).map((l) => ({ codigo: l.codigo, nome: l.nome }))}
      />

      {/* ─── Cobranças automáticas (gatilho de bloqueio) ─── */}
      <CobrancasAutomaticasPanel />

      {/* ─── Dialog: marcar diária paga com extras ─── */}
      <MarcarDiariaComExtrasDialog
        open={!!marcarOpen}
        onClose={() => setMarcarOpen(null)}
        motorista={marcarOpen}
        valorDiaria={data?.valorDiaria ?? 0}
        pending={marcar.isPending}
        onConfirm={(p) => marcarOpen && marcar.mutate({ codigo: marcarOpen.codigo, valor: p.valor, extras: p.extras })}
      />

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

// ════════════════════════════════════════════════════
// Painel: Cobranças automáticas de hoje (gatilho de bloqueio)
// ════════════════════════════════════════════════════
type CobrancaRow = {
  motorista_codigo: string;
  motorista_nome?: string | null;
  motorista_telefone?: string | null;
  status: string;
  faturamento_dia: number | string;
  valor_diaria: number | string;
  disparou_aviso_em: string | null;
  disparou_bloqueio_em: string | null;
  comprovante_enviado_em: string | null;
  liberado_em: string | null;
  liberado_por: string | null;
};

function CobrancasAutomaticasPanel() {
  const listarFn = useServerFn(listarCobrancasHoje);
  const liberarFn = useServerFn(liberarMotorista);
  const bloquearFn = useServerFn(bloquearMotorista);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cobrancas", "hoje"],
    queryFn: () => listarFn(),
    refetchInterval: 15000,
  });

  // Realtime: motorista atingiu gatilho → toast
  useEffect(() => {
    const ch = supabase
      .channel("cobrancas-painel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "motorista_cobranca" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["cobrancas"] });
          const novo = payload.new as Partial<CobrancaRow> | null;
          if (!novo) return;
          if (payload.eventType === "UPDATE" || payload.eventType === "INSERT") {
            if (novo.status === "Bloqueado") {
              toast.warning(`⚠️ ${novo.motorista_codigo} bloqueado — faturou acima do limite sem pagar a diária`);
            } else if (novo.status === "Aguardando") {
              toast.info(`💰 ${novo.motorista_codigo} avisou pagamento — confirme o comprovante`);
            }
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const liberar = useMutation({
    mutationFn: (codigo: string) => liberarFn({ data: { motoristaCodigo: codigo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Motociclista liberado ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloquear = useMutation({
    mutationFn: (codigo: string) => bloquearFn({ data: { motoristaCodigo: codigo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas"] });
      toast.success("Motociclista bloqueado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linhas = (data?.cobrancas ?? []) as CobrancaRow[];
  const ativos = linhas.filter((c) => c.status !== "Pago");

  const corStatus = (s: string) =>
    s === "Bloqueado" ? "destructive" : s === "Aguardando" ? "secondary" : s === "Pago" ? "default" : "outline";

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Cobranças automáticas de hoje</h2>
          <p className="text-xs text-muted-foreground">
            App do motociclista exibe aviso ao atingir o valor da diária e bloqueia ao passar do limite configurado.
          </p>
        </div>
        <Badge variant="outline">{ativos.length} ativa(s)</Badge>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Motociclista</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Faturado hoje</TableHead>
              <TableHead>Diária</TableHead>
              <TableHead>Comprovante</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell>
              </TableRow>
            )}
            {!isLoading && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhuma cobrança em andamento hoje.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((c) => (
              <TableRow key={c.motorista_codigo}>
                <TableCell>
                  <div className="font-mono text-xs">{c.motorista_codigo}</div>
                  <div className="text-xs text-muted-foreground">{c.motorista_nome ?? "—"}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={corStatus(c.status)}>{c.status}</Badge>
                </TableCell>
                <TableCell className="font-medium">{brl(Number(c.faturamento_dia))}</TableCell>
                <TableCell>{brl(Number(c.valor_diaria))}</TableCell>
                <TableCell className="text-xs">
                  {c.comprovante_enviado_em
                    ? `Enviado ${new Date(c.comprovante_enviado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.status !== "Pago" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!confirm(`Confirmar pagamento e liberar ${c.motorista_codigo}?`)) return;
                          liberar.mutate(c.motorista_codigo);
                        }}
                        disabled={liberar.isPending}
                      >
                        <Unlock className="h-4 w-4 mr-1" /> Liberar
                      </Button>
                    )}
                    {c.status !== "Bloqueado" && c.status !== "Pago" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (!confirm(`Bloquear ${c.motorista_codigo} agora?`)) return;
                          bloquear.mutate(c.motorista_codigo);
                        }}
                      >
                        <ShieldAlert className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
