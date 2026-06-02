'use strict';
const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { dbAll, dbGet, dbRun } = require('../db');

function hashSenha(s) {
  return crypto.createHash('sha256').update(s + 'rota013op').digest('hex');
}

// ── Login ───────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    if (!usuario || !senha) {
      return res.status(400).json({ erro: 'Informe usuário e senha' });
    }

    // Aceitar senha em texto plano (compatibilidade sistema atual)
    // OU hash
    let op = await dbGet(
      `SELECT * FROM operadores
       WHERE usuario=$1 AND (senha=$2 OR senha=$3) AND status='Ativo'`,
      [usuario, senha, hashSenha(senha)]
    );

    if (!op) return res.status(401).json({ erro: 'Usuário ou senha incorretos' });
    const { senha: _, ...opSemSenha } = op;
    res.json(opSemSenha);
  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

// ── CRUD Operadores ─────────────────────────────────────

// GET todos
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT id, nome, usuario, perfil, status, criado_em
       FROM operadores ORDER BY nome`
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET por id
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet(
      'SELECT id, nome, usuario, perfil, status FROM operadores WHERE id=$1',
      [req.params.id]
    );
    if (!row) return res.status(404).json({ erro: 'Não encontrado' });
    res.json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST — criar operador
router.post('/', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil } = req.body;
    if (!nome || !usuario || !senha) {
      return res.status(400).json({ erro: 'Nome, usuário e senha são obrigatórios' });
    }

    const existe = await dbGet(
      'SELECT id FROM operadores WHERE usuario=$1', [usuario]
    );
    if (existe) return res.status(400).json({ erro: 'Usuário já existe' });

    const info = await dbRun(
      `INSERT INTO operadores (nome, usuario, senha, perfil, status)
       VALUES ($1,$2,$3,$4,'Ativo')`,
      [nome, usuario, senha, perfil || 'operador']
    );
    const row = await dbGet(
      'SELECT id, nome, usuario, perfil, status FROM operadores WHERE id=$1',
      [info.lastInsertRowid]
    );
    res.status(201).json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PUT — editar (REGRA: verificar duplicidade excluindo próprio id)
router.put('/:id', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil, status } = req.body;
    const id = req.params.id;

    // Verificar duplicidade de usuário excluindo próprio id
    const dup = await dbGet(
      'SELECT id FROM operadores WHERE usuario=$1 AND id!=$2', [usuario, id]
    );
    if (dup) return res.status(400).json({ erro: 'Usuário já existe' });

    if (senha) {
      await dbRun(
        `UPDATE operadores SET nome=$1, usuario=$2, senha=$3, perfil=$4, status=$5
         WHERE id=$6`,
        [nome, usuario, senha, perfil || 'operador', status || 'Ativo', id]
      );
    } else {
      await dbRun(
        `UPDATE operadores SET nome=$1, usuario=$2, perfil=$3, status=$4
         WHERE id=$5`,
        [nome, usuario, perfil || 'operador', status || 'Ativo', id]
      );
    }

    const row = await dbGet(
      'SELECT id, nome, usuario, perfil, status FROM operadores WHERE id=$1', [id]
    );
    res.json(row);
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM operadores WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
