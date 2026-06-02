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

type Props = {
  onCriada?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  clientePrefill?: ClientePrefill | null;
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
  const [agendadaMotorista, setAgendadaMotorista] = useState<string>(""); // codigo do motorista pré-vinculado
  const [pagamento, setPagamento] = useState<Pagamento>("Dinheiro");
  const [desconto, setDesconto] = useState<string>("");
  const [extra, setExtra] = useState<string>("");
  const [obs, setObs] = useState("");
  const [buscandoCli, setBuscandoCli] = useState(false);
  const [cliNaoEncontrado, setCliNaoEncontrado] = useState(false);


  const [salvando, setSalvando] = useState(false);
  const [whatsappOpen, setWhatsappOpen] = useState<{ texto: string; tel?: string } | null>(null);

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


  // Calcula distância automaticamente
  useEffect(() => {
    if (origem.lat == null || origem.lng == null || destino.lat == null || destino.lng == null) return;
    let cancel = false;
    setCalcRota(true);
    calcRotaFn({
      data: {
        origem: { lat: origem.lat, lng: origem.lng },
        destino: { lat: destino.lat, lng: destino.lng },
      },
    })
      .then((r) => {
        if (cancel) return;
        if (r.km > 0) setDistancia(r.km.toFixed(1).replace(".", ","));
      })
      .catch(() => {})
      .finally(() => { if (!cancel) setCalcRota(false); });
    return () => { cancel = true; };
  }, [origem.lat, origem.lng, destino.lat, destino.lng]);

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
  };

  const gerarTextoWhatsApp = (corridaId: number) => {
    const linhas: string[] = [];
    linhas.push(`🏍️ *Corrida #${corridaId}*`);
    if (cliente) linhas.push(`👤 ${cliente}${telefone ? ` · ${telefone}` : ""}`);
    linhas.push(`📍 Origem: ${origem.text}`);
    paradas.forEach((p, i) => linhas.push(`🟡 Parada ${i + 1}: ${p.endereco}`));
    if (destino.text) linhas.push(`🏁 Destino: ${destino.text}`);
    if (km > 0) linhas.push(`📏 ${km.toFixed(1).replace(".", ",")} km`);
    linhas.push(`💰 *R$ ${total},00* (${pagamento})`);
    if (obs) linhas.push(`📝 ${obs}`);
    linhas.push(`\nResponda *ACEITO ${corridaId}* para confirmar.`);
    return linhas.join("\n");
  };

  const lancar = async () => {
    if (!origem.text.trim()) { toast.error("Informe a origem."); return; }
    if (modelo === "Agendada" && !agendadaPara) {
      toast.error("Informe a data/hora do agendamento.");
      return;
    }
    if (despacho === "Manual" && motoristasManuais.length === 0) {
      toast.error("Selecione pelo menos um motorista.");
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
          toast.warning("Corrida criada, mas " + (r.motivo ?? "nenhum motorista disponível"));
        } else {
          toast.success(`Oferta enviada para ${r.ofertados} motorista(s)`);
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
                <SelectItem value="Manual">Manual (escolher motoristas)</SelectItem>
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
            <Label className="mt-2">Vincular motorista (opcional)</Label>
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
                <p className="text-sm text-muted-foreground">Nenhum motorista cadastrado.</p>
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
              Copie o texto e cole no grupo dos motoristas ou no particular.
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
    </>
  );
}
