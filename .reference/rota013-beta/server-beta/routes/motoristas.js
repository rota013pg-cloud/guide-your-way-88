'use strict';
const express = require('express');
const router  = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

function toFront(r) {
  if (!r) return null;
  return {
    ...r,
    telefoneFamiliar: r.telefone_familiar || '',
    nomeFamiliar:     r.nome_familiar     || '',
    fotoMoto:         r.foto_moto         || '',
    docCnh:           r.doc_cnh           || '',
    docVeiculo:       r.doc_veiculo       || '',
    docEndereco:      r.doc_endereco      || '',
  };
}

// GET todos
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT * FROM motoristas WHERE status != 'Excluido' ORDER BY codigo`
    );
    res.json(rows.map(toFront));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// GET por id
router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM motoristas WHERE id=$1', [req.params.id]);
    if (!row) return res.status(404).json({ erro: 'Não encontrado' });
    res.json(toFront(row));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// POST — criar
router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const existe = await dbGet('SELECT id FROM motoristas WHERE codigo=$1', [d.codigo]);
    if (existe) return res.status(400).json({ erro: 'Código já existe' });

    const info = await dbRun(
      `INSERT INTO motoristas
        (codigo,nome,telefone,moto,placa,cor,cidade,cpf,cnh,status,foto,corridas,
         telefone_familiar,nome_familiar,doc_cnh,doc_veiculo,doc_endereco,endereco,foto_moto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        d.codigo, d.nome, d.telefone || '', d.moto || '',
        d.placa || '', d.cor || '', d.cidade || 'Praia Grande',
        d.cpf || '', d.cnh || '', d.status || 'Offline',
        d.foto || '', d.corridas || 0,
        d.telefoneFamiliar || '', d.nomeFamiliar || '',
        d.docCnh || '', d.docVeiculo || '', d.docEndereco || '',
        d.endereco || '', d.fotoMoto || ''
      ]
    );
    const row = await dbGet('SELECT * FROM motoristas WHERE id=$1', [info.lastInsertRowid]);
    res.status(201).json(toFront(row));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PUT — editar (REGRA: não incluir codigo no UPDATE)
router.put('/:id', async (req, res) => {
  try {
    const d  = req.body;
    const id = req.params.id;
    await dbRun(
      `UPDATE motoristas SET
        nome=$1, telefone=$2, moto=$3, placa=$4, cor=$5, cidade=$6,
        cpf=$7, cnh=$8, status=$9, foto=$10, corridas=$11,
        telefone_familiar=$12, nome_familiar=$13,
        doc_cnh=$14, doc_veiculo=$15, doc_endereco=$16,
        endereco=$17, foto_moto=$18
       WHERE id=$19`,
      [
        d.nome, d.telefone || '', d.moto || '', d.placa || '',
        d.cor || '', d.cidade || 'Praia Grande',
        d.cpf || '', d.cnh || '', d.status || 'Offline',
        d.foto || '', d.corridas !== undefined ? d.corridas : undefined,
        d.telefoneFamiliar || '', d.nomeFamiliar || '',
        d.docCnh || '', d.docVeiculo || '', d.docEndereco || '',
        d.endereco || '', d.fotoMoto || '', id
      ]
    );
    const row = await dbGet('SELECT * FROM motoristas WHERE id=$1', [id]);
    res.json(toFront(row));
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// PATCH status
router.patch('/:id/status', async (req, res) => {
  try {
    await dbRun('UPDATE motoristas SET status=$1 WHERE id=$2',
      [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

// DELETE (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await dbRun("UPDATE motoristas SET status='Excluido' WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
