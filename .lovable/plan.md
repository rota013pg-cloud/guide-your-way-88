
# Fluxo de Nova Corrida — Plano de Implementação

## 1. Banco de dados (migração)

**Tabela `corridas` — novas colunas**
- `modelo` (enum: `Imediata` | `Agendada`) — default `Imediata`
- `agendada_para` (timestamptz, null) — quando `modelo = Agendada`
- `despacho` (enum: `Automatico` | `Manual` | `WhatsApp`) — default `Automatico`
- `paradas` (jsonb) — array `[{ ordem, endereco, lat, lng, concluida_em }]`
- `valor_paradas` (numeric) — total cobrado por paradas extras
- `motoristas_manuais` (text[]) — códigos quando despacho = Manual
- `rodada_atual` (int, default 1) — usado pelo auto-disparo (5 → 10 → 15…)

**Nova tabela `corrida_status_log`**
- `id`, `corrida_id`, `status` (text), `criado_em` (timestamptz)
- Registra: Pendente, Ofertada, Aceita, Cheguei, A caminho, Parada 1/2…, Finalizada, Cancelada
- RLS: operadores leem/escrevem; motorista escreve só do próprio (via server fn)

**`app_config.config_json`** — adicionar chave `valor_parada_extra` (number, default 3.00)

## 2. Lógica de valor (server)

`src/lib/tarifas-calc.ts` — adicionar:
- `arredondarParaBaixo(v)` → `Math.floor(v)` (sempre zera centavos)
- `calcularValorComParadas(base, qtdParadas, valorParada)` → `floor(base + qtd * valorParada)`

## 3. UI — Dialog Nova Corrida (reescrita de `nova-corrida-dialog.tsx`)

**Campos novos/alterados:**
- Busca de cliente **por código** (input "C0001" → autopreenche Nome + Telefone)
- Endereço origem + destino (já existe)
- **Paradas intermediárias**: lista com botão "+ Adicionar parada" usando `AddressAutocomplete`. Reordenável (drag opcional, v2). Cada parada soma `valor_parada_extra` no total.
- Tarifa (já existe)
- **Modelo**: `Imediata` | `Agendada` (com `datetime-local` quando agendada)
- **Despacho**: `Automatico` | `Manual` | `WhatsApp`
  - `Manual` → MultiSelect de motoristas (códigos M0001…)
  - `WhatsApp` → após salvar, abre dialog com texto formatado + botão "Copiar"
- Pagamento (já existe)
- Observações
- **Box de valor**: mostra valor base + adicional de paradas, total em destaque (centavos zerados)
- Rodapé: **Limpar** / **Cancelar** / **Lançar corrida**

**Agendadas** ficam só salvas (`status = Agendada`); aparecem em aba/lista nova em `/corridas` com botão "Iniciar agora" que chama o disparo conforme `despacho`.

## 4. Despacho (server functions)

**`dispararOfertas` (existe — estender):**
- Se `despacho = Manual` → insere ofertas só para os códigos em `motoristas_manuais`, sem filtrar por status.
- Se `despacho = Automatico` → mantém top 5 por proximidade; agendar revisão (rodada 2 = 10, rodada 3 = 15) via `setTimeout` curto no client OU via cron leve. Implementação simples: campo `rodada_atual` + server fn `expandirOfertas(corridaId)` chamada pelo dashboard em polling de 30s para corridas pendentes.
- Se `despacho = WhatsApp` → NÃO insere ofertas; retorna `{ modo: "whatsapp", texto }` montado a partir da corrida.

**Bloqueio motorista ocupado:** ao aceitar uma oferta, server fn `aceitarCorrida` marca motorista como `Em corrida` e filtra das próximas ofertas até `finalizarCorrida`.

## 5. Timeline de status

- Server fn `registrarStatusCorrida({corridaId, status})` — escreve em `corrida_status_log` + atualiza `corridas.status`.
- Componente `<CorridaTimeline corridaId/>` — lista cronológica usada em `/corridas` e na tela de detalhe.
- Botão "Marcar parada concluída" no app do motorista (motorista.tsx) atualiza `paradas[i].concluida_em` e cria log.

## 6. PDF financeiro

`src/lib/financeiro-pdf.ts` — quando a corrida tiver log, anexar tabela "Linha do tempo" (status × hora) no recibo.

## 7. Botão "Nova corrida" no cliente

Em `/clientes` (e no `ClienteDialog`), adicionar botão 🏍️ "Nova corrida" que abre o NovaCorridaDialog já com cliente preenchido.

---

## Escopo desta primeira entrega

Para entregar funcional sem ficar gigante demais, vou implementar nesta rodada:

1. Migração (colunas + tabela log + config valor_parada)
2. UI completa do novo NovaCorridaDialog (paradas, modelo, despacho, arredondamento, busca por código)
3. Server fn `dispararOfertas` estendida (Manual / WhatsApp / Automático rodada 1)
4. Server fn `registrarStatusCorrida` + componente `<CorridaTimeline/>` na aba Corridas
5. Botão "Nova corrida" no card do cliente
6. Config "Valor por parada extra" em `/configuracoes`

**Fica para a rodada seguinte** (aviso antes):
- Auto-expansão de rodadas (5→10→15) — precisa de cron/polling
- Lista de "Agendadas" com botão "Iniciar agora"
- Botão de parada concluída no app do motorista
- Anexar timeline no PDF financeiro
- Chat operador ↔ motorista (mencionado pela sua sugestão)

## Sugestões adicionais

- **Cancelamento via chat**: concordo com sua ideia — proponho criar uma tabela `corrida_mensagens` (motorista_codigo, corrida_id, texto, autor) com Realtime. Faço junto com o chat na rodada 2.
- **Agendadas**: além do "iniciar manual", recomendo um aviso visual 10 min antes do horário no dashboard.
- **WhatsApp**: o texto copiado vai incluir origem, destino, paradas, valor, pagamento e link `https://wa.me/?text=...` para colar direto no grupo.

Pode confirmar para eu seguir com a rodada 1?
