// ═══════════════════════════════════════════════════════
//  MENSAGENS.JS — V7: sem contatos cruzados
//  Qualquer contato é intermediado pela central
// ═══════════════════════════════════════════════════════

function gerarMensagens(corrida) {
  const motCod = document.getElementById("msgMotCodigo")?.value?.trim();
  const mot = motCod
    ? state.motoristas.find(m => m.codigo === motCod)
    : (corrida?.motoristaCodigo
        ? state.motoristas.find(m => m.codigo === corrida.motoristaCodigo)
        : null);
  const c = corrida || obterCorridaAtiva();
  if (!c) { showToast("Nenhuma corrida selecionada."); return; }
  const elG = document.getElementById("msgGrupo");
  const elM = document.getElementById("msgMotorista");
  const elC = document.getElementById("msgCliente");
  if (elG) elG.value = textoGrupo(c);
  if (elM) elM.value = textoMotoristaDirecionado(c, mot);
  if (elC) elC.value = textoCliente(c, mot);
}

// Grupo — sem dados do cliente
function textoGrupo(c) {
  const data = c.dataHora ? formatarDataHora(c.dataHora) : "Imediata";
  const empresa = state.config?.empresa || "Rota 013";
  return [
    `🚨 *NOVA CORRIDA — ${empresa}*`, "",
    `📍 Origem: ${c.origem}`,
    `🏁 Destino: ${c.destino}`,
    `💰 Valor: ${moeda(c.valorFinal)}`,
    `🕐 ${c.tipo === "Agendada" ? `Agendada para: ${data}` : "Corrida imediata"}`,
    "", "Motorista disponível responder:", "✅ *EU PEGO*"
  ].join("\n");
}

// Motorista — mantém nome do cliente, NÃO inclui telefone
function textoMotoristaDirecionado(c, mot) {
  const data    = c.dataHora ? formatarDataHora(c.dataHora) : "Imediata";
  const empresa = state.config?.empresa || "Rota 013";
  const central = state.config?.whatsappCentral
    ? `📞 Central ${empresa}: ${formatPhone(state.config.whatsappCentral)}`
    : `📞 Qualquer dúvida, contate a central ${empresa}.`;
  return [
    `🚨 *CORRIDA DIRECIONADA — ${empresa}*`, "",
    mot ? `🏍️ Motorista: ${mot.codigo} - ${mot.nome}` : "🏍️ Motorista: (confirmado pela central)",
    "",
    `👤 Cliente: ${c.cliente}`,
    "",
    `📍 Origem: ${c.origem}\n🗺️ Waze: https://waze.com/ul?q=${encodeURIComponent(c.origem)}`,
    "",
    `🏁 Destino: ${c.destino}\n🗺️ Waze: https://waze.com/ul?q=${encodeURIComponent(c.destino)}`,
    "",
    `💰 Valor: ${moeda(c.valorFinal)}`,
    `📏 Distância: ${c.distancia || "-"}`,
    `🕐 ${c.tipo === "Agendada" ? `Agendada para: ${data}` : "Corrida imediata"}`,
    "",
    central
  ].join("\n");
}

// Cliente — NÃO inclui contato do motorista
function textoCliente(c, mot) {
  const empresa = state.config?.empresa || "Rota 013";
  const central = state.config?.whatsappCentral
    ? `📞 Central ${empresa}: ${formatPhone(state.config.whatsappCentral)}`
    : `📞 Entre em contato com a central ${empresa}`;

  // Foto do motorista (como link ou texto)
  let infoMot = "🏍️ Estamos localizando o motorista mais próximo...";
  if (mot) {
    infoMot = [
      `🏍️ Motorista: *${mot.nome}*`,
      `🛵 Moto: ${mot.moto || "-"} — Placa: ${mot.placa || "-"}`
    ].filter(Boolean).join("\n");
  }

  return [
    `✅ *Corrida confirmada — ${empresa}*`, "",
    infoMot,
    "",
    `📍 Buscar em: ${c.origem}`,
    "",
    `🏁 Destino: ${c.destino}`,
    "",
    `💰 Valor: ${moeda(c.valorFinal)}`,
    "",
    central,
    "😊 Boa viagem!"
  ].join("\n");
}

// Preencher modal mensagens global
function _gerarMsgNoModal(c, motCod) {
  const cod = motCod || document.getElementById('dashMsgMotCodigo')?.value?.trim() || '';
  const mot = cod
    ? state.motoristas.find(m => m.codigo === cod)
    : (c?.motoristaCodigo ? state.motoristas.find(m => m.codigo === c.motoristaCodigo) : null);
  if (!c) return;
  const el = id => document.getElementById(id);
  if (el('dashMsgGrupo'))     el('dashMsgGrupo').value     = textoGrupo(c);
  if (el('dashMsgMotorista')) el('dashMsgMotorista').value = textoMotoristaDirecionado(c, mot);
  if (el('dashMsgCliente'))   el('dashMsgCliente').value   = textoCliente(c, mot);
}

function renderMensagens() {
  const c = (state.corridas || [])[0];
  if (!c) return;
  gerarMensagens(c);
}

function abrirWhatsApp(inputId) {
  const txt  = document.getElementById(inputId)?.value;
  const fone = inputId === "msgMotorista"
    ? state.motoristas.find(m => m.codigo === document.getElementById("msgMotCodigo")?.value)?.telefone
    : state.corridas[0]?.telefone;
  const num = normalizarTelefone(fone || "");
  if (!num) { showToast("Telefone não encontrado."); return; }
  window.open(`https://wa.me/${num}?text=${encodeURIComponent(txt || "")}`, "_blank");
}

function gerarMensagensPorCorrida() {
  const cod = document.getElementById("msgCorridaCod")?.value?.trim();
  const c = cod
    ? state.corridas.find(x => String(x.id) === cod || x.clienteCodigo === cod)
    : state.corridas[0];
  if (!c) { showToast("Corrida não encontrada."); return; }
  gerarMensagens(c);
}

function formatPhone(num) {
  if (!num) return '';
  const d = num.replace(/\D/g, '');
  if (d.length === 13) return `(${d.slice(2,4)})${d.slice(4,8)}-${d.slice(8)}`;  // cel com +55
  if (d.length === 11) return `(${d.slice(0,2)})${d.slice(2,7)}-${d.slice(7)}`; // cel
  if (d.length === 10) return `(${d.slice(0,2)})${d.slice(2,6)}-${d.slice(6)}`; // fixo
  return num;
}

function formatarDataHora(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit" });
}

function obterCorridaAtiva() {
  return (state.corridas || []).find(c => ["Nova","Aceita","A caminho","Em curso"].includes(c.status))
      || state.corridas[0];
}

function copiar(txt) { navigator.clipboard?.writeText(txt); showToast("Copiado! ✅"); }

function copiarMensagemGrupo(id) {
  const c = (state.corridas || []).find(x => x.id === id);
  if (!c) return showToast("Corrida não encontrada.");
  copiar(textoGrupo(c));
}

function copiarMensagemMotorista(id) {
  const c = (state.corridas || []).find(x => x.id === id);
  if (!c) return showToast("Corrida não encontrada.");
  const m = state.motoristas.find(x => x.codigo === c.motoristaCodigo) || null;
  copiar(textoMotoristaDirecionado(c, m));
}

// Formata endereço como link do Google Maps (abre no app no Android, browser no iOS)
function linkMaps(endereco) {
  const url = `https://maps.google.com/?q=${encodeURIComponent(endereco)}`;
  return `${endereco}\n🗺️ Abrir no Maps: ${url}`;
}
