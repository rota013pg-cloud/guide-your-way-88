const express   = require('express');
const router    = express.Router();
const { dbAll, dbGet, dbRun } = require('../db');

function toFront(r) {
  if (!r) return null;
  return {
    id: r.id, clienteCodigo: r.cliente_codigo, cliente: r.cliente,
    telefone: r.telefone, origem: r.origem, destino: r.destino,
    tipo: r.tipo, dataHora: r.data_hora, metodo: r.metodo,
    distancia: r.distancia, tarifa: r.tarifa, valor: r.valor,
    valorFinal: r.valor_final, motoristaCodigo: r.motorista_codigo,
    motorista: r.motorista, status: r.status, pagamento: r.pagamento,
    obs: r.obs, operador: r.operador,
    criadoEm: r.criado_em, atualizadoEm: r.atualizado_em
  };
}

router.get('/', async (req, res) => {
  try {
    const { status, cliente } = req.query;
    let sql = 'SELECT * FROM corridas WHERE 1=1';
    const p = [];
    if (status)  { sql += ' AND status = ?'; p.push(status); }
    if (cliente) { sql += ' AND (cliente LIKE ? OR cliente_codigo = ?)'; p.push(`%${cliente}%`, cliente); }
    sql += ' ORDER BY id DESC';
    const rows = await dbAll(sql, p);
    res.json(rows.map(toFront));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const row = await dbGet('SELECT * FROM corridas WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ erro: 'Corrida não encontrada' });
    res.json(toFront(row));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const d = req.body;
    const info = await dbRun(
      `INSERT INTO corridas (cliente_codigo,cliente,telefone,origem,destino,tipo,data_hora,
       metodo,distancia,tarifa,valor,valor_final,motorista_codigo,motorista,status,pagamento,obs,operador)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [d.clienteCodigo||'',d.cliente,d.telefone||'',
       d.origem,d.destino,d.tipo||'Agora',d.dataHora||null,
       d.metodo||'Manual',d.distancia||'-',d.tarifa||'',
       d.valor||0,d.valorFinal||0,
       d.motoristaCodigo||'',d.motorista||'Aguardando',
       d.status||'Nova',d.pagamento||'Pix',d.obs||'',d.operador||'']
    );
    await dbRun('INSERT INTO logs (operador,acao) VALUES (?,?)',
      [d.operador||'Sistema', `Corrida #${info.lastInsertRowid} criada`]);
    const salvo = await dbGet('SELECT * FROM corridas WHERE id=?', [info.lastInsertRowid]);
    res.status(201).json(toFront(salvo));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status, motoristaCodigo, motorista, operador } = req.body;
    const validos = ['Nova','Aceita','A caminho','Em curso','Finalizada','Cancelada'];
    if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
    await dbRun(
      `UPDATE corridas SET status=?,
       motorista_codigo=COALESCE(?,motorista_codigo),
       motorista=COALESCE(?,motorista),
       atualizado_em=to_char(NOW(),'YYYY-MM-DD HH24:MI:SS') WHERE id=?`,
      [status, motoristaCodigo||null, motorista||null, req.params.id]
    );
    await dbRun('INSERT INTO logs (operador,acao) VALUES (?,?)',
      [operador||'Sistema', `Corrida #${req.params.id} → ${status}`]);
    const row = await dbGet('SELECT * FROM corridas WHERE id=?', [req.params.id]);
    res.json(toFront(row));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const d = req.body;
    await dbRun(
      `UPDATE corridas SET cliente_codigo=?,cliente=?,telefone=?,origem=?,destino=?,
       tipo=?,data_hora=?,metodo=?,distancia=?,tarifa=?,valor=?,valor_final=?,
       motorista_codigo=?,motorista=?,status=?,pagamento=?,obs=?,
       atualizado_em=to_char(NOW(),'YYYY-MM-DD HH24:MI:SS') WHERE id=?`,
      [d.clienteCodigo,d.cliente,d.telefone,d.origem,d.destino,
       d.tipo,d.dataHora,d.metodo,d.distancia,d.tarifa,d.valor,d.valorFinal,
       d.motoristaCodigo,d.motorista,d.status,d.pagamento||'Pix',d.obs,req.params.id]
    );
    const row = await dbGet('SELECT * FROM corridas WHERE id=?', [req.params.id]);
    res.json(toFront(row));
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await dbRun('DELETE FROM corridas WHERE id=?', [req.params.id]);
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

module.exports = router;
