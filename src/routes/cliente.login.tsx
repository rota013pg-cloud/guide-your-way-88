import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { getClienteToken, setClienteToken } from "@/lib/cliente-auth";
import { clienteLoginIniciar, clienteLoginVerificar } from "@/lib/cliente-2fa.functions";
import { LogoRota013 } from "@/components/logo-rota013";

export const Route = createFileRoute("/cliente/login")({
  ssr: false,
  head: () => ({ meta: [{ title: "Entrar — Rota 013" }], links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }] }),
  component: ClienteLoginPage,
});

function ClienteLoginPage() {
  const navigate = useNavigate();
  const iniciarFn = useServerFn(clienteLoginIniciar);
  const verificarFn = useServerFn(clienteLoginVerificar);

  const [etapa, setEtapa] = useState<"credenciais" | "codigo">("credenciais");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [emailMascarado, setEmailMascarado] = useState("");
  const [loading, setLoading] = useState(false);
  const [reenviando, setReenviando] = useState(false);

  useEffect(() => {
    if (getClienteToken()) navigate({ to: "/cliente/app", replace: true });
  }, [navigate]);

  // Passo 1: valida e-mail+senha e dispara o código
  const onEnviarCredenciais = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await iniciarFn({ data: { email: email.trim(), senha, userAgent: navigator.userAgent } });
      setEmailMascarado(r.email);
      setCodigo("");
      setEtapa("codigo");
      toast.success("Enviamos um código para o seu e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível entrar");
    } finally {
      setLoading(false);
    }
  };

  // Passo 2: confere o código e conclui o login
  const onVerificar = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = await verificarFn({ data: { email: email.trim(), codigo: codigo.trim(), userAgent: navigator.userAgent } });
      setClienteToken(r.token);
      toast.success("Bem-vindo de volta!");
      navigate({ to: "/cliente/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    setReenviando(true);
    try {
      const r = await iniciarFn({ data: { email: email.trim(), senha, userAgent: navigator.userAgent } });
      setEmailMascarado(r.email);
      toast.success("Enviamos um novo código.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível reenviar");
    } finally {
      setReenviando(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 rounded-2xl">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <LogoRota013 className="text-5xl" />
          </div>
          <h1 className="mt-3 text-xl font-semibold">
            {etapa === "credenciais" ? "Entrar" : "Verificação"}
          </h1>
        </div>

        {etapa === "credenciais" ? (
          <>
            <form onSubmit={onEnviarCredenciais} className="space-y-4">
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
                <PasswordInput
                  id="senha"
                  required
                  minLength={8}
                  autoComplete="current-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={loading}>
                {loading ? "Enviando código..." : "Continuar"}
              </Button>
            </form>
            <p className="mt-6 text-sm text-center text-muted-foreground">
              Não tem conta?{" "}
              <Link to="/cliente/cadastro" className="text-primary hover:underline">
                Cadastre-se
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="text-sm text-center text-muted-foreground mb-4">
              Enviamos um código de 6 dígitos para<br />
              <span className="font-medium text-foreground">{emailMascarado}</span>
            </p>
            <form onSubmit={onVerificar} className="space-y-4">
              <div>
                <Label htmlFor="codigo" className="mb-1.5 block">Código de verificação</Label>
                <Input
                  id="codigo"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d*"
                  maxLength={6}
                  required
                  autoFocus
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="rounded-xl text-center text-2xl tracking-[0.5em] font-semibold"
                  placeholder="______"
                />
              </div>
              <Button type="submit" className="w-full rounded-xl" disabled={loading || codigo.length !== 6}>
                {loading ? "Verificando..." : "Entrar"}
              </Button>
            </form>
            <div className="mt-4 flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => { setEtapa("credenciais"); setCodigo(""); }}
                className="text-muted-foreground hover:underline"
              >
                ← Voltar
              </button>
              <button
                type="button"
                onClick={reenviarCodigo}
                disabled={reenviando}
                className="text-primary hover:underline disabled:opacity-50"
              >
                {reenviando ? "Reenviando..." : "Reenviar código"}
              </button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
