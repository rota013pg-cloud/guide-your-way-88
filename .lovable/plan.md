## Plano — 4 entregas

### 1. Botão "Nova Corrida" no módulo Corridas + ajuste no modal
- Em `src/routes/_authenticated/corridas.tsx`: adicionar botão no header que abre `NovaCorridaDialog` (já existe).
- Em `src/components/nova-corrida-dialog.tsx`:
  - Trocar busca de cliente com botão por **busca automática (debounce ~400ms)** enquanto digita o código.
  - Preencher **somente Nome e Telefone**. Não tocar no campo de endereço de origem.

### 2. Gestão de Usuários (admin)
Nova página `/usuarios` (admin-only via `useRole`). CRUD de operadores do painel.
- **Campos**: Nome, E-mail, Login (username), Senha.
- **Ações**: criar, ver senha atual, alterar senha, bloquear, liberar, excluir.
- **Backend** (`src/lib/usuarios.functions.ts`): server functions com `requireSupabaseAuth` + `exigirAdmin`. Usa `supabaseAdmin.auth.admin.*` para criar/atualizar/deletar usuários.
- **Tabela nova** `usuarios_painel`: armazena `user_id`, `nome`, `login`, `senha_plain` (visível ao admin), `status` (`Ativo`/`Bloqueado`), `motivo_bloqueio`. RLS: admin acessa tudo.
- **Login**: o login será convertido em `<login>@painel.local` no signup para usar email/senha do Supabase Auth de forma transparente.
- Adicionar link "Usuários" na sidebar visível apenas para admin.

### 3. Mural de Recados (operadores)
Nova página `/mural` para anotações entre turnos.
- **Tabela** `mural_recados`: `autor_user_id`, `autor_nome`, `texto`, `fixado` (boolean), `lido_por` (jsonb), `criado_em`.
- **UI**: lista cronológica + botão "Novo recado". Cada card mostra autor, data/hora, texto, ação "Marcar como lido" e (autor/admin) "Excluir"/"Fixar".
- **Realtime**: subscrever inserts via `supabase.channel`.
- RLS: todos operadores leem/inserem; só autor ou admin altera/deleta.
- Adicionar item "Mural" na sidebar.
- Badge na sidebar com contagem de recados não lidos.

### 4. Alertas de corrida agendada + vínculo prévio
- **Campos novos em `corridas`**: `alerta_antes_min` (default 15), `alerta_disparado` (boolean).
- **Configuração** (`app_config.alertaAgendadaMin`, default 15) na tela de Configurações.
- **No `NovaCorridaDialog`** (modo Agendada): permitir já escolher um motorista específico (combo de motoristas Online) — grava em `motorista_codigo` com `status='Agendada'`.
- **Hook `useAlertasAgendadas`** no layout `_authenticated`: a cada 30s lê corridas com `modelo='Agendada'`, `status='Agendada'`, `agendada_para <= now() + alerta_antes_min` e ainda não disparadas → exibe toast com som + marca `alerta_disparado=true`.
- **Botão "Lançar agora"** no painel/sheet de corrida agendada: muda `modelo='Imediata'` e chama `dispararOfertas` (ou usa o motorista já vinculado).

### Arquivos a criar/editar
**Migração**: novas tabelas `usuarios_painel`, `mural_recados`; colunas `alerta_antes_min`, `alerta_disparado` em `corridas`; enable realtime no `mural_recados` e `corridas`.

**Novos**:
- `src/lib/usuarios.functions.ts`
- `src/lib/mural.functions.ts`
- `src/routes/_authenticated/usuarios.tsx`
- `src/routes/_authenticated/mural.tsx`
- `src/hooks/use-alertas-agendadas.tsx`

**Modificados**:
- `src/components/nova-corrida-dialog.tsx` (auto-busca; vincular motorista em agendadas)
- `src/components/app-sidebar.tsx` (links Usuários/Mural; badge não lidos)
- `src/routes/_authenticated/corridas.tsx` (botão Nova Corrida; botão Lançar agora)
- `src/routes/_authenticated.tsx` (montar hook de alertas)
- `src/lib/config.functions.ts` (`alertaAgendadaMin`)
- `src/routes/_authenticated/configuracoes.tsx` (input do tempo de alerta)

### Observações
- Sons de alerta usam beep gerado via `AudioContext` (sem assets externos).
- Senha do usuário criado é armazenada em `senha_plain` igual ao padrão usado nos motoristas (apenas admin lê).
- Login deve ser único (`UNIQUE` em `usuarios_painel.login`).

Confirma para eu seguir?
