/**
 * Cálculo de tarifa — client-safe (sem imports de server).
 */
import lookupRaw from "@/data/distancias-lookup.json";
import nomesRaw from "@/data/nomes-bairros.json";
import type { TarifasConfig } from "@/lib/tarifas.functions";

type Lookup = Record<string, Record<string, Record<string, number | null>>>;
export const LOOKUP_DISTANCIAS = lookupRaw as Lookup;
export const NOMES_BAIRROS = nomesRaw as Record<string, string>;

export type ResultadoCalculo = {
  tabela: string;
  tabelaId: string;
  km: number;
  valorKm: number;
  tarifaMinima: number;
  valor: number;
  fonte: "tabela" | "hibrida";
};

export function calcularValor(
  tarifas: TarifasConfig,
  tabId: string,
  origemKey: string,
  destinoKey: string,
): ResultadoCalculo | null {
  const tab = tarifas.tabelasFixas.find((t) => t.id === tabId);
  if (!tab) return null;
  const km = LOOKUP_DISTANCIAS?.[tabId]?.[origemKey]?.[destinoKey];
  if (km == null || km === 0) return null;
  const valor = Math.max(km * tab.valorKm, tab.tarifaMinima);
  return {
    tabela: tab.titulo,
    tabelaId: tab.id,
    km,
    valorKm: tab.valorKm,
    tarifaMinima: tab.tarifaMinima,
    valor,
    fonte: "tabela",
  };
}

export function nomeBairro(key: string): string {
  return NOMES_BAIRROS[key] ?? key;
}

export function bairrosOrigem(tabId: string): string[] {
  return Object.keys(LOOKUP_DISTANCIAS[tabId] ?? {});
}

export function bairrosDestino(tabId: string): string[] {
  const origens = LOOKUP_DISTANCIAS[tabId] ?? {};
  const primeira = Object.keys(origens)[0];
  return primeira ? Object.keys(origens[primeira]) : [];
}

export const TABELAS_LABEL: Record<string, string> = {
  pgpg: "Praia Grande",
  pgsv: "São Vicente",
  pgsantos: "Santos",
  pgcubatao: "Cubatão",
};
