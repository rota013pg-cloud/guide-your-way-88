'use strict';
const express = require('express');
const router  = express.Router();
const { dbGet, dbRun } = require('../db');

// POST /liberar — operador confirma pagamento do motorista
// IDEMPOTENTE: nunca duplica diária no mesmo dia operacional
router.post('/liberar', async (req, res) => {
  const { codigo } = req.body;
  if (!codigo) return res.status(400).json({ erro: 'codigo obrigatório' });

  try {
    // ── Dia operacional (6h Brasília) ── REGRA CRÍTICA ──
    // O servidor usa America/Sao_Paulo via to_char() no banco
    // Para o cálculo do dia operacional, usar a query abaixo:
    const diaRow = await dbGet(`
      SELECT to_char(
        CASE
          WHEN EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') < 6
          THEN (NOW() AT TIME ZONE 'America/Sao_Paulo')::date - 1
          ELSE (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
        END,
        'YYYY-MM-DD'
      ) AS dia
    `);
    const diaOp = diaRow?.dia || new Date().toLocaleDateString('sv');

    // ── Verificar idempotência ─────────────────────────
    const jaExiste = await dbGet(
      `SELECT id FROM financeiro
       WHERE motorista_codigo = $1
         AND tipo = 'Diária'
         AND data LIKE $2`,
      [codigo, diaOp + '%']
    );

    let registrou = false;

    if (!jaExiste) {
      const mot    = await dbGet('SELECT nome FROM motoristas WHERE codigo=$1', [codigo]);
      const cfgRow = await dbGet('SELECT config_json FROM app_config WHERE id=1');
      const cfg    = cfgRow?.config_json ? JSON.parse(cfgRow.config_json) : {};
      const valor  = Number(cfg.valorDiaria || cfg.valor_diaria || 19.90);

      // ON CONFLICT garante idempotência mesmo com race condition (dois cliques)
      const ins = await dbRun(
        `INSERT INTO financeiro (motorista_codigo, motorista, valor, tipo, operador, obs)
         VALUES ($1, $2, $3, 'Diária', 'App/Operador', 'Confirmado via painel')
         ON CONFLICT (motorista_codigo, tipo, (data::date)) DO NOTHING`,
        [codigo, mot?.nome || codigo, valor]
      );
      registrou = !!ins.lastInsertRowid;

      // Log
      await dbRun(
        `INSERT INTO logs (operador, acao) VALUES ('Beta', $1)`,
        [`Diária liberada: ${mot?.nome || codigo} (${codigo}) — R$ ${valor.toFixed(2)}`]
      ).catch(() => {});
    }

    // ── Emitir diaria:liberada para o motorista ────────
    let socketEnviado = false;
    try {
      const serverMod        = require('../server');
      const io               = serverMod.io;
      const motoristasSockets = serverMod.motoristasSockets;
      const sid              = motoristasSockets?.[codigo];

      if (io && sid) {
        io.to(sid).emit('diaria:liberada');
        socketEnviado = true;
        console.log(`✅ diaria:liberada → ${codigo} (socket: ${sid})`);
      } else {
        console.warn(`⚠️ Motorista ${codigo} offline — diária registrada, socket não enviado`);
      }
    } catch (e) {
      console.error('[push/liberar] socket:', e.message);
    }

    // ── Notificar todos os operadores ─────────────────
    try {
      const serverMod          = require('../server');
      const io                 = serverMod.io;
      const operadoresSockets  = serverMod.operadoresSockets || {};
      Object.keys(operadoresSockets).forEach(sid => {
        io.to(sid).emit('diaria:confirmada', { codigo, registrou });
      });
    } catch {}

    res.json({
      ok:           true,
      registrou,
      jaExistia:    !!jaExiste,
      socketEnviado,
      diaOp
    });

  } catch (e) {
    console.error('[push/liberar]', e.message);
    res.status(500).json({ erro: e.message });
  }
});

// GET /vapid-public-key
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
});

module.exports = router;
