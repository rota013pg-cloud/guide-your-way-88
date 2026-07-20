import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken, clearClienteToken, useCliente } from "@/lib/cliente-auth";
import { desregistrarPushCliente } from "@/lib/push-native";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app/perfil")({
  ssr: false,
  component: PerfilPage,
});

function PerfilPage() {
  const { cliente, recarregar } = useCliente();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    telefone: "",
    email: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cidade: "",
  });
  const [saving, setSaving] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  const excluirConta = async () => {
    const token = getClienteToken();
    if (!token) return;
    setExcluindo(true);
    try {
      const { error } = await supabase.rpc("cliente_excluir_conta", { _token: token });
      if (error) throw error;
      await desregistrarPushCliente().catch(() => undefined);
      clearClienteToken();
      toast.success("Conta excluída. Sentiremos sua falta!");
      navigate({ to: "/cliente/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir a conta");
      setExcluindo(false);
    }
  };

  useEffect(() => {
    if (cliente) {
      setForm({
        telefone: cliente.telefone ?? "",
        email: cliente.email ?? "",
        logradouro: cliente.endereco_logradouro ?? "",
        numero: cliente.endereco_numero ?? "",
        bairro: cliente.endereco_bairro ?? "",
        cidade: cliente.endereco_cidade ?? "",
      });
    }
  }, [cliente]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getClienteToken();
    if (!token) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("cliente_atualizar_dados", {
        _token: token,
        _telefone: form.telefone,
        _email: form.email,
        _logradouro: form.logradouro,
        _numero: form.numero,
        _bairro: form.bairro,
        _cidade: form.cidade,
      });
      if (error) throw error;
      toast.success("Dados atualizados!");
      await recarregar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!cliente) return null;

  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="text-2xl font-bold">Meus Dados</h2>

      <Card className="p-4 rounded-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Nome" value={cliente.nome} disabled />
          <Field label="Código" value={cliente.codigo} disabled />
          <Field
            label="Telefone"
            value={form.telefone}
            onChange={(v) => setForm((f) => ({ ...f, telefone: v }))}
          />
          <Field
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          />
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field
                label="Logradouro"
                value={form.logradouro}
                onChange={(v) => setForm((f) => ({ ...f, logradouro: v }))}
              />
            </div>
            <Field
              label="Número"
              value={form.numero}
              onChange={(v) => setForm((f) => ({ ...f, numero: v }))}
            />
          </div>
          <Field
            label="Bairro"
            value={form.bairro}
            onChange={(v) => setForm((f) => ({ ...f, bairro: v }))}
          />
          <Field
            label="Cidade"
            value={form.cidade}
            onChange={(v) => setForm((f) => ({ ...f, cidade: v }))}
          />
          <Button type="submit" className="w-full rounded-xl" disabled={saving}>
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </form>
      </Card>

      {/* Excluir conta */}
      <Card className="p-4 rounded-2xl border-destructive/40">
        <h3 className="text-sm font-semibold text-destructive">Excluir conta</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Remove sua conta e seus dados pessoais de forma permanente. Esta ação não pode ser desfeita.
        </p>
        {!confirmandoExclusao ? (
          <button
            type="button"
            onClick={() => setConfirmandoExclusao(true)}
            className="mt-3 w-full rounded-xl border border-destructive/50 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10"
          >
            Excluir minha conta
          </button>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs font-medium">Tem certeza? Isso é permanente.</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmandoExclusao(false)}
                disabled={excluindo}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={excluirConta}
                disabled={excluindo}
                className="flex-1 rounded-xl bg-destructive py-2.5 text-sm font-semibold text-destructive-foreground hover:opacity-90 disabled:opacity-60"
              >
                {excluindo ? "Excluindo..." : "Sim, excluir"}
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  disabled,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="rounded-xl"
      />
    </div>
  );
}
