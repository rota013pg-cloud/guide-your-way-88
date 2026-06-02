import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  label: string;
  value: string; // URL pública/assinada armazenada
  onChange: (url: string) => void;
  /** Subdir no bucket. Geralmente o código do motorista. */
  pasta: string;
  /** Nome lógico do arquivo (sem extensão). Ex: "cnh", "foto". */
  tipo: string;
};

const BUCKET = "motoristas-docs";

export function FileUploadField({ label, value, onChange, pasta, tipo }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [carregando, setCarregando] = useState(false);

  async function handleFile(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 8MB)");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${pasta}/${tipo}-${Date.now()}.${ext}`;
    setCarregando(true);
    try {
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      // URL assinada por 10 anos (bucket é privado)
      const { data: signed, error: e2 } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (e2) throw e2;
      onChange(signed.signedUrl);
      toast.success(`${label} enviado`);
    } catch (e: any) {
      toast.error(e.message || "Falha ao enviar arquivo");
    } finally {
      setCarregando(false);
    }
  }

  const isImage = value && /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(value);
  const isPdf = value && /\.pdf(\?|$)/i.test(value);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          <div className="flex-1 flex items-center gap-2 border rounded-md p-2 bg-muted/30">
            {isImage ? (
              <img src={value} alt={label} className="h-10 w-10 object-cover rounded" />
            ) : (
              <FileText className="h-8 w-8 text-primary" />
            )}
            <a
              href={value}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary underline truncate flex-1"
            >
              {isPdf ? "Abrir PDF" : "Abrir arquivo"}
            </a>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => onChange("")}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={carregando}
            onClick={() => inputRef.current?.click()}
          >
            {carregando ? (
              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
            ) : (
              <Upload className="h-3 w-3 mr-2" />
            )}
            Enviar arquivo
          </Button>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="image/*,application/pdf"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}
