// ═══════════════════════════════════════════════════════════
//  MOTORISTA-AUTH.JS — Beta 2.0 — Login único por dispositivo
// ═══════════════════════════════════════════════════════════
'use strict';

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { dbAll, dbGet, dbRun } = require('../db');

function hashSenha(senha) {
  return crypto.createHash('sha256').update(senha + 'rota013salt').digest('hex');
}

function gerarToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── POST /login ────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { codigo, senha, deviceId = '', deviceNome = '' } = req.body;
    if (!codigo || !senha) {
      return res.status(400).json({ erro: 'Informe código e senha' });
    }

    // Buscar auth
    const auth = await dbGet(
      'SELECT * FROM motorista_auth WHERE motorista_codigo=$1', [codigo]
    );
    if (!auth) return res.status(401).json({ erro: 'Motorista não encontrado' });

    if (auth.status === 'banido') {
      return res.status(403).json({ erro: 'Acesso banido. Entre em contato com a central.' });
    }
    if (auth.status === 'bloqueado') {
      return res.status(403).json({ erro: `Acesso bloqueado: ${auth.motivo_bloqueio || 'Contate a central'}` });
    }

    if (auth.senha_hash !== hashSenha(senha)) {
      return res.status(401).json({ erro: 'Senha incorreta' });
    }

    // ─── LOGIN ÚNICO POR DISPOSITIVO ───────────────────
    // Se já tem device_id registrado e é diferente do atual,
    // verificar se há sessão ativa naquele device
    // LOGIN ÚNICO: bloquear se há sessão ativa em outro dispositivo
    if (deviceId) {
      // Salvar device_id sempre (atualizar para este dispositivo)
      // e verificar se há sessão ativa de outro device
      const sessaoAtiva = await dbGet(
        `SELECT id FROM motorista_sessoes
         WHERE motorista_codigo=$1 AND status='ativo'
         ORDER BY criado_em DESC LIMIT 1`,
        [codigo]
      );
      const deviceSalvo = auth.device_id || '';
      if (sessaoAtiva && deviceSalvo && deviceSalvo !== deviceId) {
        return res.status(409).json({
          erro: 'Você já está logado em outro dispositivo. Faça logout nele primeiro.'
        });
      }
      // Registrar device_id se ainda não foi salvo
      if (!deviceSalvo) {
        await dbRun(
          `UPDATE motorista_auth SET device_id=$1 WHERE motorista_codigo=$2`,
          [deviceId, codigo]
        );
      }
    }
    // ──────────────────────────────────────────────────

    // Buscar dados do motorista
    const motorista = await dbGet(
      'SELECT * FROM motoristas WHERE codigo=$1', [codigo]
    );
    if (!motorista) {
      return res.status(404).json({ erro: 'Motorista não cadastrado' });
    }

    // Encerrar sessões antigas (apenas por segurança)
    await dbRun(
      `UPDATE motorista_sessoes SET status='encerrado'
       WHERE motorista_codigo=$1 AND status='ativo'`,
      [codigo]
    );

    // Criar nova sessão
    const token = gerarToken();
    await dbRun(
      `INSERT INTO motorista_sessoes (motorista_codigo, token) VALUES ($1,$2)`,
      [codigo, token]
    );

    // Atualizar device_id e último acesso
    await dbRun(
      `UPDATE motorista_auth
       SET device_id=$1, device_nome=$2,
           ultimo_acesso=to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS')
       WHERE motorista_codigo=$3`,
      [deviceId, deviceNome, codigo]
    );

    res.json({
      ok: true,
      token,
      motorista: {
        codigo:   motorista.codigo,
        nome:     motorista.nome,
        foto:     motorista.foto,
        moto:     motorista.moto,
        placa:    motorista.placa,
        cor:      motorista.cor,
        telefone: motorista.telefone,
        cidade:   motorista.cidade,
        status:   motorista.status
      }
    });

  } catch (e) {
    console.error('[motorista-auth] login:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── POST /logout ────────────────────────────────────────
router.post('/logout', async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.json({ ok: true });

    // Encerrar sessão
    await dbRun(
      `UPDATE motorista_sessoes SET status='encerrado' WHERE token=$1`,
      [token]
    );

    // Limpar device_id para permitir login em qualquer dispositivo
    const sessao = await dbGet(
      `SELECT motorista_codigo FROM motorista_sessoes WHERE token=$1`, [token]
    ).catch(() => null);

    if (sessao?.motorista_codigo) {
      await dbRun(
        `UPDATE motorista_auth SET device_id='', device_nome=''
         WHERE motorista_codigo=$1`,
        [sessao.motorista_codigo]
      );
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('[motorista-auth] logout:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── POST /criar ─────────────────────────────────────────
// Admin cria/redefine credencial para motorista
router.post('/criar', async (req, res) => {
  try {
    const { codigo, senha } = req.body;

    const motorista = await dbGet(
      'SELECT id FROM motoristas WHERE codigo=$1', [codigo]
    );
    if (!motorista) {
      return res.status(404).json({ erro: 'Motorista não encontrado no cadastro' });
    }

    const existe = await dbGet(
      'SELECT id FROM motorista_auth WHERE motorista_codigo=$1', [codigo]
    );

    if (existe) {
      await dbRun(
        `UPDATE motorista_auth
         SET senha_hash=$1, senha_plain=$3, status='ativo', device_id='', device_nome=''
         WHERE motorista_codigo=$2`,
        [hashSenha(senha), codigo, senha]
      );
    } else {
      await dbRun(
        `INSERT INTO motorista_auth (motorista_codigo, senha_hash, senha_plain) VALUES ($1,$2,$3)`,
        [codigo, hashSenha(senha), senha]
      );
    }

    // Encerrar sessões ativas ao redefinir senha
    await dbRun(
      `UPDATE motorista_sessoes SET status='encerrado' WHERE motorista_codigo=$1`,
      [codigo]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('[motorista-auth] criar:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── PATCH /status ────────────────────────────────────────
// Admin bloquear/liberar/banir
router.patch('/status', async (req, res) => {
  try {
    const { codigo, status, motivo, resetDevice } = req.body;
    if (!codigo) return res.status(400).json({ erro: 'codigo obrigatório' });

    if (resetDevice) {
      await dbRun(`UPDATE motorista_auth SET device_id='', device_nome='' WHERE motorista_codigo=$1`, [codigo]);
      await dbRun(`UPDATE motorista_sessoes SET status='encerrado' WHERE motorista_codigo=$1 AND status='ativo'`, [codigo]);
      return res.json({ ok: true, mensagem: 'Dispositivo resetado' });
    }

    await dbRun(`UPDATE motorista_auth SET status=$1, motivo_bloqueio=$2 WHERE motorista_codigo=$3`, [status, motivo||'', codigo]);
    if (status !== 'ativo') {
      await dbRun(`UPDATE motorista_sessoes SET status='encerrado' WHERE motorista_codigo=$1`, [codigo]);
      const io  = req.app.get('io');
      const ss  = req.app.get('serverState') || {};
      const sid = ss.motoristasSockets?.[codigo];
      if (io && sid) io.to(sid).emit('auth:bloqueado', { motivo: motivo||'Acesso bloqueado pela central' });
    }
    res.json({ ok: true });
  } catch(e) {
    console.error('[motorista-auth] status:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});


// ─── GET /lista ───────────────────────────────────────────
router.get('/lista', async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT
        ma.motorista_codigo, ma.status, ma.motivo_bloqueio,
        ma.ultimo_acesso, ma.device_nome,
        m.nome, m.foto, m.status AS status_app
      FROM motorista_auth ma
      JOIN motoristas m ON m.codigo = ma.motorista_codigo
      ORDER BY m.nome
    `);
    res.json(rows);
  } catch (e) {
    console.error('[motorista-auth] lista:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

// ─── POST /push ───────────────────────────────────────────
router.post('/push', async (req, res) => {
  try {
    const { codigo, token, subscription } = req.body;

    const sessao = await dbGet(
      `SELECT id FROM motorista_sessoes
       WHERE motorista_codigo=$1 AND token=$2 AND status='ativo'`,
      [codigo, token]
    );
    if (!sessao) return res.status(401).json({ erro: 'Não autorizado' });

    await dbRun(
      `INSERT INTO push_subscriptions (motorista_codigo, subscription_json)
       VALUES ($1,$2)
       ON CONFLICT (motorista_codigo)
       DO UPDATE SET subscription_json=$2`,
      [codigo, JSON.stringify(subscription)]
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('[motorista-auth] push:', e.message);
    res.status(500).json({ erro: 'Erro interno' });
  }
});

module.exports        = router;
module.exports.hashSenha = hashSenha;

// ─── PATCH /alterar-senha — motorista troca a própria senha ─
router.patch('/alterar-senha', async (req, res) => {
  try {
    const { token, senhaAtual, novaSenha } = req.body;
    if (!token || !senhaAtual || !novaSenha)
      return res.status(400).json({ erro: 'Informe token, senhaAtual e novaSenha' });
    if (novaSenha.length < 4)
      return res.status(400).json({ erro: 'Nova senha mínimo 4 caracteres' });
    const sessao = await dbGet(
      `SELECT motorista_codigo FROM motorista_sessoes WHERE token=$1 AND status='ativo'`, [token]
    );
    if (!sessao) return res.status(401).json({ erro: 'Sessão inválida' });
    const auth = await dbGet(
      'SELECT senha_hash FROM motorista_auth WHERE motorista_codigo=$1', [sessao.motorista_codigo]
    );
    if (!auth || auth.senha_hash !== hashSenha(senhaAtual))
      return res.status(401).json({ erro: 'Senha atual incorreta' });
    await dbRun(
      `UPDATE motorista_auth SET senha_hash=$1 WHERE motorista_codigo=$2`,
      [hashSenha(novaSenha), sessao.motorista_codigo, novaSenha]
    );
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// ─── GET /info/:codigo — admin ver info de acesso ────────────
router.get('/info/:codigo', async (req, res) => {
  try {
    const auth = await dbGet(
      `SELECT motorista_codigo, status, device_id, device_nome, ultimo_acesso, senha_plain
       FROM motorista_auth WHERE motorista_codigo=$1`, [req.params.codigo]
    );
    if (!auth) return res.status(404).json({ erro: 'Sem acesso cadastrado' });
    res.json({
      status:       auth.status,
      deviceId:     auth.device_id   || '—',
      deviceNome:   auth.device_nome || '—',
      ultimoAcesso: auth.ultimo_acesso || '—',
      senhaAtual:   auth.senha_plain   || '(não disponível)'
    });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});
