import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, Search, Bike, History } from "lucide-react";
import { listarClientes, excluirCliente } from "@/lib/clientes.functions";
import { ClienteDialog } from "@/components/cliente-dialog";
import { NovaCorridaDialog, type ClientePrefill } from "@/components/nova-corrida-dialog";
import { OcorrenciasDialog } from "@/components/ocorrencias-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes")({
  ssr: false,
  head: () => ({ meta: [{ title: "Clientes — Rota 013" }] }),
  component: ClientesPage,
});

function ClientesPage() {
  const qc = useQueryClient();
  const listar = useServerFn(listarClientes);
  const excluir = useServerFn(excluirCliente);
  const [filtro, setFiltro] = useState("");
  const [open, setOpen] = useState(false);
  const [editando, setEditando] = useState<any>(null);

  const [corridaOpen, setCorridaOpen] = useState(false);
  const [corridaPrefill, setCorridaPrefill] = useState<ClientePrefill | null>(null);
  const [historicoAlvo, setHistoricoAlvo] = useState<{ codigo: string; nome: string } | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: () => listar(),
  });

  const delMut = useMutation({
    mutationFn: (codigo: string) => excluir({ data: { codigo } }),
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtrados = clientes.filter((c: any) => {
    const q = filtro.toLowerCase();
    return (
      !q ||
      c.codigo?.toLowerCase().includes(q) ||
      c.nome?.toLowerCase().includes(q) ||
      c.telefone?.toLowerCase().includes(q)
    );
  });

  const novaCorrida = (c: any) => {
    setCorridaPrefill({ codigo: c.codigo, nome: c.nome, telefone: c.telefone });
    setCorridaOpen(true);
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-sm text-muted-foreground">{clientes.length} cadastrados</p>
        </div>
        <Button onClick={() => { setEditando(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Novo cliente
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
            if (/^\d+$/.test(v)) v = "C" + v;
            setFiltro(v);
          }}
        />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead className="hidden md:table-cell">Endereço</TableHead>
              <TableHead className="hidden lg:table-cell">Indicação</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!isLoading && filtrados.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum cliente encontrado.</TableCell></TableRow>
            )}
            {filtrados.map((c: any) => (
              <TableRow key={c.codigo}>
                <TableCell className="font-mono text-xs">{c.codigo}</TableCell>
                <TableCell className="font-medium">{c.nome}</TableCell>
                <TableCell>{c.telefone || "—"}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[260px]">
                  {c.endereco || "—"}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm">{c.indicacao || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="icon" variant="ghost" title="Nova corrida" onClick={() => novaCorrida(c)}>
                    <Bike className="h-4 w-4 text-primary" />
                  </Button>
                  <Button size="icon" variant="ghost" title="Histórico" onClick={() => setHistoricoAlvo({ codigo: c.codigo, nome: c.nome })}>
                    <History className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { setEditando(c); setOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Excluir ${c.nome}?`)) delMut.mutate(c.codigo);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <ClienteDialog open={open} onOpenChange={setOpen} cliente={editando} />
      <NovaCorridaDialog
        open={corridaOpen}
        onOpenChange={setCorridaOpen}
        clientePrefill={corridaPrefill}
      />
      {historicoAlvo && (
        <OcorrenciasDialog
          open={!!historicoAlvo}
          onOpenChange={(v) => { if (!v) setHistoricoAlvo(null); }}
          tipoPessoa="cliente"
          pessoaCodigo={historicoAlvo.codigo}
          pessoaNome={historicoAlvo.nome}
        />
      )}
    </div>
  );
}
