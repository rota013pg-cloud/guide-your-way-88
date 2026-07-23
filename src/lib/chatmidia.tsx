/**
 * Utilitários e componentes compartilhados para o chat com mídia
 * (áudio, foto, vídeo, arquivos). Usado nas telas de motociclista,
 * operador e cliente.
 *
 * No app NATIVO (Capacitor) usa plugins (câmera, seletor de arquivos, gravador
 * de voz) — que tratam permissão e devolvem os bytes em base64 (sobe sem vazio).
 * No NAVEGADOR usa as APIs web (input file + MediaRecorder).
 * Upload é feito direto pro Storage via signed URL, com corpo em memória.
 */
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

const BUCKET_CHAT = "chat-midia";

function ehNativo(): boolean {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

// Plugin nativo (iOS) que devolve a sessão de áudio ao modo "playback" depois de
// gravar — senão o iPhone deixa o player de voz mudo até reabrir o app.
const AudioSession = registerPlugin<{ setPlayback(): Promise<void> }>("AudioSession");
async function restaurarAudioPlayback(): Promise<void> {
  try {
    if (Capacitor.getPlatform() !== "ios") return;
    await AudioSession.setPlayback();
  } catch {
    /* plugin ausente/erro → ignora silenciosamente */
  }
}

export type MidiaTipo = "imagem" | "video" | "audio" | "arquivo";

export function tipoDeMime(mime: string): MidiaTipo {
  if (mime.startsWith("image/")) return "imagem";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "arquivo";
}

function base64ParaBlob(b64: string, mime: string): Blob {
  const limpo = b64.includes(",") ? b64.split(",")[1] : b64;
  const bin = atob(limpo);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export type MidiaEnviada = { midiaUrl: string; midiaTipo: MidiaTipo; midiaNome: string };
export type ObterUploadUrl = (ext: string) => Promise<{ path: string; token: string; publicUrl: string }>;

/** Sobe o arquivo pro Storage (signed URL, corpo em memória) e devolve os metadados. */
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
  // Corpo em memória — evita o "arquivo vazio" de Blobs content:// do WebView.
  const buf = await file.arrayBuffer();
  const body = new Blob([buf], { type: mime });
  const { error } = await supabase.storage
    .from(BUCKET_CHAT)
    .uploadToSignedUrl(path, token, body, { contentType: mime });
  if (error) throw new Error(error.message);
  return { midiaUrl: publicUrl, midiaTipo: tipo, midiaNome: nomeArquivo };
}

/** Render de uma mídia dentro do balão da mensagem. */
export function MidiaMensagem({
  url, tipo, nome,
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
    return <video src={url} controls playsInline style={{ maxWidth: "100%", maxHeight: 260, borderRadius: 10, display: "block" }} />;
  }
  if (tipo === "audio") {
    return <audio src={url} controls style={{ width: 240, maxWidth: "100%" }} />;
  }
  return (
    <a
      href={url} target="_blank" rel="noreferrer" download={nome ?? undefined}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "underline", wordBreak: "break-all" }}
    >
      📎 {nome ?? "arquivo"}
    </a>
  );
}

