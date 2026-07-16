import { useCallback, useEffect, useState } from "react";
import { MapPin, Bell, BatteryCharging, Check, X, ChevronRight } from "lucide-react";
import {
  statusPermissoes,
  pedirLocalizacao,
  pedirNotificacao,
  pedirBateria,
  abrirAjustesLocalizacao,
  rastreioCompleto,
  type StatusPermissoes,
} from "@/lib/permissoes-rastreio";

/**
 * Onboarding de permissões do rastreio (app nativo do motociclista).
 * Some sozinho no navegador/PWA e quando tudo já está concedido.
 * Cada permissão vira "tocar em Permitir", exceto o "Permitir o tempo todo"
 * da localização, que o Android obriga a escolher na tela de ajustes.
 */
export function AtivarRastreamento() {
  const [status, setStatus] = useState<StatusPermissoes | null>(null);
  const [aberto, setAberto] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const s = await statusPermissoes();
    setStatus(s);
    return s;
  }, []);

  useEffect(() => {
    void recarregar();
    // Reconfere ao voltar dos ajustes do sistema (localização/bateria mudam fora do app).
    const aoVoltar = () => {
      if (document.visibilityState === "visible") void recarregar();
    };
    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
    };
  }, [recarregar]);

  // Não é nativo, ainda carregando, ou já está tudo certo → não mostra nada.
  if (!status || rastreioCompleto(status)) return null;

  const rodar = async (fn: () => Promise<StatusPermissoes>) => {
    if (ocupado) return;
    setOcupado(true);
    try {
      setStatus(await fn());
    } finally {
      setOcupado(false);
    }
  };

  const locOk = status.localizacao === "always";
  const notifOk = status.notificacao === "granted";
  const batOk = status.bateria === "ok";

  // Banner compacto quando o motociclista fecha o modal mas ainda falta algo.
  if (!aberto) {
    return (
      <button className="rast-banner" onClick={() => setAberto(true)}>
        <span className="rast-banner-dot" />
        Rastreamento incompleto — tocar para ativar
        <ChevronRight size={16} />
      </button>
    );
  }

  return (
    <div className="rast-overlay">
      <style>{estilos}</style>
      <div className="rast-card">
        <button className="rast-fechar" onClick={() => setAberto(false)} aria-label="Fechar">
          <X size={18} />
        </button>

        <div className="rast-titulo">Ativar rastreamento</div>
        <p className="rast-sub">
          Pra central e o cliente acompanharem sua localização mesmo com a tela apagada,
          libere as permissões abaixo.
        </p>

        <div className="rast-lista">
          {/* Localização */}
          <Linha
            icone={<MapPin size={20} />}
            titulo="Localização"
            desc={
              locOk
                ? "Permitido o tempo todo"
                : status.localizacao === "inuse"
                ? "Falta escolher “Permitir o tempo todo”"
                : "Necessária para enviar sua posição"
            }
            ok={locOk}
          >
            {!locOk &&
              (status.localizacao === "denied" ? (
                <button className="rast-btn" disabled={ocupado} onClick={() => void rodar(pedirLocalizacao)}>
                  Permitir
                </button>
              ) : (
                <button
                  className="rast-btn"
                  disabled={ocupado}
                  onClick={() => void abrirAjustesLocalizacao()}
                >
                  Abrir ajustes
                </button>
              ))}
          </Linha>

          {/* Notificação */}
          <Linha
            icone={<Bell size={20} />}
            titulo="Notificações"
            desc={notifOk ? "Permitidas" : "Avisos de corrida e o serviço de rastreio"}
            ok={notifOk}
          >
            {!notifOk && (
              <button className="rast-btn" disabled={ocupado} onClick={() => void rodar(pedirNotificacao)}>
                Permitir
              </button>
            )}
          </Linha>

          {/* Bateria */}
          <Linha
            icone={<BatteryCharging size={20} />}
            titulo="Bateria sem restrição"
            desc={batOk ? "Liberado para rodar em segundo plano" : "Evita o sistema matar o rastreio"}
            ok={batOk}
          >
            {!batOk && (
              <button className="rast-btn" disabled={ocupado} onClick={() => void rodar(pedirBateria)}>
                Permitir
              </button>
            )}
          </Linha>
        </div>

        {status.localizacao === "inuse" && (
          <p className="rast-dica">
            Na tela de ajustes: <b>Permissões → Localização → Permitir o tempo todo</b>. O Android exige
            esse passo manual por segurança.
          </p>
        )}

        <button className="rast-depois" onClick={() => setAberto(false)}>
          Concluir depois
        </button>
      </div>
    </div>
  );
}

