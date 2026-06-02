
# Plano: Financeiro + App Motorista Premium + Painel Mobile

Trabalho extenso dividido em 4 frentes. Posso entregar tudo em uma única rodada, mas recomendo executar em fases para facilitar testes.

---

## Fase 1 — Módulo Financeiro (cobrança automática)

### Banco (migration)
- Adicionar em `app_config` (via JSON): `chavePix`, `tipoChavePix`, `whatsappCentral` (já existe), `percentualBloqueio` (default 50).
- Nova tabela `motorista_cobranca`:
  - `motorista_codigo`, `dia_op` (date), `status` ('Pendente'|'Aguardando'|'Pago'|'Bloqueado'), `faturamento_dia` (numeric), `disparou_aviso_em`, `disparou_bloqueio_em`, `comprovante_enviado_em`, `liberado_em`, `liberado_por`.
  - Único por (motorista_codigo, dia_op).
- Função SQL `recomputa_cobranca(motorista_codigo)`:
  - Soma `valor_final` de corridas Concluídas no dia operacional.
  - Cria/atualiza linha. Se faturamento > 0 e sem diária paga → status `Pendente`.
  - Se faturamento >= (1 + percentualBloqueio/100) × valorDiaria → status `Bloqueado`.
  - Se houver registro em `financeiro` tipo Diária no dia → status `Pago`.
- Trigger em `corridas` (AFTER UPDATE de status para Concluída) chama `recomputa_cobranca`.
- Trigger em `financeiro` (AFTER INSERT) marca cobrança como `Pago`.
- Realtime: ADD `motorista_cobranca` ao publication.

### Backend (server functions)
- `src/lib/cobranca.functions.ts`:
  - `listarCobrancasHoje()` — para painel operador.
  - `minhaCobranca()` — para motorista (server fn auth motorista via sessão existente).
  - `solicitarLiberacao(motoristaCodigo)` — motorista marca comprovante enviado.
  - `liberarMotorista(motoristaCodigo)` — operador confirma pagamento, insere em `financeiro`.

### UI Operador
- Em `/financeiro`, painel novo "Cobranças do dia" listando motoristas com:
  - Faturamento atual / valor diária / status / botão "Bloquear app" / "Confirmar pagamento e liberar".
- Toast/notificação quando motorista atinge gatilho de bloqueio (via Realtime).
- Toast quando motorista solicita liberação.

### UI Motorista
- Modal de aviso de pagamento (status Pendente): "Você atingiu o faturamento da diária. Pague R$ X via PIX." + botão **Copiar chave PIX** + botão **Já paguei** (envia solicitação) + nota "Envie o comprovante para WhatsApp da central para acelerar".
- Modal de **bloqueio parcial** (status Bloqueado): tela cheia, app travado, mesmo conteúdo + botão WhatsApp.
- App só volta a receber ofertas quando status virar `Pago`.

---

## Fase 2 — App Motorista PWA Premium

### Instalabilidade
- Adicionar `public/manifest.webmanifest` com `display: "standalone"`, ícones, theme_color, scope `/motorista`.
- Adicionar meta tags iOS (apple-touch-icon, apple-mobile-web-app-capable).
- **Sem service worker** (evita problemas no preview iframe — instalável basta).
- `viewport`: `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`.
- CSS: `touch-action: manipulation`, `overscroll-behavior: none`, bloqueio de rotação via `screen.orientation.lock('portrait')` quando suportado + CSS fallback.

### Layout mobile nativo
- Refatorar `src/routes/motorista.tsx`:
  - Header sticky com saudação + status motorista.
  - Conteúdo em "telas" navegáveis (Home/Corrida atual, Histórico, Faturamento, Chat, Perfil).
  - **Bottom navigation bar** fixo com 5 ícones: Início, Histórico, Faturamento, Chat, Perfil.
  - Cards com sombras suaves, tipografia maior, áreas de toque ≥ 48px.
  - Safe-area insets (`env(safe-area-inset-bottom)`).
- Componentes novos:
  - `MotoristaBottomNav`
  - `MotoristaPerfilSheet` (alterar senha)
  - `MotoristaChatSheet` (chat simples com operador — reusa `mural_recados` ou nova tabela `chat_motorista`)
  - `MotoristaHistoricoSheet`
  - `MotoristaFaturamentoSheet` (faturamento do dia + cobranças passadas)

### Chat motorista ↔ operador
- Nova tabela `chat_motorista`: `motorista_codigo`, `autor` ('motorista'|'operador'), `texto`, `lido`, `criado_em`. Realtime habilitado.
- Lado operador: aba "Chat" na sidebar com lista de conversas.

---

## Fase 3 — Painel Operador Mobile

- Aplicar mesmas regras de PWA (manifest único cobrindo painel + motorista, ou separar por scope).
- Em `_authenticated.tsx`: detectar viewport mobile → renderizar layout alternativo com bottom nav (Dashboard, Corridas, Mural, Financeiro, Mais).
- Sidebar atual continua para desktop. Em mobile, vira drawer + bottom nav.
- Tabelas viram cards em mobile (já parcialmente, revisar Corridas/Financeiro/Histórico).
- Bloqueios de zoom/rotação iguais ao motorista.

---

## Fase 4 — Configurações
- Em `/configuracoes` adicionar campos:
  - Chave PIX, Tipo chave PIX (CPF/Email/Telefone/Aleatória).
  - Percentual de gatilho de bloqueio (default 50%).
  - WhatsApp da central (já existe).

---

## Arquivos previstos

**Migrations:** 1 migration cobrindo tabelas `motorista_cobranca`, `chat_motorista`, funções e triggers.

**Criar:**
- `src/lib/cobranca.functions.ts`
- `src/lib/chat-motorista.functions.ts`
- `src/components/motorista/bottom-nav.tsx`
- `src/components/motorista/cobranca-modal.tsx`
- `src/components/motorista/bloqueio-modal.tsx`
- `src/components/motorista/perfil-sheet.tsx`
- `src/components/motorista/chat-sheet.tsx`
- `src/components/motorista/historico-sheet.tsx`
- `src/components/motorista/faturamento-sheet.tsx`
- `src/components/operador/mobile-bottom-nav.tsx`
- `src/components/operador/cobrancas-panel.tsx`
- `src/routes/_authenticated/chat.tsx`
- `public/manifest.webmanifest`
- `public/icons/*` (gerados)

**Editar:**
- `src/routes/motorista.tsx` (refator completo)
- `src/routes/_authenticated.tsx` (mobile layout)
- `src/routes/_authenticated/financeiro.tsx` (painel cobranças)
- `src/routes/_authenticated/configuracoes.tsx` (PIX + %)
- `src/lib/config.functions.ts` (novos campos)
- `src/routes/__root.tsx` (manifest + meta tags)
- `src/styles.css` (regras mobile, safe-area, no-zoom)

---

## Riscos / observações
- **PWA**: como avisado pela diretriz Lovable, vou usar manifest-only (sem service worker) para evitar problemas no preview. Instalação "Adicionar à tela inicial" funcionará no celular real.
- **Lock de orientação**: só funciona em modo standalone (após instalar). Em browser comum, apenas CSS rotaciona a mensagem.
- **Chat realtime**: vou usar Supabase Realtime — tabela nova é mais limpa que reusar mural.
- O escopo é grande (~20 arquivos novos/editados). Posso executar tudo numa sequência só, mas se preferir, divido por fase para validar entre etapas.

**Quer que eu execute tudo de uma vez, ou prefere ir por fase (1 → 2 → 3 → 4)?**
