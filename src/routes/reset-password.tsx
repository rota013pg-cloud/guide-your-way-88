import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Redefinir senha — Rota 013" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [pronto, setPronto] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Supabase processa o token no hash da URL e dispara PASSWORD_RECOVERY.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPronto(true);
    });
    // Caso o evento já tenha sido emitido antes deste mount, checa sessão direta.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && window.location.hash.includes("type=recovery")) {
        setPronto(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const salvar = async (e: FormEvent) => {
    e.preventDefault();
    if (senha.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      toast.error("As senhas não conferem.");
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      toast.success("Senha redefinida ✓");
      await supabase.auth.signOut();
      navigate({ to: "/operador/login", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao redefinir senha.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-2">Redefinir senha</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Defina uma nova senha para sua conta.
        </p>

        {!pronto ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Link de redefinição inválido ou expirado. Volte para o login e solicite um novo link.
            </div>
            <Link to="/operador/login" className="text-sm text-primary hover:underline">← Voltar ao login</Link>
          </div>
        ) : (
          <form onSubmit={salvar} className="space-y-4">
            <div>
              <Label htmlFor="nova">Nova senha</Label>
              <Input id="nova" type="password" minLength={6} required value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="conf">Confirmar senha</Label>
              <Input id="conf" type="password" minLength={6} required value={confirmar} onChange={(e) => setConfirmar(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={salvando}>
              {salvando ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
