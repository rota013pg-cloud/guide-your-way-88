/**
 * Links oficiais das lojas para o app do CLIENTE Rota 013 e utilitário de
 * detecção de plataforma. Usado na página /instalar e no "gate" que mostra a
 * tela de download quando o site é aberto pelo navegador (fora do app nativo).
 *
 * Observação: o app iOS do cliente foi enviado para revisão da Apple. Enquanto
 * não é aprovado, o link da App Store pode retornar "não encontrado". Assim que
 * a Apple aprovar, o mesmo link passa a funcionar automaticamente.
 */
export const PLAY_STORE_CLIENTE =
  "https://play.google.com/store/apps/details?id=br.com.rota013.cliente";

export const APP_STORE_CLIENTE = "https://apps.apple.com/br/app/id6796205207";

export type PlataformaLoja = "ios" | "android" | "desktop";

/** Detecta a plataforma do navegador a partir do user agent. */
export function detectarPlataforma(): PlataformaLoja {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ se identifica como Mac com toque
    (/Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
