require('dotenv').config({ path: __dirname + '/.env' });
// ═══════════════════════════════════════════════════════════
//  SERVER.JS — Rota 013 BETA 2.0
//  Node.js + Express + PostgreSQL + Socket.io
// ═══════════════════════════════════════════════════════════
'use strict';

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const http       = require('http');
const { Server } = require('socket.io');
const { initDb, dbAll, dbGet, dbRun, pool } = require('./db');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  pingTimeout:  60000,
  pingInterval: 25000
});
const PORT = process.env.BETA_PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ─── Servir frontends ────────────────────────────────────
app.use('/beta',      express.static(path.join(__dirname, '../beta')));
app.use('/img',        express.static(path.join(__dirname, '../img')));
app.use('/motorista', express.static(path.join(__dirname, '../motorista')));

// ─── Compartilhar estado do servidor com as rotas ────────
const motoristasSockets = {};  // codigo → socket.id
const operadoresSockets = {};  // socket.id → true
const gpsPosicoes       = {};  // codigo → { lat, lng, velocidade, ts }

const serverState = { motoristasSockets, operadoresSockets, gpsPosicoes };
app.set('io', io);
app.set('serverState', serverState);

// ─── Rotas API ───────────────────────────────────────────
app.use('/beta/api/auth',           require('./routes/auth'));
app.use('/beta/api/corridas',       require('./routes/beta-corridas'));
app.use('/beta/api/motoristas',     require('./routes/motoristas'));
app.use('/beta/api/clientes',       require('./routes/clientes'));
app.use('/beta/api/financeiro',     require('./routes/financeiro'));
app.use('/beta/api/config',         require('./routes/config'));
app.use('/beta/api/tarifas',        require('./routes/tarifas'));
app.use('/beta/api/motorista-auth', require('./routes/motorista-auth'));
app.use('/beta/api/gps',            require('./routes/gps'));
app.use('/beta/api/push',           require('./routes/push'));
app.use('/beta/api/operadores',     require('./routes/auth'));
app.use('/beta/api/logs',           require('./routes/logs'));

app.get('/beta/api/status', (_req, res) => {
  res.json({
    ok:      true,
    versao:  'beta-2.0',
    online:  Object.keys(motoristasSockets).length,
    uptime:  Math.floor(process.uptime())
  });
});