function Linha({
  icone,
  titulo,
  desc,
  ok,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  desc: string;
  ok: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={`rast-linha ${ok ? "ok" : ""}`}>
      <div className="rast-ico">{ok ? <Check size={20} /> : icone}</div>
      <div className="rast-txt">
        <div className="rast-linha-titulo">{titulo}</div>
        <div className="rast-linha-desc">{desc}</div>
      </div>
      <div className="rast-acao">{ok ? <span className="rast-ok">✓</span> : children}</div>
    </div>
  );
}

const estilos = `
.rast-overlay{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.7);backdrop-filter:blur(4px);padding:20px;
  padding-top:calc(20px + env(safe-area-inset-top));padding-bottom:calc(20px + env(safe-area-inset-bottom));}
.rast-card{position:relative;width:100%;max-width:400px;background:#151515;border:1px solid #2a2a2a;
  border-radius:20px;padding:24px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.6);}
.rast-fechar{position:absolute;top:14px;right:14px;background:transparent;border:none;color:#888;cursor:pointer;padding:4px;}
.rast-titulo{font-size:20px;font-weight:800;color:#fff;letter-spacing:-.02em;}
.rast-sub{font-size:13px;color:#9a9a9a;margin:6px 0 18px;line-height:1.5;}
.rast-lista{display:flex;flex-direction:column;gap:10px;}
.rast-linha{display:flex;align-items:center;gap:12px;background:#1e1e1e;border:1px solid #2c2c2c;
  border-radius:14px;padding:12px 14px;}
.rast-linha.ok{background:#14201548;border-color:#2f5d3a;}
.rast-ico{width:38px;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  background:#2a2a2a;color:#f7c600;flex-shrink:0;}
.rast-linha.ok .rast-ico{background:#1f4d2a;color:#4ade80;}
.rast-txt{flex:1;min-width:0;}
.rast-linha-titulo{font-size:14px;font-weight:700;color:#fff;}
.rast-linha-desc{font-size:11.5px;color:#8f8f8f;margin-top:1px;line-height:1.3;}
.rast-acao{flex-shrink:0;}
.rast-btn{background:#f7c600;color:#111;border:none;border-radius:10px;padding:8px 14px;font-size:13px;
  font-weight:800;cursor:pointer;white-space:nowrap;}
.rast-btn:disabled{opacity:.5;}
.rast-ok{color:#4ade80;font-size:18px;font-weight:800;}
.rast-dica{font-size:11.5px;color:#c9a94a;background:#231d05;border:1px solid #4a3d0a;border-radius:10px;
  padding:10px 12px;margin-top:14px;line-height:1.5;}
.rast-dica b{color:#f7c600;}
.rast-depois{width:100%;margin-top:14px;background:transparent;border:none;color:#8f8f8f;font-size:13px;
  padding:8px;cursor:pointer;}
.rast-banner{position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:55;
  display:flex;align-items:center;gap:8px;justify-content:center;background:#231d05;border:1px solid #4a3d0a;
  color:#f7c600;font-size:12.5px;font-weight:700;border-radius:12px;padding:11px 14px;cursor:pointer;
  box-shadow:0 8px 24px rgba(0,0,0,.4);}
.rast-banner-dot{width:8px;height:8px;border-radius:50%;background:#f7c600;animation:rastpulse 1.4s infinite;}
@keyframes rastpulse{0%,100%{opacity:1;}50%{opacity:.3;}}
`;
