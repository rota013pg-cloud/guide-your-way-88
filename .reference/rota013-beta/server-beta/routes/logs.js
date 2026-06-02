'use strict';
const express = require('express');
const router  = express.Router();
const { dbAll, dbRun, pool } = require('../db');

// Garantir que a tabela existe
async function ensureTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS logs (
        id        SERIAL PRIMARY KEY,
        operador  TEXT,
        acao      TEXT,
        data      TEXT DEFAULT to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS')
      )
    `);
  } catch {}
}
ensureTable();

// GET logs
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM logs ORDER BY id DESC LIMIT 200`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST log
router.post('/', async (req, res) => {
  try {
    const { operador, acao } = req.body;
    await dbRun(
      `INSERT INTO logs (operador, acao) VALUES ($1, $2)`,
      [operador || 'Beta', acao || '']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
