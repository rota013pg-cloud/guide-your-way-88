import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  APP_STORE_CLIENTE,
  PLAY_STORE_CLIENTE,
  detectarPlataforma,
  type PlataformaLoja,
} from "@/lib/lojas-app";

/**
 * "Gate suave": quando o site é aberto pelo NAVEGADOR (fora do app nativo),
 * mostra um convite para baixar o app nas lojas, com o botão do dispositivo
 * em destaque. Dentro do app nativo (Capacitor) não renderiza nada — o usuário
 * segue direto para o login/uso normal.
 *
 * O login pelo navegador continua funcionando logo abaixo deste aviso; por isso
 * é "suave" e não bloqueia ninguém enquanto o app iOS aguarda aprovação.
 */
export function AppDownloadPrompt() {
  const [mostrar, setMostrar] = useState(false);
  const [plataforma, setPlataforma] = useState<PlataformaLoja>("desktop");

  useEffect(() => {
    // Só aparece no navegador; dentro do app nativo fica oculto.
    if (Capacitor.isNativePlatform()) return;
    setPlataforma(detectarPlataforma());
    setMostrar(true);
  }, []);

  if (!mostrar) return null;

  const destacaApple = plataforma === "ios" || plataforma === "desktop";
  const destacaGoogle = plataforma === "android" || plataforma === "desktop";

  return (
    <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-card p-5">
      <p className="text-base font-semibold">Baixe o app do Rota 013</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Para a melhor experiência, use o aplicativo. Se preferir, você também pode
        continuar pelo navegador abaixo.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <LojaBotao loja="google" href={PLAY_STORE_CLIENTE} destaque={destacaGoogle} />
        <LojaBotao loja="apple" href={APP_STORE_CLIENTE} destaque={destacaApple} />
      </div>
    </div>
  );
}

function LojaBotao({
  loja,
  href,
  destaque,
}: {
  loja: "google" | "apple";
  href: string;
  destaque: boolean;
}) {
  const isApple = loja === "apple";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
        destaque
          ? "border-primary/60 bg-background hover:border-primary"
          : "border-border bg-background hover:border-primary/40"
      }`}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {isApple ? (
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 3.005-.836.97-2.198 1.72-3.336 1.63-.14-1.11.417-2.29 1.083-3.02.75-.83 2.06-1.45 3.13-1.5.03.28.233.55.233.885zM20.5 17.02c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.01-3.06-1.77-4.05-3.34C-.02 16.5-.34 11.13 1.42 8.28c1.02-1.65 2.63-2.62 4.14-2.62 1.54 0 2.5 1.02 3.77 1.02 1.23 0 1.98-1.02 3.76-1.02 1.34 0 2.76.73 3.77 1.99-3.31 1.81-2.77 6.54.64 7.37z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor">
            <path d="M3.6 2.4a1.3 1.3 0 0 0-.5 1.05v17.1c0 .43.2.82.53 1.05l9.9-9.6-9.93-9.6zm11.36 8.02L5.1 1.02l11.4 6.55-1.54 2.85zm3.3 1.9 2.28 1.31c.98.56.98 1.98 0 2.54l-2.32 1.33-1.74-3.22 1.78-2.96zm-2.83 3.28 1.55 2.87L5.1 22.98l9.86-9.4 1.47 2.9z" />
          </svg>
        )}
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-[10px] text-muted-foreground">
          {isApple ? "Baixe na" : "Disponível no"}
        </span>
        <span className="block text-sm font-semibold">
          {isApple ? "App Store" : "Google Play"}
        </span>
      </span>
    </a>
  );
}
