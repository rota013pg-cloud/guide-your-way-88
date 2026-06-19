import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Trash2, Copy, Search } from "lucide-react";
import { AddressAutocomplete, type AddressValue } from "@/components/address-autocomplete";
import { calcularRota } from "@/lib/maps.functions";
import { dispararOfertas, registrarStatusCorrida } from "@/lib/corridas.functions";
import { lerConfig } from "@/lib/config.functions";
import { lerTarifas, type TarifasConfig } from "@/lib/tarifas.functions";
import { calcularValorComParadas, floorReal } from "@/lib/tarifas-calc";
import { maskTelefone } from "@/lib/masks";

type TarifaOpt = { id: string; nome: string; tarifaMinima: number; valorKm: number };

type Modelo = "Imediata" | "Agendada";
type Despacho = "Automatico" | "Manual" | "WhatsApp";
type Pagamento = "Dinheiro" | "Pix" | "Cartão";
type MotoristaMini = { codigo: string; nome: string; status: string };
type Parada = { id: string; endereco: string; lat?: number; lng?: number };

export type ClientePrefill = {
  codigo: string;
  nome: string;
  telefone: string | null;
};

export type SolicitacaoInicial = {
  id: number;
  origem: AddressValue;
  destino: AddressValue;
  paradas: Array<{ text?: string; endereco?: string; lat?: number | null; lng?: number | null }>;
  solicitacoesEspeciais: string[];
  observacoes: string;
  distanciaKm: number | null;
};

type Props = {
  onCriada?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  clientePrefill?: ClientePrefill | null;
  solicitacaoInicial?: SolicitacaoInicial | null;
  /** Quando `open` não é controlado externamente, esconde o trigger padrão. */
  hideDefaultTrigger?: boolean;
};


const newId = () => Math.random().toString(36).slice(2, 9);

// Abrevia título de tarifa: "Praia Grande > São Vicente" → "PG > SV"
function abreviarTarifa(nome: string) {
  if (!nome) return "";
  const partes = nome.split(/\s*[>→-]\s*/);
  const abrevia = (s: string) =>
    s
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  if (partes.length >= 2) return partes.map(abrevia).join(" > ");
  return abrevia(nome);
}

