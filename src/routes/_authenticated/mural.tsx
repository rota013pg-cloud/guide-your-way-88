import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Pin, PinOff, Trash2, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  listarRecados, criarRecado, marcarLido, fixarRecado, excluirRecado,
} from "@/lib/mural.functions";

export const Route = createFileRoute("/_authenticated/mural")({
  ssr: false,
  head: () => ({ meta: [{ title: "Mural — Rota 013" }] }),
  component: MuralPage,
});

function MuralPage() {
  const qc = useQueryClient();
  const listarFn = useServerFn(listarRecados);
  const criarFn = useServerFn(criarRecado);
  const lidoFn = useServerFn(marcarLido);
  const fixarFn = useServerFn(fixarRecado);
  const excluirFn = useServerFn(excluirRecado);

  const [meuId, setMeuId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMeuId(data.user?.id ?? null));
  }, []);

  const { data: recados = [] } = useQuery({
    queryKey: ["mural-recados"],
    queryFn: () => listarFn(),
    refetchInterval: 15000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("mural")
      .on("postgres_changes", { event: "*", schema: "public", table: "mural_recados" }, () => {
        qc.invalidateQueries({ queryKey: ["mural-recados"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const [texto, setTexto] = useState("");
  const [fixado, setFixado] = useState(false);

  const criarMut = useMutation({
    mutationFn: () => criarFn({ data: { texto, fixado } }),
    onSuccess: () => { setTexto(""); setFixado(false); toast.success("Recado publicado"); qc.invalidateQueries({ queryKey: ["mural-recados"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Mural de recados</h1>
        <p className="text-sm text-muted-foreground">Anotações entre operadores e turnos.</p>
      </div>

      <Card className="p-4 space-y-3">
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Escreva um recado para os colegas…" />
        <div className="flex items-center justify-between flex-wrap gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={fixado} onChange={(e) => setFixado(e.target.checked)} />
            Fixar no topo
          </label>
          <Button onClick={() => criarMut.mutate()} disabled={!texto.trim() || criarMut.isPending}>
            <Plus className="h-4 w-4 mr-1" /> Publicar
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {recados.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum recado ainda.</p>
        )}
        {recados.map((r: any) => {
          const lidos: string[] = Array.isArray(r.lido_por) ? r.lido_por : [];
          const jaLi = meuId && lidos.includes(meuId);
          const sou = meuId === r.autor_user_id;
          return (
            <Card key={r.id} className={`p-4 space-y-2 ${r.fixado ? "border-primary/50 bg-primary/5" : ""}`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold">{r.autor_nome}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.criado_em).toLocaleString("pt-BR")}
                  </span>
                  {r.fixado && <Badge variant="outline"><Pin className="h-3 w-3 mr-1" />Fixado</Badge>}
                </div>
                <div className="flex gap-1">
                  {!jaLi && (
                    <Button size="sm" variant="ghost" onClick={async () => { await lidoFn({ data: { id: r.id } }); qc.invalidateQueries({ queryKey: ["mural-recados"] }); }}>
                      <Check className="h-4 w-4 mr-1" /> Marcar lido
                    </Button>
                  )}
                  {sou && (
                    <Button size="icon" variant="ghost" title={r.fixado ? "Desafixar" : "Fixar"} onClick={async () => {
                      await fixarFn({ data: { id: r.id, fixado: !r.fixado } });
                      qc.invalidateQueries({ queryKey: ["mural-recados"] });
                    }}>
                      {r.fixado ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    </Button>
                  )}
                  {sou && (
                    <Button size="icon" variant="ghost" title="Excluir" onClick={async () => {
                      if (!confirm("Excluir recado?")) return;
                      await excluirFn({ data: { id: r.id } });
                      qc.invalidateQueries({ queryKey: ["mural-recados"] });
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.texto}</p>
              <div className="text-xs text-muted-foreground">Lido por {lidos.length}</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
