import { Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function AvaliacaoStars({
  value,
  comentario,
  size = 14,
}: {
  value: number | null | undefined;
  comentario?: string | null;
  size?: number;
}) {
  if (value == null) return <span className="text-xs text-muted-foreground">—</span>;
  const v = Math.round(Number(value));
  const stars = (
    <div className="inline-flex items-center gap-0.5" aria-label={`${v} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          style={{ width: size, height: size }}
          className={n <= v ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
  if (!comentario) return stars;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">{stars}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <p className="text-xs italic">"{comentario}"</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function AvaliacaoMedia({
  media,
  qtd,
  size = 14,
}: {
  media: number | null | undefined;
  qtd: number;
  size?: number;
}) {
  if (media == null || qtd === 0) {
    return <span className="text-xs text-muted-foreground">Sem avaliações</span>;
  }
  return (
    <div className="inline-flex items-center gap-1 text-xs">
      <Star
        style={{ width: size, height: size }}
        className="fill-yellow-400 text-yellow-400"
      />
      <span className="font-semibold">{media.toFixed(1)}</span>
      <span className="text-muted-foreground">({qtd})</span>
    </div>
  );
}
