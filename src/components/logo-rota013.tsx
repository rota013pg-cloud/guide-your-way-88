export function LogoRota013({
  className = "text-2xl",
  showBeta = false,
  betaText = "Beta 2.0",
  betaClassName = "text-[10px] uppercase tracking-widest text-muted-foreground",
}: {
  className?: string;
  showBeta?: boolean;
  betaText?: string;
  betaClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`logo-r013 leading-none ${className}`}
        style={{ color: "hsl(var(--foreground))" }}
      >
        Rota<span>013</span>
      </div>
      {showBeta && (
        <div className="leading-tight">
          <div className={betaClassName}>{betaText}</div>
        </div>
      )}
    </div>
  );
}
