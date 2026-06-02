/**
 * Modal de aviso de pagamento (status Pendente) + tela de bloqueio (Bloqueado).
 * Renderiza condicional: para Bloqueado, ocupa a tela inteira e trava o uso do app.
 */
import { useState } from "react";

type Cobranca = {
  status: string;
  faturamento_dia: number;
  valor_diaria: number;
  comprovante_enviado_em: string | null;
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
  onJaPaguei: () => void;
  enviando: boolean;
  onFechar?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const pix = config.pixChave ?? "";
  const tipoPix = config.tipoChavePix ?? "Aleatória";
  const wa = (config.whatsappCentral ?? "").replace(/\D/g, "");
  const valor = Number(cobranca.valor_diaria || 0);
  const bloqueado = cobranca.status === "Bloqueado";
  const aguardando = cobranca.status === "Aguardando";
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

  const abrirWhats = () => {
    const msg = encodeURIComponent(
      `Olá, sou ${cobranca.status} e acabei de pagar a diária. Segue comprovante.`,
    );
    window.open(`https://wa.me/${wa}?text=${msg}`, "_blank");
  };

  // Layout: fullscreen para Bloqueado, card flutuante para Pendente/Aguardando
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: bloqueado ? "rgba(0,0,0,0.95)" : "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: bloqueado ? "stretch" : "flex-end",
        justifyContent: "center",
        padding: bloqueado ? 0 : "16px",
      }}
    >
      <div
        style={{
          background: "#fff",
          width: "100%",
          maxWidth: bloqueado ? "none" : 460,
          borderRadius: bloqueado ? 0 : 16,
          padding: 20,
          boxShadow: "0 -8px 32px rgba(0,0,0,0.4)",
          maxHeight: "100vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            textTransform: "uppercase",
            color: bloqueado ? "#dc2626" : "#d97706",
            letterSpacing: 0.5,
            marginBottom: 6,
          }}
        >
          {bloqueado ? "🚫 App bloqueado" : aguardando ? "⏳ Aguardando confirmação" : "💰 Pagamento da diária"}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111", marginBottom: 4 }}>
          {bloqueado
            ? "Pague a diária para continuar"
            : aguardando
            ? "Estamos confirmando seu pagamento"
            : "Você atingiu o valor da diária"}
        </div>
        <div style={{ fontSize: 14, color: "#555", marginBottom: 16, lineHeight: 1.4 }}>
          {bloqueado ? (
            <>
              Você faturou <b>R$ {Number(cobranca.faturamento_dia).toFixed(2).replace(".", ",")}</b> hoje
              e ainda não pagou a diária. Para voltar a receber corridas, efetue o pagamento abaixo
              e envie o comprovante para a central.
            </>
          ) : aguardando ? (
            <>
              Recebemos seu aviso. Para acelerar a liberação,
              <b> envie o comprovante no WhatsApp da central</b>. Assim que o operador confirmar,
              o app é liberado automaticamente.
            </>
          ) : (
            <>
              Faturamento do dia: <b>R$ {Number(cobranca.faturamento_dia).toFixed(2).replace(".", ",")}</b>.
              Por favor, efetue o pagamento da diária via PIX.
            </>
          )}
        </div>

        <div
          style={{
            background: "#fef3c7",
            border: "2px dashed #f59e0b",
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <div style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>Valor</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#92400e", lineHeight: 1 }}>
            R$ {valor.toFixed(2).replace(".", ",")}
          </div>
          <div style={{ fontSize: 11, color: "#92400e", marginTop: 4 }}>
            {config.empresa ?? "Central"}
          </div>
        </div>

        {pix ? (
          <div
            style={{
              background: "#f3f4f6",
              borderRadius: 12,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 2 }}>
              CHAVE PIX ({tipoPix})
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 16,
                wordBreak: "break-all",
                color: "#111",
                marginBottom: 8,
              }}
            >
              {pix}
            </div>
            <button
              onClick={copiarPix}
              style={{
                width: "100%",
                background: copiado ? "#10b981" : "#111",
                color: "#fff",
                border: 0,
                borderRadius: 10,
                padding: "12px 16px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {copiado ? "✓ Copiado" : "Copiar chave PIX"}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#dc2626", marginBottom: 12 }}>
            Chave PIX não configurada. Fale com a central pelo WhatsApp.
          </div>
        )}

        <div
          style={{
            background: "#dbeafe",
            border: "1px solid #93c5fd",
            color: "#1e40af",
            fontSize: 13,
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
            lineHeight: 1.4,
          }}
        >
          📲 <b>Para acelerar a liberação</b>, envie o comprovante de pagamento no WhatsApp da central.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {wa && (
            <button
              onClick={abrirWhats}
              style={{
                background: "#25d366",
                color: "#fff",
                border: 0,
                borderRadius: 10,
                padding: "14px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Enviar comprovante no WhatsApp
            </button>
          )}
          <button
            onClick={onJaPaguei}
            disabled={enviando || aguardando}
            style={{
              background: aguardando ? "#9ca3af" : "#f7c600",
              color: "#111",
              border: 0,
              borderRadius: 10,
              padding: "14px",
              fontSize: 15,
              fontWeight: 700,
              cursor: aguardando ? "not-allowed" : "pointer",
            }}
          >
            {aguardando ? "Aguardando confirmação da central…" : enviando ? "Enviando…" : "Já paguei — solicitar liberação"}
          </button>
        </div>
      </div>
    </div>
  );
}
