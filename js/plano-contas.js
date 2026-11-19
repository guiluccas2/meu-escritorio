/* ===== 📒 Plano de contas · contas bancárias e caixa · planos de recebimento/pagamento =====
   db.meta.planoContas = [{id, cod, nome, pai, ambito:'esc'|'pes', nat:'entrada'|'saida', kind, tipo:'fixa'|'variavel'|'eventual', chave?, ativo}]
     kind: 'rec' receita · 'desp' despesa · 'terc' dinheiro de cliente (fora do resultado) · 'reemb' despesa adiantada/reembolso (fora do resultado)
           'ret' retirada do titular (abaixo do resultado) · 'naoop' investimento/empréstimo (fora do operacional)
   Cada lançamento guarda l.conta (id). Os antigos (só com l.categoria) são lidos pela tabela CAT_PARA_CHAVE — nada é perdido.
   l.categoria continua preenchida (nome antigo para as contas “de sistema”) para tudo o que já dependia dela. */
const PC_GRUPOS = [
  // [código, nome, ambito, natureza, kind, tipo, filhos: [cod, nome, chave?, tipo?]]
  ['1.1', 'Honorários', 'esc', 'entrada', 'rec', 'variavel', [['1.1.01', 'Contratuais', 'hon_contr'], ['1.1.02', 'Êxito', 'hon_exito'], ['1.1.03', 'Sucumbência', 'hon_sucumb'], ['1.1.04', 'Consultas e pareceres', 'consulta'],
    ['1.1.05', 'Serviços extrajudiciais (contratos, inventário, divórcio…)'], ['1.1.06', 'Assessoria mensal / partido'], ['1.1.07', 'Advocacia de apoio / correspondente'], ['1.1.08', 'Dativos / convênio Defensoria-OAB', 'convenio']]],
  ['1.2', 'Outras receitas', 'esc', 'entrada', 'rec', 'eventual', [['1.2.01', 'Rendimentos e juros recebidos'], ['1.2.02', 'Descontos obtidos'], ['1.2.03', 'Venda de bens'], ['1.2.04', 'Outras receitas', 'outras_rec']]],
  ['2.1', 'Estrutura', 'esc', 'saida', 'desp', 'fixa', [['2.1.01', 'Aluguel e condomínio'], ['2.1.02', 'Energia elétrica'], ['2.1.03', 'Água'], ['2.1.04', 'Internet e telefone'], ['2.1.05', 'Sistemas e assinaturas'],
    ['2.1.06', 'Contabilidade'], ['2.1.07', 'Anuidade OAB'], ['2.1.08', 'Certificado digital'], ['2.1.09', 'Material de escritório e limpeza'], ['2.1.10', 'Manutenção'], ['2.1.99', 'Outras despesas do escritório', 'desp_escr']]],
  ['2.2', 'Processuais (do escritório)', 'esc', 'saida', 'desp', 'variavel', [['2.2.01', 'Custas e taxas não reembolsáveis'], ['2.2.02', 'Diligências e deslocamento'], ['2.2.03', 'Cópias e certidões'], ['2.2.04', 'Correios'],
    ['2.2.05', 'Cálculos e perícias contratados'], ['2.2.06', 'Correspondentes']]],
  ['2.3', 'Comissões e parcerias', 'esc', 'saida', 'desp', 'variavel', [['2.3.01', 'Captador / indicação', 'captador'], ['2.3.02', 'Advogado parceiro', 'parceiro']]],
  ['2.4', 'Marketing', 'esc', 'saida', 'desp', 'variavel', [['2.4.01', 'Anúncios'], ['2.4.02', 'Site e redes sociais'], ['2.4.03', 'Brindes e eventos']]],
  ['2.5', 'Bancárias', 'esc', 'saida', 'desp', 'variavel', [['2.5.01', 'Tarifas de conta'], ['2.5.02', 'PIX / TED'], ['2.5.03', 'Boletos'], ['2.5.04', 'IOF'], ['2.5.05', 'Juros e multas pagos', 'juros_pagos']]],
  ['2.6', 'Impostos', 'esc', 'saida', 'desp', 'variavel', [['2.6.01', 'ISS'], ['2.6.02', 'Simples Nacional (DAS)'], ['2.6.03', 'IRPJ / CSLL / PIS / Cofins'], ['2.6.04', 'INSS / carnê-leão'], ['2.6.99', 'Outros impostos', 'imposto']]],
  ['2.7', 'Capacitação', 'esc', 'saida', 'desp', 'eventual', [['2.7.01', 'Cursos'], ['2.7.02', 'Livros e publicações'], ['2.7.03', 'Eventos']]],
  ['2.8', 'Investimentos', 'esc', 'saida', 'naoop', 'eventual', [['2.8.01', 'Equipamentos e informática'], ['2.8.02', 'Móveis'], ['2.8.03', 'Software'], ['2.8.04', 'Reformas']]],
  ['2.9', 'Empréstimos', 'esc', 'saida', 'naoop', 'fixa', [['2.9.01', 'Parcelas de empréstimo'], ['2.9.02', 'Juros de empréstimo']]],
  ['2.10', 'Outras despesas', 'esc', 'saida', 'desp', 'eventual', [['2.10.01', 'Outras despesas', 'outras_desp']]],
  ['3.1', 'Valores de clientes', 'esc', '', 'terc', 'variavel', [['3.1.01', 'Recebidos para o cliente (alvarás, acordos)', 'cli_receb', 'entrada'], ['3.1.02', 'Repasses a clientes', 'cli_repasse', 'saida']]],
  ['3.2', 'Despesas por conta do cliente', 'esc', '', 'reemb', 'variavel', [['3.2.01', 'Despesas adiantadas pelo escritório (a reembolsar)', 'custas_adiant', 'saida'], ['3.2.02', 'Reembolsos recebidos do cliente', 'reemb_receb', 'entrada']]],
  ['4.1', 'Retiradas do titular', 'esc', 'saida', 'ret', 'fixa', [['4.1.01', 'Pró-labore', 'prolabore'], ['4.1.02', 'Distribuição de lucros', 'lucros']]],
  ['5.1', 'Receitas pessoais', 'pes', 'entrada', 'rec', 'variavel', [['5.1.01', 'Retiradas do escritório', 'pes_retirada'], ['5.1.02', 'Outros rendimentos'], ['5.1.03', 'Aluguéis recebidos'], ['5.1.04', 'Rendimentos de investimentos'],
    ['5.1.05', 'Restituição de imposto de renda'], ['5.1.99', 'Outras receitas pessoais']]],
  ['6.1', 'Moradia', 'pes', 'saida', 'desp', 'fixa', [['6.1.01', 'Aluguel / financiamento'], ['6.1.02', 'Condomínio'], ['6.1.03', 'Energia elétrica'], ['6.1.04', 'Água e gás'], ['6.1.05', 'Internet, TV e telefone']]],
  ['6.2', 'Alimentação', 'pes', 'saida', 'desp', 'variavel', [['6.2.01', 'Mercado'], ['6.2.02', 'Restaurantes e delivery']]],
  ['6.3', 'Transporte', 'pes', 'saida', 'desp', 'variavel', [['6.3.01', 'Combustível'], ['6.3.02', 'IPVA e licenciamento'], ['6.3.03', 'Seguro do veículo'], ['6.3.04', 'Manutenção do veículo'], ['6.3.05', 'Aplicativos e estacionamento']]],
  ['6.4', 'Saúde', 'pes', 'saida', 'desp', 'fixa', [['6.4.01', 'Plano de saúde'], ['6.4.02', 'Consultas e exames'], ['6.4.03', 'Farmácia']]],
  ['6.5', 'Educação', 'pes', 'saida', 'desp', 'fixa', [['6.5.01', 'Mensalidades e cursos'], ['6.5.02', 'Material escolar e livros']]],
  ['6.6', 'Lazer e viagens', 'pes', 'saida', 'desp', 'eventual', [['6.6.01', 'Lazer'], ['6.6.02', 'Viagens']]],
  ['6.7', 'Vestuário e cuidados pessoais', 'pes', 'saida', 'desp', 'variavel', [['6.7.01', 'Vestuário'], ['6.7.02', 'Cuidados pessoais']]],
  ['6.8', 'Assinaturas', 'pes', 'saida', 'desp', 'fixa', [['6.8.01', 'Streaming e aplicativos']]],
  ['6.9', 'Impostos pessoais', 'pes', 'saida', 'desp', 'eventual', [['6.9.01', 'Imposto de renda (IRPF)'], ['6.9.02', 'IPTU']]],
  ['6.10', 'Seguros', 'pes', 'saida', 'desp', 'fixa', [['6.10.01', 'Seguros (vida, residência)']]],
  ['6.11', 'Investimentos e previdência', 'pes', 'saida', 'naoop', 'fixa', [['6.11.01', 'Aplicações'], ['6.11.02', 'Previdência privada']]],
  ['6.12', 'Dívidas e empréstimos', 'pes', 'saida', 'naoop', 'fixa', [['6.12.01', 'Parcelas e juros']]],
  ['6.13', 'Doações', 'pes', 'saida', 'desp', 'eventual', [['6.13.01', 'Doações']]],
  ['6.99', 'Outras despesas pessoais', 'pes', 'saida', 'desp', 'eventual', [['6.99.01', 'Outras despesas pessoais', 'pes_outras']]],
];
const PC_RAIZES = [['1', 'Receitas', 'esc'], ['2', 'Despesas', 'esc'], ['3', 'Valores de terceiros (fora do resultado)', 'esc'], ['4', 'Retiradas do titular', 'esc'], ['5', 'Receitas pessoais', 'pes'], ['6', 'Despesas pessoais', 'pes']];
const pcId = cod => 'pc' + cod.replace(/\./g, '_');
const PLANO_PADRAO = (() => { const out = [];
  PC_RAIZES.forEach(([cod, nome, ambito]) => out.push({id:pcId(cod), cod, nome, pai:'', ambito, grupo:true, ativo:true}));
  PC_GRUPOS.forEach(([cod, nome, ambito, nat, kind, tipo, fs]) => { out.push({id:pcId(cod), cod, nome, pai:pcId(cod.split('.')[0]), ambito, nat, kind, tipo, grupo:true, ativo:true});
    fs.forEach(([c, n, chave, nat2]) => out.push({id:pcId(c), cod:c, nome:n, pai:pcId(cod), ambito, nat:nat2 || nat, kind, tipo, ativo:true, ...(chave ? {chave} : {})})); });
  return out; })();
