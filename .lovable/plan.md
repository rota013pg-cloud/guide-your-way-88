## Visão geral

Implementar 3 frentes:
1. **Cadastro de Clientes** — CRUD completo com código sequencial `C0001`.
2. **Cadastro de Motoristas** — CRUD completo com uploads (foto/PDF), máscaras, código sequencial `M0001`, e painel admin de gerenciamento de acesso (ver/alterar senha, bloquear/desbloquear com motivo).
3. **Mapa** — tiles coloridos (estilo da imagem) + pin customizado de moto exibindo o ID do motorista.

---

## 1. Banco de dados (migrations)

### Campos novos
- `clientes`: adicionar coluna `indicacao text` (código de motorista OU texto livre).
- `motoristas`: já existem todos os campos necessários (`foto`, `doc_cnh`, `doc_veiculo`, `doc_endereco`, `foto_moto`, `nome_familiar`, `telefone_familiar`, etc).
- `motorista_auth`: adicionar `motivo_bloqueio text` (preenchido ao bloquear).

### Geração de código sequencial (anti-colisão)
Função RPC server-side dentro de transaction:
```sql
CREATE FUNCTION public.proximo_codigo_cliente() RETURNS text ...
CREATE FUNCTION public.proximo_codigo_motorista() RETURNS text ...
```
Lê `MAX(substring(codigo,2)::int)` + 1, formata `C0001`/`M0001`. Chamado **apenas no momento do INSERT** (não na abertura do dialog) para garantir unicidade. O dialog exibe um **preview** ("Próximo código: C0007") buscado via server fn separada, mas o código real é alocado no salvar com `ON CONFLICT (codigo) DO NOTHING` + retry caso colida.

### Storage
Criar bucket `motoristas-docs` (privado), com policies permitindo `operadores` lerem/escreverem.

---

## 2. Server functions

`src/lib/clientes.functions.ts`
- `listarClientes`, `salvarCliente` (create/update), `excluirCliente`, `proximoCodigoCliente`.

`src/lib/motoristas.functions.ts`
- `listarMotoristas`, `salvarMotorista`, `excluirMotorista`, `proximoCodigoMotorista`.
- `adminVerSenha(codigo)` — apenas admin, retorna `senha_plain`.
- `adminAlterarSenha(codigo, novaSenha)` — apenas admin, atualiza `senha_hash` + `senha_plain`.
- `adminBloquearMotorista(codigo, motivo)` / `adminDesbloquear(codigo)` — atualiza `motorista_auth.status` + `motivo_bloqueio`, encerra sessões ativas.

Todas protegidas com `requireSupabaseAuth`; as `admin*` checam `has_role(uid, 'admin')`.

---

## 3. UI

### `src/routes/_authenticated/clientes.tsx`
- Listagem em tabela: Código, Nome, Telefone, Endereço, Corridas.
- Busca por nome/telefone/código.
- Dialog "Novo cliente" / "Editar":
  - Campos: Nome, Telefone (máscara `(DD) 9XXXX-XXXX`), Endereço (com `AddressAutocomplete`), Indicação (opcional).
  - Mostra próximo código como label.

### `src/routes/_authenticated/motoristas.tsx`
- Listagem em cards/tabela: foto, código, nome, telefone, status (Online/Offline/Bloqueado), nº corridas.
- Dialog "Novo motorista" / "Editar":
  - Dados pessoais: Nome, Telefone (máscara), CPF (máscara `XXX.XXX.XXX-XX`), Endereço (autocomplete).
  - Contato familiar: Nome parente, Telefone parente (máscara).
  - Uploads (aceita imagem ou PDF): Foto, CNH, Doc moto, Foto moto, Comprovante endereço → vai pro bucket `motoristas-docs/{codigo}/{tipo}.ext`, URL salva no campo correspondente.
  - Preview do arquivo (thumb para imagem, ícone PDF para PDF, link "Abrir").
- **Painel admin** (visível só com `useRole().isAdmin`):
  - Botão "Ver senha" → modal com senha em texto + botão copiar.
  - Botão "Alterar senha" → input nova senha.
  - Toggle Bloquear/Desbloquear → ao bloquear, exige `motivo` (textarea).
  - Badge mostra "Bloqueado: {motivo}" no card.

### Máscaras
Usar funções utilitárias em `src/lib/masks.ts` (formatadores `formatTelefone`, `formatCPF`) aplicadas via `onChange`.

---

## 4. Mapa

`src/components/map-leaflet-inner.tsx`:
- Trocar tile layer atual pelo **CartoDB Voyager** (`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png`) — visual colorido similar ao da imagem.
- Criar `divIcon` customizado para motoristas:
  ```
  <div class="moto-marker">
    <span class="moto-id">M0001</span>
    <Bike icon SVG />
  </div>
  ```
  Estilizado em `src/styles.css` (badge com ID acima do ícone de moto, cores conforme status: verde online, azul em corrida).

---

## 5. Detalhes técnicos

- **Sequência sem buraco/colisão**: a função SQL é `SECURITY DEFINER` + `LOCK TABLE ... IN SHARE ROW EXCLUSIVE MODE` no momento do insert para serializar concorrência.
- **Upload**: usa `supabase.storage.from("motoristas-docs").upload()` direto do browser (operadores autenticados).
- **Validação Zod** em todas as server fns.
- **RLS**: clientes/motoristas já tem policy `operadores acessam`. `motorista_auth` ganha checagem extra `is_admin` nas server fns para campos sensíveis.
- **Auditoria**: ao bloquear/alterar senha, registrar log (opcional — pular nesta fase para manter escopo).

---

## Arquivos criados/modificados

**Migration**: 1 (adiciona colunas, função SQL, bucket + policies)

**Criados:**
- `src/lib/clientes.functions.ts`
- `src/lib/motoristas.functions.ts`
- `src/lib/masks.ts`
- `src/components/cliente-dialog.tsx`
- `src/components/motorista-dialog.tsx`
- `src/components/motorista-admin-panel.tsx`
- `src/components/file-upload-field.tsx`

**Modificados:**
- `src/routes/_authenticated/clientes.tsx` (lista + CRUD)
- `src/routes/_authenticated/motoristas.tsx` (lista + CRUD + admin)
- `src/components/map-leaflet-inner.tsx` (tile + pin)
- `src/styles.css` (estilo do pin de moto)

---

## Fora deste escopo (confirmar)

- Histórico de bloqueios/auditoria de alterações de senha.
- Validação real do CPF (apenas máscara).
- Geração automática da primeira senha do motorista no cadastro (manter fluxo atual: definida no `motorista_auth` existente).