/**
 * Botões de anexo (câmera/foto, arquivo/galeria) + gravação de áudio.
 * Cuida de capturar, subir e chamar onEnviar com os metadados da mídia.
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
  const webRecRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);
  const [gravando, setGravando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const nativo = ehNativo();

  const subirEEnviar = async (file: Blob, nome: string) => {
    if (!file || file.size === 0) {
      toast.error("Arquivo vazio — tente novamente.");
      return;
    }
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

  // ─── NATIVO: câmera/foto via @capacitor/camera ─────────
  const fotoNativa = async () => {
    if (enviando) return;
    try {
      const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
      const photo = await Camera.getPhoto({
        quality: 65,
        resultType: CameraResultType.Base64,
        source: CameraSource.Prompt, // deixa o usuário escolher Câmera ou Galeria
        promptLabelHeader: "Foto",
        promptLabelPhoto: "Galeria",
        promptLabelPicture: "Tirar foto",
      });
      if (!photo.base64String) return;
      const fmt = photo.format || "jpeg";
      await subirEEnviar(base64ParaBlob(photo.base64String, `image/${fmt}`), `foto-${Date.now()}.${fmt}`);
    } catch (e) {
      // usuário cancelou → silencioso
      if (e instanceof Error && /cancel/i.test(e.message)) return;
      toast.error("Não foi possível abrir a câmera.");
    }
  };

  // ─── NATIVO: arquivo/vídeo via @capawesome/file-picker ─
  const arquivoNativo = async () => {
    if (enviando) return;
    try {
      const { FilePicker } = await import("@capawesome/capacitor-file-picker");
      const res = await FilePicker.pickFiles({ readData: true });
      const f = res.files?.[0];
      if (!f?.data) return;
      const mime = f.mimeType || "application/octet-stream";
      await subirEEnviar(base64ParaBlob(f.data, mime), f.name || `arquivo-${Date.now()}`);
    } catch (e) {
      if (e instanceof Error && /cancel/i.test(e.message)) return;
      toast.error("Não foi possível abrir os arquivos.");
    }
  };

  // ─── NATIVO: áudio via @independo/voice-recorder ───────
  const toggleAudioNativo = async () => {
    if (enviando) return;
    const { VoiceRecorder } = await import("@independo/capacitor-voice-recorder");
    if (!gravando) {
      try {
        const perm = await VoiceRecorder.requestAudioRecordingPermission();
        if (!perm.value) { toast.error("Permissão de microfone negada."); return; }
        await VoiceRecorder.startRecording();
        setGravando(true);
      } catch {
        toast.error("Não foi possível iniciar a gravação.");
      }
    } else {
      setGravando(false);
      try {
        const r = await VoiceRecorder.stopRecording();
        const b64 = r.value?.recordDataBase64;
        const mime = r.value?.mimeType || "audio/aac";
        if (!b64) { toast.error("Gravação vazia."); return; }
        const ext = mime.includes("mp4") || mime.includes("aac") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
        await subirEEnviar(base64ParaBlob(b64, mime), `audio-${Date.now()}.${ext}`);
      } catch {
        toast.error("Falha ao finalizar a gravação.");
      } finally {
        // Devolve a sessão de áudio ao "playback" (iOS) para o player voltar a tocar.
        await restaurarAudioPlayback();
      }
    }
  };

  // ─── WEB: input file + MediaRecorder ───────────────────
  const onPickWeb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void subirEEnviar(f, f.name);
    e.target.value = "";
  };
  const toggleAudioWeb = async () => {
    if (enviando) return;
    if (!gravando) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        const chunks: Blob[] = [];
        rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
        rec.start();
        webRecRef.current = { rec, chunks, stream };
        setGravando(true);
      } catch {
        toast.error("Não foi possível acessar o microfone.");
      }
    } else {
      const g = webRecRef.current;
      webRecRef.current = null;
      setGravando(false);
      if (!g) return;
      await new Promise<void>((resolve) => { g.rec.onstop = () => resolve(); g.rec.stop(); });
      g.stream.getTracks().forEach((t) => t.stop());
      const mime = g.rec.mimeType || "audio/webm";
      const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const blob = new Blob(g.chunks, { type: mime });
      await subirEEnviar(blob, `audio-${Date.now()}.${ext}`);
    }
  };

  const estilo: React.CSSProperties = {
    background: "transparent", border: 0, cursor: "pointer", flex: "0 0 auto",
    fontSize: 19, lineHeight: 1, padding: "0 3px", opacity: disabled || enviando ? 0.5 : 1,
  };
  const off = disabled || enviando;

  return (
    <>
      {!nativo && (
        <>
          <input ref={arquivoRef} type="file" accept="image/*,video/*,audio/*,application/*,text/*" hidden onChange={onPickWeb} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onPickWeb} />
        </>
      )}
      <button type="button" title="Câmera / foto" style={estilo} disabled={off}
        onClick={() => (nativo ? fotoNativa() : cameraRef.current?.click())}>📷</button>
      <button type="button" title="Anexar arquivo" style={estilo} disabled={off}
        onClick={() => (nativo ? arquivoNativo() : arquivoRef.current?.click())}>📎</button>
      <button type="button" title={gravando ? "Parar e enviar áudio" : "Gravar áudio"}
        style={{ ...estilo, color: gravando ? "#ef4444" : cor }} disabled={off}
        onClick={() => (nativo ? toggleAudioNativo() : toggleAudioWeb())}>
        {enviando ? "…" : gravando ? "⏹" : "🎤"}
      </button>
    </>
  );
}
