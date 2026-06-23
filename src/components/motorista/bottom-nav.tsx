/**
 * Bottom nav + sheets do app do motorista.
 * Opções: Perfil, Alterar senha, Chat com operador, Histórico, Faturamento, Pagamentos.
 */
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motoristaAlterarSenha, motoristaListarCorridas } from "@/lib/motorista.functions";
import { motoristaListarChat, motoristaEnviarMensagem } from "@/lib/chat-motorista.functions";
import { RawPasswordInput } from "@/components/ui/password-input";
import { motoristaListarCobrancasExtras } from "@/lib/cobrancas-extras.functions";
import { useQuery } from "@tanstack/react-query";
import { playChatBeep } from "@/lib/notification-sound";


type Motorista = {
  codigo: string;
  nome: string;
  foto: string | null;
  moto: string | null;
  placa: string | null;
  cor: string | null;
  telefone: string | null;
  cidade: string | null;
  status: string;
};
type Corrida = {
  id: number;
  cliente: string | null;
  origem: string;
  destino: string | null;
  status: string;
  valor_final: number | null;
};
type Cobranca = {
  status: string;
  faturamento_dia: number;
  valor_diaria: number;
  comprovante_enviado_em: string | null;
} | null;

type Tab = "perfil" | "senha" | "chat" | "historico" | "faturamento" | "pagamentos" | "indicar" | null;

const brl = (v: number) => `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;

export function MotoristaBottomNav({
  motorista,
  token,
  corridasHoje,
  cobranca,
  onAbrirCobranca,
  onSair,
  online,
  emCorrida,
}: {
  motorista: Motorista;
  token: string;
  corridasHoje: Corrida[];
  cobranca: Cobranca;
  onAbrirCobranca: () => void;
  onSair: () => void;
  online: boolean;
  emCorrida: boolean;
}) {
  const [tab, setTab] = useState<Tab>(null);
  const [unread, setUnread] = useState(0);
  const tabRef = useRef<Tab>(null);
  tabRef.current = tab;

  // Contagem inicial de mensagens não lidas (operador → motorista)
  useEffect(() => {
    let active = true;
    supabase
      .from("chat_motorista")
      .select("*", { count: "exact", head: true })
      .eq("motorista_codigo", motorista.codigo)
      .eq("autor", "operador")
      .eq("lido", false)
      .then(({ count }) => { if (active) setUnread(count ?? 0); });

    const ch = supabase
      .channel(`chat-nav-${token}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_motorista", filter: `motorista_codigo=eq.${motorista.codigo}` },
        (payload) => {
          const m = payload.new as { autor: string; autor_nome: string | null; texto: string };
          if (m.autor !== "operador") return;
          if (tabRef.current !== "chat") {
            setUnread((u) => u + 1);
            playChatBeep();
            const nome = m.autor_nome ?? "Central";
            const preview = m.texto.length > 120 ? m.texto.slice(0, 120) + "…" : m.texto;
            toast.custom(
              (id) => (
                <button
                  onClick={() => {
                    toast.dismiss(id);
                    setTab("chat");
                  }}
                  style={{
                    display: "flex", gap: 10, alignItems: "flex-start",
                    width: 320, maxWidth: "88vw",
                    background: "#1a1a1a", color: "#f1f1f1",
                    border: "1px solid #2a2a2a", borderRadius: 12,
                    padding: 12, textAlign: "left",
                    boxShadow: "0 10px 30px rgba(0,0,0,.5)", cursor: "pointer",
                  }}
                >
                  <div style={{
                    height: 40, width: 40, borderRadius: "50%",
                    background: "#f7c600", color: "#111",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 800, flexShrink: 0,
                  }}>
                    {(nome[0] ?? "C").toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>💬 {nome}</div>
                    <div style={{
                      fontSize: 12, color: "#aaa", marginTop: 2,
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                      whiteSpace: "pre-wrap", wordBreak: "break-word",
                    }}>{preview}</div>
                  </div>
                </button>
              ),
              { duration: 6000 },
            );
          }
        },
      )
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [motorista.codigo, token]);

  const fechar = () => setTab(null);

  return (
    <>
      <nav className="moto-bnav">
        <button className={tab === "perfil" ? "active" : ""} onClick={() => setTab("perfil")}>
          <span>👤</span><i>Perfil</i>
        </button>
        <button className={tab === "chat" ? "active" : ""} onClick={() => { setTab("chat"); setUnread(0); }}>
          <span>💬{unread > 0 && <em className="bnav-dot">{unread}</em>}</span><i>Chat</i>
        </button>
        <button className={tab === "historico" ? "active" : ""} onClick={() => setTab("historico")}>
          <span>📋</span><i>Histórico</i>
        </button>
        <button className={tab === "faturamento" ? "active" : ""} onClick={() => setTab("faturamento")}>
          <span>💰</span><i>Ganhos</i>
        </button>
        <button className={tab === "pagamentos" ? "active" : ""} onClick={() => setTab("pagamentos")}>
          <span>🧾</span><i>Taxas</i>
        </button>
      </nav>

      {tab && (
        <SheetWrap titulo={tituloTab(tab)} onClose={fechar}>
          {tab === "perfil" && <PerfilTab motorista={motorista} online={online} emCorrida={emCorrida} onAlterarSenha={() => setTab("senha")} onIndicar={() => setTab("indicar")} onSair={onSair} />}
          {tab === "senha" && <SenhaTab codigo={motorista.codigo} token={token} onPronto={() => setTab("perfil")} />}
          {tab === "indicar" && <IndicarTab motorista={motorista} />}
          {tab === "chat" && <ChatTab codigo={motorista.codigo} token={token} />}
          {tab === "historico" && <HistoricoTab codigo={motorista.codigo} token={token} />}
          {tab === "faturamento" && <FaturamentoTab codigo={motorista.codigo} token={token} cobranca={cobranca} />}
          {tab === "pagamentos" && (
            <PagamentosTab
              codigo={motorista.codigo}
              token={token}
              cobranca={cobranca}
              onAbrirCobranca={() => { onAbrirCobranca(); fechar(); }}
            />
          )}
        </SheetWrap>
      )}

      <style>{cssNav}</style>
    </>
  );
}

