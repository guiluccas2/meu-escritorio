# Meu Escritório — regras para qualquer alteração

PWA em JavaScript puro (sem build), publicado no GitHub Pages. Usuário: advogado; responda sempre em **português**.
O sistema controla **prazos processuais**: uma ligação quebrada entre módulos pode significar prazo perdido. Por isso, **toda alteração deve repercutir em tudo o que depende dela**.

## Regras do usuário (permanentes)
- Não mover botões existentes (acrescentar pode).
- Sem novos gastos de créditos de IA nas funções (o Assistente IA já aprovado mostra o custo).
- A chave da API Claude fica só no aparelho. O e-mail do usuário nunca vai para serviços externos.
- CPF, RG, endereço e dados bancários nunca são enviados ao Assistente IA.
- Automação de navegador: só leitura (nunca peticionar, “tomar ciência”, digitar senha/PIN, resolver captcha, abrir Expedientes/Intimações).
- Quando o usuário pedir análise/mockup, analisar antes de implementar.
- **Toda alteração futura mantém as otimizações** (pedido expresso do usuário):
  - desempenho com muitos dados: nenhuma tela acima de ~0,3 s em `testes/tperf.js` (sem `filter`/`find` em `db` dentro de laços de linhas; use `memo`/`agrupar`/`byId` e `limitar()`);
  - celular: tudo cabe em 390 px (`testes/tcel.js`), avisos e botões sem cobrir a tela;
  - dados: gravação pelo `save()`/`armGravar`, backup antes de operações destrutivas, vínculos registrados em `VINCULOS` e checagem na Verificação do sistema;
  - teste novo em `testes/` para cada funcionalidade nova, incluído no `rodar.sh`.

