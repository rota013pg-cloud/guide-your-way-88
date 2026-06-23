import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, RotateCcw, Search, ArrowUpDown, Eye } from "lucide-react";
import {
  listarAuditLogs,
  listarAuditFiltros,
  exportarAuditLogsCsv,
} from "@/lib/audit.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit-log")({
  component: AuditLogPage,
});

type Filtros = {
  dataInicial: string;
  dataFinal: string;
  usuarioId: string;
  acao: string;
  modulo: string;
};

const initial: Filtros = {
  dataInicial: "",
  dataFinal: "",
  usuarioId: "",
  acao: "",
  modulo: "",
};

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function AuditLogPage() {
  const listar = useServerFn(listarAuditLogs);
  const carregarFiltros = useServerFn(listarAuditFiltros);
  const exportar = useServerFn(exportarAuditLogsCsv);

  const [filtros, setFiltros] = useState<Filtros>(initial);
  const [aplicados, setAplicados] = useState<Filtros>(initial);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [detalhe, setDetalhe] = useState<any | null>(null);

  const queryArgs = {
    ...aplicados,
    page,
    pageSize,
    sortDir,
  };

  const logsQuery = useQuery({
    queryKey: ["audit-logs", queryArgs],
    queryFn: () => listar({ data: queryArgs as any }),
  });

  const filtrosQuery = useQuery({
    queryKey: ["audit-logs-filtros"],
    queryFn: () => carregarFiltros(),
  });

  const aplicar = () => {
    setPage(1);
    setAplicados(filtros);
  };

  const limpar = () => {
    setFiltros(initial);
    setAplicados(initial);
    setPage(1);
  };

  const baixar = async () => {
    try {
      const { csv } = await exportar({ data: { ...aplicados, sortDir } as any });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      a.download = `audit-log-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao exportar");
    }
  };

  const total = logsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rows = logsQuery.data?.rows ?? [];

  if (logsQuery.error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-2">Log de Auditoria</h1>
        <p className="text-destructive">
          {logsQuery.error instanceof Error ? logsQuery.error.message : "Erro ao carregar"}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl md:text-2xl font-bold">Log de Auditoria</h1>
        <Button onClick={baixar} variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-3 rounded-lg border bg-card">
        <div>
          <Label className="text-xs">Data inicial</Label>
          <Input
            type="date"
            value={filtros.dataInicial}
            onChange={(e) => setFiltros((f) => ({ ...f, dataInicial: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Data final</Label>
          <Input
            type="date"
            value={filtros.dataFinal}
            onChange={(e) => setFiltros((f) => ({ ...f, dataFinal: e.target.value }))}
          />
        </div>
        <div>
          <Label className="text-xs">Usuário</Label>
          <Select
            value={filtros.usuarioId || "all"}
            onValueChange={(v) => setFiltros((f) => ({ ...f, usuarioId: v === "all" ? "" : v }))}
          >
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filtrosQuery.data?.usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Ação</Label>
          <Select
            value={filtros.acao || "all"}
            onValueChange={(v) => setFiltros((f) => ({ ...f, acao: v === "all" ? "" : v }))}
          >
            <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {filtrosQuery.data?.acoes.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Módulo</Label>
          <Select
            value={filtros.modulo || "all"}
            onValueChange={(v) => setFiltros((f) => ({ ...f, modulo: v === "all" ? "" : v }))}
          >
            <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {filtrosQuery.data?.modulos.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 lg:col-span-5 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={limpar}>
            <RotateCcw className="h-4 w-4 mr-2" /> Limpar
          </Button>
          <Button size="sm" onClick={aplicar}>
            <Search className="h-4 w-4 mr-2" /> Filtrar
          </Button>
        </div>
      </div>

      <div className="rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="inline-flex items-center gap-1 hover:text-foreground"
                  onClick={() => setSortDir((d) => (d === "desc" ? "asc" : "desc"))}
                >
                  Timestamp <ArrowUpDown className="h-3 w-3" />
                </button>
              </TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Entidade</TableHead>
              <TableHead className="text-right">Detalhes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logsQuery.isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
            )}
            {!logsQuery.isLoading && rows.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum registro</TableCell></TableRow>
            )}
            {rows.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{fmtDate(r.criado_em)}</TableCell>
                <TableCell className="text-sm">{r.usuario_nome ?? r.usuario_id ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{r.usuario_tipo ?? "—"}</Badge></TableCell>
                <TableCell className="text-sm">{r.acao}</TableCell>
                <TableCell className="text-sm">{r.modulo ?? "—"}</TableCell>
                <TableCell className="text-sm">{r.entidade_id ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {r.detalhes ? (
                    <Button variant="ghost" size="sm" onClick={() => setDetalhe(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{total} registro(s)</span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1 || logsQuery.isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >Anterior</Button>
          <span>Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages || logsQuery.isLoading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >Próxima</Button>
        </div>
      </div>

      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do registro</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-2 text-sm">
              <div><b>Timestamp:</b> {fmtDate(detalhe.criado_em)}</div>
              <div><b>Usuário:</b> {detalhe.usuario_nome ?? "—"} ({detalhe.usuario_id ?? "—"})</div>
              <div><b>Ação:</b> {detalhe.acao}</div>
              <div><b>Módulo:</b> {detalhe.modulo ?? "—"}</div>
              <div><b>Entidade:</b> {detalhe.entidade_id ?? "—"}</div>
              <div><b>IP:</b> {detalhe.ip ?? "—"}</div>
              <div><b>User-agent:</b> <span className="text-xs break-all">{detalhe.user_agent ?? "—"}</span></div>
              <div>
                <b>Detalhes:</b>
                <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto max-h-72">
{JSON.stringify(detalhe.detalhes, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
