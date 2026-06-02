import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { lerConfig, salvarConfig, type AppConfig } from "@/lib/config.functions";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Configurações — Rota 013 Beta" }] }),
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const lerFn = useServerFn(lerConfig);
  const salvarFn = useServerFn(salvarConfig);
  const qc = useQueryClient();
  const { isAdmin, loading: roleLoading } = useRole();

  const { data, isLoading } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => lerFn(),
  });

  const [form, setForm] = useState<AppConfig | null>(null);

  useEffect(() => {
    if (data?.config && !form) setForm(data.config);
  }, [data, form]);

  const salvar = useMutation({
    mutationFn: (v: AppConfig) => salvarFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app-config"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
      toast.success("Configurações salvas ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = <K extends keyof AppConfig>(k: K, v: AppConfig[K]) =>
    setForm((f) => (f ? { ...f, [k]: v } : f));

  const onSalvar = () => {
    if (!form) return;
    salvar.mutate(form);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados da empresa, WhatsApp central, valor de diária e PIX.
        </p>
      </div>

      {!roleLoading && !isAdmin && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex gap-3 items-start">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <b>Modo somente leitura.</b> Apenas administradores podem alterar estas configurações.
          </div>
        </Card>
      )}

      <Card className="p-4 md:p-6 space-y-4">
        {isLoading || !form ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="empresa">Nome da empresa</Label>
                <Input
                  id="empresa"
                  value={form.empresa}
                  disabled={!isAdmin}
                  onChange={(e) => upd("empresa", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cidadeBase">Cidade base</Label>
                <Input
                  id="cidadeBase"
                  value={form.cidadeBase}
                  disabled={!isAdmin}
                  onChange={(e) => upd("cidadeBase", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp">WhatsApp central</Label>
                <Input
                  id="whatsapp"
                  inputMode="numeric"
                  placeholder="5513999999999"
                  value={form.whatsappCentral}
                  disabled={!isAdmin}
                  onChange={(e) => upd("whatsappCentral", e.target.value.replace(/\D/g, ""))}
                />
                <p className="text-xs text-muted-foreground">DDI + DDD + número, só dígitos.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pix">Chave PIX</Label>
                <Input
                  id="pix"
                  value={form.pixChave}
                  disabled={!isAdmin}
                  onChange={(e) => upd("pixChave", e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valorDiaria">Valor da diária (R$)</Label>
                <Input
                  id="valorDiaria"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valorDiaria}
                  disabled={!isAdmin}
                  onChange={(e) => upd("valorDiaria", Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Usado pelo Financeiro como valor padrão de cada diária.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="valorParadaExtra">Valor por parada extra (R$)</Label>
                <Input
                  id="valorParadaExtra"
                  type="number"
                  step="0.50"
                  min="0"
                  value={form.valorParadaExtra}
                  disabled={!isAdmin}
                  onChange={(e) => upd("valorParadaExtra", Number(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  Somado ao valor da corrida para cada parada intermediária.
                </p>
              </div>

            </div>

            {data?.atualizadoEm && (
              <p className="text-xs text-muted-foreground">
                Última atualização:{" "}
                {new Date(data.atualizadoEm).toLocaleString("pt-BR")}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                onClick={onSalvar}
                disabled={!isAdmin || salvar.isPending}
              >
                {salvar.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Salvar
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
