import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Pencil, Trash2, Search, Shield, Lock, Pause, Play } from "lucide-react";
import { listarMotoristas, excluirMotorista, pausarMotorista, retomarMotorista } from "@/lib/motoristas.functions";
import { MotoristaDialog } from "@/components/motorista-dialog";
import { MotoristaAdminPanel } from "@/components/motorista-admin-panel";
import { useRole } from "@/hooks/use-role";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/motoristas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Motoristas — Rota 013" }] }),
  component: MotoristasPage,
});

function MotoristasPage() {
  const qc = useQueryClient();
  const { isAdmin } = useRole();
  const listar = useServerFn(listarMotoristas);
  const excluir = useServerFn(excluirMotorista);
  const pausarFn = useServerFn(pausarMotorista);
  const retomarFn = useServerFn(retomarMotorista);
  const [filtro, setFiltro] = useState("");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [adminAlvo, setAdminAlvo] = useState<any>(null);

  const { data: motoristas = [], isLoading } = useQuery({
    queryKey: ["motoristas"],
    queryFn: () => listar(),
  });

  const delMut = useMutation({
    mutationFn: (codigo: string) => excluir({ data: { codigo } }),
    onSuccess: () => {
      toast.success("Motorista removido");
      qc.invalidateQueries({ queryKey: ["motoristas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pausarMut = useMutation({
    mutationFn: ({ codigo, motivo }: { codigo: string; motivo: string }) =>
      pausarFn({ data: { codigo, motivo } }),
    onSuccess: () => {
      toast.success("Motorista pausado — não receberá novas corridas");
      qc.invalidateQueries({ queryKey: ["motoristas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const retomarMut = useMutation({
    mutationFn: (codigo: string) => retomarFn({ data: { codigo } }),
    onSuccess: () => {
      toast.success("Motorista retomado — voltará a receber corridas");
      qc.invalidateQueries({ queryKey: ["motoristas"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = motoristas.filter((m: any) => {
    const q = filtro.toLowerCase();
    return !q || m.codigo?.toLowerCase().includes(q) || m.nome?.toLowerCase().includes(q) || m.telefone?.toLowerCase().includes(q);
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Motoristas</h1>
          <p className="text-sm text-muted-foreground">{motoristas.length} cadastrados</p>
        </div>
        <Button onClick={() => { setEditando(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo motorista
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar por código, nome ou telefone…"
          value={filtro}
          onChange={(e) => {
            let v = e.target.value;
            if (/^\d+$/.test(v)) v = "M" + v;
            setFiltro(v);
          }}
        />
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((m: any) => {
          const bloqueado = m.auth_status === "Bloqueado";
          const pausado = !!m.pausado;
          return (
            <Card key={m.codigo} className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={m.foto || undefined} />
                  <AvatarFallback>{m.nome?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">{m.codigo}</span>
                    {bloqueado ? (
                      <Badge variant="destructive" className="text-[10px]">
                        <Lock className="h-2.5 w-2.5 mr-1" /> Bloqueado
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px]"
                        style={{
                          color: m.status === "Online" ? "var(--success)" :
                                 m.status === "Em corrida" ? "var(--warning)" : undefined,
                        }}
                      >
                        ● {m.status}
                      </Badge>
                    )}
                    {pausado && (
                      <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600">
                        <Pause className="h-2.5 w-2.5 mr-1" /> Pausado
                      </Badge>
                    )}
                  </div>
                  <p className="font-semibold truncate">{m.nome}</p>
                  <p className="text-xs text-muted-foreground">{m.telefone || "Sem telefone"}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.moto || "—"} {m.placa ? `· ${m.placa}` : ""}
                  </p>
                </div>
              </div>

              {bloqueado && m.motivo_bloqueio && (
                <p className="text-xs text-destructive border-l-2 border-destructive pl-2">
                  Motivo: {m.motivo_bloqueio}
                </p>
              )}

              {pausado && m.pausado_motivo && (
                <p className="text-xs text-amber-600 border-l-2 border-amber-500 pl-2">
                  Pausa: {m.pausado_motivo}
                </p>
              )}

              <div className="flex gap-2 pt-2 border-t flex-wrap">
                <Button size="sm" variant="outline" className="flex-1 min-w-[90px]" onClick={() => { setEditando(m); setOpen(true); }}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                {pausado ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-emerald-600 border-emerald-500/40 hover:bg-emerald-500/10"
                    onClick={() => retomarMut.mutate(m.codigo)}
                    disabled={retomarMut.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" /> Retomar
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-600 border-amber-500/40 hover:bg-amber-500/10"
                    onClick={() => {
                      const motivo = prompt(`Pausar ${m.nome}?\n\nMotivo (opcional):`) ?? null;
                      if (motivo === null) return; // cancelou
                      pausarMut.mutate({ codigo: m.codigo, motivo: motivo.trim() });
                    }}
                    disabled={pausarMut.isPending}
                  >
                    <Pause className="h-3 w-3 mr-1" /> Pausar
                  </Button>
                )}
                {isAdmin && (
                  <Button size="sm" variant="outline" onClick={() => setAdminAlvo(m)}>
                    <Shield className="h-3 w-3 mr-1" /> Acesso
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => { if (confirm(`Remover ${m.nome}?`)) delMut.mutate(m.codigo); }}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <MotoristaDialog open={open} onOpenChange={setOpen} motorista={editando} />
      {adminAlvo && (
        <MotoristaAdminPanel
          open={!!adminAlvo}
          onOpenChange={(v) => !v && setAdminAlvo(null)}
          motorista={adminAlvo}
        />
      )}
    </div>
  );
}
