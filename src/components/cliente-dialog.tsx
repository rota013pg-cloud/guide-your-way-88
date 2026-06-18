import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { maskTelefone, maskCPF } from "@/lib/masks";
import { previewProximoCodigoCliente, salvarCliente } from "@/lib/clientes.functions";
import { toast } from "sonner";

type Cliente = {
  codigo: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  indicacao?: string | null;
  observacoes?: string | null;
  email?: string | null;
  cpf?: string | null;
  endereco_logradouro?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
};

export function ClienteDialog({
  open,
  onOpenChange,
  cliente,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  cliente?: Cliente | null;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewProximoCodigoCliente);
  const salvar = useServerFn(salvarCliente);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("Praia Grande");
  const [indicacao, setIndicacao] = useState("");
  const [obs, setObs] = useState("");

  const { data: proxCodigo } = useQuery({
    queryKey: ["preview-cliente"],
    queryFn: () => preview(),
    enabled: open && !cliente,
  });

  useEffect(() => {
    if (open) {
      setNome(cliente?.nome ?? "");
      setTelefone(cliente?.telefone ?? "");
      setEmail(cliente?.email ?? "");
      setCpf(cliente?.cpf ? maskCPF(cliente.cpf) : "");
      setLogradouro(cliente?.endereco_logradouro ?? "");
      setNumero(cliente?.endereco_numero ?? "");
      setBairro(cliente?.endereco_bairro ?? "");
      setCidade(cliente?.endereco_cidade ?? cliente?.cidade ?? "Praia Grande");
      setIndicacao(cliente?.indicacao ?? "");
      setObs(cliente?.observacoes ?? "");
    }
  }, [open, cliente]);

  const mut = useMutation({
    mutationFn: () => {
      const enderecoFmt = [
        logradouro,
        numero ? `, ${numero}` : "",
        bairro ? ` - ${bairro}` : "",
      ].join("").trim();
      return salvar({
        data: {
          codigo: cliente?.codigo,
          nome,
          telefone,
          email: email.trim() || undefined,
          cpf: cpf.replace(/\D/g, "") || undefined,
          endereco: enderecoFmt,
          cidade,
          logradouro,
          numero,
          bairro,
          indicacao,
          observacoes: obs,
        },
      });
    },
    onSuccess: () => {
      toast.success(cliente ? "Cliente atualizado" : "Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["preview-cliente"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const codigoExibido = cliente?.codigo ?? proxCodigo ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {cliente ? `Editar cliente ${cliente.codigo}` : `Novo cliente (${codigoExibido})`}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input className="uppercase" value={nome} onChange={(e) => setNome(e.target.value.toUpperCase())} maxLength={120} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(maskTelefone(e.target.value))} placeholder="(13) 99999-9999" />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} inputMode="numeric" />
            </div>
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label>Rua</Label>
            <AddressAutocomplete
              value={logradouro}
              onChange={(v) => {
                setLogradouro(v.route ?? v.text);
                if (v.streetNumber) setNumero(v.streetNumber);
                if (v.neighborhood) setBairro(v.neighborhood);
                if (v.city) setCidade(v.city);
              }}
              placeholder="Comece a digitar a rua…"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Nº</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Bairro</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} maxLength={80} />
          </div>
          <div>
            <Label>Indicação (opcional)</Label>
            <Input
              value={indicacao}
              onChange={(e) => setIndicacao(e.target.value)}
              placeholder="Código do motociclista ou onde nos conheceu"
              maxLength={120}
            />
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} maxLength={500} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !nome.trim()}>
            {mut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