// categorias antigas → contas
const CAT_PARA_CHAVE = {'Honorários contratuais':'hon_contr', 'Honorários de êxito':'hon_exito', 'Honorários sucumbenciais':'hon_sucumb', 'Consulta / parecer':'consulta', 'Valor do cliente (a repassar)':'cli_receb',
  'Reembolso de despesas':'reemb_receb', 'Outras receitas':'outras_rec', 'Custas / despesas do processo':'custas_adiant', 'Despesa do escritório':'desp_escr', 'Impostos':'imposto', 'Repasse ao cliente':'cli_repasse', 'Outras despesas':'outras_desp'};
const CHAVE_PARA_CAT = Object.fromEntries(Object.entries(CAT_PARA_CHAVE).map(([c, k]) => [k, c]));

const planoContas = () => Array.isArray(db.meta.planoContas) ? db.meta.planoContas : PLANO_PADRAO;
const pcMapa = () => memo('pc:mapa', () => new Map(planoContas().map(c => [c.id, c])));
const pcById = id => id ? pcMapa().get(id) : undefined;
const pcPorChave = ch => memo('pc:chave', () => new Map(planoContas().filter(c => c.chave).map(c => [c.chave, c]))).get(ch);
const pcFolhas = () => memo('pc:folhas', () => planoContas().filter(c => !c.grupo));
// a conta de um lançamento (novo: l.conta; antigo: pela categoria)
function contaDe(l){ if(!l) return undefined; const c = l.conta && pcById(l.conta); if(c) return c;
  const cache = memo('pc:porCat', () => new Map()), k = (l.natureza || '') + '|' + (l.categoria || '');   // mesma categoria → mesma conta (índice refeito a cada gravação)
  if(cache.has(k)) return cache.get(k);
  const ch = CAT_PARA_CHAVE[l.categoria], r = (ch && pcPorChave(ch)) || pcFolhas().find(x => x.nome === l.categoria) || pcPorChave(l.natureza === 'saida' ? 'outras_desp' : 'outras_rec');
  cache.set(k, r); return r; }
