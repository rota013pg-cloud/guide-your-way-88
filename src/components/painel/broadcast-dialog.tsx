import { useState, type FormEvent } from "react";
import { Megaphone, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

/**
 * Botão + dialog para enviar um aviso (broadcast) a TODOS os destinatários.
 * A mensagem é gravada no chat de cada pessoa e dispara push. Reutilizado
 * nos chats de clientes e de motociclistas.
 */
export function BroadcastDialog({
  publico,
  onEnviar,
}: {
  /** Rótulo do público, ex.: "clientes" ou "motociclistas". */
  publico: string;
  /** Envia o texto; retorna quantos receberam (opcional). */
  onEnviar: (texto: string) => Promise<{ total?: number }>;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const msg = texto.trim();
    if (!msg || enviando) return;
    setEnviando(true);
    try {
      const r = await onEnviar(msg);
      const qtd = r?.total;
      toast.success(
        qtd != null ? `Aviso enviado para ${qtd} ${publico}.` : "Aviso enviado.",
      );
      setTexto("");
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar aviso");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Megaphone className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Avisar todos</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Avisar todos os {publico}
          </DialogTitle>
          <DialogDescription>
            A mensagem vai para o chat de cada um e envia uma notificação. Use para comunicados gerais.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={enviar} className="space-y-3">
          <Textarea
            placeholder="Escreva o aviso para todos..."
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={1000}
            autoFocus
            disabled={enviando}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">{texto.length}/1000</span>
            <Button type="submit" disabled={enviando || !texto.trim()}>
              <Send className="h-4 w-4 mr-1" />
              {enviando ? "Enviando..." : "Enviar para todos"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
