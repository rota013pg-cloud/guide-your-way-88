import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { LogoRota013 } from "@/components/logo-rota013";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { existeAdmin } from "@/lib/bootstrap.functions";

export const loginSearchSchema = z.object({
  reason: fallback(
    z.enum(["unauthenticated", "expired", "session_error", "timeout"]).optional(),
    "unauthenticated",
  ),
  from: fallback(z.string().max(500).optional(), "/dashboard"),
});

export const Route = createFileRoute("/operador/login")({
  head: () => ({
    meta: [
      { title: "Entrar — Rota 013" },
      { name: "application-name", content: "Rota 013 Operador" },
      { name: "apple-mobile-web-app-title", content: "Rota 013 Operador" },
    ],
    links: [{ rel: "manifest", href: "/manifest-operador.webmanifest" }],
  }),
  validateSearch: zodValidator(loginSearchSchema),
  component: LoginPage,
});

// Login sem '@' é tratado como usuário interno e mapeado para email sintético.
const LOGIN_SUFIXO = "@painel.local";
const toAuthEmail = (input: string) => {
  const v = input.trim();
  return v.includes("@") ? v : `${v}${LOGIN_SUFIXO}`;
};

function LoginPage() {
  const navigate = useNavigate();
  const { reason } = Route.useSearch();
  const [identificador, setIdentificador] = useState(""); // email ou usuário
  const [senha, setSenha] = useState("");
  const [modo, setModo] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [adminExiste, setAdminExiste] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/dashboard", replace: true });
    });
    existeAdmin()
      .then(({ existe }) => {
        setAdminExiste(existe);
        if (existe) setModo("login");
      })
      .catch(() => setAdminExiste(true));
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const email = toAuthEmail(identificador);
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
      <Card className="w-full max-w-md p-8 rounded-2xl">
        <div className="mb-6 text-center">
          <LogoRota013 className="text-6xl mb-3" />
        </div>
        {reason && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {reason === "expired" && "Sua sessão expirou. Entre novamente para continuar."}
            {reason === "unauthenticated" && "Você precisa estar autenticado para acessar o painel."}
            {reason === "session_error" && "Não foi possível verificar sua sessão. Faça login novamente."}
            {reason === "timeout" && "A verificação da sessão demorou demais. Tente entrar novamente."}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="identificador" className="mb-1.5 block">E-mail ou usuário</Label>
            <Input
              id="identificador"
              type="text"
              required
              autoComplete="username"
              placeholder="seu@email.com  ou  joao.silva"
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label htmlFor="senha">Senha</Label>
              {modo === "login" && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setForgotOpen(true)}
                >
                  Esqueceu a senha?
                </button>
              )}
            </div>
            <PasswordInput id="senha" required minLength={6} value={senha} onChange={(e) => setSenha(e.target.value)} className="rounded-xl" />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Aguarde..." : modo === "login" ? "Entrar" : "Criar conta"}
          </Button>
          {adminExiste === false && (
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setModo(modo === "login" ? "signup" : "login")}
            >
              {modo === "login" ? "Primeiro acesso? Criar conta de operador" : "Já tem conta? Entrar"}
            </button>
          )}
        </form>
        {adminExiste === false && (
          <p className="mt-6 text-xs text-muted-foreground text-center">
            O primeiro usuário cadastrado vira <strong>admin</strong> automaticamente.
          </p>
        )}
      </Card>

      <EsqueciSenhaDialog open={forgotOpen} onClose={() => setForgotOpen(false)} initial={identificador} />
    </div>
  );
}

function EsqueciSenhaDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: string }) {
  const [valor, setValor] = useState(initial);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => { setValor(initial); }, [initial, open]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      const email = toAuthEmail(valor);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Se a conta existir, um e-mail de redefinição foi enviado.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar o e-mail.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Redefinir senha</DialogTitle>
          <DialogDescription>
            Informe seu e-mail (ou usuário) cadastrado. Enviaremos um link de redefinição.
            Se você só tem usuário interno (sem e-mail), peça ao administrador para resetar sua senha pelo módulo Usuários.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-3">
          <div>
            <Label htmlFor="reset-id" className="mb-1.5 block">E-mail ou usuário</Label>
            <Input
              id="reset-id"
              type="text"
              required
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="seu@email.com"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}