// ═══════════════════════════════════════════════════════════
//  WEBSOCKET — Socket.io
// ═══════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`🔌 Socket conectado: ${socket.id}`);

  // ─── Motorista: ficar online ────────────────────────────
  socket.on('motorista:online', async ({ codigo, token }) => {
    try {
      const sessao = await dbGet(
        `SELECT * FROM motorista_sessoes
         WHERE motorista_codigo=$1 AND token=$2 AND status='ativo'`,
        [codigo, token]
      );
      if (!sessao) {
        socket.emit('auth:bloqueado', { motivo: 'Sessão inválida. Faça login novamente.' });
        return;
      }

      // Se já tem outro socket para este código, expulsar
      const socketAnterior = motoristasSockets[codigo];
      if (socketAnterior && socketAnterior !== socket.id) {
        io.to(socketAnterior).emit('auth:sessao_encerrada', {
          motivo: 'Você fez login em outro dispositivo.'
        });
      }

      motoristasSockets[codigo] = socket.id;
      socket.data.codigo = codigo;
      socket.data.tipo   = 'motorista';
      socket.data.token  = token;

      await dbRun(
        `UPDATE motorista_sessoes
         SET ultimo_ping=NOW() WHERE id=$1`,
        [sessao.id]
      );
      await dbRun(
        `UPDATE motoristas
         SET status='Disponivel'
         WHERE codigo=$1 AND status NOT IN ('Bloqueado','Banido')`,
        [codigo]
      );

      console.log(`🏍️  Motorista online: ${codigo}`);
      io.emit('motorista:status', { codigo, status: 'Disponivel' });

    } catch (e) {
      console.error('[ws] motorista:online:', e.message);
    }
  });

  // ─── Motorista: ficar offline ───────────────────────────
  socket.on('motorista:offline', async ({ codigo }) => {
    if (socket.data.codigo !== codigo) return;
    try {
      await dbRun(
        `UPDATE motoristas SET status='Offline'
         WHERE codigo=$1 AND status='Disponivel'`,
        [codigo]
      );
      delete motoristasSockets[codigo];
      delete gpsPosicoes[codigo];
      io.emit('motorista:status', { codigo, status: 'Offline' });
      console.log(`🔴 Motorista offline (manual): ${codigo}`);
    } catch (e) {
      console.error('[ws] motorista:offline:', e.message);
    }
  });

  // ─── Operador: conectar ─────────────────────────────────
  socket.on('operador:online', () => {
    operadoresSockets[socket.id] = true;
    socket.data.tipo = 'operador';
    socket.emit('gps:snapshot', gpsPosicoes);
  });

  // ─── GPS do motorista ────────────────────────────────────
  socket.on('gps:update', ({ codigo, lat, lng, velocidade }) => {
    if (socket.data.codigo !== codigo) return;
    const ts = Date.now();
    gpsPosicoes[codigo] = { lat, lng, velocidade: velocidade || 0, ts };

    // Persistir no banco a cada 30s
    if (!socket.data.ultimoSalvo || ts - socket.data.ultimoSalvo > 30000) {
      socket.data.ultimoSalvo = ts;
      dbRun(
        `INSERT INTO motorista_gps (motorista_codigo,lat,lng,velocidade)
         VALUES ($1,$2,$3,$4)`,
        [codigo, lat, lng, velocidade || 0]
      ).catch(() => {});
    }

    // Broadcast para operadores
    for (const sid of Object.keys(operadoresSockets)) {
      io.to(sid).emit('gps:update', { codigo, lat, lng, velocidade, ts });
    }
  });

  // ─── Status da corrida (motorista atualiza) ─────────────
  socket.on('corrida:status', async ({ corridaId, status, motoristaCodigo }) => {
    try {
      await dbRun(
        `UPDATE corridas
         SET status=$1,
             atualizado_em=to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS')
         WHERE id=$2`,
        [status, corridaId]
      );

      // Se finalizada: incrementar contadores
      if (status === 'Finalizada') {
        // Notificar painel para recarregar dados
        setTimeout(() => io.emit('dados:atualizados', { tipo: 'corrida_finalizada', corridaId }), 500);
        await dbRun(
          `UPDATE motoristas SET corridas=COALESCE(corridas,0)+1 WHERE codigo=$1`,
          [motoristaCodigo]
        );
        const corrida = await dbGet(
          `SELECT cliente_codigo FROM corridas WHERE id=$1`, [corridaId]
        );
        if (corrida?.cliente_codigo) {
          await dbRun(
            `UPDATE clientes SET corridas=COALESCE(corridas,0)+1 WHERE codigo=$1`,
            [corrida.cliente_codigo]
          );
        }
      }

      io.emit('corrida:atualizada', { corridaId, status, motoristaCodigo });
      console.log(`📍 Corrida #${corridaId} → ${status} por ${motoristaCodigo}`);
    } catch (e) {
      console.error('[ws] corrida:status:', e.message);
    }
  });

  // ─── Aceitar oferta ─────────────────────────────────────
  socket.on('oferta:aceitar', async ({ ofertaId, motoristaCodigo }) => {
    try {
      // Lock atômico: só aceitar se ainda pendente
      const result = await pool.query(
        `UPDATE corrida_ofertas
         SET status='aceita', respondida_em=NOW()
         WHERE id=$1 AND status='pendente'
         RETURNING corrida_id`,
        [ofertaId]
      );

      if (result.rowCount === 0) {
        socket.emit('oferta:expirada', { ofertaId }); return;
      }

      const corridaId = result.rows[0].corrida_id;

      // Cancelar outras ofertas da mesma corrida
      await dbRun(
        `UPDATE corrida_ofertas
         SET status='cancelada'
         WHERE corrida_id=$1 AND id!=$2 AND status='pendente'`,
        [corridaId, ofertaId]
      );

      // Atualizar corrida
      const motorista = await dbGet(
        `SELECT * FROM motoristas WHERE codigo=$1`, [motoristaCodigo]
      );
      await dbRun(
        `UPDATE corridas
         SET motorista=$1, motorista_codigo=$2, status='Aceita',
             atualizado_em=to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD HH24:MI:SS')
         WHERE id=$3`,
        [motorista?.nome || motoristaCodigo, motoristaCodigo, corridaId]
      );

      // Broadcast: corrida aceita
      io.emit('corrida:aceita', {
        corridaId,
        motoristaCodigo,
        motoristaNome: motorista?.nome,
        moto:          motorista?.moto,
        placa:         motorista?.placa,
        foto:          motorista?.foto
      });

      // Notificar motoristas que perderam
      const perderam = await dbAll(
        `SELECT motorista_codigo FROM corrida_ofertas
         WHERE corrida_id=$1 AND status='cancelada'`,
        [corridaId]
      );
      perderam.forEach(p => {
        const sid = motoristasSockets[p.motorista_codigo];
        if (sid) io.to(sid).emit('oferta:cancelada', { corridaId });
      });

      console.log(`✅ Corrida #${corridaId} aceita por ${motoristaCodigo}`);

    } catch (e) {
      console.error('[ws] oferta:aceitar:', e.message);
      socket.emit('oferta:erro', e.message);
    }
  });

  // ─── Recusar oferta ─────────────────────────────────────
  socket.on('oferta:recusar', async ({ ofertaId, motoristaCodigo }) => {
    try {
      await dbRun(
        `UPDATE corrida_ofertas
         SET status='recusada', respondida_em=NOW()
         WHERE id=$1 AND motorista_codigo=$2`,
        [ofertaId, motoristaCodigo]
      );
      console.log(`❌ Oferta #${ofertaId} recusada por ${motoristaCodigo}`);
    } catch (e) {
      console.error('[ws] oferta:recusar:', e.message);
    }
  });

  // ─── Motorista avisa pagamento pendente ─────────────────
  socket.on('motorista:pagamento_pendente', ({ codigo, nome }) => {
    // Broadcast para todos os operadores conectados
    for (const sid of Object.keys(operadoresSockets)) {
      io.to(sid).emit('alerta:pagamento_pendente', { codigo, nome });
    }
    console.log(`💰 Pagamento pendente: ${nome} (${codigo})`);
  });

  // ─── Desconexão ─────────────────────────────────────────
  socket.on('disconnect', async () => {
    const codigo = socket.data?.codigo;
    if (codigo) {
      delete motoristasSockets[codigo];
      delete gpsPosicoes[codigo];
      try {
        await dbRun(
          `UPDATE motoristas SET status='Offline'
           WHERE codigo=$1 AND status='Disponivel'`,
          [codigo]
        );
        io.emit('motorista:status', { codigo, status: 'Offline' });
      } catch {}
      console.log(`🔌 Motorista desconectou: ${codigo}`);
    }
    if (socket.data?.tipo === 'operador') {
      delete operadoresSockets[socket.id];
    }
  });
});

