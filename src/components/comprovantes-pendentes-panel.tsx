/**
 * Painel de comprovantes PIX aguardando aprovação do operador.
 * Lista cobranças com status "Aguardando" e comprovante anexado,
 * permite ver a foto, aprovar (registra diária) ou rejeitar com motivo.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Receipt, Check, X, Loader2 } from "lucide-react";
import { listarCobrancasHoje, liberarMotorista, rejeitarComprovante } from "@/lib/cobranca.functions";

export function ComprovantesPendentesPanel() {
  const listarFn = useServerFn(listarCobrancasHoje);
  const liberarFn = useServerFn(liberarMotorista);
  const rejeitarFn = useServerFn(rejeitarComprovante);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["cobrancas-aguardando"],
    queryFn: () => listarFn(),
    refetchInterval: 10000,
  });

  const aguardando = (data?.cobrancas ?? []).filter(
    (c) => c.status === "Aguardando" && (c.comprovante_signed_url || c.comprovante_url),
  );

  const [visualizar, setVisualizar] = useState<{ url: string; nome: string } | null>(null);
  const [rejeitando, setRejeitando] = useState<{ codigo: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState("");

  const aprovar = useMutation({
    mutationFn: (v: { motoristaCodigo: string }) => liberarFn({ data: v }),
    onSuccess: () => {
      toast.success("Comprovante aprovado · diária registrada");
      qc.invalidateQueries({ queryKey: ["cobrancas-aguardando"] });
      qc.invalidateQueries({ queryKey: ["financeiro"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejeitar = useMutation({
    mutationFn: (v: { motoristaCodigo: string; motivo: string }) => rejeitarFn({ data: v }),
    onSuccess: () => {
      toast.success("Comprovante rejeitado — motorista será notificado");
      qc.invalidateQueries({ queryKey: ["cobrancas-aguardando"] });
      setRejeitando(null);
      setMotivo("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  if (aguardando.length === 0) return null;

  return (
    <>
      <Card className="p-4 border-warning/40 bg-warning/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-warning" />
            <h2 className="font-semibold">Comprovantes aguardando aprovação</h2>
          </div>
          <Badge variant="secondary">{aguardando.length}</Badge>
        </div>
        <div className="space-y-2">
          {aguardando.map((c) => (
            <div
              key={c.motorista_codigo}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              {c.comprovante_signed_url ? (
                <button
                  onClick={() => setVisualizar({ url: c.comprovante_signed_url!, nome: c.motorista_nome })}
                  className="shrink-0"
                >
                  <img
                    src={c.comprovante_signed_url}
                    alt={`Comprovante de ${c.motorista_nome}`}
                    className="h-14 w-14 rounded-md object-cover border border-border"
                  />
                </button>
              ) : (
                <div className="h-14 w-14 rounded-md bg-muted grid place-items-center text-xs text-muted-foreground">
                  sem foto
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{c.motorista_nome}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.motorista_codigo} · faturou R$ {Number(c.faturamento_dia).toFixed(2).replace(".", ",")}
                </div>
                {c.comprovante_enviado_em && (
                  <div className="text-[11px] text-muted-foreground">
                    Enviado às {new Date(c.comprovante_enviado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRejeitando({ codigo: c.motorista_codigo, nome: c.motorista_nome })}
                  disabled={rejeitar.isPending}
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    if (!confirm(`Aprovar comprovante e registrar diária de ${c.motorista_nome}?`)) return;
                    aprovar.mutate({ motoristaCodigo: c.motorista_codigo });
                  }}
                  disabled={aprovar.isPending}
                >
                  {aprovar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Check className="h-3.5 w-3.5 mr-1" /> Aprovar</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pré-visualização ampliada */}
      <Dialog open={!!visualizar} onOpenChange={(o) => !o && setVisualizar(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Comprovante — {visualizar?.nome}</DialogTitle>
          </DialogHeader>
          {visualizar && (
            <img
              src={visualizar.url}
              alt="Comprovante PIX"
              className="w-full max-h-[70vh] object-contain rounded-md bg-muted"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Diálogo de rejeição */}
      <Dialog open={!!rejeitando} onOpenChange={(o) => { if (!o) { setRejeitando(null); setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar comprovante de {rejeitando?.nome}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O motociclista verá o motivo no app e poderá enviar um novo comprovante.
          </p>
          <Textarea
            placeholder="Ex.: foto ilegível, valor incorreto, comprovante antigo…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            maxLength={300}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejeitando(null); setMotivo(""); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={motivo.trim().length < 2 || rejeitar.isPending}
              onClick={() => rejeitando && rejeitar.mutate({ motoristaCodigo: rejeitando.codigo, motivo: motivo.trim() })}
            >
              {rejeitar.isPending ? "Rejeitando…" : "Rejeitar comprovante"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