// categoria “de compatibilidade” gravada junto (o que já dependia de l.categoria continua funcionando)
const catDaConta = c => c ? (CHAVE_PARA_CAT[c.chave] || c.nome) : '';
// tipo da categoria antiga (rec/terc/reemb/desp), agora lido do plano
function planoKindCat(cat){ const ch = CAT_PARA_CHAVE[cat], c = ch ? pcPorChave(ch) : pcFolhas().find(x => x.nome === cat); return !c ? '' : c.kind === 'terc' ? 'terc' : c.kind; }
const pcCaminho = c => { const out = []; let x = c; while(x){ out.unshift(x.nome); x = pcById(x.pai); } return out.slice(1).join(' › '); };
const pcRotulo = c => c ? `${c.cod} · ${c.nome}` : '—';
const AMBITOS = {esc:'🏢 Escritório', pes:'🏠 Pessoal'};
// <select> de contas agrupado por grupo, filtrado por natureza e âmbito
function contaOptsHtml(nat, ambito, val){
  const fs = planoContas(), grupos = fs.filter(c => c.grupo && c.pai && (!ambito || c.ambito === ambito));
  return grupos.map(g => { const fl = fs.filter(c => c.pai === g.id && !c.grupo && (c.ativo !== false || c.id === val) && (!nat || c.nat === nat));
    return fl.length ? `<optgroup label="${esc(g.cod + ' ' + g.nome)}">${fl.map(c => `<option value="${c.id}" ${c.id === val ? 'selected' : ''}>${esc(c.cod + ' · ' + c.nome)}${c.ativo === false ? ' (desativada)' : ''}</option>`).join('')}</optgroup>` : ''; }).join(''); }
