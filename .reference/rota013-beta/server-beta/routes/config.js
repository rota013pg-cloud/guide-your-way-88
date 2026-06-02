'use strict';
const express = require('express');
const router  = express.Router();
const { dbGet, dbRun } = require('../db');

const DEFAULT = {
  empresa:     'Rota 013',
  whatsapp:    '(13) 4042-3331',
  valorDiaria: 19.90,
  cidade:      'Praia Grande - SP',
  pixChave:    ''
};

router.get('/', async (req, res) => {
  try {
    const row = await dbGet('SELECT config_json FROM app_config WHERE id=1');
    if (!row?.config_json) return res.json(DEFAULT);
    const salvo = JSON.parse(row.config_json);
    // Normalizar chaves (sistema atual usa whatsappCentral, beta usa whatsapp)
    if (salvo.whatsappCentral && !salvo.whatsapp) salvo.whatsapp = salvo.whatsappCentral;
    if (salvo.cidadeBase && !salvo.cidade) salvo.cidade = salvo.cidadeBase;
    res.json({ ...DEFAULT, ...salvo });
  } catch { res.json(DEFAULT); }
});

router.put('/', async (req, res) => {
  try {
    // Ler config atual para não perder campos do sistema atual
    let atual = {};
    try {
      const row = await dbGet('SELECT config_json FROM app_config WHERE id=1');
      if (row?.config_json) atual = JSON.parse(row.config_json);
    } catch {}

    const novo = {
      ...atual,
      ...DEFAULT,
      ...req.body,
      // Manter compatibilidade com sistema atual
      whatsappCentral: req.body.whatsapp || req.body.whatsappCentral || DEFAULT.whatsapp,
      cidadeBase:      req.body.cidade   || req.body.cidadeBase      || DEFAULT.cidade,
    };

    await dbRun(
      `INSERT INTO app_config (id, config_json) VALUES (1, $1)
       ON CONFLICT (id) DO UPDATE SET config_json = EXCLUDED.config_json`,
      [JSON.stringify(novo)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
