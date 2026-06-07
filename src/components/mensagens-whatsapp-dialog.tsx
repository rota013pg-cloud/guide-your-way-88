/**
 * Diálogo que gera mensagens prontas de WhatsApp para uma corrida.
 *
 * Política de contato: a central é SEMPRE o intermediário.
 *  - A mensagem do motorista NÃO inclui telefone do cliente.
 *  - A mensagem do cliente NÃO inclui telefone do motorista.
 *  - Ambas exibem o contato da central para dúvidas.
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
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
import { Copy, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lerConfig } from "@/lib/config.functions";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  corrida: any | null;
};

const brl = (v: any) =>
  "R$ " + (Number(v) || 0).toFixed(2).replace(".", ",");

const formatFone = (s: string) => {
  const d = (s || "").replace(/\D/g, "");
  if (d.length === 13) return `(${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
};

export function MensagensWhatsAppDialog({ open, onOpenChange, corrida }: Props) {
  const [codigoMot, setCodigoMot] = useState("");
  const [motorista, setMotorista] = useState<any | null>(null);
  const [buscando, setBuscando] = useState(false);

  const lerConfigFn = useServerFn(lerConfig);
  const { data: cfgData } = useQuery({
    queryKey: ["app-config-mini"],
    queryFn: () => lerConfigFn({ data: {} as any }),
    staleTime: 60_000,
    enabled: open,
  });
  const empresa = cfgData?.config?.empresa || "Rota 013";
  const central = cfgData?.config?.whatsappCentral || "";
  const linhaCentral = central
    ? `📞 Central ${empresa}: ${formatFone(central)}`
    : `📞 Em caso de dúvidas, fale com a central ${empresa}.`;

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

  // Mensagem para o MOTORISTA — sem telefone do cliente (intermediado pela central)
  const msgParticular = useMemo(() => {
    if (!corrida) return "";
    const waze = (end: string) =>
      `🗺️ Waze: https://waze.com/ul?q=${encodeURIComponent(end)}`;
    const linhas = [
      `🚗 *Corrida #${corrida.id}* — direcionada para você`,
      `👤 Cliente: ${corrida.cliente ?? "—"}`,
      ``,
      `📍 Origem: ${corrida.origem}`,
      waze(corrida.origem),
    ];
    if (Array.isArray(corrida.paradas) && corrida.paradas.length > 0) {
      corrida.paradas.forEach((p: any, i: number) => {
        linhas.push(``, `🔸 Parada ${i + 1}: ${p.endereco}`, waze(p.endereco));
      });
    }
    if (corrida.destino) {
      linhas.push(``, `🏁 Destino: ${corrida.destino}`, waze(corrida.destino));
    }
    linhas.push(``, `💰 Valor: ${brl(corrida.valor_final)}`);
    if (corrida.pagamento) linhas.push(`💳 Pagamento: ${corrida.pagamento}`);
    if (corrida.observacoes) linhas.push(`📝 Obs: ${corrida.observacoes}`);
    linhas.push("", linhaCentral, "Confirme se aceita 👍");
    return linhas.join("\n");
  }, [corrida, linhaCentral]);

  // Mensagem para o CLIENTE — sem telefone do motorista (intermediado pela central)
  const msgCliente = useMemo(() => {
    if (!corrida || !motorista) return "";
    const linhas = [
      `Olá ${corrida.cliente ?? ""}! ✅ Sua corrida foi confirmada.`,
      ``,
      `👤 Motociclista: *${motorista.nome}* (${motorista.codigo})`,
    ];
    const veic = [motorista.moto, motorista.cor].filter(Boolean).join(" ");
    if (veic) linhas.push(`🚗 Veículo: ${veic}`);
    if (motorista.placa) linhas.push(`🔢 Placa: ${motorista.placa}`);
    linhas.push(``, `📍 Origem: ${corrida.origem}`);
    if (corrida.destino) linhas.push(`🏁 Destino: ${corrida.destino}`);
    linhas.push(`💰 Valor: ${brl(corrida.valor_final)}`);
    linhas.push(``, linhaCentral, `Obrigado por escolher a ${empresa}! 🙏`);
    return linhas.join("\n");
  }, [corrida, motorista, linhaCentral, empresa]);

  const copiar = async (txt: string) => {
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Mensagem copiada");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const abrirWa = (texto: string) => {
    // Sempre abre sem destinatário fixo — a central direciona o envio.
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  if (!corrida) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Mensagens WhatsApp — Corrida #{corrida.id}</DialogTitle>
          <DialogDescription>
            Todo contato é intermediado pela central — motociclista e cliente não trocam telefones.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="grupo">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="grupo">Grupo</TabsTrigger>
            <TabsTrigger value="motorista">Motociclista</TabsTrigger>
            <TabsTrigger value="cliente">Cliente</TabsTrigger>
          </TabsList>

          <TabsContent value="grupo" className="space-y-2">
            <Textarea value={msgGrupo} readOnly rows={10} className="font-mono text-xs" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => copiar(msgGrupo)}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={() => abrirWa(msgGrupo)}>
                <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="motorista" className="space-y-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">ID do motociclista</Label>
              <Input
                value={codigoMot}
                onChange={(e) => setCodigoMot(e.target.value.toUpperCase())}
                placeholder="Ex: M0001"
              />
              {buscando && <p className="text-xs text-muted-foreground">Buscando…</p>}
              {!buscando && codigoMot && !motorista && (
                <p className="text-xs text-destructive">Motociclista não encontrado.</p>
              )}
              {motorista && (
                <p className="text-xs text-muted-foreground">{motorista.nome}</p>
              )}
            </div>
            <Textarea value={msgParticular} readOnly rows={10} className="font-mono text-xs" />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => copiar(msgParticular)}>
                <Copy className="h-4 w-4 mr-1" /> Copiar
              </Button>
              <Button size="sm" onClick={() => abrirWa(msgParticular)}>
                <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="cliente" className="space-y-2">
            <div className="grid gap-1.5">
              <Label className="text-xs">ID do motociclista (para preencher os dados)</Label>
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
              value={motorista ? msgCliente : "Informe o ID do motociclista acima para gerar a mensagem."}
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
                disabled={!motorista}
                onClick={() => abrirWa(msgCliente)}
              >
                <Send className="h-4 w-4 mr-1" /> Abrir WhatsApp
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
