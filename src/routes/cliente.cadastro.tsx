import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { setClienteToken } from "@/lib/cliente-auth";
import { LogoRota013 } from "@/components/logo-rota013";
import { maskTelefone, maskCPF } from "@/lib/masks";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { lerTermosPublico } from "@/lib/config.functions";

export const Route = createFileRoute("/cliente/cadastro")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref.toUpperCase().trim().slice(0, 20) : "",
  }),
  head: () => ({ meta: [{ title: "Criar conta — Rota 013" }], links: [{ rel: "manifest", href: "/manifest-cliente.webmanifest" }] }),
  component: ClienteCadastroPage,
});

function ClienteCadastroPage() {
  const navigate = useNavigate();
  const { ref } = Route.useSearch();
  const [form, setForm] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    cpf: "",
    logradouro: "",
    numero: "",
    bairro: "",
    complemento: "",
    cidade: "Praia Grande",
  });
  const [aceito, setAceito] = useState(false);
  const [loading, setLoading] = useState(false);
  const [openTermos, setOpenTermos] = useState(false);

  const lerTermosFn = useServerFn(lerTermosPublico);
  const { data: termos } = useQuery({
    queryKey: ["termos-publico"],
    queryFn: () => lerTermosFn(),
    staleTime: 60_000,
  });
  const versaoTermos = termos?.versao ?? "1.0";

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!aceito) {
      toast.error("Você precisa aceitar os Termos de Uso");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("cliente_cadastrar", {
        _nome: form.nome,
        _email: form.email,
        _senha: form.senha,
        _telefone: form.telefone,
        _cpf: form.cpf,
        _logradouro: form.complemento ? `${form.logradouro} — ${form.complemento}` : form.logradouro,
        _numero: form.numero,
        _bairro: form.bairro,
        _cidade: form.cidade,
        _termos_versao: versaoTermos,
        _user_agent: navigator.userAgent,
      });
      if (error) throw error;
      const payload = data as unknown as { token: string };
      setClienteToken(payload.token);
      toast.success("Conta criada com sucesso!");
      navigate({ to: "/cliente/app", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Não foi possível cadastrar";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <Card className="mx-auto w-full max-w-md p-6 rounded-2xl">
        <div className="mb-5 text-center">
          <div className="flex justify-center">
            <LogoRota013 className="text-5xl" />
          </div>
          <h1 className="mt-2 text-xl font-semibold">Criar conta</h1>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Field label="Nome completo" id="nome" value={form.nome} onChange={(v) => set("nome", v.toUpperCase())} required minLength={3} />
          <Field label="E-mail" id="email" type="email" value={form.email} onChange={(v) => set("email", v)} required autoComplete="email" />
          <Field label="Senha (mín. 8 caracteres)" id="senha" type="password" value={form.senha} onChange={(v) => set("senha", v)} required minLength={8} autoComplete="new-password" />
          <Field label="Telefone (com DDD)" id="telefone" value={form.telefone} onChange={(v) => set("telefone", maskTelefone(v))} required inputMode="tel" />
          <Field label="CPF" id="cpf" value={form.cpf} onChange={(v) => set("cpf", maskCPF(v))} required inputMode="numeric" />

          <div className="pt-2">
            <p className="text-sm font-semibold mb-2">Endereço</p>
            <div>
              <Label htmlFor="logradouro" className="mb-1.5 block">Rua</Label>
              <AddressAutocomplete
                id="logradouro"
                value={form.logradouro}
                onChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    logradouro: v.route ?? v.text,
                    numero: v.streetNumber ?? f.numero,
                    bairro: v.neighborhood ?? f.bairro,
                    cidade: v.city ?? f.cidade,
                  }))
                }
                placeholder="Comece a digitar a rua…"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <Field label="Nº" id="numero" value={form.numero} onChange={(v) => set("numero", v)} />
              <div className="col-span-2">
                <Field label="Bairro" id="bairro" value={form.bairro} onChange={(v) => set("bairro", v)} />
              </div>
            </div>
            <Field label="Complemento" id="complemento" value={form.complemento} onChange={(v) => set("complemento", v)} />
            <Field label="Cidade" id="cidade" value={form.cidade} onChange={(v) => set("cidade", v)} />
          </div>

          <div className="pt-2 space-y-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={aceito} onCheckedChange={(c) => setAceito(c === true)} className="mt-0.5" />
              <span className="text-sm text-muted-foreground">
                Li e aceito os{" "}
                <Dialog open={openTermos} onOpenChange={setOpenTermos}>
                  <DialogTrigger asChild>
                    <button type="button" className="text-primary hover:underline font-medium">
                      Termos e Condições
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Termos e Condições (v{versaoTermos})</DialogTitle>
                    </DialogHeader>
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none overflow-y-auto pr-2"
                      dangerouslySetInnerHTML={{ __html: termos?.conteudo ?? "Carregando…" }}
                    />
                    <div className="pt-3 border-t flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setOpenTermos(false)}>Fechar</Button>
                      <Button
                        onClick={() => { setAceito(true); setOpenTermos(false); }}
                      >
                        Li e aceito
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                {" "}(v{versaoTermos}).
              </span>
            </label>
            {!aceito && (
              <p className="text-xs text-muted-foreground">
                Você deve aceitar os Termos e Condições para prosseguir com o cadastro.
              </p>
            )}
          </div>

          <Button type="submit" className="w-full rounded-xl mt-2" disabled={loading || !aceito}>
            {loading ? "Criando..." : "Criar conta"}
          </Button>

        </form>
        <p className="mt-5 text-sm text-center text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/cliente/login" className="text-primary hover:underline">
            Entrar
          </Link>
        </p>
      </Card>
    </div>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  autoComplete,
  inputMode,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoComplete?: string;
  inputMode?: "tel" | "numeric" | "text" | "email";
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block">{label}</Label>
      {type === "password" ? (
        <PasswordInput
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          className="rounded-xl"
        />
      ) : (
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          className="rounded-xl"
        />
      )}
    </div>
  );
}
