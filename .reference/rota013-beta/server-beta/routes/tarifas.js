'use strict';
const express = require('express');
const router  = express.Router();
const { dbGet, dbRun } = require('../db');

// Config padrão compatível com o cálculo de distância
const DEFAULT_TARIFAS = {
  tabelas: {
    pgpg:      { minimo: 8.00,  valorKm: 1.50 },
    pgsv:      { minimo: 15.00, valorKm: 2.00 },
    pgsantos:  { minimo: 20.00, valorKm: 2.20 },
    pgcubatao: { minimo: 20.00, valorKm: 2.20 },
  },
  hibrida: { minimo: 30.00, valorKm: 3.60 }
};

// GET — retorna config atual
router.get('/', async (req, res) => {
  try {
    const row = await dbGet('SELECT config_json FROM tarifas WHERE id=1');
    if (!row) return res.json(DEFAULT_TARIFAS);

    const cfg = JSON.parse(row.config_json);

    // Migrar formato antigo (tabelasFixas) para novo (tabelas)
    if (cfg.tabelasFixas && !cfg.tabelas) {
      cfg.tabelas = {};
      cfg.tabelasFixas.forEach(t => {
        cfg.tabelas[t.id] = {
          minimo:  t.tarifaMinima || 8,
          valorKm: t.valorKm     || 1.5
        };
      });
    }
    res.json({ ...DEFAULT_TARIFAS, ...cfg });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PUT — salvar
router.put('/', async (req, res) => {
  try {
    const body = req.body;
    // Aceitar tanto { config_json: '...' } quanto o objeto direto
    const jsonStr = typeof body.config_json === 'string'
      ? body.config_json
      : JSON.stringify(body);

    await dbRun(
      `INSERT INTO tarifas (id, config_json)
       VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
      [jsonStr]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