## Mapa de dependências — confira a cada mudança
| Se você mexer em… | Atualize também |
|---|---|
| **Listas/opções** (`LISTAS` em `js/base.js`) | Uma lista nova com `usos:[[col, campo]]` aparece **sozinha** nos Workflows (`wfCamposDe`) e na Verificação. Se um módulo guardar valores de lista **pelo nome** (chave de objeto ou campo de configuração), registre em `VINCULOS.renomear` (renomear) e em `VINCULOS.verificar` (referência quebrada). Exemplos: `js/workflows.js` (WF_LISTA_G / WF_LISTA_P) e `js/verificacao.js` (Google Agenda, reagendamento, subtipos). |
| **Tipos de compromisso** | `SUBTIPOS_PADRAO` (compromissos.js), `GCAL_PADRAO` (google-agenda.js), `corTipo`, `TIPOS_CLIENTE`, `LEMB_MODELOS_PADRAO`, reagendamento (`painelCfg().reag`), gatilhos/passos dos workflows. |
| **Coleção nova em `db`** | `COL` (base.js) · `NOMES_COL` (backup.js) · checagem de órfãos em `verificacao.js` · se gera eventos, a lista de coleções no wrapper de `upsert` em `workflows.js` e `WF_EV`. |
| **Campo novo em um cadastro** | Se ligado a uma lista: `usos` na `LISTAS`. Se for relevante para automação: `WF_CAMPOS_BASE` (workflows.js). Colunas das listagens: `TABELAS` (colunas.js). Relatórios: `lote.js`. |
| **Tela/aba nova** | `index.html` (menu + `<script>`), `sw.js` (`ARQUIVOS` e `CACHE`), `PAINEL_PADRAO.menu`, `ordem.menu` e `NOMES_PAINEL.menu` (telas.js), verificação de celular (`testes/tcel.js`). |
| **Gatilho/ação de workflow novo** | `WF_EV` / `WF_AC`, `wfCasa`, `wfPasso`, `wfDesfazer` (tudo que cria/alterar precisa ser desfazível via `lg.criados`/`lg.alterados`), `wfProblemas`. |
| **Tags / campos personalizados** | Tags são guardadas por **id** (renomear é seguro); excluir é detectado pela Verificação. Campo personalizado excluído → Verificação aponta nos workflows. |
| **Gravação de dados** | Sempre via `upsert`/`save()` (base.js). `save()` é agendado e grava uma vez por rodada no **IndexedDB** (+ cópia no localStorage enquanto couber). Nunca use `localStorage.setItem(KEY, …)` direto: use `armGravar(str)`. |
| **Excluir/substituir muitos registros** | O backup automático já guarda uma cópia “antes de remover” (armGravar). Restaurações e “apagar tudo” chamam `bkDoTexto` antes. Mantenha isso em qualquer operação destrutiva nova. |
| **Financeiro** | Toda conta a pagar/receber tem `conta` (id do plano — `js/plano-contas.js`) e `categoria` de compatibilidade (`catDaConta`). Leia sempre por `contaDe(l)` e `ambDe(l)` (escritório/pessoal); `isRec`/`isDesp` vêm do `kind` da conta. Contas usadas não se excluem (desativar). Valores de clientes (`kind:'terc'`) e reembolsos (`'reemb'`) ficam fora do resultado. Nova tela financeira → aba em `FIN_ABAS` (telas.js). Conta sem vencimento = “ao final do processo” (`finStatus` → `'semdata'`): trate esse caso em qualquer lista/relatório novo. Recorrências: `db.meta.finSeries` + `l.serie` (financeiro-contas.js). Participações: contas a pagar ligadas por `l.partDe` (entrada comum) ou `l.acordoId`+`l.partId` (acordo); ao mudar valor/recebimento de uma entrada chame `finPartSync(l)` / `acordoPartSync(a, k)`. Transferências entre contas ficam em `db.transf` (não são receita/despesa); saldos por conta: `saldoConta(cb)`; demonstrativo: `finDRE({de, ate, regime:'caixa'|'comp'})`. O “acordo” não existe mais como módulo na tela: é a conta a receber **com valor do cliente** (dados em `db.acordos`, tela `#/acordo/id` = “ver parcelas”); o êxito do contrato liga por `it.acordoIds` (`itemPctContrato`). Parcelas da mesma conta: `l.grupo` (ou `l.serie`) → `finIrmas(l)`; toda baixa passa por `finPagarComDiferenca` / `acordoReceber` (diferença a menos/a mais); renegociações guardam o histórico em `db.meta.finReneg`. Despesas descontadas do repasse: `l.reembAcordo` (conta no principal da parcela). |
| **Serviços** | São `db.processos` com `p.servico = true` (`js/servicos.js`): código `P0152.S1` (`p.seqServ`, `nextSeqServ`), status próprio em `p.statusServ` e `p.status` espelhado (Ativo/Encerrado). Toda tela/relatório/contagem de **processos** precisa filtrar `!p.servico` (lista de processos, painel, `procsDaPessoa`, `nextSeq`, êxitos); gatilhos `proc_*` ignoram serviços e `serv_*` são os deles. Ficha própria (`servicoFicha`), formulário próprio (`formServico`; `formProc` redireciona). |
| **Listas longas** | Use `limitar()` / `maisBtn()` (base.js) para não desenhar milhares de linhas; contas por registro usam índices em memória (`memo`, `agrupar`, `byId`). |

## Antes de publicar
1. `node -e` de sintaxe em todos os `js/*.js` e checagem de `const`/`let` duplicados entre arquivos:
   `cat js/*.js | grep -oE "^(const|let) [A-Za-z0-9_$]+" | sort | uniq -d` (tem que sair vazio).
2. Rodar `testes/rodar.sh` (Playwright já instalado; tudo ✔) e `node testes/tperf.js` (tempos das telas).
3. Versão: trocar `VERSAO` em `index.html` (sed em todas as ocorrências), subir `CACHE` em `sw.js`, entrada em `NOVIDADES` (js/notificacoes.js), linha nova no `LEIA-ME.md` para arquivo novo.
4. Commit e push na `main`.
