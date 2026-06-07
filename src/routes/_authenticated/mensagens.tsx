import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Trash2, Copy, Save, Loader2, MessageSquare,
} from "lucide-react";
import {
  lerConfig, salvarTemplates, type MensagemTemplate,
} from "@/lib/config.functions";

export const Route = createFileRoute("/_authenticated/mensagens")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mensagens — Rota 013" }] }),
  component: MensagensPage,
});

const VARIAVEIS = [
  "{cliente}", "{motorista}", "{origem}", "{destino}",
  "{valor}", "{empresa}", "{pix}", "{whatsapp}",
] as const;

const EXEMPLO: Record<string, string> = {
  "{cliente}": "Maria Souza",
  "{motorista}": "João (M07)",
  "{origem}": "Av. Ana Costa, 100",
  "{destino}": "Praia do Gonzaga",
  "{valor}": "R$ 18,00",
  "{empresa}": "Rota 013",
  "{pix}": "13999999999",
  "{whatsapp}": "5513999999999",
};

function preview(s: string) {
  return VARIAVEIS.reduce((acc, v) => acc.split(v).join(EXEMPLO[v]), s);
}

function novoId() {
  return Math.random().toString(36).slice(2, 10);
}

function MensagensPage() {
  const lerFn = useServerFn(lerConfig);
  const salvarFn = useServerFn(salvarTemplates);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => lerFn(),
  });

  const [lista, setLista] = useState<MensagemTemplate[]>([]);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.config && !dirty) setLista(data.config.templates ?? []);
  }, [data, dirty]);

  const salvar = useMutation({
    mutationFn: (v: MensagemTemplate[]) => salvarFn({ data: { templates: v } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
      toast.success("Templates salvos ✓");
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = (id: string, patch: Partial<MensagemTemplate>) => {
    setLista((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty(true);
  };
  const add = () => {
    setLista((l) => [
      ...l,
      { id: novoId(), titulo: "Novo template", texto: "Olá {cliente}, seu motociclista é {motociclista}." },
    ]);
    setDirty(true);
  };
  const remove = (id: string) => {
    if (!confirm("Remover este template?")) return;
    setLista((l) => l.filter((t) => t.id !== id));
    setDirty(true);
  };
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Mensagens</h1>
          <p className="text-sm text-muted-foreground">
            Templates de WhatsApp reutilizáveis. Use variáveis para personalizar.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={add}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
          <Button
            onClick={() => salvar.mutate(lista)}
            disabled={!dirty || salvar.isPending}
          >
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <Card className="p-3">
        <div className="text-xs text-muted-foreground mb-2">Variáveis disponíveis:</div>
        <div className="flex flex-wrap gap-1.5">
          {VARIAVEIS.map((v) => (
            <Badge key={v} variant="secondary" className="font-mono text-[11px]">{v}</Badge>
          ))}
        </div>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && lista.length === 0 && (
        <Card className="p-10 flex flex-col items-center justify-center gap-3 text-center border-dashed">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-semibold">Nenhum template ainda</h2>
            <p className="text-sm text-muted-foreground">Clique em "Novo" para começar.</p>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {lista.map((t) => (
          <Card key={t.id} className="p-4 space-y-3">
            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor={`tit-${t.id}`} className="text-xs">Título</Label>
                <Input
                  id={`tit-${t.id}`}
                  value={t.titulo}
                  onChange={(e) => upd(t.id, { titulo: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-1">
                <Button
                  size="icon" variant="ghost"
                  onClick={() => copiar(preview(t.texto))}
                  title="Copiar mensagem (com variáveis substituídas)"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon" variant="ghost"
                  onClick={() => remove(t.id)}
                  title="Remover"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`txt-${t.id}`} className="text-xs">Texto</Label>
              <Textarea
                id={`txt-${t.id}`}
                value={t.texto}
                onChange={(e) => upd(t.id, { texto: e.target.value })}
                rows={4}
                className="font-mono text-sm"
              />
            </div>

            <div className="bg-muted/50 rounded p-3">
              <div className="text-[10px] uppercase text-muted-foreground mb-1">Pré-visualização</div>
              <pre className="text-sm whitespace-pre-wrap font-sans">{preview(t.texto)}</pre>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
