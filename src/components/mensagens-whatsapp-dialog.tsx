/**
 * Diálogo que gera mensagens prontas de WhatsApp para uma corrida:
 *  - Grupo de motoristas (sem dados do cliente)
 *  - Motorista específico (com nome+telefone do cliente)
 *  - Cliente (confirmação com motorista e veículo)
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { Copy, Send, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  corrida: any | null;
};

const brl = (v: any) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

const apenasDig = (s: string) => (s || "").replace(/\D/g, "");

export function MensagensWhatsAppDialog({ open, onOpenChange, corrida }: Props) {
  const [codigoMot, setCodigoMot] = useState("");
  const [motorista, setMotorista] = useState<any | null>(null);
  const [buscando, setBuscando] = useState(false);

  useEffect(() => {
    if (open) {
      setCodigoMot(corrida?.motorista_codigo ?? "");
      setMotorista(null);
    }
  }, [open, corrida?.motorista_codigo]);

  useEffect(() => {
    if (!open) return;
    const cod = codigoMot.trim().toUpperCase();
    if (!cod) { setMotorista(null); return; }
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("motoristas")
        .select("codigo, nome, telefone, moto, placa, cor")
        .eq("codigo", cod)
        .maybeSingle();
      setMotorista(data);
      setBuscando(false);
    }, 350);
    return () => clearTimeout(t);
  }, [codigoMot, open]);

  const msgGrupo = useMemo(() => {
    if (!corrida) return "";
    const linhas = [
      `🚗 *Nova corrida #${corrida.id}*`,
      `📍 Origem: ${corrida.origem}`,
    ];
    if (Array.isArray(corrida.paradas) && corrida.paradas.length > 0) {
      corrida.paradas.forEach((p: any, i: number) =>
        linhas.push(`🔸 Parada ${i + 1}: ${p.endereco}`),
      );
    }
    if (corrida.destino) linhas.push(`🏁 Destino: ${corrida.destino}`);
    linhas.push(`💰 Valor: ${brl(corrida.valor_final)}`);
    if (corrida.pagamento) linhas.push(`💳 Pagamento: ${corrida.pagamento}`);
    if (corrida.observacoes) linhas.push(`📝 Obs: ${corrida.observacoes}`);
    linhas.push("", "👉 Quem aceita responde com o ID.");
    return linhas.join("\n");
  }, [corrida]);

  const msgParticular = useMemo(() => {
    if (!corrida) return "";
    const linhas = [
      `🚗 *Corrida #${corrida.id}* — direcionada para você`,
      `👤 Cliente: ${corrida.cliente ?? "—"}`,
    ];
    if (corrida.telefone_cliente) linhas.push(`📞 Telefone: ${corrida.telefone_cliente}`);
    linhas.push(`📍 Origem: ${corrida.origem}`);
    if (Array.isArray(corrida.paradas) && corrida.paradas.length > 0) {
      corrida.paradas.forEach((p: any, i: number) =>
        linhas.push(`🔸 Parada ${i + 1}: ${p.endereco}`),
      );
    }
    if (corrida.destino) linhas.push(`🏁 Destino: ${corrida.destino}`);
    linhas.push(`💰 Valor: ${brl(corrida.valor_final)}`);
    if (corrida.pagamento) linhas.push(`💳 Pagamento: ${corrida.pagamento}`);
    if (corrida.observacoes) linhas.push(`📝 Obs: ${corrida.observacoes}`);
    linhas.push("", "Confirme se aceita 👍");
    return linhas.join("\n");
  }, [corrida]);

  const msgCliente = useMemo(() => {
    if (!corrida || !motorista) return "";
    const linhas = [
      `Olá ${corrida.cliente ?? ""}! ✅ Sua corrida foi confirmada.`,
      ``,
      `👤 Motorista: *${motorista.nome}* (${motorista.codigo})`,
    ];
    if (motorista.telefone) linhas.push(`📞 Contato: ${motorista.telefone}`);
    const veic = [motorista.moto, motorista.cor].filter(Boolean).join(" ");
    if (veic) linhas.push(`🚗 Veículo: ${veic}`);
    if (motorista.placa) linhas.push(`🔢 Placa: ${motorista.placa}`);
    linhas.push(``, `📍 Origem: ${corrida.origem}`);
    if (corrida.destino) linhas.push(`🏁 Destino: ${corrida.destino}`);
    linhas.push(`💰 Valor: ${brl(corrida.valor_final)}`);
    linhas.push(``, `Obrigado por escolher a Rota 013! 🙏`);
    return linhas.join("\n");
  }, [corrida, motorista]);

  const copiar = async (txt: string) => {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const abrirWa = (telefone: string, texto: string) => {
    const tel = apenasDig(telefone);
    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(texto)}`
      : `https://wa.me/?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  if (!corrida) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mensagens WhatsApp — Corrida #{corrida.id}</DialogTitle>
          <DialogDescription>Copie ou abra direto no WhatsApp.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="grupo">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="grupo">Grupo</TabsTrigger>
            <TabsTrigger value="motorista">Motorista</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="grupo" className="space-y-2">
            <Textarea value={msgGrupo} readOnly rows={10} className="font-mono text-xs" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => copiar(msgGrupo)}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={() => abrirWa("", msgGrupo)}>
                <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="motorista" className="space-y-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">ID do motorista</Label>
              <Input
                value={codigoMot}
                onChange={(e) => setCodigoMot(e.target.value.toUpperCase())}
                placeholder="Ex: M0001"
              />
              {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
              {!buscando && codigoMot && !motorista && (
                <p className="text-xs text-destructive">Motorista não encontrado.</p>
              )}
              {motorista && (
                <p className="text-xs text-muted-foreground">
                  {motorista.nome} · {motorista.telefone || "sem telefone"}
                </p>
              )}
            </div>
            <Textarea value={msgParticular} readOnly rows={10} className="font-mono text-xs" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => copiar(msgParticular)}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button
                size="sm"
                disabled={!motorista?.telefone}
                onClick={() => abrirWa(motorista?.telefone ?? "", msgParticular)}
              >
                <Phone className="h-4 w-4 mr-1" /> Enviar p/ motorista
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cliente" className="space-y-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">ID do motorista (para preencher os dados)</Label>
              <Input
                value={codigoMot}
                onChange={(e) => setCodigoMot(e.target.value.toUpperCase())}
                placeholder="Ex: M0001"
              />
              {motorista && (
                <p className="text-xs text-muted-foreground">
                  {motorista.nome} · {motorista.moto || ""} {motorista.placa ? `· ${motorista.placa}` : ""}
                </p>
              )}
            </div>
            <Textarea
              value={motorista ? msgCliente : "Informe o ID do motorista acima para gerar a mensagem."}
              readOnly
              rows={11}
              className="font-mono text-xs"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline" size="sm"
                disabled={!motorista}
                onClick={() => copiar(msgCliente)}
              >
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button
                size="sm"
                disabled={!motorista || !corrida.telefone_cliente}
                onClick={() => abrirWa(corrida.telefone_cliente ?? "", msgCliente)}
              >
                <Phone className="h-4 w-4 mr-1" /> Enviar p/ cliente
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
