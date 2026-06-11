import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  motoristaLogin,
  motoristaLogout,
  motoristaToggleStatus,
  motoristaEnviarGps,
  motoristaAceitarOferta,
  motoristaRecusarOferta,
  motoristaAtualizarStatusCorrida,
  motoristaCarregarContexto,
  motoristaCarregarCorrida,
  motoristaConcluirParada,
} from "@/lib/motorista.functions";
import {
  motoristaMinhaCobranca,
  motoristaSolicitarLiberacao,
} from "@/lib/cobranca.functions";
import { expirarOferta } from "@/lib/corridas.functions";
import { CobrancaModal } from "@/components/motorista/cobranca-modal";
import { MotoristaBottomNav } from "@/components/motorista/bottom-nav";
import { PanicButton } from "@/components/motorista/panic-button";
import { playChatBeep } from "@/lib/notification-sound";
import { LogoRota013 } from "@/components/logo-rota013";

export const Route = createFileRoute("/motorista")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Rota 013 — Motociclista" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
      { name: "theme-color", content: "#f7c600" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Rota 013" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [{ rel: "manifest", href: "/manifest.webmanifest" }],
  }),
  component: MotoristaApp,
});

// ─── Tipos ────────────────────────────────────────────
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
type Parada = {
  ordem: number;
  endereco: string;
  lat?: number | null;
  lng?: number | null;
  concluida_em?: string | null;
};
type Corrida = {
  id: number;
  cliente: string | null;
  origem: string;
  destino: string | null;
  status: string;
  valor_final: number | null;
  motorista_codigo?: string | null;
  paradas?: Parada[] | null;
  pagamento?: string | null;
};
type Oferta = {
  ofertaId: number;
  corridaId: number;
  cliente: string | null;
  origem: string;
  destino: string | null;
  valor: number;
  distancia: number | null;
};

const STORAGE = "rota013_motorista";
const TIMEOUT_OFERTA_MS = 30000;

function getDeviceId() {
  let d = localStorage.getItem("rota013_device_id");
  if (!d) {
    d = "dev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("rota013_device_id", d);
  }
  return d;
}

function brl(v: number | null | undefined) {
  return `R$ ${(Number(v) || 0).toFixed(2).replace(".", ",")}`;
}

