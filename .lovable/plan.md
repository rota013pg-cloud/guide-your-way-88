
# Portal do Cliente Rota013 — Plano de Estruturação

Projeto Lovable **novo e separado** apontando para o **mesmo backend** do painel do operador. Esta fase entrega apenas a **tela inicial pública + cadastro/login do passageiro + PWA**. Pedido de corrida e acompanhamento ficam para fases seguintes.

---

## 1. Arquitetura

```text
www.rota013.com.br          → Portal do cliente (projeto novo) ← ESTA FASE
operador.rota013.com.br     → Painel do operador (projeto atual, intocado)
motorista.rota013.com.br    → App do motorista (já existe)
                              ↓
                    MESMO backend Lovable Cloud
                    (mesmo banco, mesmas tabelas)
```

- **Stack:** TanStack Start + React 19 + Tailwind v4 (mesma do operador).
- **Backend:** conectado ao mesmo projeto Supabase via variáveis de ambiente.
- **Isolamento:** deploys independentes; bug no portal não afeta operador.
- **Sincronização:** garantida pelo banco compartilhado — cadastro feito em qualquer lado entra na mesma tabela `clientes`.

## 2. Cadastro do passageiro — integração com `clientes`

O cadastro pelo site **alimenta a tabela `clientes` existente**, preservando a sequência de IDs (`C0001`, `C0002`...) usada pelo operador.

**Campos obrigatórios:**
- Nome completo
- Telefone (com máscara BR)
- CPF (com validação)
- E-mail (vira credencial de login)
- Senha (mínimo 8 caracteres)
- Endereço principal (rua, número, bairro, cidade) — usado depois como origem padrão
- ☑ Aceite dos Termos de Uso e Política de Privacidade (obrigatório, com link)

**Mudanças no banco (migração):**
- Adicionar colunas em `clientes`: `email`, `cpf`, `endereco_logradouro`, `endereco_numero`, `endereco_bairro`, `endereco_cidade`, `termos_aceitos_em`, `termos_versao`.
- Nova tabela `cliente_auth` (espelho do padrão `motorista_auth`): `cliente_id`, `email_lower UNIQUE`, `senha_hash`, `token_atual`, `token_expira_em`, `reset_token`, `reset_token_expira_em`, `ultimo_acesso_em`.
- Funções `proximo_codigo_cliente` e `preview_proximo_codigo_cliente` já existem — reaproveitadas.
- RLS: `cliente_auth` bloqueado para `anon`/`authenticated`; acesso só via server functions com `supabaseAdmin`.

## 3. Sistema de autenticação do cliente

Espelha o padrão já usado para motoristas (decisão da memória do projeto):
- Server functions custom validam e-mail + senha, geram token opaco, devolvem ao client.
- Client guarda token em `localStorage` (chave `rota013_cliente_token`).
- Toda chamada autenticada manda o token; server resolve para `cliente_id`.
- **NÃO usa `auth.users` do Supabase** — fica reservado para operadores.
- Recuperação de senha: server function gera `reset_token` (válido 1h), dispara e-mail via **Lovable Emails** (precisa configurar domínio de e-mail nesta fase para os links de reset). Link aponta para `/redefinir-senha?token=...`.

## 4. Páginas — Fase 1

| Rota | Conteúdo | Acesso |
|---|---|---|
| `/` | TopBar + Hero + CTA "Entrar/Cadastrar" + Rodapé. Mobile-first. | Público |
| `/login` | Formulário de login. Link "Esqueci a senha" e "Criar conta". | Público |
| `/cadastro` | Formulário completo de cadastro com aceite de Termos. | Público |
| `/redefinir-senha` | Form de nova senha (recebe `?token=`). | Público |
| `/termos` | Termos de Uso (placeholder até você enviar o texto definitivo). | Público |
| `/privacidade` | Política de Privacidade (placeholder + base LGPD). | Público |
| `/instalar` | Instruções passo-a-passo de instalação PWA no iOS e Android. | Público |
| `/conta` | Área logada simples (nome, e-mail, telefone, sair). Base para próximas fases. | Cliente logado |

**TopBar (links institucionais):**  
Conforme combinado, os links **Quero ser parceiro**, **Como funciona**, **Quem somos** apontam temporariamente para os URLs atuais na Hostinger (`target="_blank"`). Quando você me passar o HTML/textos, criamos as rotas internas e trocamos os links.

**Rodapé:** razão social, CNPJ, endereço, telefone SAC, e-mail, links institucionais, link Termos/Privacidade, redes sociais.

## 5. PWA instalável

- Manifesto próprio (`/manifest.webmanifest`) com nome **"Rota 013"**, ícone, tema, `display: standalone`.
- Ícones (192, 512, maskable, apple-touch).
- **Sem service worker offline** nesta fase (segue regra do projeto — manifest-only).
- Página `/instalar` com instruções visuais:
  - **iOS Safari:** botão Compartilhar → "Adicionar à Tela de Início".
  - **Android Chrome:** menu ⋮ → "Adicionar à tela inicial" ou banner nativo.
- Banner sutil no topo (`Adicione à tela inicial →`) que abre `/instalar`, dispensável.

## 6. Design

- Visual independente do painel do operador — voltado ao **cliente final** (mais aberto, amigável, mobile-first).
- Mantém a marca **Rota 013** (logo, cores principais).
- Componentes shadcn + Tailwind v4.
- Responsivo: testado em 360px (Android pequeno), 390px (iPhone), 768px (tablet), 1280px (desktop).

## 7. O que **NÃO** entra nesta fase

- Pedido de corrida online.
- Acompanhamento em tempo real.
- Histórico de corridas.
- Pagamento online.
- Operação automática noturna.
- Páginas institucionais finais (aguardando seu HTML).

---

## Detalhes técnicos (resumo)

- **Migração 1:** ALTER `clientes` (novas colunas) + CREATE `cliente_auth` + GRANTs + RLS + índices em `email` e `cpf`.
- **Server functions:** `cadastrarCliente`, `loginCliente`, `meCliente` (resolve token), `solicitarResetSenha`, `redefinirSenha`, `aceitarTermos`.
- **E-mails:** scaffold de Lovable Emails para template de **recuperação de senha** (template "recovery" reaproveitável) — exige configurar domínio de envio.
- **Validação:** Zod no client + server (CPF, e-mail, telefone, força de senha).
- **Variáveis:** projeto novo recebe as mesmas `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` do projeto atual.

## Próximos passos

1. Você aprova este plano.
2. Eu crio o projeto Lovable novo (você me confirma o nome) e conecto ao mesmo backend.
3. Implemento a migração no banco (revisa antes de aplicar).
4. Construo as telas e o fluxo de auth.
5. Configuramos o domínio `www.rota013.com.br` apontando para o novo projeto e o domínio de e-mail para os links de reset.
6. Você envia o HTML das landing pages institucionais → migramos para rotas internas.
