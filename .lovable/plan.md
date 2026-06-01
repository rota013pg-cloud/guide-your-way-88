## Migração Rota 013 Beta — Plano Faseado

Migrar o sistema completo (painel operador + app motorista + admin + financeiro) do stack **Express + Postgres + Socket.io + HTML/JS vanilla** para **React (TanStack Start) + Lovable Cloud**, preservando todas as regras de negócio do `CONTEXTO_ATUAL.md`.

### Stack final no Lovable
- **Frontend**: React + TanStack Router + Tailwind (preserva dark theme #0f0f0f)
- **Backend**: Lovable Cloud (Postgres + Auth + Realtime + Storage)
- **Mapa**: Leaflet (já usado no projeto original)
- **Google Maps Places**: mantém com a key existente
- **PWA**: manifest + service worker para o app motorista
- **Realtime**: Supabase Realtime no lugar de Socket.io (mesmo modelo pub/sub)

### Fase 0 — Fundação (1 iteração)
- Ativar Lovable Cloud
- Criar schema completo no Postgres: `motoristas`, `clientes`, `corridas`, `financeiro`, `app_config`, `corrida_ofertas`, `motorista_gps`, `push_subscriptions`, `motorista_sessoes`, `motorista_auth`
- RLS policies (operador autenticado vê tudo; motorista só vê suas próprias corridas/dados)
- Função SQL para o "dia operacional 6h-5h59"
- Constraint única `uniq_diaria_dia` no financeiro (idempotência)
- Seed com 5 motoristas, 10 clientes, 20 corridas fictícias, config padrão
- Design system: dark theme, amarelo Rota013, tipografia

### Fase 1 — Painel Operador: Dashboard + Corridas
- Login do operador (email/senha via Lovable Cloud Auth)
- Dashboard layout 2 colunas: Mapa Leaflet (62%) + Ações rápidas/Motoristas online (38%)
- Linha inferior: Histórico corridas + Corridas ativas
- FAB amarelo "＋" → modal de nova corrida
- Autocomplete Google Places para origem/destino
- Cálculo de tarifa por distância
- Criar/editar/cancelar corrida
- Lista de motoristas online com pin no mapa
- Realtime: motoristas online aparecem/somem instantaneamente

### Fase 2 — App Motorista (PWA mobile)
- Login único por dispositivo (deviceId no localStorage, bloqueio backend)
- Tela principal: topbar com logo + nome/moto + avatar + ⚙️
- Toggle online/offline (.toggle-track + .is-online)
- Bottom nav: 🏠 Início | 🚗 Corrida (condicional) | 👤 Perfil
- Receber oferta de corrida (Realtime) → aceitar/recusar
- Tela de corrida ativa: dados origem/destino, botões "🧭 Ir" → Waze
- Atualizar status: A caminho → Chegou → Em viagem → Finalizada
- Wake Lock (3 camadas: API nativa, vídeo mudo, ping DOM)
- GPS contínuo enviando para `motorista_gps` (Realtime → painel)
- Manifest PWA + Service Worker v6

### Fase 3 — Fluxo de Ofertas + Realtime de Corrida
- `dispararOfertas()` server function (cria registros em `corrida_ofertas`)
- Realtime broadcast da oferta para o motorista
- Aceite → atualiza corrida.motorista_codigo → notifica painel
- Mudança de status: motorista → backend → Realtime → painel atualiza
- Pin do motorista se move no mapa do painel em tempo real

### Fase 4 — Sistema Financeiro / Diária
- Tela financeiro no painel (`renderFinanceiro` em React)
- Cálculo: limiar = 50% do `valorDiaria` configurado
- Motor: ao atingir limiar → motorista vê tela de bloqueio
- Motorista clica "Já enviei" → Realtime → painel mostra pendência
- Operador confirma → INSERT em `financeiro` com `ON CONFLICT DO NOTHING` → libera motorista via Realtime
- Histórico de diárias por dia operacional

### Fase 5 — Admin (Gestão de Motoristas/Clientes/Config)
- CRUD motoristas com upload de foto (perfil, moto, CNH, CRLV, comprovante endereço) → Lovable Storage
- Ficha completa do motorista (`ver-motorista.js` reescrito em React)
- Modal de acesso 🔑: ver senha atual, bloquear/liberar, resetar dispositivo
- CRUD clientes
- Configurações: empresa, whatsappCentral, valorDiaria, cidadeBase, pixChave
- CRUD tarifas

### Fase 6 — Histórico, Ranking, Relatórios
- Histórico de corridas com filtros (data, motorista, cliente, status)
- Ranking de motoristas (por corridas/faturamento)
- Relatório PDF (mantém lib do projeto original adaptada)
- Mensagens WhatsApp (`mensagens.js` → React)

### Fase 7 — Polimento e Deploy
- PWA do motorista testada em mobile real
- Service Worker com cache estratégico
- Notificações push (Web Push API + Lovable Cloud)
- Export do código para VPS (instruções `npm run build` + Nginx servir `dist/` + manter ou substituir backend Express)

### Recomendação de ritmo
Cada fase = 1 iteração no chat. Você testa no preview, valida com dados de seed, pede ajustes, e só depois passamos pra próxima. **Não vou tentar fazer todas as fases no mesmo turno** — qualidade > velocidade num projeto desse tamanho.

### O que entrego no primeiro turno (se aprovar)
**Fase 0 + início da Fase 1**:
- Lovable Cloud ativado
- Schema completo migrado
- Seed populado
- Design system (dark + amarelo Rota013)
- Login do operador funcionando
- Layout do dashboard com mapa e listas (ainda sem criar corrida — vem na próxima)

### Detalhes técnicos
- **Tabelas em snake_case** (preserva nomenclatura do banco original)
- **Códigos de motorista** mantidos como string (ex: "M001") — não trocar por UUID
- **Foto/docs** vão pro Lovable Storage (bucket `motoristas`), URL pública assinada
- **GPS**: insere em `motorista_gps` a cada 5s, publica via Realtime channel `gps:{codigo}`
- **Ofertas**: broadcast Realtime channel `motorista:{codigo}:ofertas`
- **Diária idempotente**: PostgreSQL constraint + `ON CONFLICT DO NOTHING`
- **Dia operacional**: função SQL `dia_operacional()` retorna data baseada na regra 6h
- **Type safety**: TypeScript + tipos gerados do schema do Cloud
