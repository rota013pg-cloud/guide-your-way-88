/**
 * Ponte com o plugin nativo RastreioPermissoes (Android).
 * Só tem efeito no app nativo; no navegador/PWA cai nos fallbacks.
 */
import { registerPlugin } from "@capacitor/core";
import { ehNativo } from "@/lib/gps-tracker";

export type StatusPermissoes = {
  /** always = "o tempo todo"; inuse = só com o app aberto; denied = sem localização. */
  localizacao: "always" | "inuse" | "denied";
  notificacao: "granted" | "denied";
  bateria: "ok" | "otimizada";
};

type RastreioPermissoesPlugin = {
  status(): Promise<StatusPermissoes>;
  pedirLocalizacao(): Promise<StatusPermissoes>;
  pedirNotificacao(): Promise<StatusPermissoes>;
  abrirAjustesLocalizacao(): Promise<void>;
  pedirBateria(): Promise<StatusPermissoes>;
};

const Plugin = registerPlugin<RastreioPermissoesPlugin>("RastreioPermissoes");

const PADRAO: StatusPermissoes = { localizacao: "denied", notificacao: "denied", bateria: "otimizada" };

export function rastreioCompleto(s: StatusPermissoes): boolean {
  return s.localizacao === "always" && s.notificacao === "granted" && s.bateria === "ok";
}

export async function statusPermissoes(): Promise<StatusPermissoes | null> {
  if (!ehNativo()) return null;
  try {
    return await Plugin.status();
  } catch {
    return null;
  }
}

export async function pedirLocalizacao(): Promise<StatusPermissoes> {
  if (!ehNativo()) return PADRAO;
  try {
    return await Plugin.pedirLocalizacao();
  } catch {
    return PADRAO;
  }
}

export async function pedirNotificacao(): Promise<StatusPermissoes> {
  if (!ehNativo()) return PADRAO;
  try {
    return await Plugin.pedirNotificacao();
  } catch {
    return PADRAO;
  }
}

export async function abrirAjustesLocalizacao(): Promise<void> {
  if (!ehNativo()) return;
  try {
    await Plugin.abrirAjustesLocalizacao();
  } catch {
    /* ignora */
  }
}

export async function pedirBateria(): Promise<StatusPermissoes> {
  if (!ehNativo()) return PADRAO;
  try {
    return await Plugin.pedirBateria();
  } catch {
    return PADRAO;
  }
}
