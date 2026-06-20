import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddressAutocomplete, type AddressValue } from "@/components/address-autocomplete";
import { MapLeaflet, type MapMotorista } from "@/components/map-leaflet";
import { MapPin, Plus, X, Bike, Loader2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken } from "@/lib/cliente-auth";
import { toast } from "sonner";
import { PWAInstallBanner } from "@/components/pwa-install-banner";
import { AvaliacaoCorridaDialog } from "@/components/avaliacao-corrida-dialog";

export const Route = createFileRoute("/cliente/app/")({
  ssr: false,
  component: ClienteAppHome,
});

const PRACO: AddressValue = { text: "" };

const ESPECIAIS = [
  { v: "animal", t: "🐾 Pet" },
  { v: "bagagem", t: "🎒 Bagagem volumosa" },
  { v: "capa_chuva", t: "☔ Capa de chuva" },
] as const;

type CorridaAtiva = {
  id: number;
  status: string;
  motorista: string | null;
  motorista_codigo: string | null;
  origem: string | null;
  destino: string | null;
  valor_final: number | null;
  eta_chegada_em: string | null;
  eta_coleta_segundos: number | null;
};

type MotoristaInfo = {
  nome: string | null;
  placa: string | null;
  moto: string | null;
  cor: string | null;
  telefone: string | null;
};


const STATUS_ATIVO = new Set([
  "Pendente",
  "Ofertada",
  "Aceita",
  "A caminho",
  "Chegou",
  "Em viagem",
  "Parada",
]);

