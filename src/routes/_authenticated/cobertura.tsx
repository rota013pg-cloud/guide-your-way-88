import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, ChevronRight, ExternalLink, FileWarning, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function parseLcov(text: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  let file = "";
  let lines: number[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("SF:")) {
      file = line.slice(3);
      lines = [];
    } else if (line.startsWith("DA:")) {
      const [n, hits] = line.slice(3).split(",");
      if (Number(hits) === 0) lines.push(Number(n));
    } else if (line === "end_of_record" && file) {
      out[file] = lines.sort((a, b) => a - b);
      file = "";
    }
  }
  return out;
}

function toRanges(nums: number[]): string[] {
  if (nums.length === 0) return [];
  const ranges: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] === prev + 1) {
      prev = nums[i];
    } else {
      ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = prev = nums[i];
    }
  }
  ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
  return ranges;
}

function CoveragePage() {
  const [data, setData] = useState<Summary | null>(null);
  const [uncovered, setUncovered] = useState<Record<string, number[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lines");
  const [asc, setAsc] = useState(true);
  const [selectedFile, setSelectedFile] = useState<string>("");

  useEffect(() => {
    fetch("/coverage-summary.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(String(e)));
    fetch("/coverage-lcov.info")
      .then((r) => (r.ok ? r.text() : ""))
      .then((t) => t && setUncovered(parseLcov(t)))
      .catch(() => {});
  }, []);

  function toggleRow(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const filesWithUncovered = useMemo(() => {
    return Object.keys(uncovered)
      .filter((k) => uncovered[k].length > 0)
      .sort((a, b) => a.localeCompare(b));
  }, [uncovered]);

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
                {rows.map(([path, e]) => {
                  const rel = relPath(path);
                  const miss = uncovered[rel] ?? [];
                  const isOpen = expanded.has(path);
                  return (
                    <Fragment key={path}>
                      <tr className="border-t hover:bg-muted/30">
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleRow(path)}
                              disabled={miss.length === 0}
                              className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                              aria-label={isOpen ? "Recolher" : "Expandir"}
                            >
                              {isOpen ? (
                                <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronRight className="h-3 w-3" />
                              )}
                            </button>
                            <a
                              href={htmlReportHref(path)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:underline font-mono text-xs"
                            >
                              {rel}
                            </a>
                            {miss.length > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                · {miss.length} linhas
                              </span>
                            )}
                          </div>
                        </td>
                        <Td m={e.statements} />
                        <Td m={e.branches} />
                        <Td m={e.functions} />
                        <Td m={e.lines} />
                      </tr>
                      {isOpen && miss.length > 0 && (
                        <tr className="border-t bg-muted/20">
                          <td colSpan={5} className="p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Linhas não cobertas:
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {toRanges(miss).map((r) => (
                                <span
                                  key={r}
                                  className="font-mono text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
                                >
                                  {r}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
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
