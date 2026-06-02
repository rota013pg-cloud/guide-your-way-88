'use strict';
const express = require('express');
const router  = express.Router();
const { dbAll } = require('../db');

// GET posições atuais de todos os motoristas online (em memória)
router.get('/online', (req, res) => {
  try {
    const { gpsPosicoes } = require('../server');
    res.json(gpsPosicoes || {});
  } catch { res.json({}); }
});

// GET histórico GPS de um motorista
router.get('/:codigo', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT lat, lng, velocidade, criado_em
       FROM motorista_gps
       WHERE motorista_codigo=$1
       ORDER BY criado_em DESC LIMIT 100`,
      [req.params.codigo]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
