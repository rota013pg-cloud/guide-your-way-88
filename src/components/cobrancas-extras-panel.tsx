/**
 * Painel de cobranças extras dos motoristas (camiseta, itens, manutenção, etc).
 * Lista itens abertos por motorista + diálogos para criar / lançar / extrato.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Loader2, Receipt, XCircle, Trash2, History } from "lucide-react";
import {
  criarCobrancaExtra,
  listarCobrancasExtras,
  extratoCobrancaExtra,
  lancarPagamentoCobrancaExtra,
  removerLancamentoCobrancaExtra,
  cancelarCobrancaExtra,
} from "@/lib/cobrancas-extras.functions";

type Motorista = { codigo: string; nome: string };

const brl = (v: number | string | null | undefined) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

const CATEGORIAS_LABEL: Record<string, string> = {
  uniforme: "Uniforme",
  itens_cliente: "Itens p/ cliente",
  manutencao: "Manutenção",
  equipamento: "Equipamento",
  multa: "Multa",
  adiantamento: "Adiantamento",
  outros: "Outros",
};

const FORMAS_LABEL: Record<string, string> = {
  por_dia: "Por dia",
  parcela_fixa: "Parcela fixa",
  avulsa: "Avulsa",
};

export function CobrancasExtrasPanel({ motoristas }: { motoristas: Motorista[] }) {
  const listarFn = useServerFn(listarCobrancasExtras);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cobrancas-extras", "todas"],
    queryFn: () => listarFn({ data: { somenteAbertas: false } }),
    refetchInterval: 20000,
  });

  const [novoOpen, setNovoOpen] = useState(false);
  const [extratoId, setExtratoId] = useState<number | null>(null);
  const [lancarItem, setLancarItem] = useState<{ id: number; descricao: string; saldo: number; sugerido: number } | null>(null);

  const cancelarFn = useServerFn(cancelarCobrancaExtra);
  const cancelar = useMutation({
    mutationFn: (id: number) => cancelarFn({ data: { cobrancaId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas-extras"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Cobrança cancelada");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const itens = data?.itens ?? [];
  const abertas = itens.filter((i) => i.status === "aberta");
  const quitadas = itens.filter((i) => i.status === "quitada");

  return (
    <>
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold">Cobranças extras</h2>
            <p className="text-xs text-muted-foreground">
              Camiseta, itens p/ cliente, manutenção, etc. Independente da diária.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{abertas.length} aberta(s)</Badge>
            <Button size="sm" onClick={() => setNovoOpen(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nova cobrança
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Motociclista</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pago</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={8} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </TableCell></TableRow>
              )}
              {!isLoading && itens.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma cobrança extra cadastrada.
                </TableCell></TableRow>
              )}
              {[...abertas, ...quitadas].map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.motorista_codigo}</TableCell>
                  <TableCell>
                    <div className="font-medium">{i.descricao}</div>
                    {Number(i.valor_parcela_dia) > 0 && (
                      <div className="text-xs text-muted-foreground">{brl(i.valor_parcela_dia)}/dia</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">{CATEGORIAS_LABEL[i.categoria] ?? i.categoria}</TableCell>
                  <TableCell className="text-right">{brl(i.valor_total)}</TableCell>
                  <TableCell className="text-right text-emerald-600">{brl(i.valor_pago)}</TableCell>
                  <TableCell className="text-right font-bold">{brl(i.saldo)}</TableCell>
                  <TableCell>
                    <Badge variant={i.status === "quitada" ? "default" : i.status === "cancelada" ? "outline" : "secondary"}>
                      {i.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Extrato" onClick={() => setExtratoId(i.id)}>
                        <History className="h-4 w-4" />
                      </Button>
                      {i.status === "aberta" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLancarItem({
                              id: i.id,
                              descricao: i.descricao,
                              saldo: i.saldo,
                              sugerido: Number(i.valor_parcela_dia) || i.saldo,
                            })}
                          >
                            <Receipt className="h-4 w-4 mr-1" /> Lançar
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Cancelar cobrança"
                            onClick={() => {
                              if (confirm(`Cancelar a cobrança "${i.descricao}"? Os lançamentos já feitos permanecem.`)) {
                                cancelar.mutate(i.id);
                              }
                            }}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <NovaCobrancaDialog
        open={novoOpen}
        onOpenChange={setNovoOpen}
        motoristas={motoristas}
      />
      <LancarPagamentoDialog
        item={lancarItem}
        onClose={() => setLancarItem(null)}
      />
      <ExtratoDialog
        cobrancaId={extratoId}
        onClose={() => setExtratoId(null)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════
// NOVA COBRANÇA
// ═══════════════════════════════════════════════════════
function NovaCobrancaDialog({
  open, onOpenChange, motoristas,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motoristas: Motorista[];
}) {
  const criarFn = useServerFn(criarCobrancaExtra);
  const qc = useQueryClient();
  const [form, setForm] = useState({
    motoristaCodigo: "",
    descricao: "",
    categoria: "uniforme",
    formaCobranca: "por_dia",
    valorTotal: "",
    valorParcelaDia: "",
    observacoes: "",
  });

  const criar = useMutation({
    mutationFn: () => criarFn({
      data: {
        motoristaCodigo: form.motoristaCodigo,
        descricao: form.descricao,
        categoria: form.categoria as "uniforme",
        formaCobranca: form.formaCobranca as "por_dia",
        valorTotal: Number(form.valorTotal),
        valorParcelaDia: Number(form.valorParcelaDia || 0),
        observacoes: form.observacoes || undefined,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas-extras"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Cobrança criada ✓");
      onOpenChange(false);
      setForm({ motoristaCodigo: "", descricao: "", categoria: "uniforme", formaCobranca: "por_dia", valorTotal: "", valorParcelaDia: "", observacoes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const valid = form.motoristaCodigo && form.descricao && Number(form.valorTotal) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova cobrança extra</DialogTitle>
          <DialogDescription>
            Item a ser cobrado do motociclista (camiseta, manutenção, item p/ cliente, etc).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Motociclista</Label>
            <Select value={form.motoristaCodigo} onValueChange={(v) => setForm((f) => ({ ...f, motoristaCodigo: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {motoristas.map((m) => (
                  <SelectItem key={m.codigo} value={m.codigo}>{m.codigo} — {m.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Camiseta da plataforma"
              value={form.descricao}
              onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm((f) => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CATEGORIAS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Forma</Label>
              <Select value={form.formaCobranca} onValueChange={(v) => setForm((f) => ({ ...f, formaCobranca: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FORMAS_LABEL).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Valor total (R$)</Label>
              <Input
                type="number" step="0.01" min={0}
                placeholder="50.00"
                value={form.valorTotal}
                onChange={(e) => setForm((f) => ({ ...f, valorTotal: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Por dia (R$)</Label>
              <Input
                type="number" step="0.01" min={0}
                placeholder="10.00"
                value={form.valorParcelaDia}
                onChange={(e) => setForm((f) => ({ ...f, valorParcelaDia: e.target.value }))}
                disabled={form.formaCobranca === "avulsa"}
              />
            </div>
          </div>
          <div>
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea
              rows={2}
              value={form.observacoes}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} disabled={!valid || criar.isPending}>
            {criar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar cobrança
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// LANÇAR PAGAMENTO (avulso, fora do fluxo da diária)
// ═══════════════════════════════════════════════════════
function LancarPagamentoDialog({
  item, onClose,
}: {
  item: { id: number; descricao: string; saldo: number; sugerido: number } | null;
  onClose: () => void;
}) {
  const lancarFn = useServerFn(lancarPagamentoCobrancaExtra);
  const qc = useQueryClient();
  const [valor, setValor] = useState("");
  const [obs, setObs] = useState("");

  // reset ao abrir
  useState(() => { if (item) { setValor(item.sugerido.toFixed(2)); setObs(""); } });
  if (item && valor === "") setValor(item.sugerido.toFixed(2));

  const lancar = useMutation({
    mutationFn: () => lancarFn({ data: { cobrancaId: item!.id, valor: Number(valor), observacoes: obs || undefined } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas-extras"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Pagamento lançado ✓");
      setValor(""); setObs("");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar pagamento</DialogTitle>
          <DialogDescription>{item?.descricao}</DialogDescription>
        </DialogHeader>
        {item && (
          <div className="space-y-3">
            <div className="text-sm bg-muted/50 rounded p-3">
              Saldo devedor: <b>{brl(item.saldo)}</b>
            </div>
            <div>
              <Label className="text-xs">Valor pago (R$)</Label>
              <Input
                type="number" step="0.01" min={0.01} max={item.saldo}
                value={valor}
                onChange={(e) => setValor(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Observações (opcional)</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => lancar.mutate()} disabled={!Number(valor) || lancar.isPending}>
            {lancar.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// EXTRATO da cobrança
// ═══════════════════════════════════════════════════════
function ExtratoDialog({ cobrancaId, onClose }: { cobrancaId: number | null; onClose: () => void }) {
  const extratoFn = useServerFn(extratoCobrancaExtra);
  const removerFn = useServerFn(removerLancamentoCobrancaExtra);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cobrancas-extras", "extrato", cobrancaId],
    queryFn: () => extratoFn({ data: { cobrancaId: cobrancaId! } }),
    enabled: !!cobrancaId,
  });

  const remover = useMutation({
    mutationFn: (id: number) => removerFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cobrancas-extras"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Lançamento removido");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!cobrancaId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Extrato — {data?.item?.descricao ?? ""}</DialogTitle>
          <DialogDescription>
            {data?.item && (
              <>
                Total: <b>{brl(data.item.valor_total)}</b> · Pago: <b className="text-emerald-600">{brl(data.item.valor_pago)}</b> · Saldo: <b>{brl(data.item.saldo)}</b>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin inline" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Obs</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.lancamentos ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Nenhum pagamento.</TableCell></TableRow>
              )}
              {(data?.lancamentos ?? []).map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{new Date(l.data).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-right font-medium">{brl(l.valor)}</TableCell>
                  <TableCell className="text-xs">{l.operador ?? "—"}</TableCell>
                  <TableCell className="text-xs">{l.observacoes ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => {
                      if (confirm("Remover este lançamento?")) remover.mutate(l.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════
// Dialog "Marcar diária + extras" — usado pelo financeiro.tsx
// ═══════════════════════════════════════════════════════
export function MarcarDiariaComExtrasDialog({
  open, onClose, motorista, valorDiaria, onConfirm, pending,
}: {
  open: boolean;
  onClose: () => void;
  motorista: { codigo: string; nome: string } | null;
  valorDiaria: number;
  onConfirm: (payload: { valor: number; extras: { cobrancaId: number; valor: number }[] }) => void;
  pending: boolean;
}) {
  const listarFn = useServerFn(listarCobrancasExtras);
  const { data } = useQuery({
    queryKey: ["cobrancas-extras", "marcar", motorista?.codigo],
    queryFn: () => listarFn({ data: { motoristaCodigo: motorista!.codigo, somenteAbertas: true } }),
    enabled: !!motorista && open,
  });

  const abertas = data?.itens ?? [];
  const [valorDiariaState, setValorDiariaState] = useState(valorDiaria.toFixed(2));
  const [selecionadas, setSelecionadas] = useState<Record<number, { sel: boolean; valor: string }>>({});

  // (re)inicializa quando abre
  if (open && motorista && Object.keys(selecionadas).length === 0 && abertas.length > 0) {
    const init: Record<number, { sel: boolean; valor: string }> = {};
    for (const i of abertas) {
      const sug = Number(i.valor_parcela_dia) || 0;
      init[i.id] = { sel: sug > 0, valor: (sug > 0 ? Math.min(sug, i.saldo) : 0).toFixed(2) };
    }
    setSelecionadas(init);
  }

  const totalExtras = abertas.reduce((s, i) => {
    const e = selecionadas[i.id];
    return s + (e?.sel ? Number(e.valor) || 0 : 0);
  }, 0);
  const total = (Number(valorDiariaState) || 0) + totalExtras;

  const handleClose = () => { setSelecionadas({}); setValorDiariaState(valorDiaria.toFixed(2)); onClose(); };

  const confirmar = () => {
    const extras = abertas
      .filter((i) => selecionadas[i.id]?.sel && Number(selecionadas[i.id].valor) > 0)
      .map((i) => ({ cobrancaId: i.id, valor: Math.min(Number(selecionadas[i.id].valor), i.saldo) }));
    onConfirm({ valor: Number(valorDiariaState) || valorDiaria, extras });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar diária paga</DialogTitle>
          <DialogDescription>
            {motorista ? `${motorista.codigo} — ${motorista.nome}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 p-3 bg-muted/50 rounded">
            <div>
              <div className="text-sm font-medium">Diária do dia</div>
              <div className="text-xs text-muted-foreground">Valor configurado: {brl(valorDiaria)}</div>
            </div>
            <Input
              type="number" step="0.01" min={0}
              className="w-28 text-right"
              value={valorDiariaState}
              onChange={(e) => setValorDiariaState(e.target.value)}
            />
          </div>

          {abertas.length > 0 && (
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-2">Cobranças extras abertas</div>
              <div className="space-y-2">
                {abertas.map((i) => {
                  const sel = selecionadas[i.id] ?? { sel: false, valor: "0.00" };
                  return (
                    <div key={i.id} className="flex items-center gap-2 p-2 border rounded">
                      <input
                        type="checkbox"
                        checked={sel.sel}
                        onChange={(e) => setSelecionadas((s) => ({ ...s, [i.id]: { ...sel, sel: e.target.checked } }))}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{i.descricao}</div>
                        <div className="text-xs text-muted-foreground">
                          Saldo {brl(i.saldo)} {Number(i.valor_parcela_dia) > 0 ? `· ${brl(i.valor_parcela_dia)}/dia` : ""}
                        </div>
                      </div>
                      <Input
                        type="number" step="0.01" min={0} max={i.saldo}
                        disabled={!sel.sel}
                        className="w-24 text-right"
                        value={sel.valor}
                        onChange={(e) => setSelecionadas((s) => ({ ...s, [i.id]: { ...sel, valor: e.target.value } }))}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-primary/10 rounded">
            <div className="text-sm font-medium">Total a pagar</div>
            <div className="text-xl font-bold text-primary">{brl(total)}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar pagamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