// filtro: grupo inteiro ou conta
function contaFiltroOpts(val, ambito){ const fs = planoContas();
  return fs.filter(c => c.grupo && c.pai && (!ambito || ambito === 'tudo' || c.ambito === ambito)).map(g => `<optgroup label="${esc(g.cod + ' ' + g.nome)}"><option value="${g.id}" ${val === g.id ? 'selected' : ''}>${esc(g.cod + ' ' + g.nome)} — todas</option>${fs.filter(c => c.pai === g.id && !c.grupo).map(c => `<option value="${c.id}" ${val === c.id ? 'selected' : ''}>${esc(c.cod + ' · ' + c.nome)}</option>`).join('')}</optgroup>`).join(''); }
const contaPadrao = (nat, ambito = 'esc') => (ambito === 'pes' ? pcPorChave(nat === 'saida' ? 'pes_outras' : 'pes_retirada') : pcPorChave(nat === 'saida' ? 'desp_escr' : 'hon_contr'))?.id || '';
function pcGarantirEditavel(){ if(!Array.isArray(db.meta.planoContas)) db.meta.planoContas = JSON.parse(JSON.stringify(PLANO_PADRAO)); return db.meta.planoContas; }
const pcUso = id => db.financeiro.filter(l => contaDe(l)?.id === id).length;

/* ----- contas bancárias e caixa ----- */
const CB_PADRAO = [{id:'cb_caixa', nome:'Caixa (dinheiro)', tipo:'caixa', ambito:'esc', saldoInicial:0, dataSaldo:'', ativo:true}];
const contasBanc = () => Array.isArray(db.meta.contasBanc) ? db.meta.contasBanc : CB_PADRAO;
const cbById = id => contasBanc().find(c => c.id === id);
const CB_TIPOS = {banco:'🏦 Conta bancária', caixa:'💵 Caixa / dinheiro', digital:'📱 Conta digital / carteira', aplicacao:'📈 Aplicação'};
const cbOpts = (ambito, val) => contasBanc().filter(c => (c.ativo !== false || c.id === val) && (!ambito || c.ambito === ambito || c.id === val)).map(c => ({v:c.id, t:`${CB_TIPOS[c.tipo]?.slice(0, 2) || ''} ${c.nome}`}));
const cbUltima = amb => { try{ const v = localStorage.getItem('escritorio_cb_ult_' + amb); if(v && cbById(v)) return v; }catch(e){} return contasBanc().find(c => c.ambito === amb && c.ativo !== false)?.id || ''; };
const cbUso = id => db.financeiro.filter(l => l.contaBanc === id || (l.pagamentos || []).some(p => p.contaBanc === id)).length;

/* ----- planos de recebimento / pagamento ----- */
const PR_PADRAO = [
  {id:'pr_vista', nome:'À vista', n:1, iniQ:0, iniU:'d', entQ:0, entU:'d'},
  {id:'pr_e3060', nome:'Entrada + 30/60', n:3, iniQ:0, iniU:'d', entQ:30, entU:'d'},
  {id:'pr_306090', nome:'30/60/90 (sem entrada)', n:3, iniQ:30, iniU:'d', entQ:30, entU:'d'},
  {id:'pr_10x', nome:'10x mensais', n:10, iniQ:0, iniU:'d', entQ:1, entU:'m'},
  {id:'pr_mensal12', nome:'12x mensais', n:12, iniQ:0, iniU:'d', entQ:1, entU:'m'},
  {id:'pr_final', nome:'Ao final do processo (sem data)', n:1, aoFinal:true},
];
const planosReceb = () => Array.isArray(db.meta.planosReceb) ? db.meta.planosReceb : PR_PADRAO;
const prById = id => planosReceb().find(p => p.id === id);
const somaPrazo = (d, q, u) => u === 'm' ? addMonths(d, q) : addDays(d, q);
// datas de vencimento de um plano a partir da data-base
const prDatas = (p, base) => p.aoFinal ? [''] : Array.from({length:Math.max(1, p.n || 1)}, (_, i) => { let d = somaPrazo(base, Number(p.iniQ) || 0, p.iniU); for(let k = 0; k < i; k++) d = somaPrazo(d, Number(p.entQ) || 0, p.entU); return d; });
const prResumo = p => p.aoFinal ? 'sem data — vence ao final do processo' : `${p.n}x${p.n > 1 ? ` · a cada ${p.entQ} ${p.entU === 'm' ? 'mês(es)' : 'dia(s)'}` : ''} · 1ª ${Number(p.iniQ) ? `em ${p.iniQ} ${p.iniU === 'm' ? 'mês(es)' : 'dia(s)'}` : 'na data-base'}`;