export function NovaCorridaDialog({
  onCriada,
  open: openProp,
  onOpenChange,
  clientePrefill,
  solicitacaoInicial,
  hideDefaultTrigger,
}: Props) {

  const controlled = openProp !== undefined;
  const [openInternal, setOpenInternal] = useState(false);
  const open = controlled ? !!openProp : openInternal;
  const setOpen = (v: boolean) => {
    if (controlled) onOpenChange?.(v);
    else setOpenInternal(v);
  };
  const navigate = useNavigate();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });

  const [tarifas, setTarifas] = useState<TarifaOpt[]>([]);
  const [motoristas, setMotoristas] = useState<MotoristaMini[]>([]);

  // Cliente
  const [codigoBusca, setCodigoBusca] = useState("");
  const [clienteCodigo, setClienteCodigo] = useState<string | null>(null);
  const [cliente, setCliente] = useState("");
  const [telefone, setTelefone] = useState("");

  // Endereços
  const [origem, setOrigem] = useState<AddressValue>({ text: "" });
  const [destino, setDestino] = useState<AddressValue>({ text: "" });
  const [paradas, setParadas] = useState<Parada[]>([]);

  // Tarifa / valor
  const [distancia, setDistancia] = useState("");
  const [tarifaId, setTarifaId] = useState<string>("");
  const [calcRota, setCalcRota] = useState(false);

  // Modelo / Despacho / Pagamento
  const [modelo, setModelo] = useState<Modelo>("Imediata");
  const [agendadaPara, setAgendadaPara] = useState("");
  const [despacho, setDespacho] = useState<Despacho>("Automatico");
  const [motoristasManuais, setMotoristasManuais] = useState<string[]>([]);
  const [agendadaMotorista, setAgendadaMotorista] = useState<string>(""); // codigo do motociclista pré-vinculado
  const [pagamento, setPagamento] = useState<Pagamento>("Dinheiro");
  const [desconto, setDesconto] = useState<string>("");
  const [extra, setExtra] = useState<string>("");
  const [obs, setObs] = useState("");
  const [passageiros, setPassageiros] = useState<Array<{ id: string; nome: string; idade: string }>>([]);
  const [acompanhanteResponsavel, setAcompanhanteResponsavel] = useState(false);
  const [solicitacoesEspeciais, setSolicitacoesEspeciais] = useState<string[]>([]);
  const [buscandoCli, setBuscandoCli] = useState(false);
  const [cliNaoEncontrado, setCliNaoEncontrado] = useState(false);


  const [salvando, setSalvando] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState<{ texto: string; tel?: string } | null>(null);
  const [simularOpen, setSimularOpen] = useState(false);
  const [clienteConfirmou, setClienteConfirmou] = useState(false);
  const [copiadoSim, setCopiadoSim] = useState(false);

  const calcRotaFn = useServerFn(calcularRota);
  const dispararFn = useServerFn(dispararOfertas);
  const registrarLogFn = useServerFn(registrarStatusCorrida);
  const lerConfigFn = useServerFn(lerConfig);
  const lerTarifasFn = useServerFn(lerTarifas);

  const { data: cfgData } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => lerConfigFn(),
  });
  const { data: tarifasData } = useQuery({
    queryKey: ["tarifas-config"],
    queryFn: () => lerTarifasFn(),
  });
  const valorParadaExtra = cfgData?.config?.valorParadaExtra ?? 3;
  const whatsappCentral = cfgData?.config?.whatsappCentral ?? "";

  // Aplicar prefill quando abrir
  useEffect(() => {
    if (open && clientePrefill) {
      setClienteCodigo(clientePrefill.codigo);
      setCliente(clientePrefill.nome);
      setTelefone(maskTelefone(clientePrefill.telefone ?? ""));
      setCodigoBusca(clientePrefill.codigo);
    }
  }, [open, clientePrefill]);

  // Monta opções de tarifa a partir de tabelasFixas + híbrida
  useEffect(() => {
    if (!tarifasData?.tarifas) return;
    const cfg: TarifasConfig = tarifasData.tarifas;
    const opts: TarifaOpt[] = [
      ...cfg.tabelasFixas.map((t) => ({
        id: t.id,
        nome: t.titulo,
        tarifaMinima: t.tarifaMinima,
        valorKm: t.valorKm,
      })),
      {
        id: "hibrida",
        nome: cfg.tabelaHibrida.titulo,
        tarifaMinima: cfg.tabelaHibrida.tarifaMinima,
        valorKm: cfg.tabelaHibrida.valorKm,
      },
    ];
    setTarifas(opts);
    if (!tarifaId && opts[0]) setTarifaId(opts[0].id);
  }, [tarifasData]);

  // Carregar motoristas ao abrir (tarifas vêm de query)
  useEffect(() => {
    if (!open) return;
    supabase
      .from("motoristas")
      .select("codigo,nome,status")
      .order("codigo")
      .then(({ data }) => {
        if (data) setMotoristas(data as MotoristaMini[]);
      });
  }, [open]);


  // Calcula distância automaticamente.
  // Quando há paradas com coordenadas, usa a MAIOR distância entre origem→destino
  // e origem→cada parada, garantindo que o motorista seja remunerado pelo trecho
  // mais longo do percurso (não apenas pelo endereço final).
  const paradasCoordsKey = paradas
    .map((p) => (p.lat != null && p.lng != null ? `${p.lat},${p.lng}` : ""))
    .join("|");
  useEffect(() => {
    if (origem.lat == null || origem.lng == null || destino.lat == null || destino.lng == null) return;
    let cancel = false;
    setCalcRota(true);
    const destinos: Array<{ lat: number; lng: number }> = [
      { lat: destino.lat, lng: destino.lng },
      ...paradas
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({ lat: p.lat as number, lng: p.lng as number })),
    ];
    Promise.all(
      destinos.map((d) =>
        calcRotaFn({
          data: {
            origem: { lat: origem.lat as number, lng: origem.lng as number },
            destino: d,
          },
        }).catch(() => ({ km: 0, segundos: 0 })),
      ),
    )
      .then((rotas) => {
        if (cancel) return;
        const maiorKm = rotas.reduce((acc, r) => (r.km > acc ? r.km : acc), 0);
        if (maiorKm > 0) setDistancia(maiorKm.toFixed(1).replace(".", ","));
      })
      .finally(() => { if (!cancel) setCalcRota(false); });
    return () => { cancel = true; };
  }, [origem.lat, origem.lng, destino.lat, destino.lng, paradasCoordsKey]);

  const tarifa = tarifas.find((t) => t.id === tarifaId);
  const km = parseFloat(distancia.replace(",", ".")) || 0;
  const valorBase = tarifa && km > 0 ? Math.max(km * tarifa.valorKm, tarifa.tarifaMinima) : 0;
  const { total: totalBase, adicional } = calcularValorComParadas(valorBase, paradas.length, valorParadaExtra);
  const descontoNum = Math.max(0, parseFloat(desconto.replace(",", ".")) || 0);
  const extraNum = Math.max(0, parseFloat(extra.replace(",", ".")) || 0);
  const total = Math.max(0, totalBase - descontoNum + extraNum);

  // Busca automática de cliente com debounce (apenas Nome + Telefone, não toca endereço)
  useEffect(() => {
    const cod = codigoBusca.trim().toUpperCase();
    if (!cod || cod === clienteCodigo) return;
    if (cod.length < 2) { setCliNaoEncontrado(false); return; }
    let cancel = false;
    setBuscandoCli(true);
    const t = window.setTimeout(async () => {
      const { data } = await supabase
        .from("clientes")
        .select("codigo,nome,telefone")
        .eq("codigo", cod)
        .maybeSingle();
      if (cancel) return;
      setBuscandoCli(false);
      if (!data) {
        setCliNaoEncontrado(true);
        return;
      }
      setCliNaoEncontrado(false);
      setClienteCodigo(data.codigo);
      setCliente(data.nome);
      setTelefone(maskTelefone(data.telefone ?? ""));
    }, 400);
    return () => { cancel = true; window.clearTimeout(t); };
  }, [codigoBusca, clienteCodigo]);


  const limpar = () => {
    setCodigoBusca("");
    setClienteCodigo(null);
    setCliente("");
    setTelefone("");
    setOrigem({ text: "" });
    setDestino({ text: "" });
    setParadas([]);
    setDistancia("");
    setModelo("Imediata");
    setAgendadaPara("");
    setDespacho("Automatico");
    setMotoristasManuais([]);
    setAgendadaMotorista("");
    setCliNaoEncontrado(false);
    setPagamento("Dinheiro");
    setDesconto("");
    setExtra("");
    setObs("");
    setPassageiros([]);
    setAcompanhanteResponsavel(false);
    setClienteConfirmou(false);
    setSimularOpen(false);
  };

  const gerarTextoWhatsApp = (corridaId: number) => {
    const linhas: string[] = [];
    if (corridaId > 0) linhas.push(`🏍️ *Corrida #${corridaId}*`);
    else linhas.push(`🏍️ *Simulação de corrida — Rota 013*`);
    if (cliente) linhas.push(`👤 ${cliente}${telefone ? ` · ${telefone}` : ""}`);
    linhas.push(`📍 Origem: ${origem.text}`);
    paradas.forEach((p, i) => linhas.push(`🟡 Parada ${i + 1}: ${p.endereco}`));
    if (destino.text) linhas.push(`🏁 Destino: ${destino.text}`);
    if (km > 0) linhas.push(`📏 ${km.toFixed(1).replace(".", ",")} km`);
    linhas.push(`💰 *R$ ${total.toFixed(2).replace(".", ",")}* (${pagamento})`);
    if (obs) linhas.push(`📝 ${obs}`);
    if (corridaId > 0) {
      linhas.push(`\nResponda *ACEITO ${corridaId}* para confirmar.`);
    } else {
      linhas.push(`\nResponda *CONFIRMO* para liberarmos o motociclista.`);
    }
    return linhas.join("\n");
  };

  const textoSimulacao = simularOpen ? gerarTextoWhatsApp(0) : "";

  const copiarSimulacao = async () => {
    try {
      await navigator.clipboard.writeText(textoSimulacao);
      setCopiadoSim(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopiadoSim(false), 2500);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const abrirWhatsAppCliente = () => {
    const tel = (telefone || "").replace(/\D/g, "");
    const url = tel
      ? `https://wa.me/55${tel}?text=${encodeURIComponent(textoSimulacao)}`
      : `https://wa.me/?text=${encodeURIComponent(textoSimulacao)}`;
    window.open(url, "_blank");
  };

  const lancar = async () => {
    if (!origem.text.trim()) { toast.error("Informe a origem."); return; }
    if (modelo === "Agendada" && !agendadaPara) {
      toast.error("Informe a data/hora do agendamento.");
      return;
    }
    if (despacho === "Manual" && motoristasManuais.length === 0) {
      toast.error("Selecione pelo menos um motociclista.");
      return;
    }
    const passageirosValidos = passageiros
      .map((p) => ({ nome: p.nome.trim(), idade: parseInt(p.idade, 10) }))
      .filter((p) => p.nome || !isNaN(p.idade));
    const temMenor16 = passageirosValidos.some((p) => !isNaN(p.idade) && p.idade < 16);
    if (temMenor16 && !acompanhanteResponsavel) {
      toast.error("Passageiro menor de 16 anos exige acompanhamento de responsável. Marque a confirmação.");
      return;
    }
    setSalvando(true);

    const paradasJson = paradas.map((p, i) => ({
      ordem: i + 1,
      endereco: p.endereco,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      concluida_em: null,
    }));

    const statusInicial = modelo === "Agendada" ? "Agendada" : "Pendente";

    const { data: inserted, error } = await supabase
      .from("corridas")
      .insert({
        cliente: cliente || null,
        cliente_codigo: clienteCodigo,
        telefone_cliente: telefone || null,
        origem: origem.text,
        origem_lat: origem.lat ?? null,
        origem_lng: origem.lng ?? null,
        destino: destino.text || null,
        destino_lat: destino.lat ?? null,
        destino_lng: destino.lng ?? null,
        distancia_km: km || null,
        valor_final: total,
        valor_paradas: floorReal(adicional),
        pagamento,
        observacoes: obs || null,
        status: statusInicial as any,
        tipo: "Comum",
        modelo,
        agendada_para: modelo === "Agendada" ? new Date(agendadaPara).toISOString() : null,
        despacho,
        paradas: paradasJson as any,
        motoristas_manuais: despacho === "Manual" ? motoristasManuais : [],
        motorista_codigo: modelo === "Agendada" && agendadaMotorista ? agendadaMotorista : null,
        motorista: modelo === "Agendada" && agendadaMotorista
          ? (motoristas.find((m) => m.codigo === agendadaMotorista)?.nome ?? null)
          : null,
        passageiros: passageirosValidos.map((p) => ({
          nome: p.nome || null,
          idade: isNaN(p.idade) ? null : p.idade,
        })) as any,
        solicitacoes_especiais: solicitacoesEspeciais,
      })
      .select("id")
      .single();

    setSalvando(false);
    if (error || !inserted) {
      toast.error("Erro: " + (error?.message ?? "falha desconhecida"));
      return;
    }

    // Log inicial
    registrarLogFn({
      data: {
        corridaId: inserted.id,
        status: statusInicial,
        observacao: modelo === "Agendada"
          ? `Agendada para ${new Date(agendadaPara).toLocaleString("pt-BR")}`
          : `Modelo: ${despacho}`,
      },
    }).catch(() => {});

    toast.success(modelo === "Agendada" ? "Corrida agendada!" : "Corrida criada!");

    // Despacho
    if (modelo === "Imediata") {
      try {
        const r = await dispararFn({ data: { corridaId: inserted.id } });
        if (r.modo === "whatsapp") {
          setWhatsappOpen({ texto: gerarTextoWhatsApp(inserted.id), tel: whatsappCentral });
        } else if (r.ofertados === 0) {
          toast.warning("Corrida criada, mas " + (r.motivo ?? "nenhum motociclista disponível"));
        } else {
          toast.success(`Oferta enviada para ${r.ofertados} motociclista(s)`);
        }
      } catch (e: any) {
        toast.error("Erro ao ofertar: " + e.message);
      }
    }

    limpar();
    setOpen(false);
    onCriada?.();
    if (currentPath !== "/dashboard") {
      navigate({ to: "/dashboard" });
    }
  };

  const addParada = () => setParadas((p) => [...p, { id: newId(), endereco: "" }]);
  const updParada = (id: string, v: AddressValue) =>
    setParadas((p) =>
      p.map((x) => (x.id === id ? { ...x, endereco: v.text, lat: v.lat, lng: v.lng } : x)),
    );
  const rmParada = (id: string) => setParadas((p) => p.filter((x) => x.id !== id));

  const toggleMotoristaManual = (codigo: string) =>
    setMotoristasManuais((s) =>
      s.includes(codigo) ? s.filter((x) => x !== codigo) : [...s, codigo],
    );

  const copiarWhatsapp = async () => {
    if (!whatsappOpen) return;
    try {
      await navigator.clipboard.writeText(whatsappOpen.texto);
      toast.success("Texto copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto manualmente.");
    }
  };

  const abrirWhatsApp = () => {
    if (!whatsappOpen) return;
    const url = `https://wa.me/${whatsappOpen.tel ?? ""}?text=${encodeURIComponent(whatsappOpen.texto)}`;
    window.open(url, "_blank");
  };

  const dialogContent = (
    <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Nova corrida</DialogTitle>
        <DialogDescription>
          Busque o cliente, informe os endereços e configure o despacho.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 py-2">
        {/* Cliente */}
        <div className="grid gap-2 rounded-lg border p-3 bg-muted/30">
          <Label>Cliente</Label>
          <div className="flex gap-2 items-center">
            <Input
              placeholder="Código (ex: C0001)"
              value={codigoBusca}
              onChange={(e) => {
                let v = e.target.value.toUpperCase();
                if (v && !v.startsWith("C") && /^\d+$/.test(v)) v = "C" + v;
                setCodigoBusca(v);
              }}
              className="font-mono"
            />
            {buscandoCli && <span className="text-xs text-muted-foreground">buscando…</span>}
            {cliNaoEncontrado && !buscandoCli && <span className="text-xs text-destructive">não encontrado</span>}
            {clienteCodigo && <Search className="h-4 w-4 text-primary" />}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Nome" className="uppercase" value={cliente} onChange={(e) => setCliente(e.target.value.toUpperCase())} />
            <Input
              placeholder="Telefone"
              value={telefone}
              onChange={(e) => setTelefone(maskTelefone(e.target.value))}
            />
          </div>
        </div>

        {/* Endereços */}
        <div className="grid gap-2">
          <Label>Origem *</Label>
          <AddressAutocomplete value={origem.text} onChange={setOrigem} placeholder="Endereço de partida" />
        </div>

        {paradas.map((p, i) => (
          <div key={p.id} className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Parada {i + 1}</Label>
              <Button variant="ghost" size="sm" onClick={() => rmParada(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <AddressAutocomplete
              value={p.endereco}
              onChange={(v) => updParada(p.id, v)}
              placeholder={`Endereço da parada ${i + 1}`}
            />
          </div>
        ))}

        <Button type="button" variant="outline" size="sm" onClick={addParada} className="justify-self-start">
          <Plus className="h-4 w-4 mr-1" /> Adicionar parada (+R$ {valorParadaExtra},00)
        </Button>

        <div className="grid gap-2">
          <Label>Destino</Label>
          <AddressAutocomplete value={destino.text} onChange={setDestino} placeholder="Endereço de destino" />
        </div>

        {/* Tarifa / Distância / Pagamento */}
        <div className="grid grid-cols-3 gap-3">
          <div className="grid gap-1.5">
            <Label>Distância (km){calcRota ? " …" : ""}</Label>
            <Input inputMode="decimal" value={distancia} onChange={(e) => setDistancia(e.target.value)} placeholder="0,0" />
          </div>
          <div className="grid gap-1.5 min-w-0">
            <Label>Tarifa</Label>
            <Select value={tarifaId} onValueChange={setTarifaId}>
              <SelectTrigger className="min-w-0">
                <SelectValue placeholder="Tarifa">
                  {tarifaId ? abreviarTarifa(tarifas.find((t) => t.id === tarifaId)?.nome ?? "") : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {tarifas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="font-mono mr-2">{abreviarTarifa(t.nome)}</span>
                    <span className="text-xs text-muted-foreground">{t.nome}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5 min-w-0">
            <Label>Pagamento</Label>
            <Select value={pagamento} onValueChange={(v) => setPagamento(v as Pagamento)}>
              <SelectTrigger className="min-w-0"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="Pix">Pix</SelectItem>
                <SelectItem value="Cartão">Cartão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Desconto e Cobrança Adicional */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Desconto (R$)</Label>
            <Input
              inputMode="decimal"
              value={desconto}
              onChange={(e) => setDesconto(e.target.value)}
              placeholder="0,00"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Cobrança adicional (R$)</Label>
            <Input
              inputMode="decimal"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="0,00"
            />
          </div>
        </div>


        {/* Modelo / Despacho */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Modelo</Label>
            <Select value={modelo} onValueChange={(v) => setModelo(v as Modelo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Imediata">Imediata</SelectItem>
                <SelectItem value="Agendada">Agendada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Despacho</Label>
            <Select value={despacho} onValueChange={(v) => setDespacho(v as Despacho)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Automatico">Automático (top 5 + expande)</SelectItem>
                <SelectItem value="Manual">Manual (escolher motociclistas)</SelectItem>
                <SelectItem value="WhatsApp">WhatsApp (gerar mensagem)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {modelo === "Agendada" && (
          <div className="grid gap-2">
            <Label>Data e hora do agendamento</Label>
            <Input
              type="datetime-local"
              value={agendadaPara}
              onChange={(e) => setAgendadaPara(e.target.value)}
            />
            <Label className="mt-2">Vincular motociclista (opcional)</Label>
            <Select value={agendadaMotorista || "__none"} onValueChange={(v) => setAgendadaMotorista(v === "__none" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum (lançar para todos no horário)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum (lançar para todos)</SelectItem>
                {motoristas.map((m) => (
                  <SelectItem key={m.codigo} value={m.codigo}>
                    {m.codigo} · {m.nome} ({m.status})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              O operador será alertado antes do horário e poderá lançar a corrida manualmente.
            </p>
          </div>
        )}

        {despacho === "Manual" && (
          <div className="grid gap-2 rounded-lg border p-3">
            <Label>Motoristas selecionados ({motoristasManuais.length})</Label>
            <div className="max-h-44 overflow-y-auto grid gap-1.5">
              {motoristas.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum motociclista cadastrado.</p>
              )}
              {motoristas.map((m) => (
                <label key={m.codigo} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={motoristasManuais.includes(m.codigo)}
                    onCheckedChange={() => toggleMotoristaManual(m.codigo)}
                  />
                  <span className="font-mono text-xs">{m.codigo}</span>
                  <span>{m.nome}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{m.status}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label>Passageiros (opcional)</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setPassageiros((arr) => [...arr, { id: newId(), nome: "", idade: "" }])}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
            </Button>
          </div>
          {passageiros.length > 0 && (
            <div className="space-y-2 rounded-md border p-2 bg-muted/30">
              {passageiros.map((p, idx) => {
                const idadeNum = parseInt(p.idade, 10);
                const menor = !isNaN(idadeNum) && idadeNum < 16;
                return (
                  <div key={p.id} className="flex items-center gap-2">
                    <Input
                      className="flex-1"
                      placeholder={`Passageiro ${idx + 1} — nome`}
                      value={p.nome}
                      onChange={(e) =>
                        setPassageiros((arr) => arr.map((x) => x.id === p.id ? { ...x, nome: e.target.value } : x))
                      }
                    />
                    <Input
                      className={`w-20 ${menor ? "border-destructive" : ""}`}
                      placeholder="Idade"
                      inputMode="numeric"
                      value={p.idade}
                      onChange={(e) =>
                        setPassageiros((arr) => arr.map((x) => x.id === p.id ? { ...x, idade: e.target.value.replace(/\D/g, "").slice(0, 3) } : x))
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => setPassageiros((arr) => arr.filter((x) => x.id !== p.id))}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
              {passageiros.some((p) => { const n = parseInt(p.idade, 10); return !isNaN(n) && n < 16; }) && (
                <label className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/40 rounded p-2">
                  <Checkbox
                    checked={acompanhanteResponsavel}
                    onCheckedChange={(v) => setAcompanhanteResponsavel(!!v)}
                  />
                  <span>
                    Há passageiro menor de 16 anos. Confirmo que ele(a) estará <b>acompanhado(a) de responsável</b>{" "}
                    (sem isso a corrida não pode ser lançada).
                  </span>
                </label>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-1.5">
          <Label>Solicitações especiais (opcional)</Label>
          <div className="flex flex-wrap gap-2">
            {[
              { v: "animal", t: "🐾 Animal" },
              { v: "bagagem", t: "🎒 Bagagem volumosa" },
              { v: "capa_chuva", t: "☔ Capa de chuva" },

            ].map((o) => {
              const ativo = solicitacoesEspeciais.includes(o.v);
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() =>
                    setSolicitacoesEspeciais((arr) =>
                      ativo ? arr.filter((x) => x !== o.v) : [...arr, o.v],
                    )
                  }
                  className={`px-3 py-1.5 rounded-full text-xs border transition ${
                    ativo
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 hover:bg-muted border-border"
                  }`}
                >
                  {o.t}
                </button>
              );
            })}
          </div>
          {solicitacoesEspeciais.length > 0 && (
            <p className="text-[11px] rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1.5">
              ⚠️ Confirme com o cliente antes de repassar essas solicitações ao motociclista.
            </p>
          )}

        </div>


        <div className="grid gap-1.5">
          <Label>Observações</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex.: aguardar na portaria" />
        </div>

        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 flex items-center justify-between">
          <div className="text-sm">
            <div className="text-muted-foreground">
              Base: R$ {floorReal(valorBase)},00
              {paradas.length > 0 && (
                <> · +{paradas.length}× parada: R$ {floorReal(adicional)},00</>
              )}
              {descontoNum > 0 && (
                <> · <span className="text-destructive">−R$ {descontoNum.toFixed(2).replace(".", ",")} desc.</span></>
              )}
              {extraNum > 0 && (
                <> · <span className="text-emerald-600">+R$ {extraNum.toFixed(2).replace(".", ",")} extra</span></>
              )}
            </div>
            <div className="text-xs text-muted-foreground italic">centavos zerados na base</div>
          </div>
          <span className="text-3xl font-black text-primary">R$ {total.toFixed(2).replace(".", ",")}</span>
        </div>

      </div>

      <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
        <Button variant="ghost" onClick={limpar}>Limpar</Button>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button variant="secondary" onClick={() => { setClienteConfirmou(false); setSimularOpen(true); }}>
          Simular corrida
        </Button>
        <Button onClick={lancar} disabled={salvando}>
          {salvando ? "Salvando..." : modelo === "Agendada" ? "Agendar" : "Lançar corrida"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {!controlled && !hideDefaultTrigger && (
          <DialogTrigger asChild>
            <Button className="w-full" size="lg">
              <Plus className="h-4 w-4 mr-2" />Nova corrida
            </Button>
          </DialogTrigger>
        )}
        {dialogContent}
      </Dialog>

      {/* Dialog WhatsApp */}
      <Dialog open={!!whatsappOpen} onOpenChange={(v) => { if (!v) setWhatsappOpen(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mensagem para WhatsApp</DialogTitle>
            <DialogDescription>
              Copie o texto e cole no grupo dos motociclistas ou no particular.
            </DialogDescription>
          </DialogHeader>
          <Textarea value={whatsappOpen?.texto ?? ""} readOnly rows={10} className="font-mono text-xs" />
          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setWhatsappOpen(null)}>Fechar</Button>
            <Button variant="secondary" onClick={abrirWhatsApp}>Abrir WhatsApp</Button>
            <Button onClick={copiarWhatsapp}><Copy className="h-4 w-4 mr-1" /> Copiar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Simular corrida */}
      <Dialog open={simularOpen} onOpenChange={setSimularOpen}>
        <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Simulação de corrida</DialogTitle>
            <DialogDescription>
              Revise os dados, envie a mensagem ao cliente e aguarde a confirmação antes de lançar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-1">
            <div className="rounded-lg border p-3 bg-muted/30 text-sm grid gap-1">
              <div><b>Cliente:</b> {cliente || "—"} {telefone && <span className="text-muted-foreground">· {telefone}</span>}</div>
              <div><b>Origem:</b> {origem.text || "—"}</div>
              {paradas.map((p, i) => (
                <div key={p.id}><b>Parada {i + 1}:</b> {p.endereco || "—"}</div>
              ))}
              {destino.text && <div><b>Destino:</b> {destino.text}</div>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-xs text-muted-foreground">
                {km > 0 && <span>📏 {km.toFixed(1).replace(".", ",")} km</span>}
                <span>💳 {pagamento}</span>
                <span>💰 R$ {total.toFixed(2).replace(".", ",")}</span>
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label>Mensagem para o cliente</Label>
              <Textarea value={textoSimulacao} readOnly rows={9} className="font-mono text-xs" />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="secondary" size="sm" onClick={copiarSimulacao}>
                <Copy className="h-4 w-4 mr-1" /> {copiadoSim ? "Copiado!" : "Copiar mensagem"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={abrirWhatsAppCliente}>
                Abrir WhatsApp
              </Button>
            </div>

            <label className="flex items-start gap-2 text-sm rounded-lg border p-3 bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800">
              <Checkbox
                checked={clienteConfirmou}
                onCheckedChange={(v) => setClienteConfirmou(!!v)}
                className="mt-0.5"
              />
              <span>
                <b>Cliente confirmou</b> a corrida via WhatsApp. Só lance após a confirmação para evitar deslocamento perdido.
              </span>
            </label>
          </div>

          <DialogFooter className="gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setSimularOpen(false)}>Voltar</Button>
            <Button
              disabled={!clienteConfirmou || salvando}
              onClick={async () => { setSimularOpen(false); await lancar(); }}
            >
              {salvando ? "Lançando…" : "Lançar corrida agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
