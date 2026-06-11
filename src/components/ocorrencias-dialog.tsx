import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, ThumbsUp, AlertTriangle, MessageSquare, Flag } from "lucide-react";
import {
  listarOcorrencias, criarOcorrencia, excluirOcorrencia,
  type TipoPessoa, type TipoOcorrencia, type Ocorrencia,
} from "@/lib/ocorrencias.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipoPessoa: TipoPessoa;
  pessoaCodigo: string;
  pessoaNome?: string;
};

const TIPO_META: Record<TipoOcorrencia, { label: string; cls: string; icon: any }> = {
  elogio:       { label: "Elogio",       cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40", icon: ThumbsUp },
  reclamacao:   { label: "Reclamação",   cls: "bg-amber-500/15 text-amber-700 border-amber-500/40",     icon: Flag },
  ocorrencia:   { label: "Ocorrência",   cls: "bg-orange-500/15 text-orange-700 border-orange-500/40",  icon: AlertTriangle },
  advertencia:  { label: "Advertência",  cls: "bg-red-500/15 text-red-700 border-red-500/40",           icon: AlertTriangle },
  observacao:   { label: "Observação",   cls: "bg-muted text-foreground border-border",                 icon: MessageSquare },
};

export function OcorrenciasDialog({ open, onOpenChange, tipoPessoa, pessoaCodigo, pessoaNome }: Props) {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarOcorrencias);
  const criarFn = useServerFn(criarOcorrencia);
  const excluirFn = useServerFn(excluirOcorrencia);

  const [tipo, setTipo] = useState<TipoOcorrencia>("observacao");
  const [nivel, setNivel] = useState<number>(1);
  const [descricao, setDescricao] = useState("");

  const queryKey = ["ocorrencias", tipoPessoa, pessoaCodigo] as const;

  const { data: lista = [], isLoading } = useQuery({
    queryKey,
    queryFn: () => listarFn({ data: { tipo_pessoa: tipoPessoa, pessoa_codigo: pessoaCodigo } }),
    enabled: open,
  });

  const criarMut = useMutation({
    mutationFn: () => criarFn({
      data: { tipo_pessoa: tipoPessoa, pessoa_codigo: pessoaCodigo, tipo, nivel, descricao: descricao.trim() },
    }),
    onSuccess: () => {
      toast.success("Registro adicionado");
      setDescricao("");
      setTipo("observacao");
      setNivel(1);
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => excluirFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Excluído");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {pessoaNome ?? pessoaCodigo}</DialogTitle>
          <DialogDescription>
            Registre elogios, reclamações, ocorrências e advertências. Tudo fica salvo no histórico desta pessoa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border rounded-md p-3 bg-muted/30">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TipoOcorrencia)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TIPO_META) as TipoOcorrencia[]).map((k) => (
                    <SelectItem key={k} value={k}>{TIPO_META[k].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Gravidade (1–4)</Label>
              <Select value={String(nivel)} onValueChange={(v) => setNivel(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 — Leve</SelectItem>
                  <SelectItem value="2">2 — Moderada</SelectItem>
                  <SelectItem value="3">3 — Grave</SelectItem>
                  <SelectItem value="4">4 — Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Descrição</Label>
            <Textarea
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o ocorrido…"
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => criarMut.mutate()}
              disabled={criarMut.isPending || descricao.trim().length < 3}
            >
              {criarMut.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar registro
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Histórico ({lista.length})</h4>
          {isLoading && <div className="text-sm text-muted-foreground">Carregando…</div>}
          {!isLoading && lista.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center border rounded-md">
              Nenhum registro ainda.
            </div>
          )}
          {lista.map((o: Ocorrencia) => {
            const meta = TIPO_META[o.tipo];
            const Icon = meta.icon;
            return (
              <div key={o.id} className="border rounded-md p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={meta.cls}>
                      <Icon className="h-3 w-3 mr-1" />{meta.label}
                    </Badge>
                    <Badge variant="secondary">Nível {o.nivel}</Badge>
                    {o.corrida_id && <span className="text-xs text-muted-foreground">Corrida #{o.corrida_id}</span>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { if (confirm("Excluir este registro?")) delMut.mutate(o.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <p className="text-sm whitespace-pre-wrap">{o.descricao}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(o.criado_em).toLocaleString("pt-BR")}
                  {o.operador_nome ? ` • por ${o.operador_nome}` : ""}
                </p>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
