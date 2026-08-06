import { useEffect, useState } from "react";
import {
  APP_STORE_CLIENTE,
  PLAY_STORE_CLIENTE,
  detectarPlataforma,
  type PlataformaLoja,
} from "@/lib/lojas-app";
import { LogoRota013 } from "@/components/logo-rota013";

/**
 * "Gate" da página de login do cliente quando aberta pelo NAVEGADOR.
 * O acesso do cliente é feito pelo APP. Então:
 *  - Android/iPhone: leva para a loja certa (a loja mostra "Abrir" se o app já
 *    estiver instalado, ou "Instalar" caso contrário). Redireciona sozinho.
 *  - Desktop: mostra QR code + as duas lojas (não há app de computador).
 * Dentro do app nativo este componente não é usado (a tela de login aparece).
 */
export function AppGate() {
  const [plataforma, setPlataforma] = useState<PlataformaLoja>("desktop");
  const [pronto, setPronto] = useState(false);
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    setPlataforma(detectarPlataforma());
    setPronto(true);
  }, []);

  const lojaUrl =
    plataforma === "ios" ? APP_STORE_CLIENTE : plataforma === "android" ? PLAY_STORE_CLIENTE : "";

  // Mobile: redireciona sozinho para a loja após um instante.
  useEffect(() => {
    if (!pronto || !lojaUrl) return;
    const t = window.setTimeout(() => {
      window.location.href = lojaUrl;
    }, 1600);
    return () => window.clearTimeout(t);
  }, [pronto, lojaUrl]);

  // Desktop: gera o QR apontando para esta mesma página (no celular ela leva à loja).
  useEffect(() => {
    if (!pronto || plataforma !== "desktop") return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/cliente/login`
        : "https://www.rota013.com.br/cliente/login";
    let cancelado = false;
    import("qrcode")
      .then((QR) => QR.toDataURL(url, { width: 240, margin: 1 }))
      .then((dataUrl) => {
        if (!cancelado) setQr(dataUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [pronto, plataforma]);

  if (!pronto) {
    return <div className="min-h-screen bg-background" />;
  }

  // ─── Mobile (Android / iPhone) ───
  if (plataforma === "ios" || plataforma === "android") {
    const nomeLoja = plataforma === "ios" ? "App Store" : "Google Play";
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <LogoRota013 className="text-5xl" />
        <div className="space-y-2 max-w-sm">
          <h1 className="text-xl font-semibold">Continue no aplicativo</h1>
          <p className="text-sm text-muted-foreground">
            O acesso do cliente Rota 013 é pelo app. Estamos te levando para a {nomeLoja}…
          </p>
        </div>
        <a
          href={lojaUrl}
          className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          {plataforma === "ios" ? <IconeApple /> : <IconeGoogle />}
          Abrir o app na {nomeLoja}
        </a>
        <p className="text-xs text-muted-foreground">
          Se já tiver o app instalado, a loja mostra o botão <strong>Abrir</strong>.
        </p>
      </div>
    );
  }

  // ─── Desktop ───
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 py-10 text-center">
      <LogoRota013 className="text-5xl" />
      <div className="space-y-2 max-w-md">
        <h1 className="text-xl font-semibold">Baixe o app no seu celular</h1>
        <p className="text-sm text-muted-foreground">
          O acesso do cliente Rota 013 é feito pelo aplicativo. Aponte a câmera do seu celular
          para o QR code abaixo ou baixe direto na sua loja.
        </p>
      </div>

      {qr ? (
        <img
          src={qr}
          alt="QR code para baixar o app Rota 013"
          className="size-52 rounded-2xl border border-border bg-white p-3"
          width={208}
          height={208}
        />
      ) : (
        <div className="size-52 rounded-2xl border border-border bg-muted/30" />
      )}

      <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
        <LojaBadge loja="apple" href={APP_STORE_CLIENTE} />
        <LojaBadge loja="google" href={PLAY_STORE_CLIENTE} />
      </div>
    </div>
  );
}

function LojaBadge({ loja, href }: { loja: "google" | "apple"; href: string }) {
  const isApple = loja === "apple";
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-xl border border-border bg-background p-3 transition-colors hover:border-primary/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {isApple ? <IconeApple /> : <IconeGoogle />}
      </span>
      <span className="min-w-0 text-left leading-tight">
        <span className="block text-[10px] text-muted-foreground">
          {isApple ? "Baixe na" : "Disponível no"}
        </span>
        <span className="block text-sm font-semibold">{isApple ? "App Store" : "Google Play"}</span>
      </span>
    </a>
  );
}

function IconeApple() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.417 2.2-1.11 3.005-.836.97-2.198 1.72-3.336 1.63-.14-1.11.417-2.29 1.083-3.02.75-.83 2.06-1.45 3.13-1.5.03.28.233.55.233.885zM20.5 17.02c-.55 1.27-.81 1.84-1.52 2.96-.99 1.57-2.39 3.52-4.12 3.53-1.54.02-1.94-1-4.03-.99-2.09.01-2.53 1.01-4.07.99-1.73-.01-3.06-1.77-4.05-3.34C-.02 16.5-.34 11.13 1.42 8.28c1.02-1.65 2.63-2.62 4.14-2.62 1.54 0 2.5 1.02 3.77 1.02 1.23 0 1.98-1.02 3.76-1.02 1.34 0 2.76.73 3.77 1.99-3.31 1.81-2.77 6.54.64 7.37z" />
    </svg>
  );
}

function IconeGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
      <path d="M3.6 2.4a1.3 1.3 0 0 0-.5 1.05v17.1c0 .43.2.82.53 1.05l9.9-9.6-9.93-9.6zm11.36 8.02L5.1 1.02l11.4 6.55-1.54 2.85zm3.3 1.9 2.28 1.31c.98.56.98 1.98 0 2.54l-2.32 1.33-1.74-3.22 1.78-2.96zm-2.83 3.28 1.55 2.87L5.1 22.98l9.86-9.4 1.47 2.9z" />
    </svg>
  );
}