/* ----- Cadastros (aba do Financeiro) ----- */
let pcAberto = {};
const pcAmbAtual = () => typeof FIN_AMB !== 'undefined' && FIN_AMB === 'pes' ? 'pes' : 'esc';
function finCadastrosHtml(){
  const fs = planoContas(), filhos = id => fs.filter(c => c.pai === id).sort((a, b) => a.cod.localeCompare(b.cod, 'pt-BR', {numeric:true}));
  const KT = {rec:'', desp:'', terc:'<span class="tag warn">fora do resultado</span>', reemb:'<span class="tag warn">fora do resultado</span>', ret:'<span class="tag grey">abaixo do resultado</span>', naoop:'<span class="tag grey">não operacional</span>'};
  const TT = {fixa:'fixa', variavel:'variável', eventual:'eventual'};
  const linha = (c, n) => { const kids = filhos(c.id), ab = pcAberto[c.id] ?? n < 1, uso = c.grupo ? 0 : pcUso(c.id);
    return `<div class="pcL ${c.grupo ? 'gr' : ''} ${c.ativo === false ? 'off' : ''}" style="--n:${n}">${c.grupo ? `<button type="button" class="pcT" data-act="pcToggle" data-id="${c.id}">${ab ? '▾' : '▸'}</button>` : '<span class="pcT"></span>'}<code>${esc(c.cod)}</code>
      <span class="grow">${esc(c.nome)} ${c.grupo && c.kind ? KT[c.kind] || '' : ''}${c.grupo && c.tipo && c.kind !== 'terc' && c.kind !== 'reemb' ? ` <span class="tag grey">${TT[c.tipo]}</span>` : ''}${c.ativo === false ? ' <span class="tag grey">desativada</span>' : ''}${uso ? ` <span class="small muted">${uso} lanç.</span>` : ''}</span>
      <span class="pcAc">${c.grupo && c.pai ? `<button class="mini" data-act="pcNova" data-pai="${c.id}" title="Nova conta neste grupo">＋</button>` : ''}${!c.pai ? `<button class="mini" data-act="pcNova" data-pai="${c.id}" data-grupo="1" title="Novo grupo">＋ grupo</button>` : ''}<button class="mini" data-act="pcEditar" data-id="${c.id}" title="Editar">✎</button></span></div>${c.grupo && ab ? kids.map(k => linha(k, n + 1)).join('') : ''}`; };
  const pcAmb = pcAmbAtual(), raizes = fs.filter(c => !c.pai && c.ambito === pcAmb);
  return `<div class="finCad">
    <div class="card"><h2>📒 Plano de contas — ${AMBITOS[pcAmb]}</h2>
      <p class="small muted" style="margin:-4px 0 8px">Edite, renomeie e crie contas e grupos à vontade. Contas já usadas em lançamentos não são excluídas — ficam <b>desativadas</b> (somem das listas, o histórico continua).</p>
      <div class="pcArv">${raizes.map(r => linha(r, 0)).join('')}</div>
      <div class="toolbar" style="margin-top:8px"><button class="btn" data-act="pcRestaurar">Restaurar contas que faltam do padrão</button></div></div>
    <div><div class="card"><h2>🏦 Contas bancárias e caixa<span class="sp"></span><button class="btn primary" data-act="cbNova">+ Conta</button></h2>
      ${contasBanc().map(c => `<div class="li ${c.ativo === false ? 'muted' : ''}"><div class="grow"><b>${CB_TIPOS[c.tipo]?.slice(0, 2) || ''} ${esc(c.nome)}</b> <span class="tag grey">${AMBITOS[c.ambito || 'esc']}</span>${c.ativo === false ? ' <span class="tag grey">desativada</span>' : ''}
        <div class="sub">${[c.banco, c.agencia && 'ag. ' + c.agencia, c.numero && 'c/c ' + c.numero].filter(Boolean).map(esc).join(' · ')}${c.dataSaldo ? `${c.banco || c.agencia ? ' · ' : ''}saldo em ${fmtD(c.dataSaldo)}: ${money(c.saldoInicial || 0)}` : ''}</div></div><button class="mini" data-act="cbEditar" data-id="${c.id}">editar</button></div>`).join('')}</div>
    <div class="card"><h2>📅 Planos de recebimento / pagamento<span class="sp"></span><button class="btn" data-act="prNovo">+ Plano</button></h2>
      ${planosReceb().map(p => `<div class="li"><div class="grow"><b>${esc(p.nome)}</b><div class="sub">${esc(prResumo(p))}</div></div><button class="mini" data-act="prEditar" data-id="${p.id}">editar</button></div>`).join('')}</div>
    <div class="card"><h2>Outras listas</h2><div class="li"><div class="grow"><b>💳 Formas de pagamento</b><div class="sub">${esc(OPT.forma.join(' · '))}</div></div><a class="btn" href="#/listas/forma">editar</a></div>
      <div class="li"><div class="grow"><b>📄 Tipos de documento</b><div class="sub">${esc(OPT.tipoDoc.join(' · '))}</div></div><a class="btn" href="#/listas/tipoDoc">editar</a></div></div>
    ${[['Centros de custo', 'Separar por unidade, sócio ou área de atuação.'], ['Cartões de crédito', 'Compras no cartão entram na fatura do mês, com fechamento e vencimento.'], ['Importar extrato do banco', 'Arquivo OFX/CSV do banco, conferido sozinho com os lançamentos.'], ['Cheques e boletos', 'Controle de cheques e emissão de boletos (exige integração bancária).']]
      .map(([t, s]) => `<div class="card breve"><h2>${t} <span class="tag warn">🔜 em breve</span></h2><div class="small muted">${s}</div></div>`).join('')}</div></div>`;
}
function formConta(c0, pai0, grupo){
  const novo = !c0, pai = pcById(c0?.pai || pai0), c = c0 || {id:uid(), pai:pai?.id || '', ambito:pai?.ambito || pcAmbAtual(), nat:pai?.nat || '', kind:pai?.kind || '', tipo:pai?.tipo || 'variavel', grupo:!!grupo, ativo:true,
    cod:(() => { const irm = planoContas().filter(x => x.pai === pai?.id).map(x => x.cod.split('.').pop()); const n = Math.max(0, ...irm.map(Number).filter(x => x < 99)) + 1; return `${pai?.cod}.${grupo ? n : String(n).padStart(2, '0')}`; })(), nome:''};
  const uso = c.grupo ? 0 : pcUso(c.id), sis = !!c.chave;
  openForm({title:novo ? (c.grupo ? 'Novo grupo de contas' : 'Nova conta') : `Editar ${c.grupo ? 'grupo' : 'conta'}`, data:{cod:c.cod, nome:c.nome, nat:c.nat || '', kind:c.kind || '', tipo:c.tipo || 'variavel', ativo:c.ativo !== false},
    fields:[{type:'html', html:pai ? `<div class="small muted">Em: <b>${esc(pai.cod + ' ' + pai.nome)}</b> · ${AMBITOS[c.ambito]}</div>` : ''},
      {k:'cod', label:'Código', req:true}, {k:'nome', label:'Nome', req:true, full:true},
      ...(c.pai ? [{k:'nat', label:'Movimento', type:'select', empty:false, options:[{v:'entrada', t:'⬆ Entrada (a receber)'}, {v:'saida', t:'⬇ Saída (a pagar)'}, ...(c.grupo ? [{v:'', t:'as duas (definido em cada conta)'}] : [])]},
        {k:'kind', label:'No demonstrativo de resultado', type:'select', empty:false, options:[{v:'rec', t:'Receita'}, {v:'desp', t:'Despesa'}, {v:'terc', t:'Dinheiro de cliente (fora do resultado)'}, {v:'reemb', t:'Despesa adiantada / reembolso (fora do resultado)'}, {v:'ret', t:'Retirada do titular (abaixo do resultado)'}, {v:'naoop', t:'Investimento / empréstimo (não operacional)'}]},
        {k:'tipo', label:'Tipo', type:'select', empty:false, options:[{v:'fixa', t:'Fixa (todo mês)'}, {v:'variavel', t:'Variável'}, {v:'eventual', t:'Eventual'}]}] : []),
      {k:'ativo', label:'Ativa (aparece nas listas)', type:'check'},
      {type:'html', html:`${sis ? '<div class="small muted">🔒 Conta usada pelo sistema (honorários, repasses, reembolsos…): pode renomear, mas não excluir.</div>' : ''}${uso ? `<div class="small muted">Usada em ${uso} lançamento(s).</div>` : ''}`}],
    onDelete:!novo && !sis && !planoContas().some(x => x.pai === c.id) ? () => { if(uso || cbUsoPc(c.id)) { alert('Esta conta já foi usada — desative em vez de excluir.'); return false; }
      if(!confirm(`Excluir “${c.nome}”?`)) return false; db.meta.planoContas = pcGarantirEditavel().filter(x => x.id !== c.id); save(); render(); } : null,
    onSave:o => { const L = pcGarantirEditavel(); if(L.some(x => x.cod === o.cod.trim() && x.id !== c.id)){ toast('Já existe uma conta com esse código'); return false; }
      const r = {...c, cod:o.cod.trim(), nome:o.nome.trim(), ativo:!!o.ativo, ...(c.pai ? {nat:o.nat, kind:o.kind, tipo:o.tipo} : {})};
      const i = L.findIndex(x => x.id === c.id); if(i >= 0) L[i] = r; else L.push(r);
      if(c.grupo && c.pai && !novo) L.filter(x => x.pai === c.id).forEach(x => { if(!x.chave){ x.kind = r.kind; x.tipo = r.tipo; if(r.nat) x.nat = r.nat; } });   // ajustes do grupo valem para as contas dele
      if(novo && pai) pcAberto[pai.id] = true; save(); render(); toast('Plano de contas salvo'); }});
}
const cbUsoPc = id => wfs().some(w => (w.passos || []).some(p => p.conta === id));
function formContaBanc(c0){
  const novo = !c0, c = c0 || {id:uid(), tipo:'banco', ambito:'esc', ativo:true, saldoInicial:0, dataSaldo:today()}, uso = novo ? 0 : cbUso(c.id);
  openForm({title:novo ? 'Nova conta bancária / caixa' : 'Editar conta', data:{...c, ativo:c.ativo !== false},
    fields:[{k:'nome', label:'Nome (como aparece no sistema)', req:true, ph:'ex.: Banco Inter PJ'}, {k:'tipo', label:'Tipo', type:'select', empty:false, options:Object.entries(CB_TIPOS).map(([v, t]) => ({v, t}))},
      {k:'ambito', label:'É do', type:'select', empty:false, options:Object.entries(AMBITOS).map(([v, t]) => ({v, t}))},
      {k:'banco', label:'Banco (opcional)'}, {k:'agencia', label:'Agência (opcional)'}, {k:'numero', label:'Conta (opcional)'},
      {k:'saldoInicial', label:'Saldo na data abaixo (R$)', type:'number'}, {k:'dataSaldo', label:'Data do saldo', type:'date'},
      {k:'ativo', label:'Ativa', type:'check'},
      {type:'html', html:'<div class="small muted">O saldo é calculado a partir desta data, somando o que foi recebido e pago nesta conta. Agência e conta ficam só neste sistema (nunca são enviadas a serviços externos).</div>'}],
    onDelete:!novo ? () => { if(uso){ alert(`Esta conta tem ${uso} movimentação(ões) — desative em vez de excluir.`); return false; } if(!confirm('Excluir esta conta?')) return false;
      db.meta.contasBanc = contasBanc().filter(x => x.id !== c.id); save(); render(); } : null,
    onSave:o => { const L = Array.isArray(db.meta.contasBanc) ? db.meta.contasBanc : (db.meta.contasBanc = JSON.parse(JSON.stringify(CB_PADRAO)));
      const r = {...c, ...o, saldoInicial:Number(o.saldoInicial) || 0, ativo:!!o.ativo}; const i = L.findIndex(x => x.id === c.id); if(i >= 0) L[i] = r; else L.push(r); save(); render(); toast('Conta salva'); }});
}
function formPlanoReceb(p0){
  const novo = !p0, p = p0 || {id:uid(), nome:'', n:1, iniQ:0, iniU:'d', entQ:30, entU:'d'};
  openForm({title:novo ? 'Novo plano de recebimento / pagamento' : 'Editar plano', data:{...p, aoFinal:!!p.aoFinal},
    fields:[{k:'nome', label:'Nome', req:true, full:true, ph:'ex.: Entrada + 5x mensais'}, {k:'aoFinal', label:'Sem data — vence ao final do processo (convênio, êxito…)', type:'check', full:true},
      {k:'n', label:'Nº de parcelas', type:'number'}, {k:'iniQ', label:'1ª parcela depois de', type:'number'}, {k:'iniU', label:'', type:'select', empty:false, options:[{v:'d', t:'dia(s)'}, {v:'m', t:'mês(es)'}]},
      {k:'entQ', label:'Intervalo entre parcelas', type:'number'}, {k:'entU', label:'', type:'select', empty:false, options:[{v:'d', t:'dia(s)'}, {v:'m', t:'mês(es)'}]},
      {type:'html', html:'<div class="small muted" id="prPrev"></div>'}],
    after:f => { const pv = () => { const x = {aoFinal:f.elements.aoFinal.checked, n:+f.elements.n.value || 1, iniQ:+f.elements.iniQ.value || 0, iniU:f.elements.iniU.value, entQ:+f.elements.entQ.value || 0, entU:f.elements.entU.value};
        f.querySelector('#prPrev').innerHTML = x.aoFinal ? 'Vencimento em aberto até o fim do processo.' : 'Exemplo a partir de hoje: ' + prDatas(x, today()).slice(0, 12).map(fmtD).join(' · '); };
      onForm(f, 'input', pv); onForm(f, 'change', pv); pv(); },
    onDelete:!novo ? () => { if(!confirm('Excluir este plano?')) return false; db.meta.planosReceb = planosReceb().filter(x => x.id !== p.id); save(); render(); } : null,
    onSave:o => { const L = Array.isArray(db.meta.planosReceb) ? db.meta.planosReceb : (db.meta.planosReceb = JSON.parse(JSON.stringify(PR_PADRAO)));
      const r = {...p, nome:o.nome.trim(), aoFinal:!!o.aoFinal, n:Math.max(1, Math.min(240, +o.n || 1)), iniQ:+o.iniQ || 0, iniU:o.iniU, entQ:+o.entQ || 0, entU:o.entU};
      const i = L.findIndex(x => x.id === p.id); if(i >= 0) L[i] = r; else L.push(r); save(); render(); toast('Plano salvo'); }});
}
Object.assign(A, {
  finAmb: d => { FIN_AMB = d.v; F.fin.cat = ''; render(); },
  pcToggle: d => { const c = pcById(d.id); pcAberto[d.id] = !(pcAberto[d.id] ?? !c?.pai); render(); },
  pcNova: d => formConta(null, d.pai, !!d.grupo), pcEditar: d => formConta(pcById(d.id)),
  pcRestaurar: () => { const L = pcGarantirEditavel(), falt = PLANO_PADRAO.filter(p => !L.some(x => x.id === p.id)); if(!falt.length) return toast('Nenhuma conta do padrão está faltando');
    L.push(...JSON.parse(JSON.stringify(falt))); save(); render(); toast(`${falt.length} conta(s) restaurada(s)`); },
  cbNova: () => formContaBanc(null), cbEditar: d => formContaBanc(cbById(d.id)),
  prNovo: () => formPlanoReceb(null), prEditar: d => formPlanoReceb(prById(d.id)),
});

