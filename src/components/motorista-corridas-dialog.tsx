import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { listarCorridasMotorista } from "@/lib/motoristas.functions";
import { AvaliacaoStars, AvaliacaoMedia } from "@/components/avaliacao-stars";

export function MotoristaCorridasDialog({
  open,
  onOpenChange,
  codigo,
  nome,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  codigo: string;
  nome: string;
}) {
  const listar = useServerFn(listarCorridasMotorista);
  const { data: corridas = [], isLoading } = useQuery({
    queryKey: ["motorista-corridas", codigo],
    queryFn: () => listar({ data: { codigo } }),
    enabled: open,
  });

  const avaliadas = corridas.filter((c: any) => c.avaliacao_motorista != null);
  const soma = avaliadas.reduce((s: number, c: any) => s + Number(c.avaliacao_motorista), 0);
  const media = avaliadas.length > 0 ? soma / avaliadas.length : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de corridas — {nome}</DialogTitle>
          <DialogDescription className="flex items-center gap-3">
            <span>{codigo} · {corridas.length} corrida(s)</span>
            <AvaliacaoMedia media={media} qtd={avaliadas.length} />
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isLoading && corridas.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhuma corrida realizada por este motociclista.
            </p>
          )}
          <div className="space-y-2">
            {corridas.map((c: any) => (
              <div key={c.id} className="border rounded-md p-3 space-y-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="text-xs text-muted-foreground">
                    #{c.id} · {new Date(c.criado_em).toLocaleString("pt-BR")}
                  </div>
                  <Badge variant="outline" className="text-[10px]">{c.status}</Badge>
                </div>
                <div className="text-sm font-medium">{c.cliente}</div>
                <div className="text-xs text-muted-foreground">
                  {c.origem} → {c.destino}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="text-xs">
                    R$ {Number(c.valor_final ?? 0).toFixed(2)}
                    {c.distancia_km ? ` · ${Number(c.distancia_km).toFixed(1)} km` : ""}
                  </div>
                  <AvaliacaoStars value={c.avaliacao_motorista} comentario={c.avaliacao_comentario} />
                </div>
                {c.avaliacao_comentario && (
                  <p className="text-xs italic text-muted-foreground border-l-2 pl-2 mt-1">
                    "{c.avaliacao_comentario}"
                  </p>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
