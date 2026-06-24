/**
 * Overlay exibido apenas em telas pequenas no modo paisagem,
 * pedindo ao usuário para girar o aparelho de volta para o modo retrato.
 * Necessário porque iOS Safari/PWA ignora `orientation: portrait` do manifest
 * e `screen.orientation.lock` — o bloqueio precisa ser visual.
 */
import { RotateCcw } from "lucide-react";

export function LandscapeBlock() {
  return (
    <div
      aria-hidden
      className="fixed inset-0 z-[9999] hidden items-center justify-center bg-black/95 text-white p-8 text-center landscape-block"
    >
      <style>{`
        @media (orientation: landscape) and (max-height: 500px) and (max-width: 767px) {
          .landscape-block { display: flex !important; }
          body { overflow: hidden !important; }
        }
      `}</style>
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <RotateCcw className="h-12 w-12 animate-pulse" />
        <h2 className="text-lg font-semibold">Gire o aparelho</h2>
        <p className="text-sm text-white/80">
          Este aplicativo funciona apenas no modo retrato (vertical).
          Por favor, gire seu dispositivo para continuar.
        </p>
      </div>
    </div>
  );
}
