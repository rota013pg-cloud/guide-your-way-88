import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listarCupons, salvarCupom, removerCupom } from "@/lib/cupons.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ticket, Plus, Trash2, Pencil, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/cupons")({
  head: () => ({ meta: [{ title: "Cupons — Rota013" }] }),
  component: CuponsPage,
});

type Cupom = Awaited<ReturnType<typeof listarCupons>>[number];

type FormState = {
  id?: number;
  codigo: string;
  descontoPct: string;
  aplicacao: "automatico" | "manual";
  limiteUsos: string; // "" = indeterminado
  validoDe: string; // yyyy-mm-dd
  validoAte: string;
  compensacao: "absorve" | "credito_diaria";
  ativo: boolean;
};

const VAZIO: FormState = {
  codigo: "",
  descontoPct: "10",
  aplicacao: "manual",
  limiteUsos: "",
  validoDe: "",
  validoAte: "",
  compensacao: "absorve",
  ativo: true,
};

function isoParaDia(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function CuponsPage() {
  const listarFn = useServerFn(listarCupons);
  const salvarFn = useServerFn(salvarCupom);
  const removerFn = useServerFn(removerCupom);

  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try {
      const lista = await listarFn();
      setCupons(lista as Cupom[]);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirNovo = () => {
    setForm(VAZIO);
    setDialogOpen(true);
  };

  const abrirEdicao = (c: Cupom) => {
    setForm({
      id: c.id,
      codigo: c.codigo,
      descontoPct: String(c.desconto_pct),
      aplicacao: (c.aplicacao as "automatico" | "manual") ?? "manual",
      limiteUsos: c.limite_usos != null ? String(c.limite_usos) : "",
      validoDe: isoParaDia(c.valido_de),
      validoAte: isoParaDia(c.valido_ate),
      compensacao: (c.compensacao as "absorve" | "credito_diaria") ?? "absorve",
      ativo: c.ativo,
    });
    setDialogOpen(true);
  };

  const salvar = async () => {
    const pct = Number(form.descontoPct.replace(",", "."));
    if (!form.codigo.trim()) return toast.error("Informe o código do cupom.");
    if (!(pct > 0 && pct <= 100)) return toast.error("Desconto deve ser entre 1% e 100%.");
    const limite = form.limiteUsos.trim() ? Number(form.limiteUsos) : null;
    if (limite != null && !(Number.isInteger(limite) && limite > 0)) {
      return toast.error("Limite de usos inválido (deixe vazio para indeterminado).");
    }
    setSalvando(true);
    try {
      await salvarFn({
        data: {
          id: form.id,
          codigo: form.codigo.trim().toUpperCase(),
          descontoPct: pct,
          aplicacao: form.aplicacao,
          limiteUsos: limite,
          validoDe: form.validoDe ? new Date(`${form.validoDe}T00:00:00`).toISOString() : null,
          validoAte: form.validoAte ? new Date(`${form.validoAte}T23:59:59`).toISOString() : null,
          compensacao: form.compensacao,
          ativo: form.ativo,
        },
      });
      toast.success(form.id ? "Cupom atualizado." : "Cupom criado.");
      setDialogOpen(false);
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSalvando(false);
    }
  };

  const alternarAtivo = async (c: Cupom) => {
    try {
      await salvarFn({
        data: {
          id: c.id,
          codigo: c.codigo,
          descontoPct: Number(c.desconto_pct),
          aplicacao: (c.aplicacao as "automatico" | "manual") ?? "manual",
          limiteUsos: c.limite_usos ?? null,
          validoDe: c.valido_de,
          validoAte: c.valido_ate,
          compensacao: (c.compensacao as "absorve" | "credito_diaria") ?? "absorve",
          ativo: !c.ativo,
        },
      });
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    }
  };

  const remover = async (c: Cupom) => {
    if (!confirm(`Remover o cupom ${c.codigo}? Essa ação não pode ser desfeita.`)) return;
    try {
      await removerFn({ data: { id: c.id } });
      toast.success("Cupom removido.");
      carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover");
    }
  };

  const validade = (c: Cupom): string => {
    const de = c.valido_de ? new Date(c.valido_de).toLocaleDateString("pt-BR") : null;
    const ate = c.valido_ate ? new Date(c.valido_ate).toLocaleDateString("pt-BR") : null;
    if (!de && !ate) return "Sem prazo";
    return `${de ?? "…"} → ${ate ?? "…"}`;
  };

  const ordenados = useMemo(
    () => [...cupons].sort((a, b) => Number(b.ativo) - Number(a.ativo)),
    [cupons],
  );

  return (
    <div className="p-3 lg:p-6">
      <div className="flex items-center justify-between mb-3 md:mb-4 gap-2">
        <h1 className="text-base md:text-2xl font-bold flex items-center gap-2 min-w-0">
          <Ticket className="h-5 w-5 md:h-6 md:w-6 shrink-0" />
          <span className="truncate">Cupons de desconto</span>
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={carregar} disabled={carregando}>
            <RefreshCw className={`h-4 w-4 ${carregando ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={abrirNovo}>
            <Plus className="h-4 w-4 md:mr-1" /> <span className="hidden md:inline">Novo cupom</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Cupons dão desconto nas corridas. Podem ser aplicados automaticamente ou pelo cliente no app.
        Na compensação "crédito de diária", o desconto vai somando para o motociclista e, ao atingir o
        valor de uma diária, vira 1 crédito automático.
      </p>

      {ordenados.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {carregando ? "Carregando..." : "Nenhum cupom cadastrado ainda."}
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {ordenados.map((c) => (
            <Card key={c.id} className={`p-4 ${c.ativo ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-base tracking-wide">{c.codigo}</span>
                    <Badge className="bg-primary/15 text-primary shrink-0">{Number(c.desconto_pct)}% OFF</Badge>
                    {!c.ativo && <Badge variant="secondary" className="shrink-0">inativo</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{c.aplicacao === "automatico" ? "🔁 Automático" : "⌨️ Manual (código)"}</span>
                    <span>{c.compensacao === "credito_diaria" ? "🎟️ Crédito de diária" : "Motociclista absorve"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>Validade: {validade(c)}</span>
                    <span>
                      Usos: <b className="text-foreground">{c.usos ?? 0}</b>
                      {c.limite_usos != null ? ` / ${c.limite_usos}` : " (ilimitado)"}
                    </span>
                  </div>
                </div>
                <Switch checked={c.ativo} onCheckedChange={() => alternarAtivo(c)} />
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => abrirEdicao(c)} className="flex-1">
                  <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remover(c)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar cupom" : "Novo cupom"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Código</Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s/g, "") }))}
                placeholder="BEMVINDO10"
                className="font-mono tracking-wide"
              />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={form.descontoPct}
                onChange={(e) => setForm((f) => ({ ...f, descontoPct: e.target.value }))}
              />
            </div>
            <div>
              <Label>Aplicação</Label>
              <Select
                value={form.aplicacao}
                onValueChange={(v) => setForm((f) => ({ ...f, aplicacao: v as FormState["aplicacao"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual — cliente digita o código</SelectItem>
                  <SelectItem value="automatico">Automático — aplica sozinho para todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Compensação ao motociclista</Label>
              <Select
                value={form.compensacao}
                onValueChange={(v) => setForm((f) => ({ ...f, compensacao: v as FormState["compensacao"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="absorve">Motociclista absorve o desconto</SelectItem>
                  <SelectItem value="credito_diaria">Acumula → crédito de diária</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Limite de usos (total)</Label>
              <Input
                type="number"
                min={1}
                value={form.limiteUsos}
                onChange={(e) => setForm((f) => ({ ...f, limiteUsos: e.target.value }))}
                placeholder="Vazio = indeterminado"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Válido de</Label>
                <Input
                  type="date"
                  value={form.validoDe}
                  onChange={(e) => setForm((f) => ({ ...f, validoDe: e.target.value }))}
                />
              </div>
              <div>
                <Label>Válido até</Label>
                <Input
                  type="date"
                  value={form.validoAte}
                  onChange={(e) => setForm((f) => ({ ...f, validoAte: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <Label>Ativo</Label>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((f) => ({ ...f, ativo: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button onClick={salvar} disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
