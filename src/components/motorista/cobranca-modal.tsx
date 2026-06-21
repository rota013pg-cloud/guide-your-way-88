/**
 * Modal de aviso de pagamento (status Pendente) + tela de bloqueio (Bloqueado).
 * Renderiza condicional: para Bloqueado, ocupa a tela inteira e trava o uso do app.
 * Em "Pendente"/"Bloqueado" exige anexar imagem do comprovante PIX antes de liberar.
 */
import { useRef, useState } from "react";

type Cobranca = {
  status: string;
  faturamento_dia: number;
  valor_diaria: number;
  comprovante_enviado_em: string | null;
  comprovante_rejeicao_motivo?: string | null;
};
type Config = {
  pixChave?: string;
  tipoChavePix?: string;
  whatsappCentral?: string;
  empresa?: string;
};

export function CobrancaModal({
  cobranca,
  config,
  onJaPaguei,
  enviando,
  onFechar,
}: {
  cobranca: Cobranca;
  config: Config;
  onJaPaguei: (comprovanteBase64: string) => void;
  enviando: boolean;
  onFechar?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [comprovante, setComprovante] = useState<string | null>(null);
  const [comprovanteErr, setComprovanteErr] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pix = config.pixChave ?? "";
  const tipoPix = config.tipoChavePix ?? "Aleatória";
  const wa = (config.whatsappCentral ?? "").replace(/\D/g, "");
  const valor = Number(cobranca.valor_diaria || 0);
  const bloqueado = cobranca.status === "Bloqueado";
  const aguardando = cobranca.status === "Aguardando";
  const rejeitado = !!cobranca.comprovante_rejeicao_motivo && !aguardando;
  const podeFechar = !bloqueado && !aguardando && !!onFechar;

  const copiarPix = async () => {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const onArquivo = (file: File | null) => {
    setComprovanteErr("");
    if (!file) { setComprovante(null); return; }
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setComprovanteErr("Envie uma foto (JPG, PNG ou WEBP).");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setComprovanteErr("Foto maior que 4MB. Reduza e tente de novo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setComprovante(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => setComprovanteErr("Não consegui ler a imagem.");
    reader.readAsDataURL(file);
  };

  const abrirWhats = () => {
    const msg = encodeURIComponent("Olá, acabei de pagar a diária. Segue comprovante.");
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
  };

  return (
    <div
      onClick={podeFechar ? onFechar : undefined}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: bloqueado ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: bloqueado ? "stretch" : "flex-end",
        justifyContent: "center",
        padding: bloqueado ? 0 : "16px",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", width: "100%",
          maxWidth: bloqueado ? "none" : 460,
          borderRadius: bloqueado ? 0 : 16,
          padding: bloqueado
            ? "calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)"
            : "20px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          minHeight: bloqueado ? "100dvh" : undefined,
          maxHeight: bloqueado ? "none" : "100dvh",
          overflowY: bloqueado ? "visible" : "auto",
          position: "relative",
        }}
      >
        {podeFechar && (
          <button onClick={onFechar} aria-label="Fechar" style={{
            position: "absolute", top: 8, right: 8, width: 32, height: 32,
            border: 0, background: "transparent", fontSize: 22, cursor: "pointer", color: "#666",
          }}>✕</button>
        )}
        <div style={{
          fontSize: 14, fontWeight: 700, textTransform: "uppercase",
          color: bloqueado ? "#dc2626" : "#d97706", letterSpacing: 0.5, marginBottom: 6,
        }}>
          {bloqueado ? "🚫 App bloqueado" : aguardando ? "⏳ Aguardando confirmação" : "💰 Pagamento da diária"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 4 }}>
          {bloqueado
            ? "Pague a diária para continuar"
            : aguardando
            ? "Estamos confirmando seu pagamento"
            : "Você atingiu o valor da diária"}
        </div>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 12, lineHeight: 1.4 }}>
          {bloqueado ? (
            <>
              Você faturou <b>R$ {Number(cobranca.faturamento_dia).toFixed(2).replace(".", ",")}</b> hoje
              e ainda não pagou a diária. Pague no PIX abaixo e anexe a foto do comprovante.
            </>
          ) : aguardando ? (
            <>Comprovante recebido. O operador vai validar em instantes — o app é liberado automaticamente.</>
          ) : (
            <>
              Faturamento do dia: <b>R$ {Number(cobranca.faturamento_dia).toFixed(2).replace(".", ",")}</b>.
              Por favor, efetue o pagamento da diária via PIX e anexe o comprovante.
            </>
          )}
        </div>

        {rejeitado && (
          <div style={{
            background: "#fee2e2", border: "1px solid #fca5a5", color: "#991b1b",
            fontSize: 13, borderRadius: 10, padding: 10, marginBottom: 12, lineHeight: 1.4,
          }}>
            ❌ <b>Comprovante rejeitado:</b> {cobranca.comprovante_rejeicao_motivo}. Envie um novo.
          </div>
        )}

        <div style={{
          background: "#fef3c7", border: "2px dashed #f59e0b",
          borderRadius: 12, padding: 16, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>Valor</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#92400e", lineHeight: 1 }}>
            R$ {valor.toFixed(2).replace(".", ",")}
          </div>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
            {config.empresa ?? "Central"} · Válida até as 06:00 de amanhã
          </div>
        </div>

        {pix ? (
          <div style={{ background: "#f3f4f6", borderRadius: 12, padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 2 }}>
              CHAVE PIX ({tipoPix})
            </div>
            <div style={{
              fontFamily: "monospace", fontSize: 16, wordBreak: "break-all",
              color: "#111", marginBottom: 8,
            }}>{pix}</div>
            <button onClick={copiarPix} style={{
              width: "100%", background: copiado ? "#10b981" : "#111",
              color: "#fff", border: 0, borderRadius: 10, padding: "12px 16px",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
            }}>{copiado ? "✓ Copiado" : "Copiar chave PIX"}</button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>
            Chave PIX não configurada. Fale com a central pelo WhatsApp.
          </div>
        )}

        {!aguardando && (
          <div style={{
            background: "#f0fdf4", border: "1px solid #86efac",
            borderRadius: 10, padding: 12, marginBottom: 12,
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#166534", marginBottom: 6 }}>
              📎 Anexe o comprovante do PIX
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => onArquivo(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13, width: "100%" }}
            />
            {comprovante && (
              <img
                src={comprovante}
                alt="Pré-visualização do comprovante"
                style={{
                  width: "100%", maxHeight: 220, objectFit: "contain",
                  marginTop: 8, borderRadius: 8, background: "#fff",
                }}
              />
            )}
            {comprovanteErr && (
              <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{comprovanteErr}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {wa && (
            <button onClick={abrirWhats} style={{
              background: "#25d366", color: "#fff", border: 0, borderRadius: 10,
              padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>WhatsApp da central</button>
          )}
          <button
            onClick={() => comprovante && onJaPaguei(comprovante)}
            disabled={enviando || aguardando || !comprovante}
            style={{
              background: aguardando || !comprovante ? "#9ca3af" : "#f7c600",
              color: "#111", border: 0, borderRadius: 10,
              padding: "14px", fontSize: 15, fontWeight: 700,
              cursor: aguardando || !comprovante ? "not-allowed" : "pointer",
            }}
          >
            {aguardando
              ? "Aguardando confirmação da central…"
              : enviando
              ? "Enviando…"
              : comprovante
              ? "Enviar comprovante e solicitar liberação"
              : "Anexe o comprovante para enviar"}
          </button>
        </div>
      </div>
    </div>
  );
}
