/**
 * Preferência do operador para os alertas sonoros do painel (motociclista
 * online e nova corrida). Guardada no navegador do operador (localStorage).
 * Padrão: ligado.
 */
const KEY = "rota013_alertas_som";
const EVENTO = "rota013-alertas-som";

export function getAlertasSom(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setAlertasSom(ativo: boolean): void {
  try {
    localStorage.setItem(KEY, ativo ? "1" : "0");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENTO, { detail: ativo }));
  }
}

export const ALERTAS_SOM_EVENTO = EVENTO;
