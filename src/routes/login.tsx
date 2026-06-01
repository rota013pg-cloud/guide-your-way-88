import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

type LoginReason = "unauthenticated" | "expired" | "session_error" | "timeout";
type LoginSearch = { reason?: LoginReason; from?: string };

const VALID_REASONS: LoginReason[] = ["unauthenticated", "expired", "session_error", "timeout"];

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Rota 013 Beta" }] }),
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    reason: VALID_REASONS.includes(search.reason as LoginReason) ? (search.reason as LoginReason) : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  component: LoginPage,
});


function LoginPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (modo === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Conta criada! Você já está logado.");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground font-black text-2xl mb-3">
            R
          </div>
          <h1 className="text-2xl font-bold">Rota 013 Beta</h1>
          <p className="text-sm text-muted-foreground mt-1">Painel do operador</p>
        </div>
        {reason && (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {reason === "expired" && "Sua sessão expirou. Entre novamente para continuar."}
            {reason === "unauthenticated" && "Você precisa estar autenticado para acessar o painel."}
            {reason === "session_error" && "Não foi possível verificar sua sessão. Faça login novamente."}
            {reason === "timeout" && "A verificação da sessão demorou demais. Tente entrar novamente."}
          </div>
        )}


        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setModo(modo === "login" ? "signup" : "login")}
          >
            {modo === "login" ? "Primeiro acesso? Criar conta de operador" : "Já tem conta? Entrar"}
          </button>
        </form>
        <p className="mt-6 text-xs text-muted-foreground text-center">
          O primeiro usuário cadastrado vira <strong>admin</strong> automaticamente.
        </p>
      </Card>
    </div>
  );
}
