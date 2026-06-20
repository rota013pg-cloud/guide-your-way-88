import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getClienteToken } from "@/lib/cliente-auth";
import { toast } from "sonner";

type Props = {
  corridaId: number;
  open: boolean;
  onClose: () => void;
};

function Stars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div>
      <p className="text-sm font-medium mb-2">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className="p-1"
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
          >
            <Star
              className={`size-8 transition-colors ${
                n <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvaliacaoCorridaDialog({ corridaId, open, onClose }: Props) {
  const [notaCorrida, setNotaCorrida] = useState(0);
  const [notaMotorista, setNotaMotorista] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const enviadoRef = useRef(false);

  const enviar = async (pular = false) => {
    if (enviadoRef.current) {
      onClose();
      return;
    }
    const token = getClienteToken();
    if (!token) {
      onClose();
      return;
    }
    setEnviando(true);
    try {
      const { error } = await supabase.rpc("cliente_avaliar_corrida", {
        _token: token,
        _corrida_id: corridaId,
        _nota_corrida: pular ? null : (notaCorrida || null),
        _nota_motorista: pular ? null : (notaMotorista || null),
        _comentario: pular ? "" : comentario,
      } as any);
      if (error) throw error;
      enviadoRef.current = true;
      if (!pular && (notaCorrida || notaMotorista || comentario.trim())) {
        toast.success("Obrigado pela sua avaliação!");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar avaliação");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !enviadoRef.current) void enviar(true); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Como foi sua corrida?</DialogTitle>
          <DialogDescription>Sua avaliação é opcional e nos ajuda a melhorar.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Stars value={notaCorrida} onChange={setNotaCorrida} label="Avaliação da corrida" />
          <Stars value={notaMotorista} onChange={setNotaMotorista} label="Avaliação do motociclista" />
          <div>
            <p className="text-sm font-medium mb-2">Comentários (opcional)</p>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Conte como foi sua experiência…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" className="rounded-xl flex-1" onClick={() => void enviar(true)} disabled={enviando}>
            Pular
          </Button>
          <Button className="rounded-xl flex-1" onClick={() => void enviar(false)} disabled={enviando}>
            {enviando ? <Loader2 className="size-4 animate-spin" /> : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
