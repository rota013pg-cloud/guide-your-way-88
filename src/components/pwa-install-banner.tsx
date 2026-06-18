import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "rota013_pwa_dismissed";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWAInstallBanner() {
  const [show, setShow] = useState(false);
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // já instalado
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // @ts-expect-error iOS Safari
      window.navigator.standalone === true;
    if (standalone) return;
    if (window.localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIOS(ios);

    if (ios) {
      setShow(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setShow(false);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* noop */
    }
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") dismiss();
    setDeferred(null);
  };

  if (!show) return null;

  return (
    <div className="relative mx-4 mt-3 overflow-hidden rounded-2xl border border-primary/30 bg-primary/5">
      <div className="absolute inset-0 -z-10 animate-pulse bg-primary/10" />
      <div className="flex items-center gap-3 p-3">
        <div className="rounded-full bg-primary/20 p-2 animate-pulse">
          <Download className="size-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">Instale o Rota 013</p>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {isIOS
              ? "Toque em Compartilhar e depois em “Adicionar à Tela de Início”."
              : "Adicione o app à sua tela inicial para pedir corridas mais rápido."}
          </p>
        </div>
        {!isIOS && deferred ? (
          <Button size="sm" className="rounded-xl shrink-0" onClick={install}>
            Instalar
          </Button>
        ) : null}
        <button
          onClick={dismiss}
          aria-label="Dispensar"
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
