'use strict';
const express = require('express');
const router  = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

// GET todos + busca
router.get('/', async (req, res) => {
  try {
    const { busca } = req.query;
    const params = [];
    let sql = 'SELECT * FROM clientes WHERE 1=1';
    if (busca) {
      params.push(`%${busca}%`, busca, `%${busca}%`);
      sql += ` AND (nome ILIKE $1 OR codigo=$2 OR telefone ILIKE $3)`;
    }
    sql += ' ORDER BY nome';
    res.json(await dbAll(sql, params));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET por id ou código
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT * FROM clientes WHERE id=$1 OR codigo=$2',
      [req.params.id, req.params.id]
    );
    if (!row) return res.status(404).json({ erro: 'Cliente não encontrado' });
    res.json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST — criar
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    if (!d.nome) return res.status(400).json({ erro: 'Nome obrigatório' });

    // Gerar código automático se não informado
    if (!d.codigo) {
      const last = await dbGet('SELECT codigo FROM clientes ORDER BY id DESC LIMIT 1');
      const num  = last?.codigo ? parseInt(last.codigo.replace(/\D/g, ''), 10) + 1 : 1;
      d.codigo   = String(num).padStart(4, '0');
    }

    const existe = await dbGet('SELECT id FROM clientes WHERE codigo=$1', [d.codigo]);
    if (existe) return res.status(400).json({ erro: 'Código já existe' });

    const info = await dbRun(
      `INSERT INTO clientes (codigo, nome, telefone, cidade, corridas, obs)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [d.codigo, d.nome, d.telefone || '', d.cidade || '', d.corridas || 0, d.obs || '']
    );
    const row = await dbGet('SELECT * FROM clientes WHERE id=$1', [info.lastInsertRowid]);
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PUT — editar
router.put('/:id', async (req, res) => {
  try {
    const d  = req.body;
    const id = req.params.id;
    await dbRun(
      'UPDATE clientes SET nome=$1, telefone=$2, cidade=$3, corridas=$4, obs=$5 WHERE id=$6',
      [d.nome, d.telefone || '', d.cidade || '', d.corridas || 0, d.obs || '', id]
    );
    const row = await dbGet('SELECT * FROM clientes WHERE id=$1', [id]);
    res.json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
