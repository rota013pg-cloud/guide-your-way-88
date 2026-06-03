import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, Copy, Calculator, MapPin } from "lucide-react";
import { toast } from "sonner";
import {
  lerTarifas,
  salvarTarifas,
  TARIFAS_DEFAULT,
  type TarifasConfig,
} from "@/lib/tarifas.functions";
import {
  LOOKUP_DISTANCIAS,
  TABELAS_LABEL,
  bairrosDestino,
  bairrosOrigem,
  calcularValor,
  nomeBairro,
} from "@/lib/tarifas-calc";
import { lerConfig } from "@/lib/config.functions";

export const Route = createFileRoute("/_authenticated/tarifas")({
  ssr: false,
  head: () => ({ meta: [{ title: "Tarifas — Rota 013" }] }),
  component: TarifasPage,
});

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function TarifasPage() {
  const lerFn = useServerFn(lerTarifas);
  const salvarFn = useServerFn(salvarTarifas);
  const lerCfgFn = useServerFn(lerConfig);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tarifas"],
    queryFn: () => lerFn(),
  });
  const { data: cfgData } = useQuery({
    queryKey: ["app-config"],
    queryFn: () => lerCfgFn(),
  });

  const [form, setForm] = useState<TarifasConfig | null>(null);
  useEffect(() => {
    if (data?.tarifas && !form) setForm(data.tarifas);
  }, [data, form]);

  const salvar = useMutation({
    mutationFn: (v: TarifasConfig) => salvarFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarifas"] });
      toast.success("Tarifas salvas ✓");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !form) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando tarifas…
      </div>
    );
  }

  const updFixa = (id: string, patch: Partial<TarifasConfig["tabelasFixas"][number]>) =>
    setForm((f) =>
      f
        ? {
            ...f,
            tabelasFixas: f.tabelasFixas.map((t) => (t.id === id ? { ...t, ...patch } : t)),
          }
        : f,
    );
  const updHib = (patch: Partial<TarifasConfig["tabelaHibrida"]>) =>
    setForm((f) => (f ? { ...f, tabelaHibrida: { ...f.tabelaHibrida, ...patch } } : f));

  const restaurar = () => setForm(TARIFAS_DEFAULT);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Tarifas</h1>
          <p className="text-sm text-muted-foreground">
            Tabelas fixas, híbrida, simulador e distâncias.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={restaurar}>
            Restaurar padrão
          </Button>
          <Button onClick={() => salvar.mutate(form)} disabled={salvar.isPending}>
            {salvar.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Salvar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tabelas">
        <TabsList>
          <TabsTrigger value="tabelas">Tabelas</TabsTrigger>
          <TabsTrigger value="simulador">Simulador</TabsTrigger>
          <TabsTrigger value="distancias">Distâncias</TabsTrigger>
        </TabsList>

        {/* ─── TABELAS ───────────────────────────────────── */}
        <TabsContent value="tabelas" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {form.tabelasFixas.map((t) => (
              <Card key={t.id} className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <strong>{t.titulo}</strong>
                </div>
                <div>
                  <Label>Título</Label>
                  <Input
                    value={t.titulo}
                    onChange={(e) => updFixa(t.id, { titulo: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tarifa mínima (R$)</Label>
                    <Input
                      type="number"
                      step="0.10"
                      value={t.tarifaMinima}
                      onChange={(e) =>
                        updFixa(t.id, { tarifaMinima: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  <div>
                    <Label>Valor por km (R$)</Label>
                    <Input
                      type="number"
                      step="0.10"
                      value={t.valorKm}
                      onChange={(e) => updFixa(t.id, { valorKm: Number(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <Card className="p-4 space-y-3 border-dashed">
            <div className="flex items-center gap-2">
              <Calculator className="h-4 w-4 text-primary" />
              <strong>{form.tabelaHibrida.titulo}</strong>
            </div>
            <p className="text-xs text-muted-foreground">
              Usada quando a rota não está em nenhuma tabela fixa (cálculo via geocodificação).
            </p>
            <div>
              <Label>Título</Label>
              <Input
                value={form.tabelaHibrida.titulo}
                onChange={(e) => updHib({ titulo: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tarifa mínima (R$)</Label>
                <Input
                  type="number"
                  step="0.10"
                  value={form.tabelaHibrida.tarifaMinima}
                  onChange={(e) => updHib({ tarifaMinima: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Valor por km (R$)</Label>
                <Input
                  type="number"
                  step="0.10"
                  value={form.tabelaHibrida.valorKm}
                  onChange={(e) => updHib({ valorKm: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* ─── SIMULADOR ──────────────────────────────────── */}
        <TabsContent value="simulador" className="space-y-4">
          <Simulador
            tarifas={form}
            empresa={cfgData?.config?.empresa ?? "Rota 013"}
            whatsapp={cfgData?.config?.whatsappCentral ?? ""}
          />
          <SimuladorHibrida
            tarifas={form}
            empresa={cfgData?.config?.empresa ?? "Rota 013"}
            whatsapp={cfgData?.config?.whatsappCentral ?? ""}
          />
        </TabsContent>

        {/* ─── DISTÂNCIAS ─────────────────────────────────── */}
        <TabsContent value="distancias">
          <TabelaDistancias tarifas={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
function Simulador({
  tarifas,
  empresa,
  whatsapp,
}: {
  tarifas: TarifasConfig;
  empresa: string;
  whatsapp: string;
}) {
  const [tabId, setTabId] = useState("pgpg");
  const origens = useMemo(() => bairrosOrigem(tabId), [tabId]);
  const destinos = useMemo(() => bairrosDestino(tabId), [tabId]);
  const [origemKey, setOrigemKey] = useState("");
  const [destinoKey, setDestinoKey] = useState("");

  useEffect(() => {
    setOrigemKey("");
    setDestinoKey("");
  }, [tabId]);

  const res = origemKey && destinoKey ? calcularValor(tarifas, tabId, origemKey, destinoKey) : null;
  const hib = tarifas.tabelaHibrida;

  const textoWhats = useMemo(() => {
    if (!origemKey || !destinoKey) return "";
    const linhas = [
      `🛵 *${empresa}* — Cotação de corrida`,
      ``,
      `📍 Origem: *${nomeBairro(origemKey)}*`,
      `🎯 Destino: *${nomeBairro(destinoKey)}* (${TABELAS_LABEL[tabId]})`,
    ];
    if (res) {
      linhas.push(
        `📏 Distância: ${res.km.toFixed(1)} km`,
        `💰 Valor: *${fmtBRL(res.valor)}*`,
        ``,
        `_Tabela: ${res.tabela}_`,
      );
    } else {
      linhas.push(
        `⚠️ Rota fora das tabelas fixas`,
        `💰 Valor mínimo: ${fmtBRL(hib.tarifaMinima)}`,
        `   + ${fmtBRL(hib.valorKm)}/km (calculado na origem)`,
      );
    }
    return linhas.join("\n");
  }, [empresa, origemKey, destinoKey, tabId, res, hib]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(textoWhats);
      toast.success("Copiado para a área de transferência");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const abrirWhats = () => {
    const tel = (whatsapp || "").replace(/\D/g, "");
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(textoWhats)}`;
    window.open(url, "_blank");
  };

  return (
    <Card className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Calculator className="h-4 w-4 text-primary" />
        <strong>Simulador de corrida</strong>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>Cidade destino</Label>
          <Select value={tabId} onValueChange={setTabId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TABELAS_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bairro de origem (Praia Grande)</Label>
          <Select value={origemKey} onValueChange={setOrigemKey}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {origens.map((b) => (
                <SelectItem key={b} value={b}>
                  {nomeBairro(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Bairro de destino</Label>
          <Select value={destinoKey} onValueChange={setDestinoKey}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione…" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {destinos.map((b) => (
                <SelectItem key={b} value={b}>
                  {nomeBairro(b)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {origemKey && destinoKey && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          {res ? (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tabela</span>
                <span className="font-medium">{res.tabela}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Distância</span>
                <span className="font-medium">{res.km.toFixed(1)} km</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor/km</span>
                <span className="font-medium">{fmtBRL(res.valorKm)}/km</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t">
                <span className="font-semibold">Valor da corrida</span>
                <span className="font-bold text-primary">{fmtBRL(res.valor)}</span>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-amber-600 dark:text-amber-400">
                Rota fora das tabelas fixas — usar tabela híbrida.
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mínimo</span>
                <span className="font-medium">{fmtBRL(hib.tarifaMinima)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor/km</span>
                <span className="font-medium">{fmtBRL(hib.valorKm)}/km</span>
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" onClick={copiar}>
              <Copy className="h-4 w-4" /> Copiar texto
            </Button>
            {whatsapp && (
              <Button onClick={abrirWhats}>Enviar via WhatsApp</Button>
            )}
          </div>

          <pre className="text-xs whitespace-pre-wrap bg-background border rounded p-2 mt-2 font-sans">
            {textoWhats}
          </pre>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
function TabelaDistancias({ tarifas }: { tarifas: TarifasConfig }) {
  const [tabId, setTabId] = useState("pgpg");
  const [busca, setBusca] = useState("");

  const linhas = useMemo(() => {
    const tab = tarifas.tabelasFixas.find((t) => t.id === tabId);
    if (!tab) return [];
    const origens = LOOKUP_DISTANCIAS[tabId] ?? {};
    const out: { nO: string; nD: string; km: number; valor: number }[] = [];
    const q = busca.toLowerCase();
    for (const [oK, dests] of Object.entries(origens)) {
      for (const [dK, km] of Object.entries(dests)) {
        if (km == null) continue;
        const nO = nomeBairro(oK);
        const nD = nomeBairro(dK);
        if (q && !nO.toLowerCase().includes(q) && !nD.toLowerCase().includes(q)) continue;
        out.push({ nO, nD, km, valor: Math.max(km * tab.valorKm, tab.tarifaMinima) });
      }
    }
    out.sort((a, b) => a.nO.localeCompare(b.nO) || a.nD.localeCompare(b.nD));
    return out;
  }, [tarifas, tabId, busca]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex flex-wrap gap-2">
        <Select value={tabId} onValueChange={setTabId}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TABELAS_LABEL).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar bairro…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-sm text-muted-foreground self-center">
          {linhas.length} {linhas.length === 1 ? "rota" : "rotas"}
        </span>
      </div>

      <div className="border rounded-lg max-h-[60vh] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 bg-background">
            <TableRow>
              <TableHead>Origem</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Distância</TableHead>
              <TableHead>Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {linhas.map((l, i) => (
              <TableRow key={i}>
                <TableCell>{l.nO}</TableCell>
                <TableCell>{l.nD}</TableCell>
                <TableCell>{l.km.toFixed(1)} km</TableCell>
                <TableCell className="font-semibold">{fmtBRL(l.valor)}</TableCell>
              </TableRow>
            ))}
            {linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum resultado
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