// ─── Exportações para as rotas ────────────────────────────
module.exports.io                = io;
module.exports.motoristasSockets  = motoristasSockets;
module.exports.operadoresSockets  = operadoresSockets;
module.exports.gpsPosicoes        = gpsPosicoes;

// ═══════════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════
initDb()
  .then(async () => {
    await initBetaDb();
    server.listen(PORT, () => {
      console.log(`\n✅  Rota 013 BETA 2.0 — porta ${PORT}`);
      console.log(`    Painel:    https://beta.rota013.com.br/beta`);
      console.log(`    Motorista: https://motorista.rota013.com.br/motorista\n`);
    });
  })
  .catch(e => {
    console.error('❌ Erro ao inicializar:', e);
    process.exit(1);
  });

// ─── Criar/migrar tabelas beta ────────────────────────────
async function initBetaDb() {
  await pool.query(`
    -- Tabelas novas (idempotente)
    CREATE TABLE IF NOT EXISTS motorista_auth (
      id               SERIAL PRIMARY KEY,
      motorista_codigo TEXT NOT NULL UNIQUE,
      senha_hash       TEXT NOT NULL,
      status           TEXT DEFAULT 'ativo',
      motivo_bloqueio  TEXT DEFAULT '',
      ultimo_acesso    TEXT DEFAULT '',
      device_id        TEXT DEFAULT '',
      device_nome      TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS motorista_sessoes (
      id               SERIAL PRIMARY KEY,
      motorista_codigo TEXT NOT NULL,
      token            TEXT NOT NULL UNIQUE,
      status           TEXT DEFAULT 'ativo',
      ultimo_ping      TIMESTAMPTZ DEFAULT NOW(),
      criado_em        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS motorista_gps (
      id               SERIAL PRIMARY KEY,
      motorista_codigo TEXT NOT NULL,
      lat              REAL NOT NULL,
      lng              REAL NOT NULL,
      velocidade       REAL DEFAULT 0,
      criado_em        TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS corrida_ofertas (
      id               SERIAL PRIMARY KEY,
      corrida_id       INTEGER NOT NULL,
      motorista_codigo TEXT NOT NULL,
      status           TEXT DEFAULT 'pendente',
      oferecida_em     TIMESTAMPTZ DEFAULT NOW(),
      respondida_em    TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id               SERIAL PRIMARY KEY,
      motorista_codigo TEXT NOT NULL UNIQUE,
      subscription_json TEXT NOT NULL,
      criado_em        TIMESTAMPTZ DEFAULT NOW()
    );

    -- Migrations: colunas novas em tabelas existentes
    ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS app_status TEXT DEFAULT 'Offline';
    ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS lat  REAL DEFAULT 0;
    ALTER TABLE motoristas ADD COLUMN IF NOT EXISTS lng  REAL DEFAULT 0;
    ALTER TABLE motorista_auth ADD COLUMN IF NOT EXISTS device_id   TEXT DEFAULT '';
    ALTER TABLE motorista_auth ADD COLUMN IF NOT EXISTS device_nome TEXT DEFAULT '';

    -- Índices úteis
    CREATE INDEX IF NOT EXISTS idx_sessoes_codigo ON motorista_sessoes(motorista_codigo);
    CREATE INDEX IF NOT EXISTS idx_sessoes_token  ON motorista_sessoes(token);
    CREATE INDEX IF NOT EXISTS idx_gps_codigo     ON motorista_gps(motorista_codigo);
    CREATE INDEX IF NOT EXISTS idx_ofertas_corrida ON corrida_ofertas(corrida_id);
  `);

  console.log('✅ Tabelas beta 2.0 prontas');
}
