// ═══════════════════════════════════════════════════════
//  BETA-CORRIDAS.JS — Corridas com sistema de ofertas
// ═══════════════════════════════════════════════════════
const express = require('express');
const router  = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

function toFront(r) {
  if (!r) return r;
  return {
    ...r,
    id:               r.id,
    clienteCodigo:    r.cliente_codigo,
    valorFinal:       r.valor_final,
    motoristaCodigo:  r.motorista_codigo,
    dataHora:         r.data_hora,
    criadoEm:         r.criado_em,
    atualizadoEm:     r.atualizado_em
  };
}

// Fórmula Haversine — distância em km entre dois pontos GPS
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// GET todas as corridas
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM corridas ORDER BY id DESC LIMIT 200");
    res.json(rows.map(toFront));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// GET corrida por ID
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet("SELECT * FROM corridas WHERE id=?", [req.params.id]);
    res.json(toFront(row));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST — criar corrida + disparar ofertas
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const info = await dbRun(
      `INSERT INTO corridas
        (cliente_codigo,cliente,telefone,origem,destino,tipo,data_hora,
         metodo,distancia,tarifa,valor,valor_final,motorista,status,pagamento,obs,operador)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.clienteCodigo||'', d.cliente, d.telefone||'', d.origem, d.destino,
       d.tipo||'Agora', d.dataHora||'', d.metodo||'App', d.distancia||'-',
       d.tarifa||'', d.valor||0, d.valorFinal||d.valor||0,
       'Aguardando', 'Nova', d.pagamento||'Pix', d.obs||'', d.operador||'']
    );
    const corridaId = info.lastInsertRowid;
    const corrida   = await dbGet("SELECT * FROM corridas WHERE id=?", [corridaId]);

    // Disparar ofertas em background
    const io = req.app.get('io');
    if (io) dispararOfertas(corridaId, req.app, 0);

    res.status(201).json(toFront(corrida));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// PUT — editar corrida
router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    await dbRun(
      `UPDATE corridas SET cliente_codigo=?,cliente=?,telefone=?,origem=?,destino=?,
       tipo=?,metodo=?,distancia=?,tarifa=?,valor=?,valor_final=?,motorista=?,
       motorista_codigo=?,status=?,pagamento=?,obs=?,
       atualizado_em=to_char(NOW(),'YYYY-MM-DD HH24:MI:SS') WHERE id=?`,
      [d.clienteCodigo||'', d.cliente, d.telefone||'', d.origem, d.destino,
       d.tipo||'Agora', d.metodo||'App', d.distancia||'-', d.tarifa||'',
       d.valor||0, d.valorFinal||0, d.motorista||'Aguardando',
       d.motoristaCodigo||'', d.status||'Nova', d.pagamento||'Pix',
       d.obs||'', req.params.id]
    );
    const row = await dbGet("SELECT * FROM corridas WHERE id=?", [req.params.id]);
    res.json(toFront(row));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// PATCH — mudar status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status, motoristaCodigo } = req.body;
    await dbRun(
      "UPDATE corridas SET status=?, atualizado_em=to_char(NOW(),'YYYY-MM-DD HH24:MI:SS') WHERE id=?",
      [status, req.params.id]
    );
    // Emitir evento para todos via Socket.io
    const io = req.app.get('io');
    if (io) io.emit('corrida:atualizada', { corridaId: req.params.id, status, motoristaCodigo });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM corridas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// GET ofertas de uma corrida
router.get('/:id/ofertas', async (req, res) => {
  try {
    const rows = await dbAll(
      "SELECT * FROM corrida_ofertas WHERE corrida_id=? ORDER BY oferecida_em",
      [req.params.id]
    );
    res.json(rows);
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// POST — disparar oferta manualmente
router.post('/:id/ofertar', async (req, res) => {
  try {
    await dispararOfertas(req.params.id, req.app, 0);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ══════════════════════════════════════════════════════
//  LÓGICA DE OFERTAS
// ══════════════════════════════════════════════════════
async function dispararOfertas(corridaId, app, rodada) {
  const MAX_RODADAS = 2; // 2 rodadas de 30s = 60s total antes de alertar
  const TIMEOUT_MS  = 30000;
  const QTD_MOT     = 5;

  try {
    const corrida = await dbGet("SELECT * FROM corridas WHERE id=?", [corridaId]);
    if (!corrida || corrida.status !== 'Nova') return;

    // Buscar motoristas disponíveis (com ou sem GPS recente)
    const disponiveis = await dbAll(`
      SELECT m.*,
             mg.lat, mg.lng
      FROM motoristas m
      LEFT JOIN motorista_auth ma ON ma.motorista_codigo = m.codigo
      LEFT JOIN motorista_gps mg ON mg.motorista_codigo = m.codigo
        AND mg.id = (
          SELECT id FROM motorista_gps
          WHERE motorista_codigo = m.codigo
          ORDER BY id DESC LIMIT 1
        )
      WHERE m.status = 'Disponivel'
        AND (ma.status = 'ativo' OR ma.status IS NULL)
    `);

    if (disponiveis.length === 0) {
      // Nenhum disponível — alertar operador
      alertarOperador(app, corridaId, 'Nenhum motorista disponível');
      return;
    }

    // Já ofertados nesta corrida
    const jaOfertados = await dbAll(
      "SELECT motorista_codigo FROM corrida_ofertas WHERE corrida_id=?",
      [corridaId]
    );
    const jaOfertadosCod = new Set(jaOfertados.map(o => o.motorista_codigo));

    // Filtrar já ofertados e ordenar por proximidade
    // Usar coordenadas centrais de Praia Grande como fallback
    const LAT_BASE = -24.0122, LNG_BASE = -46.4097;
    const candidatos = disponiveis
      .filter(m => !jaOfertadosCod.has(m.codigo))
      .map(m => ({
        ...m,
        distancia: haversine(m.lat || LAT_BASE, m.lng || LNG_BASE, LAT_BASE, LNG_BASE)
      }))
      .sort((a, b) => a.distancia - b.distancia)
      .slice(0, QTD_MOT);

    if (candidatos.length === 0) {
      if (rodada >= MAX_RODADAS) {
        alertarOperador(app, corridaId, 'Nenhum motorista aceitou a corrida');
        return;
      }
      // Próxima rodada com os mesmos
      setTimeout(() => dispararOfertas(corridaId, app, rodada + 1), TIMEOUT_MS);
      return;
    }

    const io = app.get('io');

    // Criar ofertas no banco e enviar via Socket.io + Push
    for (const mot of candidatos) {
      const info = await dbRun(
        "INSERT INTO corrida_ofertas (corrida_id, motorista_codigo) VALUES (?,?)",
        [corridaId, mot.codigo]
      );
      const ofertaId = info.lastInsertRowid;

      // Enviar via WebSocket se motorista estiver conectado
      const { motoristasSockets } = require('../server');
      const sid = motoristasSockets[mot.codigo];
      if (sid && io) {
        io.to(sid).emit('oferta:nova', {
          ofertaId,
          corridaId,
          cliente:  corrida.cliente,
          origem:   corrida.origem,
          destino:  corrida.destino,
          valor:    corrida.valor_final,
          distancia: corrida.distancia,
          timeout:  TIMEOUT_MS
        });
      }

      // Enviar Push Notification
      if (mot.subscription_json) {
        enviarPush(mot.subscription_json, {
          title: '🏍️ Nova corrida!',
          body:  `${corrida.origem} → ${corrida.destino} | R$ ${corrida.valor_final?.toFixed(2)}`,
          data:  { corridaId, ofertaId }
        }).catch(() => {});
      }
    }

    // Notificar painel operador
    if (io) {
      io.emit('corrida:ofertas', {
        corridaId,
        motoristas: candidatos.map(m => ({ codigo: m.codigo, nome: m.nome })),
        rodada,
        timeout: TIMEOUT_MS
      });
    }

    // Agendar verificação após timeout
    setTimeout(async () => {
      const aceita = await dbGet(
        "SELECT * FROM corrida_ofertas WHERE corrida_id=? AND status='aceita'",
        [corridaId]
      );
      if (!aceita) {
        // Ninguém aceitou — próxima rodada
        dispararOfertas(corridaId, app, rodada + 1);
      }
    }, TIMEOUT_MS);

  } catch(e) {
    console.error('Erro em dispararOfertas:', e.message);
  }
}

function alertarOperador(app, corridaId, motivo) {
  const io = app.get('io');
  if (io) {
    io.emit('alerta:operador', {
      tipo: 'sem_motorista',
      corridaId,
      motivo,
      ts: Date.now()
    });
  }
  console.log(`⚠️  Alerta operador: Corrida #${corridaId} — ${motivo}`);
}

async function enviarPush(subscriptionJson, payload) {
  try {
    const webpush = require('web-push');
    const sub = JSON.parse(subscriptionJson);
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch(e) {
    // web-push pode não estar instalado ainda
  }
}

module.exports = router;
module.exports.dispararOfertas = dispararOfertas;
