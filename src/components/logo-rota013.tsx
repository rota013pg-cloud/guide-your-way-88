import logoAsset from "@/assets/rota013-logo.png.asset.json";

export function LogoRota013({ className = "text-2xl" }: { className?: string }) {
  // Aproxima a altura ao tamanho do texto anterior (1em ~ font-size do className)
  return (
    <img
      src={logoAsset.url}
      alt="Rota013"
      className={`inline-block w-auto object-contain rounded-lg ${className}`}
      style={{ height: "1.4em" }}
    />
  );
}