/* ----- vínculos e verificação ----- */
VINCULOS.verificar.push(() => {
  const out = [], semConta = db.financeiro.filter(l => !pcById(l.conta) && !CAT_PARA_CHAVE[l.categoria] && !pcFolhas().some(x => x.nome === l.categoria));
  if(semConta.length) out.push({area:'💰 Financeiro', titulo:`${semConta.length} lançamento(s) sem conta do plano reconhecida`, txt:'Foram contados em “Outras receitas/despesas”. Abra e escolha a conta certa.', href:'#/financeiro'});
  const contaSumiu = db.financeiro.filter(l => l.conta && !pcById(l.conta));
  if(contaSumiu.length){ VER_CORRIGIR.finConta = () => { contaSumiu.forEach(l => { delete l.conta; }); return contaSumiu.length; };
    out.push({area:'💰 Financeiro', titulo:`${contaSumiu.length} lançamento(s) apontam para conta do plano excluída`, txt:'Corrigir usa a categoria original de cada um.', corrigir:'finConta', grave:true}); }
  const cbSumiu = db.financeiro.filter(l => l.contaBanc && !cbById(l.contaBanc));
  if(cbSumiu.length) out.push({area:'💰 Financeiro', titulo:`${cbSumiu.length} movimentação(ões) em conta bancária excluída`, txt:'O saldo dessas contas fica incompleto. Cadastre a conta de novo ou edite os lançamentos.', href:'#/financeiro/cadastros', grave:true});
  return out;
});