function tituloTab(t: Exclude<Tab, null>): string {
  return ({
    perfil: "Meu perfil",
    senha: "Alterar senha",
    chat: "Chat com a central",
    historico: "Histórico de corridas",
    faturamento: "Meus ganhos",
    pagamentos: "Pagamento de taxas",
    indicar: "Indicar cliente",
  } as Record<string, string>)[t];
}

// ─── Helpers de data para filtros estilo extrato ────────
function hojeISO() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}
function inicioMesISO() {
  const d = new Date();
  d.setHours(d.getHours() - 3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function inicio7DiasISO() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(d.getHours() - 3);
  return d.toISOString().slice(0, 10);
}
function fmtDataBr(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

type PeriodoFiltro = "hoje" | "7dias" | "mes" | "personalizado";

interface FiltroPeriodo {
  de: string;
  ate: string;
}

function periodoParaDatas(p: PeriodoFiltro, customDe?: string, customAte?: string): FiltroPeriodo {
  switch (p) {
    case "hoje":
      return { de: hojeISO(), ate: hojeISO() };
    case "7dias":
      return { de: inicio7DiasISO(), ate: hojeISO() };
    case "mes":
      return { de: inicioMesISO(), ate: hojeISO() };
    default:
      return { de: customDe || hojeISO(), ate: customAte || hojeISO() };
  }
}

function SheetWrap({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="moto-sheet-overlay" onClick={onClose}>
      <div className="moto-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="moto-sheet-head">
          <h3>{titulo}</h3>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="moto-sheet-body">{children}</div>
      </div>
    </div>
  );
}

// ─── PERFIL ─────────────────────────────────────────────
function PerfilTab({ motorista, online, emCorrida, onAlterarSenha, onIndicar, onSair }: { motorista: Motorista; online: boolean; emCorrida: boolean; onAlterarSenha: () => void; onIndicar: () => void; onSair: () => void }) {
  const statusAtual = emCorrida ? "Em corrida" : online ? "Online" : "Offline";
  const linhas: [string, string | null][] = [
    ["Código", motorista.codigo],
    ["Nome", motorista.nome],
    ["Moto", motorista.moto],
    ["Placa", motorista.placa],
    ["Cor", motorista.cor],
    ["Telefone", motorista.telefone],
    ["Cidade", motorista.cidade],
    ["Status", statusAtual],
  ];
  return (
    <div className="moto-perfil">
      <div className="moto-perfil-foto" style={motorista.foto ? { backgroundImage: `url('${motorista.foto}')` } : {}}>
        {!motorista.foto && (motorista.nome[0] || "M").toUpperCase()}
      </div>
      <div className="moto-perfil-nome">{motorista.nome}</div>
      <div className="moto-perfil-cod">{motorista.codigo}</div>
      <ul className="moto-info">
        {linhas.map(([k, v]) => (
          <li key={k}><span>{k}</span><b>{v ?? "—"}</b></li>
        ))}
      </ul>
      <button className="moto-btn-primary" onClick={onIndicar}>📲 Indicar cliente</button>
      <button className="moto-btn-primary" onClick={onAlterarSenha}>🔑 Alterar senha</button>
      <button className="btn-sair" onClick={onSair} style={{ marginTop: 10 }}>
        Sair do app
      </button>
    </div>
  );
}

// ─── INDICAR ────────────────────────────────────────────
function IndicarTab({ motorista }: { motorista: Motorista }) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const link = `${typeof window !== "undefined" ? window.location.origin : ""}/cliente/cadastro?ref=${encodeURIComponent(motorista.codigo)}`;

  useEffect(() => {
    let active = true;
    import("qrcode").then((QR) => {
      QR.toDataURL(link, { width: 512, margin: 1, color: { dark: "#111111", light: "#ffffff" } })
        .then((url) => { if (active) setQrUrl(url); })
        .catch(() => {});
    });
    return () => { active = false; };
  }, [link]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const compartilhar = async () => {
    const texto = `Faça seu cadastro na Rota 013 com minha indicação: ${link}`;
    const nav = navigator as Navigator & { share?: (d: { title?: string; text?: string; url?: string }) => Promise<void> };
    if (nav.share) {
      try { await nav.share({ title: "Rota 013", text: texto, url: link }); } catch { /* cancelado */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
    }
  };

  const baixarQR = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `indicacao-${motorista.codigo}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div style={{ textAlign: "center" }}>
      <p style={{ color: "#aaa", fontSize: 13, marginBottom: 14, lineHeight: 1.5 }}>
        Compartilhe este link ou QR Code. Ao abrir, o cliente vai direto para o cadastro
        com seu código <b style={{ color: "#f7c600" }}>{motorista.codigo}</b> já preenchido.
      </p>

      <div style={{
        background: "#fff", borderRadius: 16, padding: 16, margin: "0 auto 14px",
        width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {qrUrl
          ? <img src={qrUrl} alt="QR Code de indicação" style={{ width: "100%", height: "100%" }} />
          : <span style={{ color: "#888", fontSize: 13 }}>Gerando QR Code…</span>}
      </div>

      <div style={{
        background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 12,
        padding: 12, fontSize: 12, color: "#f1f1f1", wordBreak: "break-all", textAlign: "left",
      }}>
        {link}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
        <button className="moto-btn-primary" style={{ marginTop: 0 }} onClick={copiar}>📋 Copiar link</button>
        <button className="moto-btn-primary" style={{ marginTop: 0 }} onClick={compartilhar}>↗ Compartilhar</button>
      </div>
      <button className="moto-btn-primary" onClick={baixarQR} disabled={!qrUrl}>⬇ Baixar QR Code</button>
    </div>
  );
}

// ─── SENHA ──────────────────────────────────────────────
function SenhaTab({ codigo, token, onPronto }: { codigo: string; token: string; onPronto: () => void }) {
  const alterarFn = useServerFn(motoristaAlterarSenha);
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const salvar = async () => {
    setErro("");
    if (nova.length < 4) { setErro("Senha nova deve ter pelo menos 4 caracteres."); return; }
    if (nova !== conf) { setErro("Confirmação não confere."); return; }
    setCarregando(true);
    try {
      await alterarFn({ data: { codigo, token, senhaAtual: atual, senhaNova: nova } });
      setOk(true);
      setTimeout(onPronto, 1200);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao alterar senha.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="moto-form">
      <label>Senha atual</label>
      <RawPasswordInput value={atual} onChange={(e) => setAtual(e.target.value)} />
      <label>Nova senha</label>
      <RawPasswordInput value={nova} onChange={(e) => setNova(e.target.value)} />
      <label>Confirmar nova senha</label>
      <RawPasswordInput value={conf} onChange={(e) => setConf(e.target.value)} />
      {erro && <div className="moto-erro">{erro}</div>}
      {ok && <div className="moto-ok">✓ Senha alterada!</div>}
      <button className="moto-btn-primary" disabled={carregando || !atual || !nova} onClick={salvar}>
        {carregando ? "Salvando…" : "Salvar nova senha"}
      </button>
    </div>
  );
}

// ─── CHAT ───────────────────────────────────────────────
type Msg = { id: number; autor: string; autor_nome: string | null; texto: string; criado_em: string };
function ChatTab({ codigo, token }: { codigo: string; token: string }) {
  const listarFn = useServerFn(motoristaListarChat);
  const enviarFn = useServerFn(motoristaEnviarMensagem);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listarFn({ data: { codigo, token } })
      .then((r) => setMsgs(r.mensagens as Msg[]))
      .catch(() => {});
    const ch = supabase
      .channel(`chat-tab-${token}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_motorista", filter: `motorista_codigo=eq.${codigo}` },
        (payload) => setMsgs((cur) => [...cur, payload.new as Msg]),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [codigo, token, listarFn]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      await enviarFn({ data: { codigo, token, texto: t } });
      setTexto("");
    } catch { /* ignore */ } finally { setEnviando(false); }
  };

  return (
    <div className="moto-chat">
      <div className="moto-chat-lista">
        {msgs.length === 0 && <div className="moto-empty">Nenhuma mensagem ainda. Envie a primeira!</div>}
        {msgs.map((m) => {
          const isSelf = m.autor === "motorista" || m.autor === "motociclista";
          return (
            <div key={m.id} className={`moto-msg ${isSelf ? "self" : "op"}`}>
              <div className="moto-msg-autor">{isSelf ? "Você" : (m.autor_nome ?? "Central")}</div>
              <div className="moto-msg-texto">{m.texto}</div>
            </div>
          );
        })}
        <div ref={fimRef} />
      </div>
      <div className="moto-chat-input">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite uma mensagem…"
          onKeyDown={(e) => e.key === "Enter" && enviar()}
        />
        <button onClick={enviar} disabled={enviando || !texto.trim()}>➤</button>
      </div>
    </div>
  );
}

// ─── HISTÓRICO ──────────────────────────────────────────
function HistoricoTab({ codigo, token }: { codigo: string; token: string }) {
  const listarFn = useServerFn(motoristaListarCorridas);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("hoje");
  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [carregando, setCarregando] = useState(false);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [ultimaBusca, setUltimaBusca] = useState<PeriodoFiltro | null>(null);

  const buscar = async (p: PeriodoFiltro) => {
    const datas = periodoParaDatas(p, de, ate);
    setCarregando(true);
    try {
      const r = await listarFn({ data: { codigo, token, de: datas.de, ate: datas.ate } });
      setCorridas(r.corridas as Corrida[]);
      setUltimaBusca(p);
    } catch {
      setCorridas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscar(periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const datasAtuais = periodoParaDatas(periodo, de, ate);
  const periodoLabel =
    periodo === "hoje"
      ? "Hoje"
      : periodo === "7dias"
      ? "Últimos 7 dias"
      : periodo === "mes"
      ? "Este mês"
      : `${fmtDataBr(datasAtuais.de)} a ${fmtDataBr(datasAtuais.ate)}`;

  return (
    <div>
      {/* Filtros rápidos */}
      <div className="moto-filtros">
        {(["hoje", "7dias", "mes", "personalizado"] as PeriodoFiltro[]).map((p) => (
          <button
            key={p}
            className={periodo === p ? "active" : ""}
            onClick={() => setPeriodo(p)}
          >
            {p === "hoje" ? "Hoje" : p === "7dias" ? "7 dias" : p === "mes" ? "Mês" : "Período"}
          </button>
        ))}
      </div>

      {/* Personalizado */}
      {periodo === "personalizado" && (
        <div className="moto-filtro-datas">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <span>até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          <button className="moto-btn-buscar" onClick={() => buscar("personalizado")}>
            Buscar
          </button>
        </div>
      )}

      <div className="moto-periodo-label">{periodoLabel}</div>

      {carregando && <div className="moto-empty">Carregando…</div>}
      {!carregando && corridas.length === 0 && <div className="moto-empty">Nenhuma corrida no período.</div>}

      {!carregando && corridas.length > 0 && (
        <div className="moto-historico">
          {corridas.map((c) => (
            <div key={c.id} className="moto-hist-item">
              <div className="moto-hist-head">
                <span>#{c.id} — {c.cliente ?? "Cliente"}</span>
                <b>{brl(Number(c.valor_final ?? 0))}</b>
              </div>
              <div className="moto-hist-end">📍 {c.origem}<br />🏁 {c.destino ?? "-"}</div>
              <span className="moto-hist-badge">{c.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FATURAMENTO ────────────────────────────────────────
function FaturamentoTab({ codigo, token, cobranca }: { codigo: string; token: string; cobranca: Cobranca }) {
  const listarFn = useServerFn(motoristaListarCorridas);
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("hoje");
  const [de, setDe] = useState(hojeISO());
  const [ate, setAte] = useState(hojeISO());
  const [carregando, setCarregando] = useState(false);
  const [corridas, setCorridas] = useState<Corrida[]>([]);

  const buscar = async (p: PeriodoFiltro) => {
    const datas = periodoParaDatas(p, de, ate);
    setCarregando(true);
    try {
      const r = await listarFn({ data: { codigo, token, de: datas.de, ate: datas.ate } });
      setCorridas(r.corridas as Corrida[]);
    } catch {
      setCorridas([]);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    buscar(periodo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  const datasAtuais = periodoParaDatas(periodo, de, ate);
  const periodoLabel =
    periodo === "hoje"
      ? "Hoje"
      : periodo === "7dias"
      ? "Últimos 7 dias"
      : periodo === "mes"
      ? "Este mês"
      : `${fmtDataBr(datasAtuais.de)} a ${fmtDataBr(datasAtuais.ate)}`;

  const finalizadas = corridas.filter((c) => c.status === "Finalizada");
  const total = finalizadas.reduce((s, c) => s + Number(c.valor_final ?? 0), 0);
  const diaria = Number(cobranca?.valor_diaria ?? 0);
  const liquido = total - diaria;

  return (
    <div>
      {/* Filtros rápidos */}
      <div className="moto-filtros">
        {(["hoje", "7dias", "mes", "personalizado"] as PeriodoFiltro[]).map((p) => (
          <button
            key={p}
            className={periodo === p ? "active" : ""}
            onClick={() => setPeriodo(p)}
          >
            {p === "hoje" ? "Hoje" : p === "7dias" ? "7 dias" : p === "mes" ? "Mês" : "Período"}
          </button>
        ))}
      </div>

      {periodo === "personalizado" && (
        <div className="moto-filtro-datas">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          <span>até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          <button className="moto-btn-buscar" onClick={() => buscar("personalizado")}>
            Buscar
          </button>
        </div>
      )}

      <div className="moto-periodo-label">{periodoLabel}</div>

      {carregando && <div className="moto-empty">Carregando…</div>}

      {!carregando && (
        <div className="moto-fat">
          <div className="moto-fat-card big">
            <span>Ganho bruto — {periodoLabel}</span>
            <b>{brl(total)}</b>
          </div>
          <div className="moto-fat-grid">
            <div className="moto-fat-card">
              <span>Corridas finalizadas</span><b>{finalizadas.length}</b>
            </div>
            <div className="moto-fat-card">
              <span>Diária de hoje</span><b>{brl(diaria)}</b>
            </div>
          </div>
          <div className={`moto-fat-card big ${liquido >= 0 ? "ok" : "warn"}`}>
            <span>Líquido (após diária)</span>
            <b>{brl(liquido)}</b>
          </div>
          <div className="moto-fat-status">
            Status do pagamento: <b>{cobranca?.status ?? "—"}</b>
          </div>

          {finalizadas.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="section-title" style={{ padding: "12px 0 6px", fontSize: 12 }}>
                Corridas do período
              </div>
              <div className="moto-historico">
                {finalizadas.map((c) => (
                  <div key={c.id} className="moto-hist-item">
                    <div className="moto-hist-head">
                      <span>#{c.id} — {c.cliente ?? "Cliente"}</span>
                      <b>{brl(Number(c.valor_final ?? 0))}</b>
                    </div>
                    <div className="moto-hist-end">📍 {c.origem}<br />🏁 {c.destino ?? "-"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PAGAMENTOS ─────────────────────────────────────────
function PagamentosTab({
  codigo, token, cobranca, onAbrirCobranca,
}: {
  codigo: string;
  token: string;
  cobranca: Cobranca;
  onAbrirCobranca: () => void;
}) {
  const status = cobranca?.status ?? "Pendente";
  const cor = status === "Bloqueado" ? "#dc2626" : status === "Pago" ? "#16a34a" : status === "Aguardando" ? "#d97706" : "#555";

  const listarFn = useServerFn(motoristaListarCobrancasExtras);
  const { data } = useQuery({
    queryKey: ["motorista-cobrancas-extras", codigo],
    queryFn: () => listarFn({ data: { codigo, token } }),
    refetchInterval: 30000,
  });

  const itens = data?.itens ?? [];
  const abertas = itens.filter((i) => i.status === "aberta");
  const totalDevido = abertas.reduce((s, i) => s + i.saldo, 0);

  return (
    <div className="moto-pag">
      <div className="moto-pag-status" style={{ color: cor }}>{status}</div>
      <div className="moto-pag-row"><span>Faturamento do dia</span><b>{brl(Number(cobranca?.faturamento_dia ?? 0))}</b></div>
      <div className="moto-pag-row"><span>Valor da diária</span><b>{brl(Number(cobranca?.valor_diaria ?? 0))}</b></div>
      {cobranca?.comprovante_enviado_em && (
        <div className="moto-pag-info">📨 Comprovante enviado em {new Date(cobranca.comprovante_enviado_em).toLocaleString("pt-BR")}</div>
      )}
      <button className="moto-btn-primary" onClick={onAbrirCobranca}>
        Abrir tela de pagamento (PIX)
      </button>
      <p className="moto-pag-help">
        Após pagar, envie o comprovante no WhatsApp da central para liberação imediata.
      </p>

      {/* ─── Cobranças extras (camiseta, manutenção, itens) ─── */}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #2a2a2a" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h4 style={{ color: "#f7c600", fontSize: 14, fontWeight: 800 }}>📦 Outras cobranças</h4>
          {totalDevido > 0 && (
            <span style={{ background: "#dc2626", color: "#fff", padding: "3px 8px", borderRadius: 8, fontSize: 12, fontWeight: 700 }}>
              Devendo {brl(totalDevido)}
            </span>
          )}
        </div>
        {itens.length === 0 && (
          <div className="moto-empty" style={{ padding: "12px 0" }}>Nenhuma cobrança extra.</div>
        )}
        {itens.map((i) => (
          <div key={i.id} style={{
            background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 10,
            padding: 10, marginBottom: 8,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{i.descricao}</div>
                <div style={{ color: "#888", fontSize: 11 }}>
                  {i.valor_parcela_dia > 0 ? `${brl(i.valor_parcela_dia)}/dia` : "Avulsa"}
                </div>
              </div>
              <span style={{
                background: i.status === "quitada" ? "#16a34a" : "#d97706",
                color: "#fff", padding: "2px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700,
              }}>
                {i.status === "quitada" ? "QUITADO" : "ABERTO"}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 8, fontSize: 11 }}>
              <div><div style={{ color: "#888" }}>Total</div><b style={{ color: "#fff" }}>{brl(i.valor_total)}</b></div>
              <div><div style={{ color: "#888" }}>Pago</div><b style={{ color: "#16a34a" }}>{brl(i.valor_pago)}</b></div>
              <div><div style={{ color: "#888" }}>Saldo</div><b style={{ color: i.saldo > 0 ? "#f7c600" : "#16a34a" }}>{brl(i.saldo)}</b></div>
            </div>
            {i.lancamentos.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary style={{ color: "#888", fontSize: 11, cursor: "pointer" }}>Ver extrato ({i.lancamentos.length})</summary>
                <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px dashed #2a2a2a" }}>
                  {i.lancamentos.map((l, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa", padding: "2px 0" }}>
                      <span>{new Date(l.data).toLocaleDateString("pt-BR")}</span>
                      <b style={{ color: "#fff" }}>{brl(l.valor)}</b>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── CSS ────────────────────────────────────────────────
const cssNav = `
.moto-app .moto-bnav {
  position:fixed; left:0; right:0; bottom:0;
  background:#111; border-top:1px solid #2a2a2a;
  display:grid; grid-template-columns:repeat(5,1fr);
  padding:6px 4px calc(6px + env(safe-area-inset-bottom));
  z-index:900;
}
.moto-app .moto-bnav button {
  background:transparent; border:0; color:#888; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; gap:2px;
  padding:6px 2px; font-size:10px; font-weight:600;
  text-transform:uppercase; letter-spacing:.5px;
}
.moto-app .moto-bnav button.active { color:#f7c600; }
.moto-app .moto-bnav button span { font-size:20px; line-height:1; position:relative; }
.moto-app .moto-bnav button i { font-style:normal; }
.moto-app .moto-bnav .bnav-dot {
  position:absolute; top:-4px; right:-10px;
  background:#ef4444; color:#fff; font-size:9px; font-weight:700;
  border-radius:10px; padding:1px 5px; font-style:normal;
}
.moto-app .home-scroll, .moto-app .corrente-scroll { padding-bottom:calc(72px + env(safe-area-inset-bottom)) !important; }

.moto-app .moto-sheet-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.7); z-index:950;
  display:flex; align-items:flex-end;
}
.moto-app .moto-sheet {
  background:#1a1a1a; width:100%; max-height:90vh;
  border-radius:24px 24px 0 0; display:flex; flex-direction:column;
  animation: moto-slide .25s ease-out;
}
@keyframes moto-slide { from { transform:translateY(100%); } to { transform:translateY(0); } }
.moto-app .moto-sheet-head {
  display:flex; align-items:center; justify-content:space-between;
  padding:16px 20px; border-bottom:1px solid #2a2a2a; flex-shrink:0;
}
.moto-app .moto-sheet-head h3 { font-size:16px; font-weight:800; color:#fff; }
.moto-app .moto-sheet-head button {
  background:transparent; border:0; color:#888; font-size:22px; cursor:pointer;
}
.moto-app .moto-sheet-body {
  flex:1; overflow-y:auto; padding:16px 20px calc(20px + env(safe-area-inset-bottom));
}

.moto-app .moto-empty { text-align:center; color:#888; padding:40px 0; }
.moto-app .moto-erro { background:#3a1414; color:#fca5a5; padding:10px; border-radius:10px; font-size:13px; }
.moto-app .moto-ok { background:#143a1c; color:#86efac; padding:10px; border-radius:10px; font-size:13px; }
.moto-app .moto-btn-primary {
  width:100%; background:#f7c600; color:#111; font-weight:800;
  border:0; border-radius:14px; padding:16px; cursor:pointer; margin-top:14px; font-size:15px;
}
.moto-app .moto-btn-primary:disabled { opacity:.5; }

.moto-app .moto-perfil { text-align:center; }
.moto-app .moto-perfil-foto {
  width:96px; height:96px; border-radius:50%; margin:0 auto 12px;
  background:#f7c600 center/cover no-repeat; color:#111;
  font-size:36px; font-weight:900; display:flex; align-items:center; justify-content:center;
}
.moto-app .moto-perfil-nome { font-size:20px; font-weight:800; color:#fff; }
.moto-app .moto-perfil-cod { font-size:12px; color:#888; margin-bottom:16px; letter-spacing:2px; }
.moto-app .moto-info { list-style:none; padding:0; margin:0; text-align:left; }
.moto-app .moto-info li {
  display:flex; justify-content:space-between; padding:10px 4px;
  border-bottom:1px solid #2a2a2a; font-size:14px;
}
.moto-app .moto-info li span { color:#888; }
.moto-app .moto-info li b { color:#f1f1f1; }

.moto-app .moto-form label {
  display:block; font-size:11px; color:#888; margin:12px 0 6px;
  text-transform:uppercase; letter-spacing:1px;
}
.moto-app .moto-form input {
  width:100%; background:#0f0f0f; border:1.5px solid #2a2a2a;
  border-radius:12px; padding:14px; color:#f1f1f1; outline:none; font-size:16px;
}
.moto-app .moto-form input:focus { border-color:#f7c600; }

.moto-app .moto-chat { display:flex; flex-direction:column; height:60vh; }
.moto-app .moto-chat-lista {
  flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-bottom:8px;
}
.moto-app .moto-msg {
  max-width:80%; padding:10px 14px; border-radius:16px; font-size:14px;
  line-height:1.35; box-shadow:0 2px 6px rgba(0,0,0,.25);
}
.moto-app .moto-msg.self {
  background-image:linear-gradient(135deg,#c9a84c 0%,#f0d78c 100%);
  color:#0d0d0d; align-self:flex-end; border-bottom-right-radius:4px;
}
.moto-app .moto-msg.op {
  background:#222; color:#f1f1f1; align-self:flex-start;
  border:1px solid rgba(201,168,76,.18); border-bottom-left-radius:4px;
}
.moto-app .moto-msg.self .moto-msg-autor { color:#0d0d0d; opacity:.65; text-align:right; }
.moto-app .moto-msg.op .moto-msg-autor { color:#c9a84c; opacity:1; }
.moto-app .moto-msg-autor { font-size:10px; margin-bottom:2px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
.moto-app .moto-chat-input { display:flex; gap:8px; padding-top:8px; border-top:1px solid #2a2a2a; }
.moto-app .moto-chat-input input {
  flex:1; background:#0f0f0f; border:1.5px solid #2a2a2a; border-radius:12px;
  padding:12px 14px; color:#f1f1f1; outline:none; font-size:15px;
}
.moto-app .moto-chat-input button {
  background:#f7c600; color:#111; border:0; border-radius:12px;
  padding:0 18px; font-size:18px; font-weight:800; cursor:pointer;
}

.moto-app .moto-historico { display:flex; flex-direction:column; gap:10px; }
.moto-app .moto-hist-item { background:#0f0f0f; border:1px solid #2a2a2a; border-radius:14px; padding:12px; }
.moto-app .moto-hist-head { display:flex; justify-content:space-between; font-size:13px; margin-bottom:6px; }
.moto-app .moto-hist-head b { color:#f7c600; font-size:15px; }
.moto-app .moto-hist-end { font-size:12px; color:#888; line-height:1.5; }
.moto-app .moto-hist-badge {
  display:inline-block; margin-top:6px; padding:3px 10px; border-radius:12px;
  background:#1a1a1a; color:#888; font-size:11px; font-weight:700;
}

.moto-app .moto-fat { display:flex; flex-direction:column; gap:10px; }
.moto-app .moto-fat-card {
  background:#0f0f0f; border:1px solid #2a2a2a; border-radius:14px;
  padding:14px; display:flex; justify-content:space-between; align-items:center;
}
.moto-app .moto-fat-card span { font-size:12px; color:#888; text-transform:uppercase; letter-spacing:.5px; }
.moto-app .moto-fat-card b { font-size:18px; color:#f1f1f1; font-weight:800; }
.moto-app .moto-fat-card.big b { color:#f7c600; font-size:24px; }
.moto-app .moto-fat-card.big.ok b { color:#4ade80; }
.moto-app .moto-fat-card.big.warn b { color:#ef4444; }
.moto-app .moto-fat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
.moto-app .moto-fat-status { text-align:center; color:#888; margin-top:8px; font-size:13px; }
.moto-app .moto-fat-status b { color:#f1f1f1; }

.moto-app .moto-pag { display:flex; flex-direction:column; gap:10px; }
.moto-app .moto-pag-status {
  text-align:center; font-size:24px; font-weight:900; padding:14px;
  background:#0f0f0f; border-radius:14px; border:1px solid #2a2a2a;
}
.moto-app .moto-pag-row {
  display:flex; justify-content:space-between; padding:10px 4px;
  border-bottom:1px solid #2a2a2a; font-size:14px;
}
.moto-app .moto-pag-row span { color:#888; }
.moto-app .moto-pag-row b { color:#f1f1f1; }
.moto-app .moto-pag-info { color:#86efac; font-size:13px; padding:8px 0; }
.moto-app .moto-pag-help { color:#888; font-size:12px; text-align:center; margin-top:8px; }

.moto-app .moto-filtros {
  display:flex; gap:6px; margin-bottom:10px;
}
.moto-app .moto-filtros button {
  flex:1; background:#0f0f0f; border:1.5px solid #2a2a2a; border-radius:10px;
  padding:8px 4px; color:#888; font-size:12px; font-weight:700; cursor:pointer;
}
.moto-app .moto-filtros button.active {
  background:#f7c600; color:#111; border-color:#f7c600;
}
.moto-app .moto-filtro-datas {
  display:flex; align-items:center; gap:6px; margin-bottom:10px; flex-wrap:wrap;
}
.moto-app .moto-filtro-datas input[type="date"] {
  background:#0f0f0f; border:1.5px solid #2a2a2a; border-radius:10px;
  padding:8px 10px; color:#f1f1f1; font-size:14px; outline:none;
}
.moto-app .moto-filtro-datas span { color:#888; font-size:12px; }
.moto-app .moto-btn-buscar {
  background:#f7c600; color:#111; border:0; border-radius:10px;
  padding:8px 14px; font-size:13px; font-weight:800; cursor:pointer;
}
.moto-app .moto-periodo-label {
  font-size:12px; color:#888; margin-bottom:10px; text-align:center;
}
`;
