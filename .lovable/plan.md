# Plano de implementação — Manual Rota013

Vou implementar as 19 atualizações em **5 fases sequenciais**, cada fase entregando valor utilizável. Ao final, reviso completamente a tela `Instruções` para refletir o sistema real.

---

## Fase 1 — Segurança (botão de pânico)
1. **Tabela `motorista_alertas`** (id, motorista_codigo, tipo: panico|suspeito, lat, lng, criado_em, atendido_em, atendido_por, observacao) com RLS + GRANTs + realtime.
2. **App motociclista**: botão fixo de pânico (modal de confirmação 3s) + botão "Comportamento suspeito" no card da corrida ativa. Envia localização atual.
3. **Painel**: modal de alerta crítico (som + vibração visual) listando alertas abertos, com link `tel:190`, `tel:192`, `tel:193` e botão "Marcar atendido". Notifier global em `__root.tsx`.

## Fase 2 — Fluxo de corrida
4. **Modal "Simular corrida"** no `nova-corrida-dialog`: mostra resumo (cliente, trajeto, valor, forma pgto, ETA estimado).
5. **Botão "Copiar mensagem WhatsApp"** com template configurável (cliente recebe valor + dados do motociclista após aceite).
6. **Etapa "Aguardando confirmação do cliente"** antes de lançar — checkbox "Cliente confirmou".
7. **ETA repassado ao painel**: quando motociclista aceita, calcula e exibe no card.
8. **Tolerância 5 min ao chegar** (app motociclista): contador visual após "Cheguei", sem bloquear.
9. **Confirmação "Pagamento recebido"** antes de iniciar viagem em corridas pagas no ato.

## Fase 3 — Histórico de pessoas (ocorrências)
10. **Tabela `ocorrencias_pessoa`** (id, tipo_pessoa: cliente|motociclista|passageiro, pessoa_id, tipo: ocorrencia|elogio|reclamacao|orientacao|advertencia|suspensao, nivel 1-4, descricao, evidencia_url, operador_id, criado_em).
11. **Dialog "Histórico" no card de cliente e motociclista**: lista + form de nova ocorrência + contadores no card (badge vermelho se reclamação recente).
12. **Passageiros**: novo campo `passageiros` (jsonb) na corrida — nome, idade (bloqueio <16), com seu próprio histórico.

## Fase 4 — Cadastro + solicitações especiais ✅
13. **`ear` (boolean)** + `vistoria_status` + `vistoria_em` + `prioridade_criterios` (jsonb) em motoristas. Nova aba **Avaliação** no cadastro com checkbox EAR, select status vistoria, data e 4 critérios de prioridade (experiência, avaliação, equipamentos, pontualidade).
14. **Solicitações especiais na corrida** (`solicitacoes_especiais text[]`): chips no nova-corrida-dialog (Animal, Bagagem, 3º passageiro, Capa de chuva, Capacete extra) → badges amarelos no card do motociclista após aceite.

## Fase 5 — Financeiro + Dashboard
15. **Validação de comprovante PIX**: motociclista anexa imagem ao solicitar liberação; painel mostra fila com Aprovar/Rejeitar.
16. **Validade da diária até 06:00**: corrige texto/lógica onde necessário, aviso visual de bloqueio (≥150% sem pagar).
17. **KPIs no dashboard**: cards com tempo médio atendimento, taxa cancelamento, ocorrências por nível (7d), tempo médio distribuição, inadimplência.

## Final — Documentação
18. **Reescrita completa de `/instrucoes`**: nova seção "Segurança" (pânico, ocorrências), atualização das seções existentes com os novos fluxos (simular, confirmar cliente, comprovante PIX, KPIs, solicitações especiais, EAR/vistoria), nova seção "Atalhos do motociclista" com tolerância 5 min e pagamento recebido. Remove qualquer texto desatualizado.

---

## Detalhes técnicos
- Toda escrita do app motociclista passa por server fn com `validateMotoristaToken` (mantém arquitetura dual existente).
- Tabelas novas: RLS + GRANT explícito (operador via `is_operador`, motorista via server fn admin).
- Realtime habilitado em `motorista_alertas` (policy `anon` + GRANT `anon SELECT` para sub realtime).
- PDFs (`historico-pdf`, `financeiro-pdf`) ganham linha de ocorrências relevantes.
- KPIs calculados em server fn única `getDashboardKpis` (cache 30s no client).

## Ordem de entrega
Vou entregar **fase a fase**, em mensagens separadas, para que você possa testar incrementalmente. Confirma que posso começar pela **Fase 1 (Segurança / pânico)**?
