import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/esqueci-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Esqueci minha senha — Rota 013" }] }),
  component: EsqueciSenhaPage,
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [linkReset, setLinkReset] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("cliente_solicitar_reset", { _email: email });
      if (error) throw error;
      const payload = data as unknown as { ok: boolean; reset_token?: string };
      toast.success("Se a conta existir, geramos um link de redefinição.");
      if (payload.reset_token) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setLinkReset(`${origin}/cliente/redefinir-senha?token=${payload.reset_token}`);
      }
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
          Informe seu e-mail. Vamos gerar um link de redefinição.
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
          <Button type="submit" className="w-full rounded-xl" disabled={loading}>
            {loading ? "Enviando..." : "Gerar link"}
          </Button>
        </form>
        {linkReset && (
          <div className="mt-4 rounded-xl border border-border bg-muted p-3 text-xs break-all">
            <p className="font-semibold mb-1">Link de redefinição (envio por e-mail ainda não configurado):</p>
            <a href={linkReset} className="text-primary underline">{linkReset}</a>
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
