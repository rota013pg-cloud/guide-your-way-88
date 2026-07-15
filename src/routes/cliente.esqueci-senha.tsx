import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { solicitarResetCliente } from "@/lib/cliente-reset.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/esqueci-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Esqueci minha senha — Rota 013" }], links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }] }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const solicitarFn = useServerFn(solicitarResetCliente);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await solicitarFn({ data: { email } });
      setEnviado(true);
      toast.success("Se a conta existir, um link de redefinição foi enviado por e-mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6 rounded-2xl">
        <h1 className="text-xl font-semibold mb-1">Esqueci minha senha</h1>
        <p className="text-sm text-muted-foreground mb-5">
          Informe seu e-mail. Se a conta existir, enviaremos um link de redefinição.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="mb-1.5 block">E-mail</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-xl"
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" disabled={loading || enviado}>
            {loading ? "Enviando..." : enviado ? "Solicitação enviada" : "Enviar link"}
          </Button>
        </form>
        {enviado && (
          <div className="mt-4 rounded-xl border border-border bg-muted p-3 text-xs">
            Se houver uma conta com esse e-mail, o link de redefinição será enviado em instantes.
            Caso não receba, fale com o suporte.
          </div>
        )}
        <p className="mt-5 text-sm text-center text-muted-foreground">
          <Link to="/cliente/login" className="text-primary hover:underline">
            Voltar para entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}
