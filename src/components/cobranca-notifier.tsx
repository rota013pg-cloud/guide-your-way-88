/**
 * Notificador global do painel: alerta com badge + popover listando motoristas
 * cujo app está travado na tela de pagamento da diária (Pendente / Aguardando /
 * Bloqueado). Toca beep e mostra toast quando um novo motorista entra nesse
 * estado.
 */
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { playChatBeep } from "@/lib/notification-sound";

type Cobranca = {
  id: number;
  motorista_codigo: string;
  status: string;
  faturamento_dia: number;
  valor_diaria: number;
  atualizado_em: string;
};

const STATUS_TRAVADO = ["Pendente", "Aguardando", "Bloqueado"];

export function CobrancaNotifier() {
  const [travados, setTravados] = useState<Cobranca[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const conhecidos = useRef<Set<string>>(new Set());
  const primeiraCarga = useRef(true);

  const carregar = async () => {
    const hoje = new Date();
    // dia operacional: antes das 06h conta como dia anterior
    if (hoje.getHours() < 6) hoje.setDate(hoje.getDate() - 1);
    const dia = hoje.toISOString().slice(0, 10);
    const { data } = await supabase
      .from("motorista_cobranca")
      .select("id,motorista_codigo,status,faturamento_dia,valor_diaria,atualizado_em")
      .eq("dia_op", dia)
      .in("status", STATUS_TRAVADO)
      .order("atualizado_em", { ascending: false });
    const lista = (data as Cobranca[]) ?? [];
    setTravados(lista);
    const codigos = lista.map((c) => c.motorista_codigo);
    if (codigos.length) {
      const { data: mots } = await supabase
        .from("motoristas")
        .select("codigo,nome")
        .in("codigo", codigos);
      const map: Record<string, string> = {};
      for (const m of (mots ?? []) as { codigo: string; nome: string }[]) {
        map[m.codigo] = m.nome;
      }
      setNomes(map);
    }

    // detectar novos
    const atuais = new Set(lista.map((c) => `${c.motorista_codigo}:${c.status}`));
    if (!primeiraCarga.current) {
      for (const chave of atuais) {
        if (!conhecidos.current.has(chave)) {
          const [cod, st] = chave.split(":");
          const nome = nomes[cod] ?? cod;
          playChatBeep();
          toast.custom(
            (id) => (
              <button
                onClick={() => {
                  toast.dismiss(id);
                  navigate({ to: "/motoristas" });
                }}
                className="flex items-start gap-3 w-[340px] max-w-[88vw] rounded-lg border border-border bg-card text-card-foreground shadow-lg p-3 text-left hover:bg-muted/40 transition"
              >
                <div className="h-10 w-10 rounded-full bg-warning text-warning-foreground flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">
                    💰 {nome} — {st}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    App travado na tela de pagamento da diária.
                  </div>
                </div>
              </button>
            ),
            { duration: 7000 },
          );
        }
      }
    }
    conhecidos.current = atuais;
    primeiraCarga.current = false;
  };

  useEffect(() => {
    carregar();
    const ch = supabase
      .channel("cobranca-notifier")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "motorista_cobranca" },
        () => carregar(),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = travados.length;
  const bloqueados = travados.filter((c) => c.status === "Bloqueado").length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          aria-label={`Pagamentos pendentes${total ? ` (${total})` : ""}`}
        >
          <DollarSign className="h-4 w-4" />
          {total > 0 && (
            <Badge
              variant={bloqueados > 0 ? "destructive" : "default"}
              className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center rounded-full"
            >
              {total > 9 ? "9+" : total}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-warning" /> Apps travados em pagamento
          </div>
          {total > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {total} motorista{total > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {total === 0 ? (
            <div className="px-3 py-8 text-center text-xs text-muted-foreground">
              Nenhum motorista aguardando confirmação.
            </div>
          ) : (
            travados.map((c) => (
              <Link
                key={c.id}
                to="/motoristas"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 border-b border-border last:border-0 hover:bg-muted/60 transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold truncate">
                    {nomes[c.motorista_codigo] ?? c.motorista_codigo}
                  </span>
                  <Badge
                    className={
                      c.status === "Bloqueado"
                        ? "bg-destructive text-destructive-foreground"
                        : c.status === "Aguardando"
                        ? "bg-primary text-primary-foreground"
                        : "bg-warning text-warning-foreground"
                    }
                  >
                    {c.status}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Faturou R$ {Number(c.faturamento_dia).toFixed(2).replace(".", ",")} ·
                  Diária R$ {Number(c.valor_diaria).toFixed(2).replace(".", ",")}
                </div>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
