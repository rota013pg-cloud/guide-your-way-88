import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken } from "@/lib/cliente-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app/senha")({
  ssr: false,
  component: AlterarSenhaPage,
});

function AlterarSenhaPage() {
  const navigate = useNavigate();
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [confirma, setConfirma] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (nova.length < 8) return toast.error("A nova senha deve ter ao menos 8 caracteres.");
    if (nova !== confirma) return toast.error("A confirmação não confere.");
    const token = getClienteToken();
    if (!token) return;
    setSaving(true);
    try {
      const { error } = await supabase.rpc("cliente_alterar_senha", {
        _token: token,
        _senha_atual: atual,
        _nova_senha: nova,
      });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      navigate({ to: "/cliente/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao alterar senha");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <h2 className="text-2xl font-bold">Alterar senha</h2>

      <Card className="p-4 rounded-2xl">
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label className="mb-1.5 block text-sm">Senha atual</Label>
            <Input
              type="password"
              value={atual}
              onChange={(e) => setAtual(e.target.value)}
              required
              autoComplete="current-password"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Nova senha</Label>
            <Input
              type="password"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-xl"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-sm">Confirme a nova senha</Label>
            <Input
              type="password"
              value={confirma}
              onChange={(e) => setConfirma(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={saving}>
            {saving ? "Alterando..." : "Alterar senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