// ═══════════════════════════════════════════════════════
function MotoristaApp() {
  const loginFn = useServerFn(motoristaLogin);
  const logoutFn = useServerFn(motoristaLogout);
  const toggleFn = useServerFn(motoristaToggleStatus);
  const gpsFn = useServerFn(motoristaEnviarGps);
  const aceitarFn = useServerFn(motoristaAceitarOferta);
  const recusarFn = useServerFn(motoristaRecusarOferta);
  const statusCorridaFn = useServerFn(motoristaAtualizarStatusCorrida);
  const contextoFn = useServerFn(motoristaCarregarContexto);
  const carregarCorridaFn = useServerFn(motoristaCarregarCorrida);
  const concluirParadaFn = useServerFn(motoristaConcluirParada);
  const expirarOfertaFn = useServerFn(expirarOferta);

  const [sessao, setSessao] = useState<{ motorista: Motorista; token: string } | null>(null);
  const [tela, setTela] = useState<"login" | "home" | "corrida">("login");
  const [online, setOnline] = useState(false);
  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [corridaAtual, setCorridaAtual] = useState<Corrida | null>(null);
  const [corridasHoje, setCorridasHoje] = useState<Corrida[]>([]);
  const [config, setConfig] = useState<{ valorDiaria?: number; pixChave?: string }>({});
  const [toast, setToast] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [loginCodigo, setLoginCodigo] = useState("");
  const [loginSenha, setLoginSenha] = useState("");
  const [loginErro, setLoginErro] = useState("");
  const [cobranca, setCobranca] = useState<{ status: string; faturamento_dia: number; valor_diaria: number; comprovante_enviado_em: string | null } | null>(null);
  const [cobrancaCfg, setCobrancaCfg] = useState<{ pixChave?: string; tipoChavePix?: string; whatsappCentral?: string; empresa?: string }>({});
  const [enviandoLib, setEnviandoLib] = useState(false);
  const [forcarCobranca, setForcarCobranca] = useState(false);
  const minhaCobrancaFn = useServerFn(motoristaMinhaCobranca);
  const solicitarLibFn = useServerFn(motoristaSolicitarLiberacao);

  const gpsWatchRef = useRef<number | null>(null);
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const ofertaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ultimoStatusCobrancaRef = useRef<string | null>(null);
  // Intenção do motociclista: ficou online por escolha própria? Usado para
  // restaurar status ao voltar do background (visibilitychange/pagehide).
  const intencaoOnlineRef = useRef<boolean>(false);
  const forcadoOfflineBgRef = useRef<boolean>(false);

  // Notifica (toast) quando entra em Pendente — sem abrir modal bloqueante
  useEffect(() => {
    if (!cobranca) return;
    const prev = ultimoStatusCobrancaRef.current;
    if (prev !== "Pendente" && cobranca.status === "Pendente") {
      const fat = Number(cobranca.faturamento_dia || 0);
      const di = Number(cobranca.valor_diaria || 0);
      setToast(`💰 Você atingiu a diária (R$ ${fat.toFixed(2).replace(".", ",")} / R$ ${di.toFixed(2).replace(".", ",")}). Pague quando puder pelo menu Taxas.`);
      setTimeout(() => setToast(""), 6000);
    }
    ultimoStatusCobrancaRef.current = cobranca.status;
  }, [cobranca]);

  // ─── Toast helper ───────────────────────────────────
  const mostrarToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  // ─── Restaurar sessão ───────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE);
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setSessao(s);
        setTela("home");
      } catch {
        localStorage.removeItem(STORAGE);
      }
    }
  }, []);

  // ─── Carregar contexto + assinar realtime quando logado ─
  const recarregarContexto = useCallback(async () => {
    if (!sessao) return;
    try {
      const ctx = await contextoFn({
        data: { codigo: sessao.motorista.codigo, token: sessao.token },
      });
      setCorridaAtual(ctx.corridaAtual as Corrida | null);
      setCorridasHoje((ctx.corridasHoje as Corrida[]) ?? []);
      setConfig(ctx.config);
      const estaOnline = ctx.motorista?.status === "Online" || ctx.motorista?.status === "Em corrida";
      setOnline(estaOnline);
      if (estaOnline) intencaoOnlineRef.current = true;
      if (ctx.oferta && !oferta) setOferta(ctx.oferta);
      if (ctx.corridaAtual && tela !== "corrida") setTela("corrida");
    } catch (e) {
      console.error("contexto:", e);
    }
  }, [sessao, contextoFn, oferta, tela]);

  useEffect(() => {
    if (!sessao) return;
    recarregarContexto();

    const apresentarOferta = async (ofertaId: number, corridaId: number) => {
      const { corrida } = await carregarCorridaFn({
        data: {
          codigo: sessao.motorista.codigo,
          token: sessao.token,
          corridaId,
        },
      });
      if (!corrida) return;
      setOferta({
        ofertaId,
        corridaId: corrida.id,
        cliente: corrida.cliente,
        origem: corrida.origem,
        destino: corrida.destino,
        valor: Number(corrida.valor_final ?? 0),
        distancia: corrida.distancia_km as number | null,
      });
      try {
        navigator.vibrate?.([200, 100, 200, 100, 200]);
      } catch {
        /* ignore */
      }
      try { playChatBeep(); } catch { /* ignore */ }
    };

    // Realtime: novas ofertas para este motorista
    const channel = supabase
      .channel(`motorista-${sessao.motorista.codigo}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "corrida_ofertas",
          filter: `motorista_codigo=eq.${sessao.motorista.codigo}`,
        },
        async (payload) => {
          const o = payload.new as { id: number; corrida_id: number; status: string };
          if (o.status !== "pendente") return;
          await apresentarOferta(o.id, o.corrida_id);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "corrida_ofertas",
          filter: `motorista_codigo=eq.${sessao.motorista.codigo}`,
        },
        async (payload) => {
          const o = payload.new as { id: number; corrida_id: number; status: string };
          // Reoferta: o upsert no servidor reativa o registro como "pendente" → exibir card novamente
          if (o.status === "pendente") {
            await apresentarOferta(o.id, o.corrida_id);
            return;
          }
          setOferta((cur) => (cur && o.id === cur.ofertaId ? null : cur));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "corridas",
          filter: `motorista_codigo=eq.${sessao.motorista.codigo}`,
        },
        () => {
          recarregarContexto();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "motorista_cobranca",
          filter: `motorista_codigo=eq.${sessao.motorista.codigo}`,
        },
        async () => {
          try {
            const r = await minhaCobrancaFn({ data: { codigo: sessao.motorista.codigo, token: sessao.token } });
            setCobranca(r.cobranca as typeof cobranca);
            setCobrancaCfg(r.config);
          } catch { /* ignore */ }
        },
      )
      .subscribe();

    // carrega cobrança inicial
    minhaCobrancaFn({ data: { codigo: sessao.motorista.codigo, token: sessao.token } })
      .then((r) => { setCobranca(r.cobranca as typeof cobranca); setCobrancaCfg(r.config); })
      .catch(() => {});

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessao, carregarCorridaFn, recarregarContexto]);

  // ─── Countdown da oferta ────────────────────────────
  useEffect(() => {
    if (!oferta) {
      if (ofertaTimerRef.current) clearTimeout(ofertaTimerRef.current);
      return;
    }
    const ofertaAtual = oferta;
    ofertaTimerRef.current = setTimeout(() => {
      setOferta(null);
      mostrarToast("Tempo esgotado");
      // Avisa o servidor para expirar e disparar nova rodada se ninguém mais tiver a oferta
      expirarOfertaFn({
        data: { ofertaId: ofertaAtual.ofertaId, corridaId: ofertaAtual.corridaId },
      }).catch(() => {});
    }, TIMEOUT_OFERTA_MS);
    return () => {
      if (ofertaTimerRef.current) clearTimeout(ofertaTimerRef.current);
    };
  }, [oferta, expirarOfertaFn]);

  // ─── GPS ────────────────────────────────────────────
  // Envia uma posição imediatamente (usado no início e como reforço periódico
  // caso o watchPosition pare de disparar callbacks com o app em foreground).
  const enviarPosicaoAgora = useCallback(() => {
    if (!sessao || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        gpsFn({
          data: {
            codigo: sessao.motorista.codigo,
            token: sessao.token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            velocidade: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          },
        }).catch(() => {});
      },
      (err) => console.warn("GPS (one-shot):", err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
    );
  }, [sessao, gpsFn]);

  const iniciarGps = useCallback(() => {
    if (!sessao || !navigator.geolocation) return;
    if (gpsWatchRef.current !== null) navigator.geolocation.clearWatch(gpsWatchRef.current);
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current);

    // Posição imediata ao iniciar (não espera o primeiro fix do watch).
    enviarPosicaoAgora();

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        gpsFn({
          data: {
            codigo: sessao.motorista.codigo,
            token: sessao.token,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            velocidade: pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0,
          },
        }).catch(() => {});
      },
      (err) => console.warn("GPS:", err.message),
      // maximumAge:0 força fix novo a cada notificação — evita pin "preso"
      // no endereço onde o motorista ficou online.
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );

    // Backup: a cada 10s força um getCurrentPosition mesmo se o watch não
    // disparar (alguns navegadores param o watch parado, sem movimento).
    gpsIntervalRef.current = setInterval(() => {
      enviarPosicaoAgora();
    }, 10000);
  }, [sessao, gpsFn, enviarPosicaoAgora]);

  const pararGps = useCallback(() => {
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current);
      gpsIntervalRef.current = null;
    }
  }, []);

  useEffect(() => () => pararGps(), [pararGps]);

  // Auto-start do GPS sempre que o motorista está logado e online — inclusive
  // ao restaurar a sessão (antes só iniciava no clique de "Ficar Online").
  useEffect(() => {
    if (sessao && online) {
      iniciarGps();
    } else {
      pararGps();
    }
  }, [sessao, online, iniciarGps, pararGps]);

  // ─── App em background/fechado: força Offline para não receber corridas ─
  // Sem isso o painel acha que o motorista está online mas ele não responde
  // a notificações nem recebe ofertas. Ao voltar para foreground, restaura
  // o status Online automaticamente se essa era a intenção do motorista.
  useEffect(() => {
    if (!sessao) return;

    const irOffline = (motivo: string) => {
      if (!intencaoOnlineRef.current) return;
      forcadoOfflineBgRef.current = true;
      pararGps();
      // fire-and-forget — o app pode estar sendo encerrado
      toggleFn({
        data: { codigo: sessao.motorista.codigo, token: sessao.token, online: false },
      }).then(() => {
        setOnline(false);
        console.info("[bg] offline:", motivo);
      }).catch(() => {});
    };

    const voltarOnline = async () => {
      if (!intencaoOnlineRef.current || !forcadoOfflineBgRef.current) return;
      try {
        await toggleFn({
          data: { codigo: sessao.motorista.codigo, token: sessao.token, online: true },
        });
        setOnline(true);
        forcadoOfflineBgRef.current = false;
        enviarPosicaoAgora();
        recarregarContexto();
      } catch (e) {
        console.warn("[fg] falha ao restaurar online:", e);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") irOffline("visibilitychange");
      else if (document.visibilityState === "visible") voltarOnline();
    };
    const onPageHide = () => irOffline("pagehide");

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [sessao, toggleFn, pararGps, enviarPosicaoAgora, recarregarContexto]);

  // ─── Ações ──────────────────────────────────────────
  const fazerLogin = async () => {
    setLoginErro("");
    if (!loginCodigo || !loginSenha) {
      setLoginErro("Preencha código e senha.");
      return;
    }
    setCarregando(true);
    try {
      const r = await loginFn({
        data: {
          codigo: loginCodigo.toUpperCase(),
          senha: loginSenha,
          deviceId: getDeviceId(),
          deviceNome: navigator.userAgent.slice(0, 100),
        },
      });
      const nova = { motorista: r.motorista as Motorista, token: r.token };
      localStorage.setItem(STORAGE, JSON.stringify(nova));
      setSessao(nova);
      setTela("home");
      setLoginCodigo("");
      setLoginSenha("");
    } catch (e: unknown) {
      setLoginErro(e instanceof Error ? e.message : "Erro de conexão.");
    } finally {
      setCarregando(false);
    }
  };

  const sair = async () => {
    if (!sessao) return;
    if (!confirm("Deseja sair?")) return;
    pararGps();
    try {
      await logoutFn({ data: { codigo: sessao.motorista.codigo, token: sessao.token } });
    } catch {
      /* ignore */
    }
    localStorage.removeItem(STORAGE);
    setSessao(null);
    setOnline(false);
    setCorridaAtual(null);
    setOferta(null);
    setTela("login");
  };

  const alternarStatus = async () => {
    if (!sessao) return;
    const novo = !online;
    try {
      await toggleFn({
        data: { codigo: sessao.motorista.codigo, token: sessao.token, online: novo },
      });
      // Marca a intenção do motorista — usado para restaurar Online quando
      // ele voltar do background depois de um auto-offline.
      intencaoOnlineRef.current = novo;
      forcadoOfflineBgRef.current = false;
      setOnline(novo);
      // GPS é controlado pelo useEffect [sessao, online].
    } catch (e: unknown) {
      mostrarToast(e instanceof Error ? e.message : "Erro");
    }
  };

  const aceitarOferta = async () => {
    if (!sessao || !oferta) return;
    setCarregando(true);
    try {
      const r = await aceitarFn({
        data: {
          codigo: sessao.motorista.codigo,
          token: sessao.token,
          ofertaId: oferta.ofertaId,
        },
      });
      setOferta(null);
      setCorridaAtual(r.corrida as Corrida);
      setTela("corrida");
      mostrarToast("Corrida aceita ✓");
    } catch (e: unknown) {
      mostrarToast(e instanceof Error ? e.message : "Erro");
      setOferta(null);
    } finally {
      setCarregando(false);
    }
  };

  const recusarOferta = async () => {
    if (!sessao || !oferta) return;
    try {
      await recusarFn({
        data: {
          codigo: sessao.motorista.codigo,
          token: sessao.token,
          ofertaId: oferta.ofertaId,
        },
      });
    } catch {
      /* ignore */
    }
    setOferta(null);
    mostrarToast("Corrida recusada");
  };

  const mudarStatusCorrida = async (s: "A caminho" | "Chegou" | "Em viagem" | "Finalizada") => {
    if (!sessao || !corridaAtual) return;
    setCarregando(true);
    try {
      await statusCorridaFn({
        data: {
          codigo: sessao.motorista.codigo,
          token: sessao.token,
          corridaId: corridaAtual.id,
          status: s,
        },
      });
      if (s === "Finalizada") {
        setCorridaAtual(null);
        setTela("home");
        mostrarToast("Corrida finalizada ✓");
        recarregarContexto();
      } else {
        setCorridaAtual({ ...corridaAtual, status: s });
      }
    } catch (e: unknown) {
      mostrarToast(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
    }
  };

  const concluirParada = async (ordem: number, desfazer = false) => {
    if (!sessao || !corridaAtual) return;
    setCarregando(true);
    try {
      await concluirParadaFn({
        data: {
          codigo: sessao.motorista.codigo,
          token: sessao.token,
          corridaId: corridaAtual.id,
          ordem,
          desfazer,
        },
      });
      const { corrida } = await carregarCorridaFn({
        data: { codigo: sessao.motorista.codigo, token: sessao.token, corridaId: corridaAtual.id },
      });
      if (corrida) setCorridaAtual(corrida as Corrida);
      mostrarToast(desfazer ? `Parada ${ordem} desfeita` : `Parada ${ordem} concluída ✓`);
    } catch (e: unknown) {
      mostrarToast(e instanceof Error ? e.message : "Erro");
    } finally {
      setCarregando(false);
    }
  };


  const irWaze = (lugar: string) =>
    window.open(`https://waze.com/ul?q=${encodeURIComponent(lugar)}`, "_blank");

  // ─── Cálculos ───────────────────────────────────────
  const finalizadasHoje = corridasHoje.filter((c) => c.status === "Finalizada");
  const ganhoHoje = finalizadasHoje.reduce((s, c) => s + Number(c.valor_final ?? 0), 0);

  // ═══════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════
  return (
    <div className="moto-app">
      <style>{cssMotorista}</style>

      {tela === "login" && (
        <LoginTela
          codigo={loginCodigo}
          senha={loginSenha}
          erro={loginErro}
          carregando={carregando}
          onCodigo={setLoginCodigo}
          onSenha={setLoginSenha}
          onEntrar={fazerLogin}
        />
      )}

      {tela === "home" && sessao && (
        <HomeTela
          motorista={sessao.motorista}
          online={online}
          finalizadas={finalizadasHoje.length}
          ganho={ganhoHoje}
          corridasHoje={corridasHoje}
          onToggle={alternarStatus}
          onSair={sair}
          onAbrirCorrida={() => corridaAtual && setTela("corrida")}
          temCorrida={!!corridaAtual}
        />
      )}

      {tela === "corrida" && corridaAtual && (
        <CorridaTela
          corrida={corridaAtual}
          onVoltar={() => setTela("home")}
          onMudarStatus={mudarStatusCorrida}
          onConcluirParada={concluirParada}
          onWaze={irWaze}
        />
      )}

      {oferta && cobranca?.status !== "Bloqueado" && (
        <OfertaModal
          oferta={oferta}
          onAceitar={aceitarOferta}
          onRecusar={recusarOferta}
        />
      )}

      {cobranca && (
        forcarCobranca ||
        cobranca.status === "Bloqueado" ||
        cobranca.status === "Aguardando" ||
        (cobranca.status === "Pendente" && Number(cobranca.faturamento_dia) >= Number(cobranca.valor_diaria) * 1.45)
      ) && (
        <CobrancaModal
          cobranca={cobranca}
          config={cobrancaCfg}
          enviando={enviandoLib}
          onJaPaguei={async () => {
            if (!sessao) return;
            setEnviandoLib(true);
            try {
              await solicitarLibFn({ data: { codigo: sessao.motorista.codigo, token: sessao.token } });
              mostrarToast("Aguardando confirmação da central");
            } catch (e) {
              mostrarToast(e instanceof Error ? e.message : "Erro");
            } finally {
              setEnviandoLib(false);
              setForcarCobranca(false);
            }
          }}
          onFechar={() => setForcarCobranca(false)}
        />

      )}

      {sessao && tela !== "login" && (
        <MotoristaBottomNav
          motorista={sessao.motorista}
          token={sessao.token}
          corridasHoje={corridasHoje}
          cobranca={cobranca}
          onAbrirCobranca={() => setForcarCobranca(true)}
        />
      )}

      {sessao && tela !== "login" && (
        <PanicButton
          codigo={sessao.motorista.codigo}
          token={sessao.token}
          corridaId={corridaAtual?.id ?? null}
          onToast={mostrarToast}
        />
      )}


      {carregando && <AguardeOverlay />}
      {toast && <div className="moto-toast">{toast}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════
function LoginTela({
  codigo,
  senha,
  erro,
  carregando,
  onCodigo,
  onSenha,
  onEntrar,
}: {
  codigo: string;
  senha: string;
  erro: string;
  carregando: boolean;
  onCodigo: (v: string) => void;
  onSenha: (v: string) => void;
  onEntrar: () => void;
}) {
  return (
    <div className="tela tela-login">
      <div className="login-wrap">
        <div className="login-logo">
          <LogoRota013 className="text-[3.4rem]" />
        </div>
        <p className="login-sub">App do Motociclista</p>
        <div className="form-group">
          <label>Código</label>
          <input
            value={codigo}
            onChange={(e) => onCodigo(e.target.value.toUpperCase())}
            placeholder="Ex: M001"
            autoCapitalize="characters"
          />
        </div>
        <div className="form-group">
          <label>Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => onSenha(e.target.value)}
            placeholder="Sua senha"
            onKeyDown={(e) => e.key === "Enter" && onEntrar()}
          />
        </div>
        <button className="btn-primary" disabled={carregando} onClick={onEntrar}>
          {carregando ? "Entrando..." : "Entrar"}
        </button>
        {erro && <p className="erro-msg">{erro}</p>}
      </div>
    </div>
  );
}

function HomeTela({
  motorista,
  online,
  finalizadas,
  ganho,
  corridasHoje,
  onToggle,
  onSair,
  onAbrirCorrida,
  temCorrida,
}: {
  motorista: Motorista;
  online: boolean;
  finalizadas: number;
  ganho: number;
  corridasHoje: Corrida[];
  onToggle: () => void;
  onSair: () => void;
  onAbrirCorrida: () => void;
  temCorrida: boolean;
}) {
  const iniciais = (motorista.nome || "M")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="tela">
      <header className="header">
        <a className="app-logo" href="#">
          <LogoRota013 className="text-2xl" />
        </a>
        <div className="header-center">
          <div className="header-nome">{motorista.nome}</div>
          <div className="header-moto">
            {motorista.moto || "-"} • {motorista.placa || "-"}
          </div>
        </div>
        <div className="avatar" style={motorista.foto ? { backgroundImage: `url('${motorista.foto}')` } : {}}>
          {!motorista.foto && iniciais}
        </div>
      </header>

      <div className="status-bar">
        <div className={`status-dot ${online ? "online" : "offline"}`} />
        <span className="status-texto">
          {online ? "Online — aguardando corridas" : "Offline"}
        </span>
        <button className={`btn-status ${online ? "is-online" : ""}`} onClick={onToggle}>
          {online ? "Ficar Offline" : "Ficar Online"}
        </button>
      </div>

      <div className="cards-row">
        <div className="card-mini">
          <div className="card-num">{finalizadas}</div>
          <div className="card-label">Corridas</div>
        </div>
        <div className="card-mini">
          <div className="card-num gold">{brl(ganho)}</div>
          <div className="card-label">Ganho hoje</div>
        </div>
      </div>

      {temCorrida && (
        <button className="btn-retomar" onClick={onAbrirCorrida}>
          🚗 Você tem uma corrida em andamento — abrir
        </button>
      )}

      <div className="home-scroll">
        <div className="section-title">Últimas corridas</div>
        <div className="lista-corridas">
          {corridasHoje.length === 0 && <div className="empty-msg">Nenhuma corrida hoje</div>}
          {corridasHoje.slice(0, 8).map((c) => (
            <div key={c.id} className="corrida-item">
              <div className="corrida-item-header">
                <span className="corrida-item-id">
                  #{c.id} — {c.cliente || "Cliente"}
                </span>
                <span className="corrida-item-valor">{brl(c.valor_final)}</span>
              </div>
              <div className="corrida-item-end">
                📍 {c.origem}
                <br />
                🏁 {c.destino || "-"}
              </div>
              <div style={{ marginTop: 6 }}>
                <span className={`badge ${badgeClass(c.status)}`}>{c.status}</span>
              </div>
            </div>
          ))}
        </div>

        <button className="btn-sair" onClick={onSair}>
          Sair do app
        </button>
      </div>
    </div>
  );
}

function CorridaTela({
  corrida,
  onVoltar,
  onMudarStatus,
  onConcluirParada,
  onWaze,
}: {
  corrida: Corrida;
  onVoltar: () => void;
  onMudarStatus: (s: "A caminho" | "Chegou" | "Em viagem" | "Finalizada") => void;
  onConcluirParada: (ordem: number, desfazer?: boolean) => void;
  onWaze: (lugar: string) => void;
}) {
  const paradas = Array.isArray(corrida.paradas) ? [...corrida.paradas].sort((a, b) => a.ordem - b.ordem) : [];
  const proximaParada = paradas.find((p) => !p.concluida_em);
  const ultimaConcluida = [...paradas].reverse().find((p) => p.concluida_em);
  const [verTodos, setVerTodos] = useState(false);
  const [confirmarFim, setConfirmarFim] = useState(false);

  // Próximo endereço após esta etapa (usado no texto do botão)
  const proximoApos = (apos: "origem" | "parada", ordem?: number): string => {
    if (apos === "origem") {
      return paradas[0]?.endereco || corrida.destino || "destino";
    }
    // parada com ordem N → próxima parada não concluída após N, ou destino
    const prox = paradas.find((p) => p.ordem > (ordem || 0));
    return prox?.endereco || corrida.destino || "destino";
  };

  // Determina ETAPA ATIVA + AÇÃO ÚNICA (Waze + avanço de status)
  type Etapa = {
    tipo: "origem" | "parada" | "destino";
    label: string;
    endereco: string;
    icone: string;
    progresso?: string;
  };
  let etapa: Etapa | null = null;
  let acao: { txt: string; classe: string; onClick: () => void } | null = null;
  let voltar: { txt: string; onClick: () => void } | null = null;

  // Normaliza "Chegou" como equivalente a "A caminho" (status legado)
  const st = corrida.status === "Chegou" ? "A caminho" : corrida.status;

  if (st === "Aceita" || st === "A caminho") {
    if (st === "Aceita") {
      etapa = { tipo: "origem", label: "Buscar passageiro", endereco: corrida.origem, icone: "📍" };
      acao = {
        txt: "🧭 Ir até o cliente",
        classe: "caminho",
        onClick: () => {
          onMudarStatus("A caminho");
          onWaze(corrida.origem);
        },
      };
    } else {
      // A caminho → já está com o passageiro; exibe o próximo endereço (parada 1 ou destino)
      const primeira = paradas[0];
      if (primeira) {
        etapa = {
          tipo: "parada",
          label: `Parada 1 de ${paradas.length}`,
          endereco: primeira.endereco,
          icone: "🟡",
          progresso: `Parada 1/${paradas.length}`,
        };
      } else {
        etapa = {
          tipo: "destino",
          label: "Destino",
          endereco: corrida.destino || "",
          icone: "🏁",
        };
      }
      const destinoLabel = primeira ? `Parada 1` : "destino";
      acao = {
        txt: `▶️ Iniciar viagem — ${destinoLabel}`,
        classe: "chegou",
        onClick: () => {
          onMudarStatus("Em viagem");
          onWaze(proximoApos("origem"));
        },
      };
      voltar = { txt: "← Voltar (ainda não embarcou)", onClick: () => onMudarStatus("A caminho") };
    }
  } else if (st === "Em viagem" && proximaParada) {
    // Regra: a tela mostra SEMPRE o endereço que o Waze vai abrir (o próximo após esta parada).
    const proxEndereco = proximoApos("parada", proximaParada.ordem);
    const proxParadaObj = paradas.find((p) => p.ordem > proximaParada.ordem);
    if (proxParadaObj) {
      etapa = {
        tipo: "parada",
        label: `Próximo: Parada ${proxParadaObj.ordem} de ${paradas.length}`,
        endereco: proxEndereco,
        icone: "🟡",
        progresso: `Parada ${proximaParada.ordem}/${paradas.length}`,
      };
    } else {
      etapa = {
        tipo: "destino",
        label: "Próximo: Destino final",
        endereco: proxEndereco,
        icone: "🏁",
        progresso: `Parada ${proximaParada.ordem}/${paradas.length}`,
      };
    }
    const proxLabel = proxParadaObj ? `Parada ${proxParadaObj.ordem}` : "destino";
    acao = {
      txt: `✅ Cheguei na parada ${proximaParada.ordem} — Ir para ${proxLabel}`,
      classe: "chegou",
      onClick: () => {
        onConcluirParada(proximaParada.ordem);
        onWaze(proxEndereco);
      },
    };
    if (proximaParada.ordem === 1) {
      voltar = { txt: "← Voltar para origem", onClick: () => onMudarStatus("A caminho") };
    } else {
      const anterior = paradas.find((p) => p.ordem === proximaParada.ordem - 1);
      if (anterior) voltar = { txt: `← Voltar para parada ${anterior.ordem}`, onClick: () => onConcluirParada(anterior.ordem, true) };
    }
  } else if (st === "Em viagem" && corrida.destino) {
    etapa = {
      tipo: "destino",
      label: paradas.length > 0 ? "Destino final" : "Destino",
      endereco: corrida.destino,
      icone: "🏁",
    };
    acao = { txt: "🏁 Finalizar corrida", classe: "finalizar", onClick: () => setConfirmarFim(true) };
    if (ultimaConcluida) {
      voltar = {
        txt: `← Voltar para parada ${ultimaConcluida.ordem}`,
        onClick: () => onConcluirParada(ultimaConcluida.ordem, true),
      };
    } else {
      voltar = { txt: "← Voltar para origem", onClick: () => onMudarStatus("A caminho") };
    }
  }

  const statusLabel = etapa?.progresso || st;
  const totalEnderecos = 1 + paradas.length + (corrida.destino ? 1 : 0);

  return (
    <div className="tela">
      <header className="header header-dark">
        <button className="btn-icon-sm" onClick={onVoltar}>
          ←
        </button>
        <span className="header-titulo">Corrida em andamento</span>
        <div className="badge-status">{statusLabel}</div>
      </header>

      <div className="corrente-scroll">
        {/* Resumo recolhido */}
        <div className="corrida-resumo">
          <div>
            <div className="resumo-l1">
              #{corrida.id} • {corrida.cliente || "Cliente"}
            </div>
            <div className="resumo-l2">
              {totalEnderecos} endereço(s) • <span className="gold">{brl(corrida.valor_final)}</span>
            </div>
          </div>
          <button className="btn-ver-todos" onClick={() => setVerTodos(true)}>
            Ver trajeto
          </button>
        </div>

        {/* Etapa ativa — único endereço, único botão */}
        {etapa && (
          <div className="etapa-ativa">
            <div className="etapa-label">{etapa.label.toUpperCase()}</div>
            <div className="etapa-endereco">
              <span className="etapa-icone">{etapa.icone}</span>
              <span>{etapa.endereco}</span>
            </div>

            {acao && (
              <button className={`btn-acao ${acao.classe}`} onClick={acao.onClick}>
                {acao.txt}
              </button>
            )}

            {voltar && (
              <button className="btn-voltar-etapa" onClick={voltar.onClick}>
                {voltar.txt}
              </button>
            )}
          </div>
        )}
      </div>


      {/* Modal: trajeto completo, só leitura */}
      {verTodos && (
        <div className="modal-overlay" onClick={() => setVerTodos(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-titulo">Trajeto completo</div>
            <div className="trajeto-lista">
              <div className="trajeto-item">
                <span className="ci">📍</span>
                <div>
                  <span className="cl">ORIGEM</span>
                  <span className="cv">{corrida.origem}</span>
                </div>
              </div>
              {paradas.map((p) => (
                <div key={p.ordem} className="trajeto-item" style={{ opacity: p.concluida_em ? 0.55 : 1 }}>
                  <span className="ci">{p.concluida_em ? "✅" : "🟡"}</span>
                  <div>
                    <span className="cl">PARADA {p.ordem}</span>
                    <span className="cv" style={p.concluida_em ? { textDecoration: "line-through" } : {}}>
                      {p.endereco}
                    </span>
                  </div>
                </div>
              ))}
              {corrida.destino && (
                <div className="trajeto-item">
                  <span className="ci">🏁</span>
                  <div>
                    <span className="cl">DESTINO{paradas.length > 0 ? " FINAL" : ""}</span>
                    <span className="cv">{corrida.destino}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-aviso">
              ℹ️ Apenas para consulta. Siga os endereços conforme aparecem na tela.
            </div>
            <button className="btn-acao caminho" onClick={() => setVerTodos(false)}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* Confirmação de finalização */}
      {confirmarFim && (
        <div className="modal-overlay" onClick={() => setConfirmarFim(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-titulo">Finalizar corrida?</div>
            <div className="modal-aviso">
              Confirme apenas se já entregou no destino final. Esta ação não pode ser desfeita.
            </div>
            <button
              className="btn-acao finalizar"
              onClick={() => {
                setConfirmarFim(false);
                onMudarStatus("Finalizada");
              }}
            >
              🏁 Sim, finalizar
            </button>
            <button className="btn-acao caminho" onClick={() => setConfirmarFim(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OfertaModal({
  oferta,
  onAceitar,
  onRecusar,
}: {
  oferta: Oferta;
  onAceitar: () => void;
  onRecusar: () => void;
}) {
  const [segundos, setSegundos] = useState(Math.floor(TIMEOUT_OFERTA_MS / 1000));
  useEffect(() => {
    const t = setInterval(() => setSegundos((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const progresso = (segundos / (TIMEOUT_OFERTA_MS / 1000)) * 213.6;

  return (
    <div className="modal-oferta">
      <div className="oferta-card">
        <div className="oferta-titulo">🏍️ Nova corrida disponível!</div>
        <div className="oferta-info">
          <div className="oferta-row">
            <span className="oferta-icone">👤</span>
            <div>
              <span className="oferta-label">CLIENTE</span>
              <span className="oferta-valor">{oferta.cliente || "-"}</span>
            </div>
          </div>
          <div className="oferta-row">
            <span className="oferta-icone">📍</span>
            <div>
              <span className="oferta-label">BUSCAR EM</span>
              <span className="oferta-valor">{oferta.origem}</span>
            </div>
          </div>
          <div className="oferta-row">
            <span className="oferta-icone">🏁</span>
            <div>
              <span className="oferta-label">DESTINO</span>
              <span className="oferta-valor">{oferta.destino || "-"}</span>
            </div>
          </div>
          <div className="oferta-row">
            <span className="oferta-icone">💰</span>
            <div>
              <span className="oferta-label">VALOR</span>
              <span className="oferta-valor gold">{brl(oferta.valor)}</span>
            </div>
          </div>
        </div>
        <div className="countdown-wrap">
          <svg className="countdown-svg" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="#333" strokeWidth="6" />
            <circle
              cx="40"
              cy="40"
              r="34"
              fill="none"
              stroke="#f7c600"
              strokeWidth="6"
              strokeDasharray="213.6"
              strokeDashoffset={213.6 - progresso}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"
            />
          </svg>
          <div className="countdown-num">{segundos}</div>
        </div>
        <div className="oferta-botoes">
          <button className="btn-recusar" onClick={onRecusar}>
            ✕ Recusar
          </button>
          <button className="btn-aceitar" onClick={onAceitar}>
            ✓ Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}

function AguardeOverlay() {
  return (
    <div className="modal-overlay">
      <div className="aguarde-box">
        <div className="spinner" />
        <p>Aguarde...</p>
      </div>
    </div>
  );
}

function badgeClass(s: string) {
  const map: Record<string, string> = {
    Pendente: "nova",
    Ofertada: "nova",
    Aceita: "aceita",
    "A caminho": "acaminho",
    Chegou: "acaminho",
    "Em viagem": "acaminho",
    Finalizada: "finalizada",
    Cancelada: "finalizada",
  };
  return map[s] || "nova";
}

// ═══════════════════════════════════════════════════════
// CSS isolado (escopado em .moto-app)
// ═══════════════════════════════════════════════════════
const cssMotorista = `
.moto-app {
  --bg:#0f0f0f; --card:#1a1a1a; --card2:#222; --line:#2a2a2a;
  --gold:#f7c600; --text:#f1f1f1; --muted:#888;
  --green:#22c55e; --red:#ef4444; --orange:#f97316;
  position:fixed; inset:0; background:var(--bg); color:var(--text);
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:15px; overflow:hidden;
}
.moto-app *, .moto-app *::before, .moto-app *::after {
  box-sizing:border-box; margin:0; padding:0;
  -webkit-tap-highlight-color:transparent;
}
.moto-app input, .moto-app button { font-family:inherit; font-size:16px; }
.moto-app .tela {
  position:absolute; inset:0; display:flex; flex-direction:column; background:var(--bg);
}
.moto-app .tela-login { justify-content:center; }
.moto-app .login-wrap { padding:32px 28px; max-width:420px; margin:0 auto; width:100%; }
.moto-app .login-logo { text-align:center; margin-bottom:4px; }
.moto-app .login-sub {
  text-align:center; color:var(--muted); font-size:13px;
  letter-spacing:2px; text-transform:uppercase; margin-bottom:36px;
}
.moto-app .form-group { margin-bottom:16px; }
.moto-app .form-group label {
  display:block; font-size:12px; color:var(--muted);
  text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;
}
.moto-app .form-group input {
  width:100%; background:var(--card); border:1.5px solid var(--line);
  border-radius:16px; padding:14px 16px; color:var(--text); outline:none;
}
.moto-app .form-group input:focus { border-color:var(--gold); }
.moto-app .btn-primary {
  width:100%; background:var(--gold); color:#111; font-weight:700;
  font-size:15px; border:none; border-radius:16px; padding:16px; cursor:pointer;
  margin-top:8px;
}
.moto-app .btn-primary:disabled { opacity:.6; }
.moto-app .erro-msg { color:var(--red); font-size:13px; text-align:center; margin-top:12px; }

.moto-app .header {
  display:flex; align-items:center; justify-content:space-between;
  padding:max(14px, env(safe-area-inset-top)) 16px 14px;
  background:var(--card); border-bottom:1px solid var(--line); flex-shrink:0;
}
.moto-app .header-dark { background:#111; }
.moto-app .app-logo { text-decoration:none; }
.moto-app .header-center { flex:1; text-align:center; padding:0 8px; }
.moto-app .header-nome { font-weight:700; font-size:15px; }
.moto-app .header-moto { font-size:12px; color:var(--muted); margin-top:2px; }
.moto-app .header-titulo { font-weight:700; font-size:16px; flex:1; text-align:center; }
.moto-app .avatar {
  width:38px; height:38px; border-radius:50%;
  background:var(--gold); color:#111; font-weight:700;
  display:flex; align-items:center; justify-content:center;
  font-size:14px; background-size:cover; background-position:center; flex-shrink:0;
}
.moto-app .btn-icon-sm {
  background:transparent; border:none; color:var(--text);
  font-size:22px; cursor:pointer; padding:4px 8px;
}

.moto-app .status-bar {
  display:flex; align-items:center; gap:10px; padding:14px 16px;
  background:var(--card2); border-bottom:1px solid var(--line); flex-shrink:0;
}
.moto-app .status-dot {
  width:10px; height:10px; border-radius:50%; flex-shrink:0;
}
.moto-app .status-dot.online { background:var(--green); box-shadow:0 0 8px var(--green); }
.moto-app .status-dot.offline { background:var(--muted); }
.moto-app .status-texto { font-size:13px; color:var(--muted); flex:1; }
.moto-app .btn-status {
  background:var(--gold); color:#111; border:none; border-radius:12px;
  padding:8px 16px; font-weight:700; font-size:13px; cursor:pointer; flex-shrink:0;
}
.moto-app .btn-status.is-online {
  background:transparent; color:var(--red); border:1px solid var(--red);
}

.moto-app .cards-row {
  display:grid; grid-template-columns:1fr 1fr; gap:10px;
  padding:14px 14px 6px; flex-shrink:0;
}
.moto-app .card-mini {
  background:var(--card); border-radius:18px; padding:14px 10px;
  text-align:center; border:1px solid var(--line);
}
.moto-app .card-num { font-size:20px; font-weight:800; }
.moto-app .card-num.gold { color:var(--gold); }
.moto-app .card-label {
  font-size:11px; color:var(--muted); margin-top:4px;
  text-transform:uppercase; letter-spacing:.5px;
}

.moto-app .btn-retomar {
  margin:8px 14px 0; padding:12px; background:#1c3a2a; color:#4ade80;
  border:1px solid #2a5a3a; border-radius:14px; font-weight:700; cursor:pointer;
}

.moto-app .home-scroll {
  flex:1; min-height:0; overflow-y:auto; -webkit-overflow-scrolling:touch;
  padding-bottom:env(safe-area-inset-bottom);
}
.moto-app .section-title {
  padding:16px 16px 8px; font-size:13px; color:var(--muted);
  text-transform:uppercase; letter-spacing:1px;
}
.moto-app .lista-corridas { padding:0 14px; }
.moto-app .empty-msg { text-align:center; color:var(--muted); padding:32px 0; }
.moto-app .corrida-item {
  background:var(--card); border:1px solid var(--line);
  border-radius:18px; padding:14px; margin-bottom:10px;
}
.moto-app .corrida-item-header {
  display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;
}
.moto-app .corrida-item-id { font-size:12px; color:var(--muted); font-weight:700; }
.moto-app .corrida-item-valor { font-size:16px; font-weight:800; color:var(--gold); }
.moto-app .corrida-item-end { font-size:13px; color:var(--muted); line-height:1.5; }
.moto-app .btn-sair {
  margin:20px 14px; padding:14px; width:calc(100% - 28px);
  background:transparent; border:1.5px solid rgba(239,68,68,.5);
  color:var(--red); border-radius:14px; font-weight:700; cursor:pointer;
}

.moto-app .badge {
  display:inline-block; padding:4px 10px; border-radius:20px;
  font-size:11px; font-weight:700;
}
.moto-app .badge.nova { background:#1e3a5f; color:#60a5fa; }
.moto-app .badge.aceita { background:#1c3a2a; color:#4ade80; }
.moto-app .badge.acaminho { background:#2a1c0f; color:var(--orange); }
.moto-app .badge.finalizada { background:#1a1a1a; color:var(--muted); }
.moto-app .badge-status {
  background:var(--orange); color:#fff; font-size:12px; font-weight:700;
  padding:6px 12px; border-radius:20px;
}

.moto-app .corrente-scroll {
  flex:1; min-height:0; overflow-y:auto;
  padding-bottom:env(safe-area-inset-bottom);
}
.moto-app .mapa-placeholder {
  height:160px; display:flex; align-items:center; justify-content:center;
  background:#1a1a1a; color:#888; font-size:14px;
}
.moto-app .corrida-card {
  margin:12px 14px; background:var(--card); border-radius:20px;
  border:1px solid var(--line); overflow:hidden;
}
.moto-app .corrida-row {
  display:flex; align-items:flex-start; gap:12px; padding:12px 16px;
}
.moto-app .corrida-row + .corrida-row { border-top:1px solid var(--line); }
.moto-app .ci { font-size:18px; flex-shrink:0; margin-top:2px; }
.moto-app .cl { display:block; font-size:10px; color:var(--muted); text-transform:uppercase; letter-spacing:1px; }
.moto-app .cv {
  display:block; font-size:14px; font-weight:600;
  margin-top:2px; line-height:1.4; word-break:break-word;
}
.moto-app .cv.gold { color:var(--gold); font-size:18px; font-weight:800; }
.moto-app .btn-waze {
  background:#1a237e; color:#90caf9; border:none; border-radius:12px;
  padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer; flex-shrink:0;
}
.moto-app .acoes-corrida { padding:14px; display:flex; flex-direction:column; gap:10px; }
.moto-app .btn-acao {
  width:100%; padding:18px; border:none; border-radius:18px;
  font-size:16px; font-weight:700; cursor:pointer;
}
.moto-app .btn-acao.caminho { background:var(--orange); color:#fff; }
.moto-app .btn-acao.chegou { background:#2563eb; color:#fff; }
.moto-app .btn-acao.finalizar { background:var(--green); color:#fff; }

.moto-app .modal-oferta {
  position:fixed; inset:0; background:rgba(0,0,0,.85);
  display:flex; align-items:flex-end; justify-content:center; z-index:1000;
}
.moto-app .oferta-card {
  background:var(--card); border-radius:28px 28px 0 0;
  padding:24px 20px 28px; width:100%; max-width:480px;
}
.moto-app .oferta-titulo {
  font-size:20px; font-weight:900; text-align:center;
  margin-bottom:20px; color:var(--gold);
}
.moto-app .oferta-info {
  background:var(--card2); border-radius:16px; padding:4px 0; margin-bottom:20px;
}
.moto-app .oferta-row {
  display:flex; align-items:flex-start; gap:12px; padding:12px 16px;
}
.moto-app .oferta-row + .oferta-row { border-top:1px solid var(--line); }
.moto-app .oferta-icone { font-size:20px; flex-shrink:0; }
.moto-app .oferta-label {
  display:block; font-size:10px; color:var(--muted);
  text-transform:uppercase; letter-spacing:1px;
}
.moto-app .oferta-valor {
  display:block; font-size:14px; font-weight:600; margin-top:2px;
}
.moto-app .oferta-valor.gold { color:var(--gold); font-size:20px; font-weight:800; }
.moto-app .countdown-wrap {
  position:relative; width:80px; height:80px; margin:0 auto 20px;
}
.moto-app .countdown-svg { width:80px; height:80px; }
.moto-app .countdown-num {
  position:absolute; inset:0; display:flex; align-items:center;
  justify-content:center; font-size:22px; font-weight:900; color:var(--gold);
}
.moto-app .oferta-botoes { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.moto-app .btn-recusar {
  background:var(--card2); color:var(--red); border:1.5px solid var(--red);
  border-radius:14px; padding:16px; font-weight:700; font-size:16px; cursor:pointer;
}
.moto-app .btn-aceitar {
  background:var(--green); color:#fff; border:none;
  border-radius:14px; padding:16px; font-weight:700; font-size:16px; cursor:pointer;
}

.moto-app .modal-overlay {
  position:fixed; inset:0; background:rgba(0,0,0,.75);
  display:flex; align-items:center; justify-content:center; z-index:1100;
}
.moto-app .aguarde-box {
  background:var(--card); border-radius:20px; padding:32px 40px;
  text-align:center; display:flex; flex-direction:column; align-items:center; gap:14px;
}
.moto-app .spinner {
  width:44px; height:44px; border:4px solid var(--line);
  border-top-color:var(--gold); border-radius:50%;
  animation: moto-spin .8s linear infinite;
}
@keyframes moto-spin { to { transform:rotate(360deg); } }

.moto-app .moto-toast {
  position:fixed; bottom:calc(20px + env(safe-area-inset-bottom));
  left:50%; transform:translateX(-50%);
  background:#fff; color:#111; padding:12px 20px; border-radius:12px;
  font-size:14px; font-weight:600; z-index:1200;
  box-shadow:0 8px 24px rgba(0,0,0,.3);
}

.moto-app .corrida-resumo {
  margin:12px 14px; padding:12px 16px; background:var(--card);
  border:1px solid var(--line); border-radius:14px;
  display:flex; align-items:center; justify-content:space-between; gap:12px;
}
.moto-app .resumo-l1 { font-size:13px; font-weight:700; color:var(--text); }
.moto-app .resumo-l2 { font-size:12px; color:var(--muted); margin-top:2px; }
.moto-app .resumo-l2 .gold { color:var(--gold); font-weight:800; }
.moto-app .btn-ver-todos {
  background:var(--card2); color:var(--text); border:1px solid var(--line);
  border-radius:10px; padding:8px 12px; font-size:12px; font-weight:700; cursor:pointer;
  flex-shrink:0;
}

.moto-app .etapa-ativa {
  margin:14px; background:var(--card); border:2px solid var(--orange);
  border-radius:20px; padding:20px; display:flex; flex-direction:column; gap:14px;
  box-shadow:0 8px 24px rgba(0,0,0,.4);
}
.moto-app .etapa-label {
  font-size:11px; color:var(--orange); font-weight:800;
  letter-spacing:1.5px; text-align:center;
}
.moto-app .etapa-endereco {
  display:flex; align-items:flex-start; gap:12px;
  font-size:18px; font-weight:700; line-height:1.4; color:var(--text);
  padding:8px 0;
}
.moto-app .etapa-icone { font-size:24px; flex-shrink:0; }
.moto-app .btn-ir-waze {
  background:#1a237e; color:#fff; border:none; border-radius:16px;
  padding:18px; font-size:17px; font-weight:800; cursor:pointer;
}
.moto-app .btn-voltar-etapa {
  background:transparent; color:var(--muted); border:1px solid var(--line);
  border-radius:12px; padding:10px; font-size:13px; font-weight:600;
  cursor:pointer; margin-top:4px;
}
.moto-app .btn-voltar-etapa:active { opacity:.7; }


.moto-app .modal-box {
  background:var(--card); border-radius:20px; padding:24px;
  max-width:420px; width:calc(100% - 28px); max-height:80vh; overflow-y:auto;
  display:flex; flex-direction:column; gap:14px;
}
.moto-app .modal-titulo {
  font-size:18px; font-weight:800; color:var(--gold); text-align:center;
}
.moto-app .modal-aviso {
  font-size:13px; color:var(--muted); text-align:center;
  background:var(--card2); padding:10px 12px; border-radius:10px;
}
.moto-app .trajeto-lista {
  display:flex; flex-direction:column;
  background:var(--card2); border-radius:14px; overflow:hidden;
}
.moto-app .trajeto-item {
  display:flex; align-items:flex-start; gap:12px; padding:12px 14px;
}
.moto-app .trajeto-item + .trajeto-item { border-top:1px solid var(--line); }
`;
