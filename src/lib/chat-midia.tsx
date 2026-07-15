/**
 * Utilitários e componentes compartilhados para o chat com mídia
 * (áudio, foto, vídeo, arquivos). Usado nas telas de motociclista,
 * operador e cliente. Upload é feito direto pro Storage via signed URL.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const BUCKET_CHAT = "chat-midia";

export type MidiaTipo = "imagem" | "video" | "audio" | "arquivo";

export function tipoDeMime(mime: string): MidiaTipo {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "arquivo";
}

export type MidiaEnviada = { midiaUrl: string; midiaTipo: MidiaTipo; midiaNome: string };
export type ObterUploadUrl = (ext: string) => Promise<{ path: string; token: string; publicUrl: string }>;

/** Sobe o arquivo pro Storage (signed URL) e devolve os metadados pra gravar a mensagem. */
export async function enviarArquivoChat(
  file: Blob,
  nomeArquivo: string,
  obterUploadUrl: ObterUploadUrl,
): Promise<MidiaEnviada> {
  const mime = file.type || "application/octet-stream";
  const tipo = tipoDeMime(mime);
  const ext = (nomeArquivo.includes(".")
    ? nomeArquivo.split(".").pop()!
    : (mime.split("/")[1] || "bin")
  ).toLowerCase();
  const { path, token, publicUrl } = await obterUploadUrl(ext);
  const { error } = await supabase.storage
    .from(BUCKET_CHAT)
    .uploadToSignedUrl(path, token, file, { contentType: mime });
  if (error) throw new Error(error.message);
  return { midiaUrl: publicUrl, midiaTipo: tipo, midiaNome: nomeArquivo };
}

/** Render de uma mídia dentro do balão da mensagem. */
export function MidiaMensagem({
  url,
  tipo,
  nome,
}: {
  url?: string | null;
  tipo?: string | null;
  nome?: string | null;
}) {
  if (!url) return null;
  if (tipo === "imagem") {
    return (
      <img
        src={url}
        alt={nome ?? "imagem"}
        onClick={() => window.open(url, "_blank")}
        style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 10, cursor: "pointer", display: "block" }}
      />
    );
  }
  if (tipo === "video") {
    return (
      <video src={url} controls playsInline style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10, display: "block" }} />
    );
  }
  if (tipo === "audio") {
    return <audio src={url} controls style={{ width: 240, maxWidth: "100%" }} />;
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={nome ?? undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "underline", wordBreak: "break-all" }}
    >
      📎 {nome ?? "arquivo"}
    </a>
  );
}

// ─── Gravador de áudio (MediaRecorder) ──────────────────────────────
type Gravador = { rec: MediaRecorder; chunks: Blob[]; stream: MediaStream };

/**
 * Botões de anexo (arquivo/galeria, câmera) + gravação de áudio.
 * Cuida de subir o arquivo e chama onEnviar com os metadados da mídia.
 */
export function BotoesAnexo({
  obterUploadUrl,
  onEnviar,
  cor = "#f7c600",
  disabled = false,
}: {
  obterUploadUrl: ObterUploadUrl;
  onEnviar: (m: MidiaEnviada) => Promise<void> | void;
  cor?: string;
  disabled?: boolean;
}) {
  const arquivoRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const gravadorRef = useRef<Gravador | null>(null);
  const [gravando, setGravando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const subirEEnviar = async (file: Blob, nome: string) => {
    setEnviando(true);
    try {
      const meta = await enviarArquivoChat(file, nome, obterUploadUrl);
      await onEnviar(meta);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar a mídia.");
    } finally {
      setEnviando(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void subirEEnviar(f, f.name);
    e.target.value = "";
  };

  const toggleGravar = async () => {
    if (enviando) return;
    if (!gravando) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
        rec.start();
        gravadorRef.current = { rec, chunks, stream };
        setGravando(true);
      } catch {
        toast.error("Não foi possível acessar o microfone.");
      }
    } else {
      const g = gravadorRef.current;
      gravadorRef.current = null;
      setGravando(false);
      if (!g) return;
      await new Promise<void>((resolve) => {
        g.rec.onstop = () => resolve();
        g.rec.stop();
      });
      g.stream.getTracks().forEach((t) => t.stop());
      const mime = g.rec.mimeType || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(g.chunks, { type: mime });
      if (blob.size > 0) await subirEEnviar(blob, `audio-${Date.now()}.${ext}`);
    }
  };

  const estilo: React.CSSProperties = {
    background: "transparent", border: 0, cursor: "pointer",
    fontSize: 20, lineHeight: 1, padding: "0 6px", opacity: disabled || enviando ? 0.5 : 1,
  };

  return (
    <>
      <input ref={arquivoRef} type="file" accept="image/*,video/*,application/pdf,application/*,text/*" hidden onChange={onPick} />
      <input ref={cameraRef} type="file" accept="image/*,video/*" capture="environment" hidden onChange={onPick} />
      <button type="button" title="Anexar arquivo" style={estilo} disabled={disabled || enviando} onClick={() => arquivoRef.current?.click()}>📎</button>
      <button type="button" title="Câmera" style={estilo} disabled={disabled || enviando} onClick={() => cameraRef.current?.click()}>📷</button>
      <button
        type="button"
        title={gravando ? "Parar e enviar áudio" : "Gravar áudio"}
        style={{ ...estilo, color: gravando ? "#ef4444" : cor }}
        disabled={disabled || enviando}
        onClick={toggleGravar}
      >
        {enviando ? "…" : gravando ? "⏹" : "🎤"}
      </button>
    </>
  );
}
