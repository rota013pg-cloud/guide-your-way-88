import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Eye, Key, Lock, Unlock, Trash2, Plus, ShieldAlert, ShieldCheck, User } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRole } from "@/hooks/use-role";
import {
  listarUsuarios, criarUsuario, alterarSenhaUsuario, alterarRoleUsuario,
  bloquearUsuario, desbloquearUsuario, excluirUsuario, verSenhaUsuario,
  atualizarFotoUsuario,
} from "@/lib/usuarios.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  head: () => ({ meta: [{ title: "Usuários — Rota 013 Beta" }] }),
  component: UsuariosPage,
});

function UsuariosPage() {
  const { isAdmin, loading } = useRole();
  const qc = useQueryClient();

  const listarFn = useServerFn(listarUsuarios);
  const criarFn = useServerFn(criarUsuario);
  const senhaFn = useServerFn(alterarSenhaUsuario);
  const bloqFn = useServerFn(bloquearUsuario);
  const desbloqFn = useServerFn(desbloquearUsuario);
  const excluirFn = useServerFn(excluirUsuario);
  const verSenhaFn = useServerFn(verSenhaUsuario);
  const roleFn = useServerFn(alterarRoleUsuario);
  const fotoFn = useServerFn(atualizarFotoUsuario);

  async function uploadFotoUsuario(userId: string, file: File): Promise<string | null> {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `usuarios-painel/${userId}/foto-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("motoristas-docs").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast.error(error.message); return null; }
    const { data: signed } = await supabase.storage.from("motoristas-docs").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
    return signed?.signedUrl ?? null;
  }

  const { data: usuarios = [] } = useQuery({
    queryKey: ["usuarios-painel"],
    queryFn: () => listarFn(),
    enabled: isAdmin,
  });

  const [novo, setNovo] = useState<{ nome: string; email: string; login: string; senha: string; role: "admin" | "operador" }>({ nome: "", email: "", login: "", senha: "", role: "operador" });
  const [openNovo, setOpenNovo] = useState(false);
  const [senhaDialog, setSenhaDialog] = useState<{ userId: string; nome: string } | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [bloqDialog, setBloqDialog] = useState<{ userId: string; nome: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [senhaRevelada, setSenhaRevelada] = useState<{ nome: string; senha: string | null } | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["usuarios-painel"] });

  const criarMut = useMutation({
    mutationFn: () => criarFn({ data: novo }),
    onSuccess: () => {
      toast.success("Usuário criado");
      setOpenNovo(false);
      setNovo({ nome: "", email: "", login: "", senha: "", role: "operador" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const senhaMut = useMutation({
    mutationFn: () => senhaFn({ data: { userId: senhaDialog!.userId, senha: novaSenha } }),
    onSuccess: () => {
      toast.success("Senha alterada");
      setSenhaDialog(null);
      setNovaSenha("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bloqMut = useMutation({
    mutationFn: () => bloqFn({ data: { userId: bloqDialog!.userId, motivo } }),
    onSuccess: () => { toast.success("Usuário bloqueado"); setBloqDialog(null); setMotivo(""); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-6">
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 flex gap-3 items-start">
          <ShieldAlert className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">Acesso restrito a administradores.</div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold">Usuários do painel</h1>
          <p className="text-sm text-muted-foreground">{usuarios.length} cadastrados</p>
        </div>
        <Button onClick={() => setOpenNovo(true)}><Plus className="h-4 w-4 mr-1" /> Novo usuário</Button>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Login</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="hidden md:table-cell">E-mail</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
            )}
            {usuarios.map((u: any) => (
              <TableRow key={u.user_id}>
                <TableCell className="font-mono text-xs">{u.login}</TableCell>
                <TableCell>{u.nome}</TableCell>
                <TableCell className="hidden md:table-cell text-sm">{u.email}</TableCell>
                <TableCell>
                  <Select
                    value={u.role}
                    onValueChange={async (v) => {
                      try {
                        await roleFn({ data: { userId: u.user_id, role: v as any } });
                        toast.success("Perfil atualizado");
                        refresh();
                      } catch (e: any) { toast.error(e.message); }
                    }}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Admin</span>
                      </SelectItem>
                      <SelectItem value="operador">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> Operador</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Badge variant={u.status === "Bloqueado" ? "destructive" : "secondary"}>{u.status}</Badge>
                  {u.motivo_bloqueio && <div className="text-xs text-muted-foreground mt-0.5">{u.motivo_bloqueio}</div>}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1 flex-wrap">
                    <Button size="icon" variant="ghost" title="Ver senha" onClick={async () => {
                      const r = await verSenhaFn({ data: { userId: u.user_id } });
                      setSenhaRevelada({ nome: u.nome, senha: r.senha });
                    }}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" title="Alterar senha" onClick={() => setSenhaDialog({ userId: u.user_id, nome: u.nome })}>
                      <Key className="h-4 w-4" />
                    </Button>
                    {u.status === "Bloqueado" ? (
                      <Button size="icon" variant="ghost" title="Liberar" onClick={async () => {
                        await desbloqFn({ data: { userId: u.user_id } }); toast.success("Liberado"); refresh();
                      }}><Unlock className="h-4 w-4" /></Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Bloquear" onClick={() => setBloqDialog({ userId: u.user_id, nome: u.nome })}>
                        <Lock className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="Excluir" onClick={async () => {
                      if (!confirm(`Excluir ${u.nome}?`)) return;
                      await excluirFn({ data: { userId: u.user_id } }); toast.success("Excluído"); refresh();
                    }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Novo */}
      <Dialog open={openNovo} onOpenChange={setOpenNovo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
            <DialogDescription>Login é convertido em e-mail interno para autenticação.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5"><Label>Nome</Label>
              <Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>E-mail de contato</Label>
              <Input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></div>
            <div className="grid gap-1.5"><Label>Login</Label>
              <Input value={novo.login} onChange={(e) => setNovo({ ...novo, login: e.target.value.toLowerCase() })} placeholder="ex: joao.silva" /></div>
            <div className="grid gap-1.5"><Label>Senha</Label>
              <Input type="text" value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} placeholder="mín. 6 caracteres" /></div>
            <div className="grid gap-1.5"><Label>Perfil</Label>
              <Select value={novo.role} onValueChange={(v) => setNovo({ ...novo, role: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — acesso total (configurações, tarifas, usuários)</SelectItem>
                  <SelectItem value="operador">Operador — operação diária (corridas, clientes, mural, financeiro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNovo(false)}>Cancelar</Button>
            <Button onClick={() => criarMut.mutate()} disabled={criarMut.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Senha revelada */}
      <Dialog open={!!senhaRevelada} onOpenChange={(v) => !v && setSenhaRevelada(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Senha de {senhaRevelada?.nome}</DialogTitle>
          </DialogHeader>
          <div className="font-mono text-2xl text-center py-4">{senhaRevelada?.senha ?? "—"}</div>
          <DialogFooter><Button onClick={() => setSenhaRevelada(null)}>OK</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alterar senha */}
      <Dialog open={!!senhaDialog} onOpenChange={(v) => !v && setSenhaDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Nova senha de {senhaDialog?.nome}</DialogTitle></DialogHeader>
          <Input value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} placeholder="Nova senha" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSenhaDialog(null)}>Cancelar</Button>
            <Button onClick={() => senhaMut.mutate()} disabled={senhaMut.isPending || novaSenha.length < 6}>Alterar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloquear */}
      <Dialog open={!!bloqDialog} onOpenChange={(v) => !v && setBloqDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Bloquear {bloqDialog?.nome}</DialogTitle></DialogHeader>
          <Label>Motivo</Label>
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBloqDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => bloqMut.mutate()} disabled={bloqMut.isPending || !motivo.trim()}>Bloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
