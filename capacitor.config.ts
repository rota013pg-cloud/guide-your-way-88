import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Configuração base do Capacitor para empacotar o site como app nativo.
 * Os PWAs (motociclista/cliente) continuam funcionando normalmente —
 * esta config só é usada quando você roda `npx cap add ios/android` localmente.
 *
 * Para gerar dois apps separados, troque `appId` e `appName` antes de
 * `npx cap add`, ou crie dois arquivos de config e use --config.
 *
 *   Motociclista: br.com.rota013.motociclista
 *   Cliente:      br.com.rota013.cliente
 */
const config: CapacitorConfig = {
  appId: "br.com.rota013.motociclista",
  appName: "Rota 013 Motociclista",
  webDir: ".output/public",
  server: {
    // Carrega o site publicado. Trocar para o domínio final em produção.
    url: "https://rota013.com.br",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
