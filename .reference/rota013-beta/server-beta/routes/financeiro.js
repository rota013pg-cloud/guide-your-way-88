'use strict';
const express = require('express');
const router  = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

function toFront(r) {
  if (!r) return null;
  return {
    id:              r.id,
    motoristaCodigo: r.motorista_codigo,
    motorista:       r.motorista,
    valor:           r.valor,
    tipo:            r.tipo,
    operador:        r.operador,
    obs:             r.obs,
    data:            r.data
  };
}

// GET — com filtros opcionais
router.get('/', async (req, res) => {
  try {
    const { motorista, data } = req.query;
    const params = [];
    let sql = 'SELECT * FROM financeiro WHERE 1=1';

    if (motorista) { params.push(motorista); sql += ` AND motorista_codigo=$${params.length}`; }
    if (data)      { params.push(`${data}%`); sql += ` AND data LIKE $${params.length}`; }
    sql += ' ORDER BY data DESC LIMIT 500';

    const rows = await dbAll(sql, params);
    res.json(rows.map(toFront));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST — registrar diária ou extra
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.motoristaCodigo) {
      return res.status(400).json({ erro: 'motoristaCodigo obrigatório' });
    }
    const info = await dbRun(
      `INSERT INTO financeiro
        (motorista_codigo, motorista, valor, tipo, operador, obs)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        d.motoristaCodigo, d.motorista,
        d.valor, d.tipo || 'Diária',
        d.operador || 'Beta', d.obs || ''
      ]
    );
    const salvo = await dbGet('SELECT * FROM financeiro WHERE id=$1', [info.lastInsertRowid]);
    res.status(201).json(toFront(salvo));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM financeiro WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
