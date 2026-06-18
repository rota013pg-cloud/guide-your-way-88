import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getClienteToken, setClienteToken } from "@/lib/cliente-auth";
import { LogoRota013 } from "@/components/logo-rota013";

export const Route = createFileRoute("/cliente/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Rota 013" }] }),
  component: ClienteLoginPage,
});

function ClienteLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (getClienteToken()) navigate({ to: "/cliente/app", replace: true });
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("cliente_login", {
        _email: email,
        _senha: senha,
        _user_agent: navigator.userAgent,
      });
      if (error) throw error;
      const payload = data as unknown as { token: string };
      setClienteToken(payload.token);
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/cliente/app", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível entrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 rounded-2xl">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <LogoRota013 className="text-5xl" />
          </div>
          <h1 className="mt-3 text-xl font-semibold">Entrar</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="senha">Senha</Label>
              <Link to="/cliente/esqueci-senha" className="text-xs text-primary hover:underline">
                Esqueceu?
              </Link>
            </div>
            <Input
              id="senha"
              type="password"
              required
              minLength={8}
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          Não tem conta?{" "}
          <Link to="/cliente/cadastro" className="text-primary hover:underline">
            Cadastre-se
          </Link>
        </p>
      </Card>
    </div>
  );
}
