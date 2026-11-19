/* ===== 📄 Relatórios — dentro de cada seção, sempre sobre o que está filtrado na tela =====
   Botão padrão relMenu('chave') → PDF (impressão) · Excel (.csv) · Word (.doc que o Word abre e edita). Cada chave tem uma fonte em REL_FONTES
   que devolve {titulo, sub, colunas:[[nome, fn(linha)]], linhas}. Para uma tela nova: registre a fonte e ponha relMenu('chave') no cabeçalho. */
const REL_FONTES = {};
function relDoc(f){
  const css = `body{font:11px/1.35 Arial,sans-serif;color:#111;margin:18px}h1{font-size:16px;margin:0 0 2px}h2{font-size:13px;margin:14px 0 4px}.sub{color:#555;margin-bottom:10px}
    table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 5px;text-align:left;vertical-align:top}th{background:#eef2f7;font-size:10.5px}tr:nth-child(even) td{background:#fafafa}td.n{text-align:right;white-space:nowrap}
    @page{size:A4 ${f.retrato ? 'portrait' : 'landscape'};margin:12mm}`;
  const tabela = (cols, ls) => `<table><thead><tr>${cols.map(c => `<th>${esc(c[0])}</th>`).join('')}</tr></thead><tbody>${ls.map(r => `<tr>${cols.map(c => { const v = c[1](r); return `<td${typeof v === 'number' || c[2] === 'n' ? ' class="n"' : ''}>${esc(typeof v === 'number' && c[2] === 'n' ? v.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : v ?? '')}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  const secoes = f.secoes || [{colunas:f.colunas, linhas:f.linhas}];
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(f.titulo)}</title><style>${css}</style></head><body><h1>${esc(f.titulo)}</h1>
    <div class="sub">${esc(f.sub || '')}${f.sub ? ' · ' : ''}emitido em ${new Date().toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})}</div>
    ${secoes.map(s => `${s.titulo ? `<h2>${esc(s.titulo)}</h2>` : ''}${s.linhas.length ? tabela(s.colunas, s.linhas) : '<p>Nada no período / filtro.</p>'}`).join('')}</body></html>`;
}
function relGerar(f, formato){
  if(!f) return; const secoes = f.secoes || [{colunas:f.colunas, linhas:f.linhas}];
  if(!secoes.some(s => s.linhas.length)) return toast('Nada para o relatório com estes filtros');
  const nome = (f.arquivo || f.titulo).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + today();
  if(formato === 'xls'){ const q = v => '"' + String(typeof v === 'number' ? String(v.toFixed(2)).replace('.', ',') : v ?? '').replace(/"/g, '""') + '"';
    const txt = secoes.map(s => [...(s.titulo && secoes.length > 1 ? [q(s.titulo)] : []), s.colunas.map(c => q(c[0])).join(';'), ...s.linhas.map(r => s.colunas.map(c => q(c[1](r))).join(';'))].join('\r\n')).join('\r\n\r\n');
    download(nome + '.csv', '﻿' + txt, 'text/csv;charset=utf-8'); return toast('📊 Planilha gerada (abre no Excel)'); }
  const html = relDoc(f);
  if(formato === 'doc'){ download(nome + '.doc', '﻿' + html.replace('<html lang="pt-BR">', '<html lang="pt-BR" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">'), 'application/msword'); return toast('📝 Arquivo do Word gerado'); }
  const fr = document.createElement('iframe'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'; document.body.appendChild(fr);
  fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
  setTimeout(() => { try{ fr.contentWindow.focus(); fr.contentWindow.print(); }catch(e){ toast('Não foi possível abrir a impressão'); } setTimeout(() => fr.remove(), 60000); }, 250);
  toast('📄 Escolha “Salvar como PDF” na janela de impressão');
}
const relMenu = (k, rot = '📄 Relatório') => `<details class="relMenu noprint"><summary class="btn">${rot} ▾</summary><div><button class="mini" data-act="rel" data-k="${k}" data-f="pdf">📄 PDF / imprimir</button><button class="mini" data-act="rel" data-k="${k}" data-f="xls">📊 Excel</button><button class="mini" data-act="rel" data-k="${k}" data-f="doc">📝 Word</button></div></details>`;
A.rel = (d, el) => { el.closest('details')?.removeAttribute('open'); const fn = REL_FONTES[d.k]; if(fn) relGerar(fn(d), d.f); };
document.addEventListener('click', e => { document.querySelectorAll('details.relMenu[open]').forEach(dt => { if(!dt.contains(e.target)) dt.removeAttribute('open'); }); });

/* ----- fontes ----- */
const rNome = id => pessoaNome(id) || '', rProc = id => { const p = byId('processos', id); return p ? procLabel(p) : ''; }, rD = d => d ? fmtD(d) : '';
REL_FONTES.agenda = () => { const l = (filtroAgenda(F.ag.vis === 'lista') || []).slice().sort((a, b) => (a.data || '9').localeCompare(b.data || '9') || (a.hora || '').localeCompare(b.hora || ''));
  return {titulo:'Agenda — compromissos e prazos', sub:`${l.length} item(ns)`, linhas:l, colunas:[['Data', p => rD(p.data)], ['Hora', p => p.diaInteiro ? 'dia todo' : p.hora || ''], ['Tipo', p => p.tipo], ['Subtipo', p => p.subtipo || ''], ['Título', p => p.titulo],
    ['Cliente', p => rNome(p.pessoaId || byId('processos', p.processoId)?.clienteId)], ['Processo / serviço', p => rProc(p.processoId)], ['Local', p => p.local || ''], ['Prazo fatal', p => rD(p.dataFatal)], ['Situação', p => p.situacao || '']]}; };
REL_FONTES.conversas = () => { const l = window._convList || [];
  return {titulo:'Atendimentos e conversas', sub:`${l.length} registro(s)`, linhas:l, colunas:[['Data / hora', c => fmtDT(c.dataHora)], ['Cliente / lead', c => rNome(c.pessoaId) || byId('leads', c.leadId)?.nome || ''], ['Processo / serviço', c => rProc(c.processoId)], ['Canal', c => c.canal || ''],
    ['Categoria', c => c.categoria || ''], ['Quem iniciou', c => c.iniciadoPor === 'escritorio' ? 'Escritório' : c.iniciadoPor ? 'Cliente' : ''], ['Assunto', c => c.assunto || ''], ['Relato', c => c.relato || ''], ['Próxima ação', c => [c.proximaAcao, rD(c.proximaData)].filter(Boolean).join(' — ')], ['Retorno feito', c => c.proximaData ? (c.retornoFeito ? 'sim' : 'não') : '']]}; };
REL_FONTES.servicos = () => { const l = window._servList || [];
  return {titulo:'Serviços', sub:`${l.length} serviço(s)`, linhas:l, colunas:[['Pasta', p => procCode(p)], ['Tipo', p => p.tipoServico || ''], ['Título', p => p.titulo || ''], ['Cliente', p => rNome(p.clienteId)], ['Status', p => p.statusServ || ''], ['Situação', p => p.situacaoServ || ''],
    ['Início', p => rD(p.dataInicio)], ['Honorários', p => Number(p.valorServico) || '', 'n'], ['Forma', p => FORMA_HON[p.formaHon] || ''], ['Devedor', p => rNome(p.devedorId)], ['Tags', p => tagsDe(p).map(t => t.nome).join(', ')]]}; };
REL_FONTES.fin = () => { const l = window._finList || [];
  return {titulo:'Financeiro — contas', sub:`${l.length} conta(s) · ${FIN_AMB === 'pes' ? 'pessoal' : FIN_AMB === 'tudo' ? 'escritório e pessoal' : 'escritório'}`, linhas:l, colunas:[['Vencimento', x => x.vencimento ? fmtD(x.vencimento) : 'ao final do processo'], ['Tipo', x => x.natureza === 'saida' ? 'A pagar' : 'A receber'],
    ['Conta do plano', x => pcRotulo(contaDe(x))], ['Pessoa', x => rNome(x.pessoaId)], ['Pasta / processo', x => rProc(x.processoId)], ['Histórico', x => x.descricao], ['Documento', x => [x.tipoDoc, x.numDoc].filter(Boolean).join(' ')],
    ['Valor', x => (x.natureza === 'saida' ? -1 : 1) * (Number(x.valor) || 0), 'n'], ['Situação', x => ({ok:'pago / recebido', vencido:'vencido', aberto:'em aberto', aguardando:'aguarda recebimento', semdata:'sem data'})[finStatus(x)] || ''],
    ['Pago / recebido em', x => rD(x.pagoEm)], ['Valor efetivo', x => x.pagoEm ? realV(x) : '', 'n'], ['Conta bancária', x => cbById(x.contaBanc)?.nome || '']]}; };
REL_FONTES.mov = () => { const c = cbById(MOV.cb); if(!c) return null; const ini = saldoConta(c.id, addDays(MOV.de, -1)); let s = ini;
  const ms = movsConta(c.id).filter(m => m.data >= MOV.de && m.data <= MOV.ate && m.data >= (c.dataSaldo || '')).map(m => ({...m, saldo:(s += m.v)}));
  return {titulo:`Extrato — ${c.nome}`, sub:`${fmtD(MOV.de)} a ${fmtD(MOV.ate)} · saldo inicial ${money(ini)} · saldo final ${money(s)}`, retrato:true, linhas:ms, colunas:[['Data', m => fmtD(m.data)], ['Histórico', m => m.hist], ['Pessoa', m => rNome(m.l?.pessoaId)], ['Conta do plano', m => m.conta ? m.conta.cod + ' ' + m.conta.nome : 'transferência'], ['Valor', m => m.v, 'n'], ['Saldo', m => m.saldo, 'n']]}; };
REL_FONTES.dre = () => { const t = today(), [de, ate] = REL.per === 'ano' ? [REL.ano + '-01-01', REL.ano + '-12-31'] : REL.per === 'livre' ? [REL.de || t.slice(0, 8) + '01', REL.ate || t] : [REL.mes + '-01', addDays(addMonths(REL.mes + '-01', 1), -1)];
  const r = finDRE({de, ate, regime:FIN_REG}), linhas = [];
  [['rec', 'Receitas'], ['desp', 'Despesas'], ['naoop', 'Investimentos e empréstimos'], ['ret', 'Retiradas do titular'], ['terc', 'Valores de terceiros (fora do resultado)'], ['reemb', 'Despesas adiantadas / reembolsos (fora do resultado)']].forEach(([k, nome]) => {
    const cs = [...r.por].filter(([id]) => pcById(id)?.kind === k); if(!cs.length) return;
    cs.sort((a, b) => pcById(a[0]).cod.localeCompare(pcById(b[0]).cod, 'pt-BR', {numeric:true})).forEach(([id, v]) => linhas.push({g:nome, c:pcRotulo(pcById(id)), v}));
    linhas.push({g:nome, c:'Total — ' + nome.toLowerCase(), v:r.kinds[k], tot:true}); });
  linhas.push({g:'', c:'RESULTADO OPERACIONAL', v:r.operacional, tot:true}, {g:'', c:'RESULTADO APÓS RETIRADAS E INVESTIMENTOS', v:r.final, tot:true});
  return {titulo:'Demonstrativo de resultado', sub:`${fmtD(de)} a ${fmtD(ate)} · regime de ${FIN_REG === 'comp' ? 'competência' : 'caixa'} · ${FIN_AMB === 'pes' ? 'pessoal' : FIN_AMB === 'tudo' ? 'escritório e pessoal' : 'escritório'}`, retrato:true,
    secoes:[{titulo:'Demonstrativo', linhas, colunas:[['Grupo', x => x.g], ['Conta', x => x.c], ['Valor', x => x.v, 'n']]}]}; };
REL_FONTES.horas = () => { const l = window._horasList || [];
  return {titulo:'Horas trabalhadas', sub:`${l.length} lançamento(s) · total ${fmtMin(sum(l.map(h => h.min || 0)))}`, linhas:l, colunas:[['Data', h => fmtD(h.data)], ['Início', h => h.ini || ''], ['Fim', h => h.fim || ''], ['Duração', h => fmtMin(h.min || 0)], ['Atividade', h => h.atividade || ''],
    ['Cliente', h => rNome(h.pessoaId || byId('processos', h.processoId)?.clienteId)], ['Processo / serviço', h => rProc(h.processoId)], ['Descrição', h => h.descricao || h.obs || ''], ['Faturável', h => tsFat(h) ? 'sim' : 'não']]}; };
REL_FONTES.honor = () => ({titulo:'Honorários contratados', sub:'processos e serviços', linhas:honContratadosLinhas(), colunas:[['Pasta', x => procCode(x.p)], ['Tipo', x => x.p.servico ? 'Serviço' : 'Processo'], ['Título', x => x.p.titulo || x.p.tipoServico || ''], ['Cliente', x => rNome(x.p.clienteId)], ['Área', x => x.p.area || ''],
  ['Status do processo / serviço', x => x.p.servico ? x.p.statusServ || '' : x.p.status || ''], ['Honorários', x => x.txt], ['Situação', x => x.sit], ['Valor apurado / lançado', x => x.valor || '', 'n'], ['Recebido', x => x.rec || '', 'n']]});
REL_FONTES.pasta = () => { const pid = MOV.cli; if(!pid) return null; const ls = db.financeiro.filter(l => (l.pessoaId === pid || byId('processos', l.processoId)?.clienteId === pid) && (!MOV.proc || l.processoId === MOV.proc) && !l.partId && !l.partDe && ambDe(l) === 'esc' && contaDe(l)?.chave !== 'hon_sucumb')
    .sort((a, b) => (a.pagoEm || a.vencimento || '9').localeCompare(b.pagoEm || b.vencimento || '9'));
  return {titulo:`Prestação de contas — ${pessoaNome(pid)}`, sub:MOV.proc ? rProc(MOV.proc) : 'todas as pastas', retrato:true, linhas:ls, colunas:[['Data', l => rD(l.pagoEm || l.vencimento)], ['Descrição', l => l.descricao], ['Tipo', l => ({terc:'valor do cliente', reemb:'despesa / reembolso', rec:'honorários'})[contaDe(l)?.kind] || ''],
    ['Entrada', l => l.natureza === 'entrada' ? (l.pagoEm ? realV(l) : Number(l.valor) || 0) : '', 'n'], ['Saída', l => l.natureza === 'saida' ? (l.pagoEm ? realV(l) : Number(l.valor) || 0) : '', 'n'], ['Situação', l => l.pagoEm ? 'realizado' : 'previsto']]}; };
REL_FONTES.andamentos = () => andPeriodoFonte();

/* ----- honorários contratados (Financeiro › Relatórios) ----- */
function honContratadosLinhas(){
  const out = [];
  db.processos.filter(p => !INATIVOS.includes(p.status) || (p.contrato?.itens || []).length).forEach(p => {
    const its = p.contrato?.itens || [];
    if(p.servico && !its.length){ out.push({p, txt:p.valorServico ? `${money(p.valorServico)} — ${FORMA_HON[p.formaHon] || ''}` : '', sit:p.valorServico ? 'informado no serviço' : 'sem honorários informados', valor:Number(p.valorServico) || 0,
      rec:sum((agrupar('fin:proc', () => db.financeiro, x => x.processoId).get(p.id) || []).filter(x => x.natureza === 'entrada' && contaDe(x)?.kind === 'rec' && x.pagoEm).map(realV))}); return; }
    if(!its.length){ if(!INATIVOS.includes(p.status)) out.push({p, txt:'', sit:'sem honorários informados'}); return; }
    its.forEach(it => { const ls = itemLanc(it), vias = (it.acordoIds || (it.acordoId ? [it.acordoId] : [])).flatMap(id => acordoLanc(id).filter(l => l.categoria === CAT_HC));
      const tot = sum([...ls, ...vias].map(l => Number(l.valor) || 0)), rec = sum([...ls, ...vias].filter(l => l.pagoEm).map(realV));
      out.push({p, it, txt:itemTxt(it), sit:it.tipo === 'fixo' ? (ls.length ? (rec >= tot - 0.004 ? 'recebido' : 'em aberto') : 'não lançado') : it.status === 'apurado' ? 'apurado' : 'aguardando resultado', valor:tot || Number(it.valorApurado) || 0, rec}); }); });
  return out.sort((a, b) => cmpPasta(byId('pessoas', a.p.clienteId)?.pasta, byId('pessoas', b.p.clienteId)?.pasta) || (a.p.servico ? 1 : 0) - (b.p.servico ? 1 : 0));
}
function honContratadosHtml(){
  const ls = honContratadosLinhas(), sem = ls.filter(x => /sem honor/.test(x.sit)).length, agu = ls.filter(x => x.sit === 'aguardando resultado').length;
  return `<div class="card"><h2>📄 Honorários contratados <span class="tag grey">${ls.length}</span>${agu ? ` <span class="tag warn">${agu} aguardando resultado</span>` : ''}${sem ? ` <span class="tag bad">${sem} sem honorários</span>` : ''}<span class="sp"></span>${relMenu('honor')}</h2>
    <div class="tablewrap"><table><thead><tr><th>Pasta</th><th>Processo / serviço</th><th>Cliente</th><th>Honorários</th><th>Situação</th><th class="right">Lançado</th><th class="right">Recebido</th></tr></thead><tbody>
    ${limitar('rel:hon', ls, x => `<tr data-href="#/processo/${x.p.id}"><td class="nowrap"><b>${esc(procCode(x.p).replace(/^P0*/, ''))}</b></td><td>${x.p.servico ? '🧰 ' : ''}${esc(x.p.titulo || x.p.tipoServico || '')}<div class="small muted">${esc(x.p.area || '')}</div></td><td>${esc(rNome(x.p.clienteId))}</td>
      <td class="small">${esc(x.txt) || '<span class="muted">—</span>'}</td><td><span class="tag ${/sem honor/.test(x.sit) ? 'bad' : x.sit === 'aguardando resultado' || x.sit === 'em aberto' || x.sit === 'não lançado' ? 'warn' : 'ok'}">${esc(x.sit)}</span></td>
      <td class="right nowrap">${x.valor ? money(x.valor) : ''}</td><td class="right nowrap">${x.rec ? money(x.rec) : ''}</td></tr>`, 100)}</tbody></table></div></div>`;
}

/* ----- andamentos do período (Processos) ----- */
const AND_P = {de:'', ate:'', area:'', status:'ativos', tipo:''};
function andPeriodoFonte(){
  const t = today(), de = AND_P.de || addDays(t, -30), ate = AND_P.ate || t;
  const ls = db.andamentos.filter(a => a.data >= de && a.data <= ate && (!AND_P.tipo || a.tipo === AND_P.tipo)).map(a => ({a, p:byId('processos', a.processoId)}))
    .filter(x => x.p && !x.p.servico && (!AND_P.area || x.p.area === AND_P.area) && (AND_P.status === 'todos' || (AND_P.status === 'ativos' ? !INATIVOS.includes(x.p.status) : x.p.status === AND_P.status)))
    .sort((x, y) => cmpPasta(byId('pessoas', x.p.clienteId)?.pasta, byId('pessoas', y.p.clienteId)?.pasta) || (parseInt(x.p.seq, 10) || 0) - (parseInt(y.p.seq, 10) || 0) || x.a.data.localeCompare(y.a.data));
  return {titulo:'Andamentos do período', sub:`${fmtD(de)} a ${fmtD(ate)} · ${ls.length} andamento(s) em ${new Set(ls.map(x => x.p.id)).size} processo(s)${AND_P.area ? ' · ' + AND_P.area : ''}${AND_P.tipo ? ' · ' + AND_P.tipo : ''}`, linhas:ls,
    colunas:[['Pasta', x => procCode(x.p)], ['Número', x => x.p.numero || ''], ['Ação', x => x.p.titulo || ''], ['Cliente', x => rNome(x.p.clienteId)], ['Data', x => fmtD(x.a.data)], ['Tipo', x => x.a.tipo || ''], ['Andamento', x => x.a.descricao || ''], ['Fase', x => x.p.fase || ''], ['Status', x => x.p.status || '']]};
}
function formAndPeriodo(){
  const t = today(); if(!AND_P.de){ AND_P.de = addDays(t, -30); AND_P.ate = t; }
  openForm({title:'📄 Andamentos do período', soFechar:true, data:{...AND_P}, fields:[{k:'de', label:'De', type:'date'}, {k:'ate', label:'Até', type:'date'}, {k:'area', label:'Área', type:'select', options:() => OPT.area, emptyLabel:'Todas'},
    {k:'status', label:'Processos', type:'select', empty:false, options:[{v:'ativos', t:'Só os ativos'}, {v:'todos', t:'Todos'}, ...OPT.statusProc.map(v => ({v, t:v}))]}, {k:'tipo', label:'Tipo de andamento', type:'select', options:() => OPT.tipoAnd, emptyLabel:'Todos'},
    {type:'html', html:'<div id="apPrev" class="small muted"></div><div class="toolbar" style="margin-top:8px"><button type="button" class="btn primary" data-apf="pdf">📄 PDF / imprimir</button><button type="button" class="btn" data-apf="xls">📊 Excel</button><button type="button" class="btn" data-apf="doc">📝 Word</button></div>'}],
    after:f => { const ler = () => ['de', 'ate', 'area', 'status', 'tipo'].forEach(k => { AND_P[k] = f.elements[k].value; }), upd = () => { ler(); f.querySelector('#apPrev').textContent = andPeriodoFonte().sub; };
      onForm(f, 'change', upd); onForm(f, 'input', upd); upd(); f.querySelectorAll('[data-apf]').forEach(b => b.onclick = () => { ler(); relGerar(andPeriodoFonte(), b.dataset.apf); }); }});
}
A.andPeriodo = () => formAndPeriodo();
