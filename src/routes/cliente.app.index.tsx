import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { AddressAutocomplete, type AddressValue } from "@/components/address-autocomplete";
import { MapLeaflet, type MapMotorista } from "@/components/map-leaflet";
import { MapPin, Plus, X, Bike, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken } from "@/lib/cliente-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/cliente/app/")({
  ssr: false,
  component: ClienteAppHome,
});

const PRACO: AddressValue = { text: "" };

function ClienteAppHome() {
  const [origem, setOrigem] = useState<AddressValue>(PRACO);
  const [destino, setDestino] = useState<AddressValue>(PRACO);
  const [paradas, setParadas] = useState<AddressValue[]>([]);
  const [motoristas, setMotoristas] = useState<MapMotorista[]>([]);
  const [solicitando, setSolicitando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [cotacao, setCotacao] = useState<{ distancia: number; valor: number } | null>(null);

  // Carrega motoristas online + atualiza a cada 15s
  useEffect(() => {
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
  }, []);

  // Preenche origem com geolocalização atual (uma vez)
  useEffect(() => {
    if (origem.text || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigem({
          text: "Minha localização atual",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      () => {},
      { timeout: 5000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const adicionarParada = () => setParadas((p) => [...p, { text: "" }]);
  const removerParada = (i: number) => setParadas((p) => p.filter((_, idx) => idx !== i));
  const setParada = (i: number, v: AddressValue) =>
    setParadas((p) => p.map((it, idx) => (idx === i ? v : it)));

  const cotar = () => {
    if (!origem.lat || !origem.lng) return toast.error("Selecione um endereço de origem válido.");
    if (!destino.lat || !destino.lng) return toast.error("Selecione um endereço de destino válido.");
    for (const p of paradas) {
      if (!p.lat || !p.lng) return toast.error("Selecione um endereço válido para todas as paradas.");
    }
    // Distância total: origem → paradas → destino (Haversine)
    const pontos = [
      { lat: origem.lat, lng: origem.lng },
      ...paradas.map((p) => ({ lat: p.lat!, lng: p.lng! })),
      { lat: destino.lat, lng: destino.lng },
    ];
    let dist = 0;
    for (let i = 1; i < pontos.length; i++) {
      dist += haversine(pontos[i - 1], pontos[i]);
    }
    // Tarifa simples — alinhada à tabela `tarifas` Padrão: bandeirada 5 + 2.50/km, mínimo 7
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
        _destino: destino.text,
        _destino_lat: destino.lat!,
        _destino_lng: destino.lng!,
        _paradas: paradas.map((p) => ({ text: p.text, lat: p.lat, lng: p.lng })),
        _distancia_km: Number(cotacao.distancia.toFixed(2)),
        _valor: cotacao.valor,
        _observacoes: "",
      });
      if (error) throw error;
      toast.success("Corrida solicitada! Procurando motociclista...");
      setModalOpen(false);
      setParadas([]);
      setDestino(PRACO);
      setCotacao(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao solicitar corrida");
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Para onde vamos?</h2>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <Bike className="size-4" /> {motoristas.length} mototaxista{motoristas.length === 1 ? "" : "s"} por perto
        </p>
      </div>

      {/* Mapa */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="h-64 w-full">
          <MapLeaflet motoristas={motoristas} />
        </div>
      </Card>

      {/* Formulário de solicitação */}
      <Card className="rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-2">
          <MapPin className="size-5 text-primary mt-2.5 shrink-0" />
          <div className="flex-1">
            <AddressAutocomplete
              value={origem.text}
              onChange={setOrigem}
              placeholder="Endereço de origem"
            />
          </div>
        </div>

        {paradas.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <MapPin className="size-5 text-amber-500 mt-2.5 shrink-0" />
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
              className="mt-1"
            >
              <X className="size-4" />
            </Button>
          </div>
        ))}

        <div className="flex items-start gap-2">
          <MapPin className="size-5 text-destructive mt-2.5 shrink-0" />
          <div className="flex-1">
            <AddressAutocomplete
              value={destino.text}
              onChange={setDestino}
              placeholder="Endereço de destino"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={adicionarParada}
          className="flex items-center gap-2 text-xs text-primary font-medium hover:underline"
        >
          <Plus className="size-4" />
          Adicionar parada
        </button>

        <Button onClick={cotar} className="w-full rounded-xl" size="lg">
          Solicitar corrida
        </Button>
      </Card>

      {/* Modal de confirmação */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confirmar corrida</DialogTitle>
          </DialogHeader>
          {cotacao && (
            <div className="space-y-3 py-2">
              <Row label="Origem" value={origem.text} />
              {paradas.map((p, i) => (
                <Row key={i} label={`Parada ${i + 1}`} value={p.text} />
              ))}
              <Row label="Destino" value={destino.text} />
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Distância estimada</p>
                  <p className="font-semibold">{cotacao.distancia.toFixed(1)} km</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Valor estimado</p>
                  <p className="text-2xl font-bold text-primary">R$ {cotacao.valor.toFixed(2)}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="rounded-xl flex-1"
              onClick={() => setModalOpen(false)}
              disabled={solicitando}
            >
              Descartar
            </Button>
            <Button className="rounded-xl flex-1" onClick={confirmar} disabled={solicitando}>
              {solicitando ? <Loader2 className="size-4 animate-spin" /> : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
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