function ClienteAppHome() {
  const [origem, setOrigem] = useState<AddressValue>(PRACO);
  const [destino, setDestino] = useState<AddressValue>(PRACO);
  const [paradas, setParadas] = useState<AddressValue[]>([]);
  const [especiais, setEspeciais] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [motoristas, setMotoristas] = useState<MapMotorista[]>([]);
  const [solicitando, setSolicitando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [cotacao, setCotacao] = useState<{ distancia: number; valor: number } | null>(null);
  const [corridaAtiva, setCorridaAtiva] = useState<CorridaAtiva | null>(null);
  const [motoristaInfo, setMotoristaInfo] = useState<MotoristaInfo | null>(null);
  const [avaliarCorridaId, setAvaliarCorridaId] = useState<number | null>(null);
  const ultimaAtivaRef = useRef<CorridaAtiva | null>(null);

  // Polling da corrida ativa do cliente
  useEffect(() => {
    const token = getClienteToken();
    if (!token) return;
    let alive = true;
    const tick = async () => {
      const { data } = await supabase.rpc("cliente_listar_corridas", { _token: token });
      if (!alive) return;
      const lista = (data ?? []) as any[];
      const ativa = lista.find((c) => STATUS_ATIVO.has(c.status));
      const nova: CorridaAtiva | null = ativa
        ? {
            id: ativa.id,
            status: ativa.status,
            motorista: ativa.motorista,
            motorista_codigo: ativa.motorista_codigo,
            origem: ativa.origem,
            destino: ativa.destino,
            valor_final: ativa.valor_final,
            eta_chegada_em: ativa.eta_chegada_em ?? null,
            eta_coleta_segundos: ativa.eta_coleta_segundos ?? null,
          }
        : null;


      // Detectar transição: corrida ativa anterior agora aparece como Finalizada → abrir avaliação
      const anterior = ultimaAtivaRef.current;
      if (anterior && (!nova || nova.id !== anterior.id)) {
        const finalizada = lista.find(
          (c) => c.id === anterior.id && c.status === "Finalizada" && c.avaliada_em == null,
        );
        if (finalizada) setAvaliarCorridaId(anterior.id);
      }
      ultimaAtivaRef.current = nova;
      setCorridaAtiva(nova);
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Buscar dados do motociclista (placa/moto/telefone) quando aceitar
  useEffect(() => {
    const cod = corridaAtiva?.motorista_codigo;
    if (!cod) {
      setMotoristaInfo(null);
      return;
    }
    let alive = true;
    supabase
      .from("motoristas")
      .select("nome,placa,moto,cor,telefone")
      .eq("codigo", cod)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setMotoristaInfo(data as MotoristaInfo);
      });
    return () => {
      alive = false;
    };
  }, [corridaAtiva?.motorista_codigo]);

  // Mapa de motoristas online (apenas quando não há corrida ativa)
  useEffect(() => {
    if (corridaAtiva) return;
    let alive = true;
    const carregar = async () => {
      const { data } = await supabase.rpc("cliente_motoristas_online");
      if (!alive) return;
      setMotoristas(
        ((data ?? []) as Array<{ codigo: string; nome: string; lat: number; lng: number; status: string }>).map(
          (m) => ({ codigo: m.codigo, nome: m.nome, lat: Number(m.lat), lng: Number(m.lng), status: m.status }),
        ),
      );
    };
    void carregar();
    const id = setInterval(carregar, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [corridaAtiva]);

  // Origem inicia vazia — cliente preenche manualmente.

  const adicionarParada = () => setParadas((p) => [...p, { text: "" }]);
  const removerParada = (i: number) => setParadas((p) => p.filter((_, idx) => idx !== i));
  const setParada = (i: number, v: AddressValue) =>
    setParadas((p) => p.map((it, idx) => (idx === i ? v : it)));

  const toggleEspecial = (v: string) =>
    setEspeciais((arr) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]));

  const cotar = () => {
    if (!origem.lat || !origem.lng) return toast.error("Selecione um endereço de origem válido.");
    for (const p of paradas) {
      if (!p.lat || !p.lng) return toast.error("Selecione um endereço válido para todas as paradas.");
    }
    // Destino é opcional
    const pontos = [
      { lat: origem.lat, lng: origem.lng },
      ...paradas.map((p) => ({ lat: p.lat!, lng: p.lng! })),
      ...(destino.lat && destino.lng ? [{ lat: destino.lat, lng: destino.lng }] : []),
    ];
    let dist = 0;
    for (let i = 1; i < pontos.length; i++) dist += haversine(pontos[i - 1], pontos[i]);
    const BANDEIRADA = 5;
    const POR_KM = 2.5;
    const MINIMO = 7;
    const PARADA_EXTRA = 2;
    const valor = Math.max(MINIMO, BANDEIRADA + dist * POR_KM + paradas.length * PARADA_EXTRA);
    setCotacao({ distancia: dist, valor: Math.ceil(valor) });
    setModalOpen(true);
  };

  const confirmar = async () => {
    const token = getClienteToken();
    if (!token || !cotacao) return;
    setSolicitando(true);
    try {
      const { error } = await supabase.rpc("cliente_solicitar_corrida", {
        _token: token,
        _origem: origem.text,
        _origem_lat: origem.lat!,
        _origem_lng: origem.lng!,
        _destino: destino.text || "",
        _destino_lat: destino.lat ?? 0,
        _destino_lng: destino.lng ?? 0,
        _paradas: paradas.map((p) => ({ text: p.text, lat: p.lat, lng: p.lng })),
        _distancia_km: Number(cotacao.distancia.toFixed(2)),
        _valor: cotacao.valor,
        _observacoes: observacao,
        _solicitacoes_especiais: especiais,
      } as any);
      if (error) throw error;
      toast.success("Corrida solicitada! Procurando motociclista...");
      setModalOpen(false);
      setParadas([]);
      setDestino(PRACO);
      setEspeciais([]);
      setObservacao("");
      setCotacao(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar corrida");
    } finally {
      setSolicitando(false);
    }
  };

  const especiaisLabels = especiais.map((v) => ESPECIAIS.find((e) => e.v === v)?.t ?? v);

  const avaliacaoDialog = avaliarCorridaId != null ? (
    <AvaliacaoCorridaDialog
      corridaId={avaliarCorridaId}
      open={true}
      onClose={() => setAvaliarCorridaId(null)}
    />
  ) : null;

  // ─── Renderização condicional: corrida ativa ────────────────────
  if (corridaAtiva) {
    return (
      <div className="px-4 py-4 space-y-4">
        <CorridaAtivaCard corrida={corridaAtiva} motorista={motoristaInfo} />
        {avaliacaoDialog}
      </div>
    );
  }



  return (
    <div className="px-4 py-5 space-y-5 animate-fade-in">
      <PWAInstallBanner />

      <div className="space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[color:var(--gold)]">Rota 013</p>
        <h2 className="font-display text-3xl font-bold text-[color:var(--gold-soft)] tracking-tight">
          Para onde vamos?
        </h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          <Bike className="size-4 text-[color:var(--gold)]" />
          {motoristas.length} motociclista{motoristas.length === 1 ? "" : "s"} por perto
        </p>
      </div>

      <Card className="rounded-3xl overflow-hidden border hairline bg-card shadow-[var(--shadow-elegant)]">
        <div className="h-60 w-full relative">
          <MapLeaflet motoristas={motoristas} hideLabels />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[color:var(--noir)] to-transparent" />
        </div>
      </Card>

      <Card className="rounded-3xl p-5 space-y-5 border hairline bg-card shadow-[var(--shadow-elegant)]">
        {/* Endereços com conector vertical */}
        <div className="relative">
          <div className="route-connector absolute left-[10px] top-6 bottom-6 w-px" aria-hidden="true" />
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="mt-3 size-5 shrink-0 rounded-full border-2 border-[color:var(--gold)] bg-background flex items-center justify-center z-10">
                <span className="size-1.5 rounded-full bg-[color:var(--gold)]" />
              </span>
              <div className="flex-1">
                <AddressAutocomplete
                  value={origem.text}
                  onChange={setOrigem}
                  placeholder="Endereço de origem *"
                />
              </div>
            </div>

            {paradas.map((p, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-3 size-5 shrink-0 rotate-45 bg-[color:var(--muted-foreground)] z-10" />
                <div className="flex-1">
                  <AddressAutocomplete
                    value={p.text}
                    onChange={(v) => setParada(i, v)}
                    placeholder={`Parada ${i + 1}`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removerParada(i)}
                  aria-label="Remover parada"
                  className="mt-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <X className="size-4" />
                </Button>
              </div>
            ))}

            <div className="flex items-start gap-3">
              <MapPin className="mt-2.5 size-5 shrink-0 text-[color:var(--gold-soft)] z-10" fill="currentColor" />
              <div className="flex-1">
                <AddressAutocomplete
                  value={destino.text}
                  onChange={setDestino}
                  placeholder="Endereço de destino (opcional)"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={adicionarParada}
          className="flex items-center gap-2 text-xs font-semibold text-[color:var(--gold)] hover:text-[color:var(--gold-soft)] transition-colors"
        >
          <Plus className="size-4" />
          Adicionar parada
        </button>

        <div className="border-t hairline -mx-5 px-5 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
            Solicitações especiais
          </p>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {ESPECIAIS.map((o) => {
              const ativo = especiais.includes(o.v);
              return (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => toggleEspecial(o.v)}
                  className={`flex-none px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all duration-200 active:scale-[0.96] ${
                    ativo
                      ? "bg-[color:var(--gold)] text-[color:var(--noir)] border-[color:var(--gold)] shadow-[var(--shadow-gold)]"
                      : "bg-background text-muted-foreground border-[color:var(--border)] hover:border-[color:var(--gold)]/40 hover:text-[color:var(--gold-soft)]"
                  }`}
                >
                  {o.t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Observação
          </p>
          <Textarea
            rows={2}
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Ex.: aguardar na portaria"
            maxLength={300}
            className="rounded-xl bg-background border-[color:var(--border)] focus-visible:border-[color:var(--gold)]/60 focus-visible:ring-[color:var(--gold)]/20"
          />
        </div>

        <Button
          onClick={cotar}
          size="lg"
          className="btn-gold w-full rounded-2xl font-display text-base h-12 hover:bg-transparent"
        >
          Solicitar corrida
        </Button>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="theme-cliente rounded-3xl bg-card border hairline">
          <DialogHeader>
            <DialogTitle className="font-display text-[color:var(--gold-soft)]">Confirmar corrida</DialogTitle>
          </DialogHeader>
          {cotacao && (
            <div className="space-y-3 py-2">
              <Row label="Origem" value={origem.text} />
              {paradas.map((p, i) => (
                <Row key={i} label={`Parada ${i + 1}`} value={p.text} />
              ))}
              {destino.text && <Row label="Destino" value={destino.text} />}
              {especiaisLabels.length > 0 && (
                <Row label="Solicitações especiais" value={especiaisLabels.join(" · ")} />
              )}
              {observacao && <Row label="Observação" value={observacao} />}
              <div className="border-t hairline pt-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Distância estimada</p>
                  <p className="font-display font-semibold text-lg">{cotacao.distancia.toFixed(1)} km</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Valor estimado</p>
                  <p className="font-display text-3xl font-bold text-[color:var(--gold)]">R$ {cotacao.valor.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="rounded-xl flex-1 border-[color:var(--border)] hover:bg-muted hover:text-foreground"
              onClick={() => setModalOpen(false)}
              disabled={solicitando}
            >
              Descartar
            </Button>
            <Button
              className="btn-gold rounded-xl flex-1 hover:bg-transparent"
              onClick={confirmar}
              disabled={solicitando}
            >
              {solicitando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {avaliacaoDialog}
    </div>
  );
}

function CorridaAtivaCard({
  corrida,
  motorista,
}: {
  corrida: CorridaAtiva;
  motorista: MotoristaInfo | null;
}) {
  const aceita = !!corrida.motorista_codigo;
  const procurando = corrida.status === "Pendente" || corrida.status === "Ofertada";

  return (
    <Card className="rounded-2xl p-5 space-y-4">
      {procurando && (
        <div className="text-center space-y-3 py-4">
          <Loader2 className="size-10 animate-spin text-primary mx-auto" />
          <div>
            <p className="text-lg font-semibold">Procurando motociclista…</p>
            <p className="text-sm text-muted-foreground">
              Sua corrida está sendo processada e aguardando aceitação.
            </p>
          </div>
        </div>
      )}

      {aceita && (
        <>
          <div className="flex items-center gap-3">
            <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Bike className="size-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {corrida.status === "Aceita" || corrida.status === "A caminho"
                  ? "Motociclista a caminho"
                  : corrida.status === "Chegou"
                    ? "Motociclista chegou"
                    : corrida.status === "Em viagem"
                      ? "Em viagem"
                      : corrida.status}
              </p>
              <p className="font-semibold truncate">{motorista?.nome ?? corrida.motorista ?? "—"}</p>
            </div>
          </div>

          {(corrida.status === "Aceita" || corrida.status === "A caminho") && (corrida.eta_coleta_segundos || corrida.eta_chegada_em) && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <p className="text-sm text-foreground">
                Chegada em{" "}
                <span className="font-bold text-primary">
                  aproximadamente {(() => {
                    if (corrida.eta_coleta_segundos && corrida.eta_coleta_segundos > 0) {
                      return Math.max(1, Math.round(corrida.eta_coleta_segundos / 60));
                    }
                    const ms = new Date(corrida.eta_chegada_em!).getTime() - Date.now();
                    return Math.max(1, Math.round(ms / 60000));
                  })()} min
                </span>
                .
              </p>
            </div>
          )}



          <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
            {motorista?.moto && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Moto</span>
                <span className="font-medium text-right">{motorista.moto}</span>
              </div>
            )}
            {motorista?.cor && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Cor</span>
                <span className="font-medium text-right">{motorista.cor}</span>
              </div>
            )}
            {motorista?.placa && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Placa</span>
                <span className="font-medium font-mono">{motorista.placa}</span>
              </div>
            )}

            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Origem</span>
              <span className="font-medium text-right line-clamp-2">{corrida.origem ?? "—"}</span>
            </div>
            {corrida.destino && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Destino</span>
                <span className="font-medium text-right line-clamp-2">{corrida.destino}</span>
              </div>
            )}
            {corrida.valor_final != null && (
              <div className="flex justify-between gap-3 pt-1 border-t border-border">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-primary">
                  R$ {Number(corrida.valor_final).toFixed(2).replace(".", ",")}
                </span>
              </div>
            )}
          </div>

          {motorista?.telefone && (
            <Button asChild variant="outline" className="w-full rounded-xl">
              <a href={`tel:${motorista.telefone}`}>
                <Phone className="size-4 mr-2" />
                Ligar para o motociclista
              </a>
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Acompanhe o status pelo aplicativo. O mapa em tempo real está temporariamente desativado.
          </p>
        </>
      )}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}




function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
