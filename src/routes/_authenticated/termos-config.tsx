import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Save, Loader2, FileText, Eye } from "lucide-react";
import { lerConfig, salvarTermos } from "@/lib/config.functions";

export const Route = createFileRoute("/_authenticated/termos-config")({
  ssr: false,
  head: () => ({ meta: [{ title: "Termos e Condições — Rota 013" }] }),
  component: TermosPage,
});

function TermosPage() {
  const lerFn = useServerFn(lerConfig);
  const salvarFn = useServerFn(salvarTermos);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => lerFn(),
  });

  const [versao, setVersao] = useState("1.0");
  const [conteudo, setConteudo] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (data?.config?.termos && !dirty) {
      setVersao(data.config.termos.versao ?? "1.0");
      setConteudo(data.config.termos.conteudo ?? "");
    }
  }, [data, dirty]);

  const salvar = useMutation({
    mutationFn: () => salvarFn({ data: { versao, conteudo } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
      qc.invalidateQueries({ queryKey: ["termos-publico"] });
      toast.success("Termos salvos ✓");
      setDirty(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const atualizadoEm = data?.config?.termos?.atualizadoEm
    ? new Date(data.config.termos.atualizadoEm).toLocaleString("pt-BR")
    : "—";

  return (
    <div className="p-3 md:p-6 space-y-3 md:space-y-4 max-w-5xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold flex items-center gap-2">
            <FileText className="h-5 w-5 md:h-6 md:w-6 shrink-0" /> Termos e Condições
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground">
            Conteúdo exibido no cadastro de novos clientes. Suporta HTML básico
            (&lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;strong&gt;, &lt;a&gt;…).
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Última atualização: <span className="font-mono">{atualizadoEm}</span>
          </p>
        </div>
        <Button onClick={() => salvar.mutate()} disabled={!dirty || salvar.isPending}>
          {salvar.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Salvar
        </Button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && (
        <div className="grid md:grid-cols-2 gap-4">
          <Card className="p-4 space-y-3">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="versao" className="text-xs">Versão</Label>
                <Input
                  id="versao"
                  value={versao}
                  onChange={(e) => { setVersao(e.target.value); setDirty(true); }}
                  placeholder="1.0"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="conteudo" className="text-xs">Conteúdo (HTML)</Label>
              <Textarea
                id="conteudo"
                value={conteudo}
                onChange={(e) => { setConteudo(e.target.value); setDirty(true); }}
                rows={22}
                className="font-mono text-xs"
              />
            </div>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="text-xs uppercase text-muted-foreground flex items-center gap-1">
              <Eye className="h-3 w-3" /> Pré-visualização
            </div>
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded p-3 bg-muted/30 max-h-[600px] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: conteudo }}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
