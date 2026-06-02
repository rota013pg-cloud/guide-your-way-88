import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Eye, EyeOff, Copy, Lock, Unlock, KeyRound, Smartphone } from "lucide-react";
import {
  adminVerSenha,
  adminAlterarSenha,
  adminBloquearMotorista,
  adminDesbloquearMotorista,
  adminResetarDispositivoMotorista,
} from "@/lib/motoristas.functions";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  motorista: {
    codigo: string;
    nome: string;
    auth_status?: string;
    motivo_bloqueio?: string | null;
  };
};

export function MotoristaAdminPanel({ open, onOpenChange, motorista }: Props) {
  const qc = useQueryClient();
  const verSenhaFn = useServerFn(adminVerSenha);
  const alterarSenhaFn = useServerFn(adminAlterarSenha);
  const bloquearFn = useServerFn(adminBloquearMotorista);
  const desbloquearFn = useServerFn(adminDesbloquearMotorista);
  const resetarDispositivoFn = useServerFn(adminResetarDispositivoMotorista);

  const [senha, setSenha] = useState<string | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const bloqueado = motorista.auth_status === "Bloqueado";

  const verMut = useMutation({
    mutationFn: () => verSenhaFn({ data: { codigo: motorista.codigo } }),
    onSuccess: (r: any) => {
      setSenha(r.senha);
      setMostrarSenha(true);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const altMut = useMutation({
    mutationFn: () => alterarSenhaFn({ data: { codigo: motorista.codigo, novaSenha } }),
    onSuccess: () => {
      toast.success("Senha alterada. Sessões ativas foram encerradas.");
      setNovaSenha("");
      setSenha(novaSenha);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const blockMut = useMutation({
    mutationFn: () =>
      bloqueado
        ? desbloquearFn({ data: { codigo: motorista.codigo } })
        : bloquearFn({ data: { codigo: motorista.codigo, motivo } }),
    onSuccess: () => {
      toast.success(bloqueado ? "Acesso liberado" : "Motorista bloqueado");
      qc.invalidateQueries({ queryKey: ["motoristas"] });
      setMotivo("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerenciar acesso — {motorista.codigo} {motorista.nome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {bloqueado && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <strong>Bloqueado.</strong> Motivo: {motorista.motivo_bloqueio || "—"}
            </div>
          )}

          {/* Ver senha */}
          <div className="space-y-2">
            <Label className="text-xs">Senha do app</Label>
            {senha ? (
              <div className="flex items-center gap-2">
                <Input value={mostrarSenha ? senha : "•".repeat(senha.length)} readOnly />
                <Button size="icon" variant="ghost" onClick={() => setMostrarSenha((v) => !v)}>
                  {mostrarSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(senha);
                    toast.success("Senha copiada");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => verMut.mutate()} disabled={verMut.isPending}>
                <Eye className="h-3 w-3 mr-2" /> Visualizar senha
              </Button>
            )}
          </div>

          {/* Alterar senha */}
          <div className="space-y-2">
            <Label className="text-xs">Alterar senha</Label>
            <div className="flex gap-2">
              <Input
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Nova senha (mín 4 caracteres)"
              />
              <Button
                onClick={() => altMut.mutate()}
                disabled={altMut.isPending || novaSenha.length < 4}
              >
                <KeyRound className="h-3 w-3 mr-2" /> Salvar
              </Button>
            </div>
          </div>

          {/* Bloquear / Desbloquear */}
          <div className="space-y-2 border-t pt-3">
            {bloqueado ? (
              <Button
                variant="default"
                className="w-full"
                onClick={() => blockMut.mutate()}
                disabled={blockMut.isPending}
              >
                <Unlock className="h-4 w-4 mr-2" /> Desbloquear acesso
              </Button>
            ) : (
              <>
                <Label className="text-xs">Motivo do bloqueio</Label>
                <Textarea
                  rows={2}
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: não compareceu, problema com documentação…"
                />
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => blockMut.mutate()}
                  disabled={blockMut.isPending || motivo.trim().length === 0}
                >
                  <Lock className="h-4 w-4 mr-2" /> Bloquear acesso
                </Button>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
