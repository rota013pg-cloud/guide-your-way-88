import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AddressAutocomplete } from "@/components/address-autocomplete";
import { FileUploadField } from "@/components/file-upload-field";
import { maskTelefone, maskCPF } from "@/lib/masks";
import { previewProximoCodigoMotorista, salvarMotorista } from "@/lib/motoristas.functions";
import { toast } from "sonner";

type Motorista = {
  codigo: string;
  nome: string;
  telefone?: string | null;
  cpf?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  nome_familiar?: string | null;
  telefone_familiar?: string | null;
  moto?: string | null;
  placa?: string | null;
  cor?: string | null;
  foto?: string | null;
  doc_cnh?: string | null;
  doc_veiculo?: string | null;
  foto_moto?: string | null;
  doc_endereco?: string | null;
};

export function MotoristaDialog({
  open,
  onOpenChange,
  motorista,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motorista?: Motorista | null;
}) {
  const qc = useQueryClient();
  const preview = useServerFn(previewProximoCodigoMotorista);
  const salvar = useServerFn(salvarMotorista);

  const [form, setForm] = useState<Motorista & { senha_inicial?: string }>({} as any);

  const { data: proxCodigo } = useQuery({
    queryKey: ["preview-motorista"],
    queryFn: () => preview(),
    enabled: open && !motorista,
  });

  useEffect(() => {
    if (open) {
      setForm({
        codigo: motorista?.codigo ?? "",
        nome: motorista?.nome ?? "",
        telefone: motorista?.telefone ?? "",
        cpf: motorista?.cpf ?? "",
        endereco: motorista?.endereco ?? "",
        cidade: motorista?.cidade ?? "Praia Grande",
        nome_familiar: motorista?.nome_familiar ?? "",
        telefone_familiar: motorista?.telefone_familiar ?? "",
        moto: motorista?.moto ?? "",
        placa: motorista?.placa ?? "",
        cor: motorista?.cor ?? "",
        foto: motorista?.foto ?? "",
        doc_cnh: motorista?.doc_cnh ?? "",
        doc_veiculo: motorista?.doc_veiculo ?? "",
        foto_moto: motorista?.foto_moto ?? "",
        doc_endereco: motorista?.doc_endereco ?? "",
        senha_inicial: "",
      });
    }
  }, [open, motorista]);

  const codigoUso = motorista?.codigo || proxCodigo || "novo";

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mut = useMutation({
    mutationFn: () =>
      salvar({
        data: {
          codigo: motorista?.codigo,
          nome: form.nome!,
          telefone: form.telefone ?? "",
          cpf: form.cpf ?? "",
          endereco: form.endereco ?? "",
          cidade: form.cidade ?? "Praia Grande",
          nome_familiar: form.nome_familiar ?? "",
          telefone_familiar: form.telefone_familiar ?? "",
          moto: form.moto ?? "",
          placa: form.placa ?? "",
          cor: form.cor ?? "",
          foto: form.foto ?? "",
          doc_cnh: form.doc_cnh ?? "",
          doc_veiculo: form.doc_veiculo ?? "",
          foto_moto: form.foto_moto ?? "",
          doc_endereco: form.doc_endereco ?? "",
          senha_inicial: form.senha_inicial || undefined,
        } as any,
      }),
    onSuccess: (res: any) => {
      toast.success(
        motorista
          ? "Motociclista atualizado"
          : `Motociclista ${res?.codigo} cadastrado. Senha: ${res?.senha}`,
      );
      qc.invalidateQueries({ queryKey: ["motoristas"] });
      qc.invalidateQueries({ queryKey: ["preview-motorista"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {motorista ? `Editar motociclista ${motorista.codigo}` : `Novo motociclista (${codigoUso})`}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="dados">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="veiculo">Veículo</TabsTrigger>
            <TabsTrigger value="docs">Documentos</TabsTrigger>
          </TabsList>

          <TabsContent value="dados" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nome *</Label>
                <Input className="uppercase" value={form.nome ?? ""} onChange={(e) => set("nome")(e.target.value.toUpperCase())} maxLength={120} />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={form.telefone ?? ""}
                  onChange={(e) => set("telefone")(maskTelefone(e.target.value))}
                  placeholder="(13) 99999-9999"
                />
              </div>
              <div>
                <Label>CPF</Label>
                <Input
                  value={form.cpf ?? ""}
                  onChange={(e) => set("cpf")(maskCPF(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="col-span-2">
                <Label>Endereço</Label>
                <AddressAutocomplete
                  value={form.endereco ?? ""}
                  onChange={(v) => set("endereco")(v.text)}
                />
              </div>
              <div>
                <Label>Nome do parente</Label>
                <Input
                  className="uppercase"
                  value={form.nome_familiar ?? ""}
                  onChange={(e) => set("nome_familiar")(e.target.value.toUpperCase())}
                  maxLength={120}
                />
              </div>
              <div>
                <Label>Telefone do parente</Label>
                <Input
                  value={form.telefone_familiar ?? ""}
                  onChange={(e) => set("telefone_familiar")(maskTelefone(e.target.value))}
                  placeholder="(13) 99999-9999"
                />
              </div>
              {!motorista && (
                <div className="col-span-2">
                  <Label>Senha inicial do app (opcional)</Label>
                  <Input
                    value={form.senha_inicial ?? ""}
                    onChange={(e) => set("senha_inicial")(e.target.value)}
                    placeholder="Se vazio, usa o código em minúsculo (ex: m0001)"
                  />
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="veiculo" className="space-y-3 pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modelo da moto</Label>
                <Input value={form.moto ?? ""} onChange={(e) => set("moto")(e.target.value)} />
              </div>
              <div>
                <Label>Placa</Label>
                <Input
                  value={form.placa ?? ""}
                  onChange={(e) => set("placa")(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>
              <div>
                <Label>Cor</Label>
                <Input value={form.cor ?? ""} onChange={(e) => set("cor")(e.target.value)} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input value={form.cidade ?? ""} onChange={(e) => set("cidade")(e.target.value)} />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="docs" className="space-y-3 pt-3">
            <FileUploadField
              label="Foto do motociclista"
              value={form.foto ?? ""}
              onChange={set("foto")}
              pasta={codigoUso}
              tipo="foto"
            />
            <FileUploadField
              label="CNH"
              value={form.doc_cnh ?? ""}
              onChange={set("doc_cnh")}
              pasta={codigoUso}
              tipo="cnh"
            />
            <FileUploadField
              label="Documento da moto"
              value={form.doc_veiculo ?? ""}
              onChange={set("doc_veiculo")}
              pasta={codigoUso}
              tipo="doc-moto"
            />
            <FileUploadField
              label="Foto da moto"
              value={form.foto_moto ?? ""}
              onChange={set("foto_moto")}
              pasta={codigoUso}
              tipo="foto-moto"
            />
            <FileUploadField
              label="Comprovante de endereço"
              value={form.doc_endereco ?? ""}
              onChange={set("doc_endereco")}
              pasta={codigoUso}
              tipo="comprovante-endereco"
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.nome?.trim()}>
            {mut.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
