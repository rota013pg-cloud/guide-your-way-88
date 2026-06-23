import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const filtrosSchema = z.object({
  dataInicial: z.string().optional().nullable(),
  dataFinal: z.string().optional().nullable(),
  usuarioId: z.string().optional().nullable(),
  acao: z.string().optional().nullable(),
  modulo: z.string().optional().nullable(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});

type Filtros = z.infer<typeof filtrosSchema>;

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acesso restrito a administradores");
}

function aplicarFiltros(q: any, f: Filtros) {
  if (f.dataInicial) q = q.gte("criado_em", new Date(f.dataInicial).toISOString());
  if (f.dataFinal) {
    const fim = new Date(f.dataFinal);
    fim.setHours(23, 59, 59, 999);
    q = q.lte("criado_em", fim.toISOString());
  }
  if (f.usuarioId) q = q.eq("usuario_id", f.usuarioId);
  if (f.acao) q = q.eq("acao", f.acao);
  if (f.modulo) q = q.eq("modulo", f.modulo);
  return q;
}

export const listarAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtrosSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const from = (data.page - 1) * data.pageSize;
    const to = from + data.pageSize - 1;
    let q = context.supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("criado_em", { ascending: data.sortDir === "asc" })
      .range(from, to);
    q = aplicarFiltros(q, data);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const listarAuditFiltros = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select("acao, modulo, usuario_id, usuario_nome")
      .order("criado_em", { ascending: false })
      .limit(2000);
    if (error) throw new Error(error.message);
    const acoes = new Set<string>();
    const modulos = new Set<string>();
    const usuariosMap = new Map<string, string>();
    for (const r of data ?? []) {
      if (r.acao) acoes.add(r.acao);
      if (r.modulo) modulos.add(r.modulo);
      if (r.usuario_id) usuariosMap.set(r.usuario_id, r.usuario_nome ?? r.usuario_id);
    }
    return {
      acoes: Array.from(acoes).sort(),
      modulos: Array.from(modulos).sort(),
      usuarios: Array.from(usuariosMap.entries())
        .map(([id, nome]) => ({ id, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    };
  });

const csvEscape = (v: unknown) => {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const exportarAuditLogsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => filtrosSchema.omit({ page: true, pageSize: true }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let q = context.supabase
      .from("audit_logs")
      .select("*")
      .order("criado_em", { ascending: data.sortDir === "asc" })
      .limit(10000);
    q = aplicarFiltros(q, { ...data, page: 1, pageSize: 10000 } as Filtros);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const header = [
      "timestamp",
      "usuario_id",
      "usuario_nome",
      "usuario_tipo",
      "acao",
      "modulo",
      "entidade_id",
      "detalhes",
      "ip",
    ];
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push(
        [
          new Date(r.criado_em).toISOString(),
          r.usuario_id,
          r.usuario_nome,
          r.usuario_tipo,
          r.acao,
          r.modulo,
          r.entidade_id,
          r.detalhes,
          r.ip,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    return { csv: lines.join("\n"), total: rows?.length ?? 0 };
  });
