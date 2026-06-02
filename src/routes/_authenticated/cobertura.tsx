import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ExternalLink, FileWarning } from "lucide-react";

type Metric = { total: number; covered: number; skipped: number; pct: number };
type FileEntry = {
  lines: Metric;
  statements: Metric;
  functions: Metric;
  branches: Metric;
};
type Summary = Record<string, FileEntry> & { total: FileEntry };

type SortKey = "file" | "statements" | "branches" | "functions" | "lines";

export const Route = createFileRoute("/_authenticated/cobertura")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cobertura de Testes — Rota 013 Beta" }] }),
  component: CoveragePage,
});

function pctColor(pct: number) {
  if (pct >= 80) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-destructive";
}

function relPath(full: string) {
  const i = full.indexOf("/src/");
  return i >= 0 ? full.slice(i + 1) : full;
}

function htmlReportHref(full: string) {
  // istanbul HTML uses the relative path with .html appended
  const rel = relPath(full);
  return `/coverage-report/${rel}.html`;
}

function CoveragePage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lines");
  const [asc, setAsc] = useState(true);

  useEffect(() => {
    fetch("/coverage-summary.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data).filter(([k]) => k !== "total") as [
      string,
      FileEntry,
    ][];
    const filtered = entries.filter(([k]) =>
      relPath(k).toLowerCase().includes(query.toLowerCase()),
    );
    filtered.sort(([ak, av], [bk, bv]) => {
      let cmp = 0;
      if (sortKey === "file") cmp = relPath(ak).localeCompare(relPath(bk));
      else cmp = av[sortKey].pct - bv[sortKey].pct;
      return asc ? cmp : -cmp;
    });
    return filtered;
  }, [data, query, sortKey, asc]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setAsc(!asc);
    else {
      setSortKey(key);
      setAsc(true);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Cobertura de Testes</h1>
          <p className="text-sm text-muted-foreground">
            Resumo por arquivo. Ordene pelas colunas para encontrar os trechos com menor cobertura.
          </p>
        </div>
        <Button asChild variant="outline">
          <a href="/coverage-report/index.html" target="_blank" rel="noreferrer">
            Relatório HTML completo <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>

      {error && (
        <Card className="p-4 flex items-start gap-3 border-destructive/50">
          <FileWarning className="h-5 w-5 text-destructive mt-0.5" />
          <div className="text-sm">
            <p className="font-medium">Não foi possível carregar a cobertura.</p>
            <p className="text-muted-foreground">
              Rode <code className="px-1 bg-muted rounded">bun run test:coverage</code> e copie{" "}
              <code className="px-1 bg-muted rounded">coverage/</code> para{" "}
              <code className="px-1 bg-muted rounded">public/coverage-report/</code>.
            </p>
            <p className="text-muted-foreground mt-1">Detalhe: {error}</p>
          </div>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["statements", "branches", "functions", "lines"] as const).map((k) => (
              <Card key={k} className="p-4">
                <p className="text-xs uppercase text-muted-foreground">{k}</p>
                <p className={`text-2xl font-bold ${pctColor(data.total[k].pct)}`}>
                  {data.total[k].pct.toFixed(2)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.total[k].covered}/{data.total[k].total}
                </p>
              </Card>
            ))}
          </div>

          <Input
            placeholder="Filtrar por caminho do arquivo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="max-w-md"
          />

          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <Th label="Arquivo" k="file" sortKey={sortKey} asc={asc} onSort={toggleSort} />
                  <Th label="Stmts" k="statements" sortKey={sortKey} asc={asc} onSort={toggleSort} align="right" />
                  <Th label="Branches" k="branches" sortKey={sortKey} asc={asc} onSort={toggleSort} align="right" />
                  <Th label="Funcs" k="functions" sortKey={sortKey} asc={asc} onSort={toggleSort} align="right" />
                  <Th label="Lines" k="lines" sortKey={sortKey} asc={asc} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {rows.map(([path, e]) => (
                  <tr key={path} className="border-t hover:bg-muted/30">
                    <td className="p-2">
                      <a
                        href={htmlReportHref(path)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline font-mono text-xs"
                      >
                        {relPath(path)}
                      </a>
                    </td>
                    <Td m={e.statements} />
                    <Td m={e.branches} />
                    <Td m={e.functions} />
                    <Td m={e.lines} />
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-muted-foreground">
                      Nenhum arquivo corresponde ao filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  asc,
  onSort,
  align,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  asc: boolean;
  onSort: (k: SortKey) => void;
  align?: "right";
}) {
  const active = sortKey === k;
  return (
    <th className={`p-2 ${align === "right" ? "text-right" : ""}`}>
      <button
        onClick={() => onSort(k)}
        className="inline-flex items-center gap-1 font-medium hover:text-primary"
      >
        {label}
        <ArrowUpDown className={`h-3 w-3 ${active ? "text-primary" : "opacity-40"}`} />
        {active && <span className="text-xs">{asc ? "↑" : "↓"}</span>}
      </button>
    </th>
  );
}

function Td({ m }: { m: Metric }) {
  return (
    <td className="p-2 text-right">
      <span className={`font-mono ${pctColor(m.pct)}`}>{m.pct.toFixed(1)}%</span>
      <span className="text-xs text-muted-foreground ml-1">
        ({m.covered}/{m.total})
      </span>
    </td>
  );
}
