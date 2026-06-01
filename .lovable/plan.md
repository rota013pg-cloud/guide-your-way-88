# Portar Rota 013 Beta 2.0 para TanStack Start + Lovable Cloud

## Estado atual

**Backend (Supabase) — já portado:**
- Tabelas: `motoristas`, `corridas`, `corrida_ofertas`, `clientes`, `financeiro`, `tarifas`, `app_config`, `motorista_auth`, `motorista_sessoes`, `motorista_gps`, `push_subscriptions`, `user_roles`.
- Roles `admin` / `operador` via `has_role()` / `is_operador()`.
- RLS ativa em todas as tabelas.
- Função `dia_operacional()` (corte às 06h America/Sao_Paulo) para diárias.

**Frontend (React/TanStack) — já existe:**
- `__root.tsx`, `index.tsx`, `login.tsx`, `dashboard.tsx`.
- Componentes: `map-leaflet`, `nova-corrida-dialog`.
- Auth + redirecionamento + testes (trabalho recente).

**Backup legado (`/mnt/user-uploads/rota013-beta-backup.tar.gz`)** contém o que falta portar: módulos do painel operador beta, app do motorista (PWA) e regras de negócio do `server-beta/`.

## Fases propostas

### Fase 1 — Layout do painel + navegação (esta entrega)
- Criar layout `_authenticated.tsx` (sidebar + topo com relógio, perfil, logout).
- Rotas vazias dos módulos: `corridas`, `motoristas`, `clientes`, `financeiro`, `tarifas`, `historico`, `configuracoes`, `mensagens`.
- Mover `dashboard` para dentro de `_authenticated/dashboard.tsx`.
- Hook `useRole()` para esconder itens admin-only.

### Fase 2 — Módulo Corridas (núcleo operacional)
- Listagem em tempo real (Supabase Realtime em `corridas` + `corrida_ofertas`).
- Filtros: status, data, motorista.
- Dialog Nova Corrida (já existe — integrar com tarifas + autocomplete Google Places).
- Ações: aceitar/cancelar/finalizar, atribuir motorista, disparar oferta.
- Server fn `dispararOferta` (porta da lógica de `routes/beta-corridas.js`).

### Fase 3 — Motoristas + Clientes + Tarifas
- CRUD completo de cada um.
- Upload de fotos/documentos para Supabase Storage (bucket `motoristas`).
- Geração de senha do motorista (`motorista_auth`) + link/QR de acesso.
- Tabela de tarifas com bandeirada/por km/mínimo.

### Fase 4 — Financeiro
- Marcar diária paga (com constraint única `uniq_diaria_dia` que já existe).
- Liberar pagamento (idempotente).
- Relatório por período (PDF via `pdf-lib` no cliente).
- Ranking de motoristas.

### Fase 5 — Configurações + Mensagens
- `app_config` (empresa, WhatsApp central, valor diária, pixChave) — admin-only.
- Templates de mensagens WhatsApp.
- Histórico operacional (logs).

### Fase 6 — App do Motorista (PWA separada)
- Rota pública `/motorista` (login por código + senha, fora do `_authenticated`).
- Status online/offline, aceitar corridas, GPS via `navigator.geolocation` → server fn → `motorista_gps`.
- Service worker + manifest (PWA).
- Push notifications via Web Push API (já existe `push_subscriptions`).

### Fase 7 — Realtime + mapa
- Mapa Leaflet com marcadores GPS em tempo real.
- Notificações sonoras quando corrida aceita/finalizada.
- Indicador "motorista online" na sidebar.

## Detalhes técnicos

- **Reads**: `createServerFn` + `requireSupabaseAuth` + TanStack Query (`ensureQueryData` no loader, `useSuspenseQuery` no componente).
- **Writes**: `createServerFn` com `inputValidator(zod)`; invalidação via `queryClient.invalidateQueries`.
- **Realtime**: hook `useRealtimeTable(table)` que usa `supabase.channel()` no cliente e invalida queries no evento.
- **Storage**: bucket `motoristas` (privado, RLS por `is_operador`).
- **Google Maps**: secret `GOOGLE_MAPS_KEY` (precisarei pedir).
- **PWA do motorista**: `vite-plugin-pwa` + manifest separado em `/motorista`.

## O que peço pra começar agora (Fase 1)

Confirmação para:
1. Criar layout autenticado + skeletons das 8 rotas.
2. Mover `dashboard.tsx` para `_authenticated/dashboard.tsx` (mantendo testes).
3. Adicionar `GOOGLE_MAPS_KEY` como secret (necessário a partir da Fase 2).

Posso ir entregando fase por fase, ou se preferir, executo Fases 1–3 numa sequência longa.
