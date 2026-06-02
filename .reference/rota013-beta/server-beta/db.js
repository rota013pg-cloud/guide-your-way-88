// ═══════════════════════════════════════════════════════
//  DB.JS — PostgreSQL (produção)
//  Interface idêntica ao SQLite: dbAll, dbGet, dbRun
// ═══════════════════════════════════════════════════════
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// ─── Helpers síncronos simulados (async internamente) ─
// As routes usam dbGet/dbAll/dbRun de forma síncrona,
// então envolvemos em wrappers que o Express chama via async/await
// ATENÇÃO: todas as routes precisam ser async e usar await

async function dbAll(sql, params = []) {
  // Converter ? (SQLite) para $1,$2,... (Postgres)
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  try {
    const { rows } = await pool.query(pgSql, params);
    return rows;
  } catch (e) {
    console.error('dbAll error:', e.message, '\nSQL:', pgSql);
    return [];
  }
}

async function dbGet(sql, params = []) {
  const rows = await dbAll(sql, params);
  return rows[0] || null;
}

async function dbRun(sql, params = []) {
  let i = 0;
  const pgSql = sql.replace(/\?/g, () => `$${++i}`);
  // Adicionar RETURNING id se for INSERT
  const sqlFinal = pgSql.trim().toUpperCase().startsWith('INSERT')
    ? pgSql.replace(/;?\s*$/, ' RETURNING id')
    : pgSql;
  try {
    const { rows } = await pool.query(sqlFinal, params);
    return { lastInsertRowid: rows[0]?.id || null };
  } catch (e) {
    console.error('dbRun error:', e.message, '\nSQL:', sqlFinal);
    throw e;
  }
}

// ─── Criar tabelas ────────────────────────────────────
async function initDb() {
  console.log('🔌 Conectando ao PostgreSQL...');
  await pool.query('SELECT 1'); // testar conexão
  console.log('✅ Conectado');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS operadores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      usuario TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      perfil TEXT DEFAULT 'operador',
      status TEXT DEFAULT 'Ativo',
      criado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      telefone TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      corridas INTEGER DEFAULT 0,
      obs TEXT DEFAULT '',
      criado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS motoristas (
      id SERIAL PRIMARY KEY,
      codigo TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      telefone TEXT DEFAULT '',
      moto TEXT DEFAULT '',
      placa TEXT DEFAULT '',
      cor TEXT DEFAULT '',
      cidade TEXT DEFAULT '',
      cpf TEXT DEFAULT '',
      cnh TEXT DEFAULT '',
      status TEXT DEFAULT 'Offline',
      foto TEXT DEFAULT '',
      corridas INTEGER DEFAULT 0,
      telefone_familiar TEXT DEFAULT '',
      nome_familiar TEXT DEFAULT '',
      criado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS corridas (
      id SERIAL PRIMARY KEY,
      cliente_codigo TEXT DEFAULT '',
      cliente TEXT NOT NULL,
      telefone TEXT DEFAULT '',
      origem TEXT NOT NULL,
      destino TEXT NOT NULL,
      tipo TEXT DEFAULT 'Agora',
      data_hora TEXT,
      metodo TEXT DEFAULT 'Manual',
      distancia TEXT DEFAULT '-',
      tarifa TEXT DEFAULT '',
      valor REAL DEFAULT 0,
      valor_final REAL DEFAULT 0,
      motorista_codigo TEXT DEFAULT '',
      motorista TEXT DEFAULT 'Aguardando',
      status TEXT DEFAULT 'Nova',
      pagamento TEXT DEFAULT 'Pix',
      obs TEXT DEFAULT '',
      operador TEXT DEFAULT '',
      criado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS'),
      atualizado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS financeiro (
      id SERIAL PRIMARY KEY,
      motorista_codigo TEXT NOT NULL,
      motorista TEXT NOT NULL,
      valor REAL NOT NULL,
      tipo TEXT DEFAULT 'Diária',
      operador TEXT DEFAULT '',
      obs TEXT DEFAULT '',
      data TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS tarifas (
      id INTEGER PRIMARY KEY DEFAULT 1,
      config_json TEXT NOT NULL,
      atualizado_em TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS logs (
      id SERIAL PRIMARY KEY,
      operador TEXT DEFAULT '',
      acao TEXT NOT NULL,
      data TEXT DEFAULT to_char(NOW(),'YYYY-MM-DD HH24:MI:SS')
    );

    CREATE TABLE IF NOT EXISTS app_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      config_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Seed inicial (só se banco estiver vazio)
  const temOp = await dbGet('SELECT id FROM operadores LIMIT 1');
  if (!temOp) {
    console.log('📦 Inserindo dados iniciais...');
    await dbRun("INSERT INTO operadores (nome,usuario,senha,perfil) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
      ['Administrador', 'admin', '123456', 'admin']);
    await dbRun("INSERT INTO operadores (nome,usuario,senha,perfil) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
      ['Operador Central', 'operador', '123456', 'operador']);
  }

  const temTarifa = await dbGet('SELECT id FROM tarifas WHERE id=1');
  if (!temTarifa) {
    const config = {
      tabelasFixas: [
        { id:'pgpg',     titulo:'Praia Grande → Praia Grande', tarifaMinima:4.50,  valorKm:1.20 },
        { id:'pgsv',     titulo:'Praia Grande → São Vicente',  tarifaMinima:15.00, valorKm:2.00 },
        { id:'pgsantos', titulo:'Praia Grande → Santos',       tarifaMinima:20.00, valorKm:2.20 },
        { id:'pgcubatao',titulo:'Praia Grande → Cubatão',      tarifaMinima:20.00, valorKm:2.20 },
      ],
      tabelaHibrida: { titulo:'Híbrida (outras rotas)', tarifaMinima:30.00, valorKm:3.60 }
    };
    await dbRun('INSERT INTO tarifas (id,config_json) VALUES (?,?)', [1, JSON.stringify(config)]);
  }

  console.log('✅ Banco pronto\n');
}

// saveDb() não faz nada no Postgres (commit automático)
function saveDb() {}

module.exports = { initDb, dbAll, dbGet, dbRun, saveDb, pool };
