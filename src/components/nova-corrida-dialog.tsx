import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { dispararOfertas } from "@/lib/corridas.functions";

type Tarifa = { id: number; nome: string; bandeirada: number; minimo: number; por_km: number };
type ClienteMini = { codigo: string; nome: string; telefone: string | null };

export function NovaCorridaDialog({ onCriada }: { onCriada?: () => void }) {
  const [open, setOpen] = useState(false);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [clientes, setClientes] = useState<ClienteMini[]>([]);
  const [salvando, setSalvando] = useState(false);

  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [distancia, setDistancia] = useState("");
  const [tarifaId, setTarifaId] = useState<string>("");
  const [pagamento, setPagamento] = useState<"Dinheiro" | "Pix" | "Cartão" | "Maquininha" | "Conta">("Dinheiro");
  const [obs, setObs] = useState("");

  useEffect(() => {
    if (!open) return;
    supabase.from("tarifas").select("id,nome,bandeirada,minimo,por_km").eq("ativa", true).then(({ data }) => {
      if (data) {
        setTarifas(data as Tarifa[]);
        if (data[0] && !tarifaId) setTarifaId(String(data[0].id));
      }
    });
    supabase.from("clientes").select("codigo,nome,telefone").order("nome").limit(50).then(({ data }) => {
      if (data) setClientes(data as ClienteMini[]);
    });
  }, [open]);

  const tarifa = tarifas.find((t) => String(t.id) === tarifaId);
  const km = parseFloat(distancia.replace(",", ".")) || 0;
  const valorBruto = tarifa ? tarifa.bandeirada + km * tarifa.por_km : 0;
  const valor = tarifa ? Math.max(valorBruto, tarifa.minimo) : 0;

  const reset = () => {
    setCliente(""); setTelefone(""); setOrigem(""); setDestino("");
    setDistancia(""); setPagamento("Dinheiro" as const); setObs("");
  };

  const onPickCliente = (codigo: string) => {
    const c = clientes.find((x) => x.codigo === codigo);
    if (c) { setCliente(c.nome); setTelefone(c.telefone ?? ""); }
  };

  const salvar = async () => {
    if (!origem.trim()) { toast.error("Informe a origem."); return; }
    setSalvando(true);
    const { error } = await supabase.from("corridas").insert({
      cliente: cliente || null,
      telefone_cliente: telefone || null,
      origem,
      destino: destino || null,
      distancia_km: km || null,
      valor_final: valor,
      pagamento,
      observacoes: obs || null,
      status: "Pendente",
      tipo: "Comum",
    });
    setSalvando(false);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Corrida criada!");
    reset();
    setOpen(false);
    onCriada?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full" size="lg"><Plus className="h-4 w-4 mr-2" />Nova corrida</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova corrida</DialogTitle>
          <DialogDescription>Preencha os dados. A tarifa é calculada automaticamente.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {clientes.length > 0 && (
            <div className="grid gap-1.5">
              <Label>Cliente cadastrado (opcional)</Label>
              <Select onValueChange={onPickCliente}>
                <SelectTrigger><SelectValue placeholder="Selecionar cliente…" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.codigo} value={c.codigo}>{c.nome} {c.telefone ? `· ${c.telefone}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="cli">Nome</Label>
              <Input id="cli" value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nome do cliente" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tel">Telefone</Label>
              <Input id="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(13) 99999-9999" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="ori">Origem *</Label>
            <Input id="ori" value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Endereço de partida" />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="dest">Destino</Label>
            <Input id="dest" value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Endereço de destino" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="km">Distância (km)</Label>
              <Input id="km" inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder="0,0" />
            </div>
            <div className="grid gap-1.5">
              <Label>Tarifa</Label>
              <Select value={tarifaId} onValueChange={setTarifaId}>
                <SelectTrigger><SelectValue placeholder="Tarifa" /></SelectTrigger>
                <SelectContent>
                  {tarifas.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Pagamento</Label>
              <Select value={pagamento} onValueChange={(v) => setPagamento(v as typeof pagamento)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Pix">Pix</SelectItem>
                  <SelectItem value="Cartão">Cartão</SelectItem>
                  <SelectItem value="Maquininha">Maquininha</SelectItem>
                  <SelectItem value="Conta">Conta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="obs">Observações</Label>
            <Textarea id="obs" value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex.: aguardar na portaria" />
          </div>

          <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Valor calculado</span>
            <span className="text-2xl font-black text-primary">R$ {valor.toFixed(2)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>{salvando ? "Salvando..." : "Criar corrida"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
