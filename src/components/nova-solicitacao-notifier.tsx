/**
 * Notificador de NOVAS SOLICITAÇÕES de corrida vindas do app do cliente.
 * Toca alerta sonoro e exibe modal bloqueante com os dados; o operador
 * pode "Registrar Corrida" (abre NovaCorridaDialog pré-preenchido) ou
 * descartar a notificação (a solicitação fica disponível na lista de
 * corridas pendentes da central).
 */
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bike } from "lucide-react";
import { playChatBeep } from "@/lib/notification-sound";
import { ensureNotificationPermission, showDesktopNotification } from "@/lib/desktop-notification";
import {
  NovaCorridaDialog,
  type SolicitacaoInicial,
  type ClientePrefill,
} from "@/components/nova-corrida-dialog";

type Solicitacao = {
  id: number;
  cliente: string | null;
  cliente_codigo: string | null;
  telefone_cliente: string | null;
  origem: string | null;
  origem_lat: number | null;
  origem_lng: number | null;
  destino: string | null;
  destino_lat: number | null;
  destino_lng: number | null;
  paradas: any;
  solicitacoes_especiais: string[] | null;
  observacoes: string | null;
  distancia_km: number | null;
  valor_final: number | null;
  criado_em: string;
};

const LABELS: Record<string, string> = {
  animal: "🐾 Pet",
  bagagem: "🎒 Bagagem volumosa",
  capa_chuva: "☔ Capa de chuva",
};

const COLS =
  "id,cliente,cliente_codigo,telefone_cliente,origem,origem_lat,origem_lng,destino,destino_lat,destino_lng,paradas,solicitacoes_especiais,observacoes,distancia_km,valor_final,criado_em";

export function NovaSolicitacaoNotifier() {
  const [pendentes, setPendentes] = useState<Solicitacao[]>([]);
  const [registrando, setRegistrando] = useState<Solicitacao | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [acao, setAcao] = useState(false);
  const idsVistos = useRef<Set<number>>(new Set());
  const primeiraCarga = useRef(true);

  useEffect(() => {
    ensureNotificationPermission();
    let cancelado = false;

    const carregar = async () => {
      const { data } = await supabase
        .from("corridas")
        .select(COLS)
        .eq("aguardando_registro", true)
        .order("criado_em", { ascending: true })
        .limit(20);
      if (cancelado) return;
      const lista = (data ?? []) as Solicitacao[];
      const novas = lista.filter((s) => !idsVistos.current.has(s.id));
      if (!primeiraCarga.current && novas.length > 0) {
        playChatBeep();
        const s = novas[0];
        showDesktopNotification({
          id: `solic-${s.id}`,
          title: "🏍️ Nova solicitação de corrida",
          body: `${s.cliente ?? "Cliente"} — ${s.origem ?? ""}`,
          tag: "solicitacao-cliente",
        });
      }
      primeiraCarga.current = false;
      idsVistos.current = new Set(lista.map((s) => s.id));
      setPendentes(lista);
    };

    void carregar();
    const id = window.setInterval(carregar, 6000);
    return () => {
      cancelado = true;
      window.clearInterval(id);
    };
  }, []);

  const atual = pendentes[0] ?? null;
  const modalAberto = atual !== null && !dialogOpen;

  const removerDaFila = (id: number) => {
    setPendentes((p) => p.filter((x) => x.id !== id));
    idsVistos.current.delete(id);
  };

  const descartar = async () => {
    if (!atual) return;
    setAcao(true);
    await supabase
      .from("corridas")
      .update({ aguardando_registro: false })
      .eq("id", atual.id);
    removerDaFila(atual.id);
    setAcao(false);
  };

  const registrar = () => {
    if (!atual) return;
    setRegistrando(atual);
    setDialogOpen(true);
  };

  const aoCriarCorrida = async () => {
    if (!registrando) return;
    // A solicitação original foi convertida; cancela a entrada original
    await supabase
      .from("corridas")
      .update({
        status: "Cancelada",
        aguardando_registro: false,
        observacoes: "Convertida em corrida pelo operador",
      })
      .eq("id", registrando.id);
    removerDaFila(registrando.id);
    setRegistrando(null);
  };

  const solicitacaoInicial: SolicitacaoInicial | null = registrando
    ? {
        id: registrando.id,
        origem: {
          text: registrando.origem ?? "",
          lat: registrando.origem_lat ?? undefined,
          lng: registrando.origem_lng ?? undefined,
        },
        destino: {
          text: registrando.destino ?? "",
          lat: registrando.destino_lat ?? undefined,
          lng: registrando.destino_lng ?? undefined,
        },
        paradas: Array.isArray(registrando.paradas) ? registrando.paradas : [],
        solicitacoesEspeciais: registrando.solicitacoes_especiais ?? [],
        observacoes: registrando.observacoes ?? "",
        distanciaKm: registrando.distancia_km != null ? Number(registrando.distancia_km) : null,
      }
    : null;

  const clientePrefill: ClientePrefill | null = registrando?.cliente_codigo
    ? {
        codigo: registrando.cliente_codigo,
        nome: registrando.cliente ?? "",
        telefone: registrando.telefone_cliente,
      }
    : null;

  return (
    <>
      <Dialog open={modalAberto} onOpenChange={() => { /* não permite fechar sem ação */ }}>
        <DialogContent
          className="max-w-md"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bike className="size-5 text-primary animate-pulse" />
              Nova solicitação de corrida
            </DialogTitle>
          </DialogHeader>
          {atual && (
            <div className="space-y-2 text-sm">
              <Row
                label="Cliente"
                value={`${atual.cliente ?? "—"}${atual.telefone_cliente ? ` · ${atual.telefone_cliente}` : ""}`}
              />
              <Row label="Origem" value={atual.origem ?? "—"} />
              {Array.isArray(atual.paradas) && atual.paradas.length > 0 && (
                <Row
                  label="Paradas"
                  value={(atual.paradas as any[])
                    .map((p, i) => `${i + 1}. ${p.text ?? p.endereco ?? ""}`)
                    .join(" / ")}
                />
              )}
              {atual.destino && <Row label="Destino" value={atual.destino} />}
              {atual.solicitacoes_especiais && atual.solicitacoes_especiais.length > 0 && (
                <Row
                  label="Solicitações especiais"
                  value={atual.solicitacoes_especiais.map((s) => LABELS[s] ?? s).join(" · ")}
                />
              )}
              {atual.observacoes && <Row label="Observação" value={atual.observacoes} />}
              {atual.valor_final != null && (
                <Row
                  label="Valor estimado"
                  value={`R$ ${Number(atual.valor_final).toFixed(2).replace(".", ",")}`}
                />
              )}
              {atual.solicitacoes_especiais && atual.solicitacoes_especiais.length > 0 && (
                <p className="text-[11px] rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-2 py-1.5">
                  ⚠️ Confirme com o cliente antes de repassar essas solicitações ao motociclista.
                </p>
              )}
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={descartar} disabled={acao}>
              Descartar
            </Button>
            <Button onClick={registrar} disabled={acao}>
              Registrar Corrida
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NovaCorridaDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setRegistrando(null);
        }}
        clientePrefill={clientePrefill}
        solicitacaoInicial={solicitacaoInicial}
        onCriada={aoCriarCorrida}
        hideDefaultTrigger
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-medium break-words">{value}</p>
    </div>
  );
}
