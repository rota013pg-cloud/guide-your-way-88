import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

const search = z.object({ token: fallback(z.string().optional(), undefined) });

export const Route = createFileRoute("/cliente/redefinir-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha — Rota 013" }] }),
  validateSearch: zodValidator(search),
  component: RedefinirSenhaPage,
});

function RedefinirSenhaPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Token ausente. Solicite um novo link.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("cliente_redefinir_senha", {
        _token: token,
        _nova_senha: senha,
      });
      if (error) throw error;
      toast.success("Senha atualizada! Faça login.");
      navigate({ to: "/cliente/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível redefinir");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 rounded-2xl">
        <h1 className="text-xl font-semibold mb-1">Nova senha</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Digite a nova senha (mínimo 8 caracteres).
        </p>
        {!token && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Link inválido. <Link to="/cliente/esqueci-senha" className="underline">Solicitar novo</Link>.
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="senha" className="mb-1.5 block">Nova senha</Label>
            <Input
              id="senha"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading || !token}>
            {loading ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
