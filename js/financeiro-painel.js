/* ===== 💰 Financeiro — Painel (saldos e resultado), Repasses, Movimentações (extrato por conta, transferências, extrato por pasta) e Relatórios =====
   Transferências entre contas: db.transf = [{id, data, origem, destino, valor, historico}] (não entram em receitas/despesas).
   Retirada para o pessoal: duas contas pagas ligadas (l.parRetirada): saída no escritório (4 Retiradas) + entrada no pessoal (5.1.01).
   Demonstrativo: regime de CAIXA (pela data em que entrou/saiu, valor efetivo) ou de COMPETÊNCIA (pelo mês de competência — ou do vencimento —, valor previsto). */
const fAmbOk = l => FIN_AMB === 'tudo' || ambDe(l) === FIN_AMB;
const cbAmbOk = c => FIN_AMB === 'tudo' || (c.ambito || 'esc') === FIN_AMB;
const transfs = () => db.transf || [];
// movimentos de uma conta bancária (recebimentos/pagamentos com essa conta + transferências)
function movsConta(cb){
  const out = [];
  db.financeiro.forEach(l => { if(l.pagoEm && l.contaBanc === cb) out.push({data:l.pagoEm, hist:l.descricao, conta:contaDe(l), v:(l.natureza === 'entrada' ? 1 : -1) * realV(l), l}); });
  transfs().forEach(t => { if(t.origem === cb) out.push({data:t.data, hist:`⇄ Para ${cbById(t.destino)?.nome || '?'}${t.historico ? ' — ' + t.historico : ''}`, v:-t.valor, t});
    if(t.destino === cb) out.push({data:t.data, hist:`⇄ De ${cbById(t.origem)?.nome || '?'}${t.historico ? ' — ' + t.historico : ''}`, v:+t.valor, t}); });
  return out.sort((a, b) => a.data.localeCompare(b.data) || b.v - a.v);
}
const saldoConta = (cb, ate = '9999-12-31') => { const c = cbById(cb); if(!c) return 0; const ini = c.dataSaldo || '';
  return (Number(c.saldoInicial) || 0) + sum(movsConta(cb).filter(m => m.data >= ini && m.data <= ate).map(m => m.v)); };

/* ----- demonstrativo de resultado ----- */
function finDRE({de, ate, regime}){
  const por = new Map(), add = (c, v) => { if(!c) return; por.set(c.id, (por.get(c.id) || 0) + v); };
  db.financeiro.forEach(l => { if(!fAmbOk(l)) return; const c = contaDe(l);
    if(regime === 'comp'){ const d = l.competencia ? l.competencia + '-01' : l.vencimento; if(!d || d < de || d > ate) return; add(c, (l.natureza === 'saida' ? -1 : 1) * (Number(l.valor) || 0)); }
    else { if(!l.pagoEm || l.pagoEm < de || l.pagoEm > ate) return; add(c, (l.natureza === 'saida' ? -1 : 1) * realV(l)); } });
  const kinds = {rec:0, desp:0, naoop:0, ret:0, terc:0, reemb:0}; por.forEach((v, id) => { const k = pcById(id)?.kind; if(k in kinds) kinds[k] += v; });
  return {por, kinds, operacional:kinds.rec + kinds.desp, final:kinds.rec + kinds.desp + kinds.naoop + kinds.ret};
}
function dreHtml(r, resumido){
  const fs = planoContas(), grupos = fs.filter(g => g.grupo && g.pai), linhas = k => grupos.filter(g => g.kind === k).map(g => { const filhos = fs.filter(c => c.pai === g.id && !c.grupo && r.por.get(c.id));
      const tot = sum(filhos.map(c => r.por.get(c.id))); if(!filhos.length) return '';
      return resumido ? `<tr><td>${esc(g.nome)}</td><td class="right ${tot < 0 ? 'neg' : 'pos'}">${money(tot)}</td></tr>`
        : `<tr class="dreG"><td><details><summary>${esc(g.cod + ' ' + g.nome)}</summary>${filhos.map(c => `<div class="dreC"><span>${esc(c.cod + ' ' + c.nome)}</span><span>${money(r.por.get(c.id))}</span></div>`).join('')}</details></td><td class="right ${tot < 0 ? 'neg' : 'pos'}">${money(tot)}</td></tr>`; }).join('');
  const T = (t, v, cls = '') => `<tr class="dreT ${cls}"><td>${t}</td><td class="right">${money(v)}</td></tr>`;
  return `<table class="dre">${linhas('rec')}${T('Total de receitas', r.kinds.rec)}${linhas('desp')}${T('Total de despesas', r.kinds.desp)}${T('<b>Resultado operacional</b>', r.operacional, 'forte')}
    ${r.kinds.naoop ? linhas('naoop') + T('Investimentos e empréstimos', r.kinds.naoop) : ''}${r.kinds.ret ? linhas('ret') + T('Retiradas do titular', r.kinds.ret) : ''}
    ${r.kinds.naoop || r.kinds.ret ? T('<b>Resultado após retiradas e investimentos</b>', r.final, 'forte') : ''}</table>
    ${r.kinds.terc || r.kinds.reemb ? `<div class="small muted" style="margin-top:6px">Fora do resultado (dinheiro de terceiros): valores de clientes ${money(sum([...r.por].filter(([id]) => pcById(id)?.kind === 'terc' && r.por.get(id) > 0).map(([, v]) => v)))} recebidos · ${money(-sum([...r.por].filter(([id]) => pcById(id)?.kind === 'terc' && r.por.get(id) < 0).map(([, v]) => v)))} repassados${r.kinds.reemb ? ` · despesas adiantadas/reembolsos: saldo ${money(r.kinds.reemb)}` : ''}</div>` : ''}`;
}
let FIN_REG = 'caixa';
const regSeg = () => `<span class="seg"><button class="${FIN_REG === 'caixa' ? 'on' : ''}" data-act="finReg" data-v="caixa" title="Pela data em que o dinheiro entrou ou saiu">Caixa</button><button class="${FIN_REG === 'comp' ? 'on' : ''}" data-act="finReg" data-v="comp" title="Pelo mês de competência (ou do vencimento)">Competência</button></span>`;

/* ----- Painel: blocos novos (saldos, resultado do mês, repasses pendentes) ----- */
function finPainelSaldos(){
  const cbs = contasBanc().filter(c => c.ativo !== false && cbAmbOk(c)), t = today();
  const semConta = db.financeiro.filter(l => l.pagoEm && !l.contaBanc && fAmbOk(l) && l.pagoEm >= addDays(t, -90)).length;
  if(!cbs.length) return '';
  return `<div class="fcKs fSaldos">${cbs.map(c => `<a class="fcK" href="#/financeiro/movimentacoes" data-act="movConta" data-id="${c.id}"><small>${CB_TIPOS[c.tipo]?.slice(0, 2) || ''} ${esc(c.nome)}</small><b class="${saldoConta(c.id, t) < 0 ? 'neg' : ''}">${money(saldoConta(c.id, t))}</b><span>saldo hoje</span></a>`).join('')}
    ${cbs.length > 1 ? `<div class="fcK ok"><small>Saldo total</small><b>${money(sum(cbs.map(c => saldoConta(c.id, t))))}</b><span>${cbs.length} contas</span></div>` : ''}</div>
    ${semConta ? `<div class="small muted" style="margin:-4px 0 10px">ℹ️ ${semConta} recebimento(s)/pagamento(s) dos últimos 90 dias sem conta bancária informada — não entram nos saldos. <a href="#/financeiro/receber" data-act="fcSemConta">ver</a></div>` : ''}`;
}
function finPainelResultado(M){
  const de = M + '-01', ate = addDays(addMonths(de, 1), -1), r = finDRE({de, ate, regime:FIN_REG});
  const reps = db.financeiro.filter(l => l.categoria === CAT_REP && !l.pagoEm && finStatus(l) !== 'aguardando').sort(byDateAsc('vencimento')), t = today();
  return `<div class="grid2 finRes"><div class="card" style="margin:0"><h2>📈 Resultado de ${nomeMesLongo(M).toLowerCase()}<span class="sp"></span>${regSeg()}</h2>${dreHtml(r, true)}<div style="text-align:right;margin-top:6px"><a class="small" href="#/financeiro/relatorios">relatório completo →</a></div></div>
    <div class="card" style="margin:0"><h2>🤝 Repasses pendentes <span class="tag ${reps.some(l => l.vencimento < t) ? 'bad' : 'grey'}">${reps.length}</span><span class="sp"></span><a class="small" href="#/financeiro/repasses">ver todos</a></h2>
      ${reps.slice(0, 6).map(l => `<div class="li ${l.vencimento < t ? 'late' : ''}"><div class="grow"><b>${money(l.valor)}</b> → ${linkP(l.pessoaId) || esc(l.descricao)}<div class="sub">${esc(l.descricao)} · repassar até ${fmtD(l.vencimento)} (${rel(l.vencimento)})</div></div><button class="mini" data-act="payFin" data-id="${l.id}">repassar</button></div>`).join('') || '<div class="empty">Nenhum repasse pendente. 👍</div>'}</div></div>`;
}

/* ----- Repasses ----- */
function finRepassesView(){
  const t = today(), reps = db.financeiro.filter(l => l.categoria === CAT_REP && !l.pagoEm), aRep = reps.filter(l => finStatus(l) !== 'aguardando').sort(byDateAsc('vencimento')), agu = reps.filter(l => finStatus(l) === 'aguardando').sort(byDateAsc('vencimento'));
  const cli = new Map(); db.financeiro.forEach(l => { if(!l.pessoaId) return; const c = cli.get(l.pessoaId) || {rec:0, rep:0, pend:0};
    if(l.categoria === CAT_CLI && l.pagoEm) c.rec += realV(l); if(l.categoria === CAT_REP){ if(l.pagoEm) c.rep += realV(l); else if(finStatus(l) !== 'aguardando') c.pend += l.valor; } cli.set(l.pessoaId, c); });
  const semLanc = [...cli].map(([pid, c]) => ({pid, falta:Math.round((c.rec - c.rep - c.pend) * 100) / 100})).filter(x => x.falta > 0.004);
  const feitos = db.financeiro.filter(l => l.categoria === CAT_REP && l.pagoEm && l.pagoEm >= addDays(t, -60)).sort(byDateDesc('pagoEm'));
  const li = (l, btn) => `<div class="li ${l.vencimento && l.vencimento < t && btn ? 'late' : ''}"><div class="grow"><b>${money(btn ? l.valor : realV(l))}</b> → ${linkP(l.pessoaId) || '—'}<div class="sub">${esc(l.descricao)}${l.processoId ? ' · 📁 ' + linkProc(l.processoId) : ''} · ${btn ? (finStatus(l) === 'aguardando' ? 'aguarda o recebimento' : `repassar até ${fmtD(l.vencimento)} (${rel(l.vencimento)})`) : `repassado em ${fmtD(l.pagoEm)}${l.forma ? ' · ' + esc(l.forma) : ''}`}</div></div>${btn ? `<button class="mini" data-act="payFin" data-id="${l.id}">repassar</button>` : ''}</div>`;
  return `<h1>💰 Financeiro<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button></h1>${finAbasHtml('repasses')}
    <div class="fcKs">${[['bd', 'A repassar agora', sum(aRep.map(l => l.valor)), `${aRep.length} repasse(s) · ${aRep.filter(l => l.vencimento < t).length} atrasado(s)`], ['wa', 'Aguardando receber', sum(agu.map(l => l.valor)), `${agu.length} parcela(s) ainda não recebidas`], ['', 'Dinheiro de clientes em sua conta', saldoClientes(), 'recebido − repassado'], ['ok', 'Repassado (60 dias)', sum(feitos.map(realV)), `${feitos.length} repasse(s)`]].map(([c, t2, v, s]) => `<div class="fcK ${c}"><small>${t2}</small><b>${money(v)}</b><span>${s}</span></div>`).join('')}</div>
    ${semLanc.length ? `<div class="card" style="border:2px solid var(--warn)"><h2>⚠️ Valores de clientes recebidos sem repasse lançado</h2>${semLanc.map(x => `<div class="li"><div class="grow"><b>${money(x.falta)}</b> de ${linkP(x.pid)}<div class="sub">recebido para o cliente e ainda sem conta de repasse</div></div><button class="mini" data-act="repLancar" data-p="${x.pid}" data-v="${x.falta}">lançar repasse</button></div>`).join('')}</div>` : ''}
    <div class="grid2"><div class="card" style="margin:0"><h2>🔴 A repassar</h2>${aRep.map(l => li(l, true)).join('') || '<div class="empty">Nada a repassar agora. 👍</div>'}</div>
      <div class="card" style="margin:0"><h2>⏳ Aguardando o recebimento</h2>${limitar('rep:agu', agu, l => li(l, true), 30) || '<div class="empty">Nenhum.</div>'}</div></div>
    <div class="card"><h2>✔ Repassados nos últimos 60 dias</h2>${limitar('rep:ok', feitos, l => li(l, false), 30) || '<div class="empty">Nenhum.</div>'}</div>`;
}

/* ----- Movimentações: extrato por conta + transferências + extrato por pasta ----- */
const MOV = {vis:'conta', cb:'', de:'', ate:'', cli:'', proc:''};
function finMovView(){
  const t = today(); if(!MOV.de){ MOV.de = t.slice(0, 8) + '01'; MOV.ate = t; }
  const cbs = contasBanc().filter(c => cbAmbOk(c)); if(!MOV.cb || !cbById(MOV.cb)) MOV.cb = cbs.find(c => c.ativo !== false)?.id || '';
  const seg = `<span class="seg"><button class="${MOV.vis === 'conta' ? 'on' : ''}" data-act="movVis" data-v="conta">🏦 Extrato por conta</button><button class="${MOV.vis === 'pasta' ? 'on' : ''}" data-act="movVis" data-v="pasta">📁 Extrato por pasta (prestação de contas)</button></span>`;
  const head = `<h1>💰 Financeiro<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button>${relMenu(MOV.vis === 'pasta' ? 'pasta' : 'mov')}<button class="btn" data-act="transfNova">⇄ Transferência / depósito</button><button class="btn" data-act="retiradaNova">🏠 Retirada para o pessoal</button></h1>${finAbasHtml('movimentacoes')}<div style="margin:-4px 0 12px">${seg}</div>`;
  if(MOV.vis === 'pasta') return head + finExtratoPasta();
  const c = cbById(MOV.cb);
  if(!c) return head + '<div class="card empty">Cadastre uma conta bancária ou caixa em ⚙️ Cadastros.</div>';
  const ini = saldoConta(c.id, addDays(MOV.de, -1)), ms = movsConta(c.id).filter(m => m.data >= MOV.de && m.data <= MOV.ate && m.data >= (c.dataSaldo || ''));
  let s = ini; const linhas = ms.map(m => { s += m.v; return `<tr><td class="nowrap">${fmtD(m.data)}</td><td>${m.l ? `<a href="#" data-act="editFin" data-id="${m.l.id}">${esc(m.hist)}</a>` : `<a href="#" data-act="transfEditar" data-id="${m.t.id}">${esc(m.hist)}</a>`}${m.l?.pessoaId ? `<div class="small muted">${esc(pessoaNome(m.l.pessoaId))}</div>` : ''}</td><td class="small">${m.conta ? esc(m.conta.cod + ' ' + m.conta.nome) : '<span class="muted">transferência</span>'}</td>
    <td class="right nowrap ${m.v < 0 ? 'neg' : 'pos'}">${money(m.v)}</td><td class="right nowrap">${money(s)}</td></tr>`; });
  return head + `<div class="card fcFiltros"><div class="fcG"><label>Conta<select data-mov="cb">${opts(cbs.map(x => ({v:x.id, t:(CB_TIPOS[x.tipo]?.slice(0, 2) || '') + ' ' + x.nome})), MOV.cb)}</select></label>
      <label>De<input type="date" data-mov="de" value="${MOV.de}"></label><label>Até<input type="date" data-mov="ate" value="${MOV.ate}"></label>
      <div class="fcBt"><button class="mini" data-act="movPer" data-p="mes">este mês</button><button class="mini" data-act="movPer" data-p="ant">mês passado</button><button class="mini" data-act="movPer" data-p="ano">este ano</button></div></div></div>
    <div class="card"><h2>${CB_TIPOS[c.tipo]?.slice(0, 2) || ''} ${esc(c.nome)} <span class="small muted" style="font-weight:400">${fmtD(MOV.de)} a ${fmtD(MOV.ate)}</span><span class="sp"></span><span class="small">Saldo inicial <b>${money(ini)}</b> · final <b>${money(s)}</b></span></h2>
      ${ms.length ? `<div class="tablewrap"><table><thead><tr><th>Data</th><th>Histórico</th><th>Conta do plano</th><th class="right">Valor</th><th class="right">Saldo</th></tr></thead><tbody>${linhas.join('')}</tbody></table></div>` : '<div class="empty">Nenhuma movimentação nesta conta no período.</div>'}
      ${c.dataSaldo && MOV.de < c.dataSaldo ? `<div class="small muted">O saldo desta conta começa em ${fmtD(c.dataSaldo)} (cadastro da conta).</div>` : ''}</div>`;
}
function finExtratoPasta(){
  const cliOpts = pessoasOpts(), pid = MOV.cli, procs = pid ? procOpts(pid) : [];
  const filtro = `<div class="card fcFiltros noprint"><div class="fcG"><label>Cliente<select data-mov="cli"><option value="">— escolha —</option>${opts(cliOpts, pid)}</select></label>
    <label>Pasta / processo<select data-mov="proc"><option value="">Todas as pastas do cliente</option>${opts(procs, MOV.proc)}</select></label></div></div>`;
  if(!pid) return filtro + '<div class="card empty">Escolha o cliente para montar a prestação de contas.</div>';
  const cli = byId('pessoas', pid), pr = MOV.proc && byId('processos', MOV.proc);
  const ls = db.financeiro.filter(l => (l.pessoaId === pid || (l.processoId && byId('processos', l.processoId)?.clienteId === pid)) && (!MOV.proc || l.processoId === MOV.proc) && !l.partId && !l.partDe && ambDe(l) === 'esc');
  const ac = l => l.acordoId && byId('acordos', l.acordoId)?.modo !== 'cliente';
  const recebido = ls.filter(l => l.pagoEm && (l.categoria === CAT_CLI || (l.categoria === CAT_HC && ac(l)))).sort(byDateAsc('pagoEm'));
  const retidos = ls.filter(l => l.pagoEm && l.categoria === CAT_HC && ac(l)), reps = ls.filter(l => l.categoria === CAT_REP && l.pagoEm).sort(byDateAsc('pagoEm'));
  const desp = ls.filter(l => contaDe(l)?.chave === 'custas_adiant' && l.pagoEm), reemb = ls.filter(l => contaDe(l)?.chave === 'reemb_receb' && l.pagoEm);
  const honCli = ls.filter(l => l.natureza === 'entrada' && contaDe(l)?.kind === 'rec' && contaDe(l)?.chave !== 'hon_sucumb' && !ac(l)), abertos = honCli.filter(l => !l.pagoEm), pagos = honCli.filter(l => l.pagoEm);
  const tRec = sum(recebido.map(realV)), tRet = sum(retidos.map(realV)), tDesp = sum(desp.map(realV)), tReemb = sum(reemb.map(realV)), tRep = sum(reps.map(realV));
  const saldo = Math.round((tRec - tRet - tRep) * 100) / 100, despAbertas = Math.round((tDesp - tReemb) * 100) / 100;
  const L = (d, t, v, cls = '') => `<tr><td class="nowrap">${d ? fmtD(d) : ''}</td><td>${esc(t)}</td><td class="right nowrap ${cls}">${money(v)}</td></tr>`;
  const txt = `Olá, ${(cli?.nome || '').split(' ')[0]}! Segue a prestação de contas${pr ? ' do processo ' + (pr.numero || procCode(pr)) : ''}:\n\n• Recebido em seu nome: ${money(tRec)}\n• Honorários contratuais retidos: ${money(tRet)}\n• Repassado a você: ${money(tRep)}\n• Saldo a repassar: ${money(saldo)}${despAbertas > 0.004 ? `\n• Despesas adiantadas pelo escritório (a reembolsar): ${money(despAbertas)}` : ''}${abertos.length ? `\n• Honorários em aberto: ${money(sum(abertos.map(l => l.valor)))}` : ''}\n\nQualquer dúvida, estou à disposição.`;
  return filtro + `<div class="card prest"><h2>📁 Prestação de contas — ${esc(cli?.nome || '')}<span class="sp"></span><span class="noprint"><a class="btn" target="_blank" rel="noopener" href="https://wa.me/${digits(telsDe(cli)[0]?.numero || cli?.telefone || '').replace(/^(?!55)/, '55')}?text=${encodeURIComponent(txt)}">🟢 Enviar ao cliente</a></span></h2>
    <div class="small muted" style="margin:-6px 0 10px">${pr ? esc(procLabel(pr)) : 'Todas as pastas'} · emitido em ${fmtD(today())}</div>
    <div class="fcKs">${[['', 'Recebido em seu nome', tRec], ['', 'Honorários retidos', tRet], ['ok', 'Repassado a você', tRep], [saldo > 0.004 ? 'wa' : 'ok', 'Saldo a repassar', saldo]].map(([c, t, v]) => `<div class="fcK ${c}"><small>${t}</small><b>${money(v)}</b></div>`).join('')}</div>
    ${recebido.length ? `<h3>Valores recebidos em seu nome</h3><table class="dre">${(() => { const gs = new Map(); recebido.forEach(l => { const k = l.acordoId ? l.acordoId + '|' + l.parcela : l.id; const g = gs.get(k) || {d:l.pagoEm, v:0, t:l.acordoId ? `${byId('acordos', l.acordoId)?.descricao || 'Acordo'} — parcela ${l.parcela}/${byId('acordos', l.acordoId)?.parcelas || '?'}` : l.descricao}; g.v += realV(l); gs.set(k, g); });
      return [...gs.values()].map(g => L(g.d, g.t, g.v)).join(''); })()}${L('', 'Total recebido', tRec)}</table>` : ''}
    ${retidos.length ? `<h3>(−) Honorários contratuais retidos</h3><table class="dre">${retidos.map(l => L(l.pagoEm, l.descricao, -realV(l), 'neg')).join('')}</table>` : ''}
    ${reps.length ? `<h3>Repasses feitos a você</h3><table class="dre">${reps.map(l => L(l.pagoEm, l.descricao + (l.forma ? ' · ' + l.forma : ''), realV(l))).join('')}${L('', 'Total repassado', tRep)}</table>` : ''}
    ${desp.length ? `<h3>Despesas adiantadas pelo escritório</h3><table class="dre">${desp.map(l => L(l.pagoEm, l.descricao, realV(l))).join('')}${reemb.map(l => L(l.pagoEm, '(−) reembolsado: ' + l.descricao, -realV(l), 'pos')).join('')}${L('', 'A reembolsar', despAbertas)}</table>` : ''}
    ${pagos.length || abertos.length ? `<h3>Honorários e serviços</h3><table class="dre">${pagos.map(l => L(l.pagoEm, l.descricao + ' — pago', realV(l))).join('')}${abertos.map(l => L(l.vencimento, l.descricao + (l.vencimento ? ' — em aberto' : ' — ao final do processo'), l.valor, 'neg')).join('')}</table>` : ''}
    <div class="small muted" style="margin-top:8px">Não aparecem aqui: honorários de sucumbência e participações de parceiros.</div></div>`;
}
function formTransf(t0){
  const novo = !t0, t = t0 || {id:uid(), data:today(), origem:'', destino:'', valor:'', historico:''};
  openForm({title:novo ? '⇄ Transferência / depósito entre contas' : 'Editar transferência', data:t,
    fields:[{k:'origem', label:'De (origem)', type:'select', req:true, options:() => cbOpts('', t.origem)}, {k:'destino', label:'Para (destino)', type:'select', req:true, options:() => cbOpts('', t.destino)},
      {k:'data', label:'Data', type:'date', req:true}, {k:'valor', label:'Valor (R$)', type:'number', req:true}, {k:'historico', label:'Histórico', full:true, ph:'ex.: depósito do caixa no banco'},
      {type:'html', html:'<div class="small muted">Transferência entre contas não é receita nem despesa — só muda o saldo de cada conta. Para levar dinheiro do escritório para você, use “🏠 Retirada para o pessoal”.</div>'}],
    onDelete:!novo ? () => { if(!confirm('Excluir esta transferência?')) return false; db.transf = transfs().filter(x => x.id !== t.id); save(); render(); } : null,
    onSave:o => { if(o.origem === o.destino){ toast('Origem e destino iguais'); return false; } const r = {...t, ...o, valor:Number(o.valor) || 0}; if(r.valor <= 0){ toast('Informe o valor'); return false; }
      db.transf = [...transfs().filter(x => x.id !== r.id), r]; save(); render(); toast('Transferência registrada'); }});
}
function formRetirada(){
  const esc1 = contasBanc().filter(c => (c.ambito || 'esc') === 'esc' && c.ativo !== false), pes = contasBanc().filter(c => c.ambito === 'pes' && c.ativo !== false);
  openForm({title:'🏠 Retirada do escritório para o pessoal', data:{data:today(), tipo:'prolabore', origem:esc1[0]?.id || '', destino:pes[0]?.id || ''},
    fields:[{k:'tipo', label:'Tipo', type:'select', empty:false, options:[{v:'prolabore', t:'Pró-labore'}, {v:'lucros', t:'Distribuição de lucros'}]},
      {k:'valor', label:'Valor (R$)', type:'number', req:true}, {k:'data', label:'Data', type:'date', req:true},
      {k:'origem', label:'Sai da conta (escritório)', type:'select', options:() => esc1.map(c => ({v:c.id, t:c.nome}))}, {k:'destino', label:'Entra na conta (pessoal)', type:'select', options:() => pes.map(c => ({v:c.id, t:c.nome}))},
      {type:'html', html:`<div class="small muted">Registra a saída no escritório (4 Retiradas do titular — abaixo do resultado) e a entrada no seu financeiro pessoal (5.1.01), já pagas.${pes.length ? '' : ' <b>Cadastre uma conta pessoal</b> em ⚙️ Cadastros para o saldo pessoal ficar certo.'}</div>`}],
    onSave:o => { const v = Number(o.valor) || 0; if(v <= 0){ toast('Informe o valor'); return false; } const a = uid(), b = uid(), cs = pcPorChave(o.tipo === 'lucros' ? 'lucros' : 'prolabore'), ce = pcPorChave('pes_retirada'), agora = new Date().toISOString(), nm = o.tipo === 'lucros' ? 'Distribuição de lucros' : 'Pró-labore';
      db.financeiro.push({id:a, criadoEm:agora, natureza:'saida', ambito:'esc', conta:cs?.id, categoria:catDaConta(cs), descricao:nm, valor:v, vencimento:o.data, pagoEm:o.data, valorPago:v, contaBanc:o.origem || '', parRetirada:b},
        {id:b, criadoEm:agora, natureza:'entrada', ambito:'pes', conta:ce?.id, categoria:catDaConta(ce), descricao:nm + ' (do escritório)', valor:v, vencimento:o.data, pagoEm:o.data, valorPago:v, contaBanc:o.destino || '', parRetirada:a});
      save(); render(); toast('Retirada registrada'); }});
}

/* ----- Relatórios ----- */
const REL = {per:'mes', mes:'', ano:'', de:'', ate:''};
function finRelatoriosView(){
  const t = today(); if(!REL.mes) REL.mes = t.slice(0, 7); if(!REL.ano) REL.ano = t.slice(0, 4);
  const [de, ate] = REL.per === 'ano' ? [REL.ano + '-01-01', REL.ano + '-12-31'] : REL.per === 'livre' ? [REL.de || t.slice(0, 8) + '01', REL.ate || t] : [REL.mes + '-01', addDays(addMonths(REL.mes + '-01', 1), -1)];
  const r = finDRE({de, ate, regime:FIN_REG});
  // 12 meses
  const fim = (REL.per === 'ano' ? REL.ano + '-12' : (REL.per === 'livre' ? ate : REL.mes).slice(0, 7)), meses = Array.from({length:12}, (_, i) => addMonths(fim + '-01', i - 11).slice(0, 7));
  const mR = meses.map(m => finDRE({de:m + '-01', ate:addDays(addMonths(m + '-01', 1), -1), regime:FIN_REG})), mx = Math.max(1, ...mR.map(x => Math.max(x.kinds.rec, -x.kinds.desp)));
  // honorários por área e por conta
  const area = new Map(), porConta = new Map();
  db.financeiro.forEach(l => { if(!fAmbOk(l) || l.natureza !== 'entrada') return; const c = contaDe(l); if(c?.kind !== 'rec') return; const d = FIN_REG === 'comp' ? (l.competencia ? l.competencia + '-01' : l.vencimento) : l.pagoEm;
    if(!d || d < de || d > ate) return; const v = FIN_REG === 'comp' ? Number(l.valor) || 0 : realV(l), ar = byId('processos', l.processoId)?.area || (l.processoId ? 'Sem área' : 'Sem processo');
    area.set(ar, (area.get(ar) || 0) + v); porConta.set(c.nome, (porConta.get(c.nome) || 0) + v); });
  const barras = m => { const tot = sum([...m.values()]); return [...m].sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="relB"><span>${esc(k)}</span><div><i style="width:${tot ? v / tot * 100 : 0}%"></i></div><b>${money(v)}</b><small>${tot ? Math.round(v / tot * 100) : 0}%</small></div>`).join('') || '<div class="empty">Sem honorários no período.</div>'; };
  // previsão de caixa (próximos 3 meses + sem data)
  const prox = [0, 1, 2].map(i => addMonths(t.slice(0, 8) + '01', i).slice(0, 7)), aberto = db.financeiro.filter(l => !l.pagoEm && fAmbOk(l) && finStatus(l) !== 'aguardando');
  const saldoHoje = sum(contasBanc().filter(c => c.ativo !== false && cbAmbOk(c)).map(c => saldoConta(c.id, t)));
  let acum = saldoHoje; const prev = prox.map((m, i) => { const ls = aberto.filter(l => i === 0 ? (l.vencimento && l.vencimento.slice(0, 7) <= m) : (l.vencimento || '').startsWith(m)); const e = sum(ls.filter(l => l.natureza === 'entrada').map(l => l.valor)), s = sum(ls.filter(l => l.natureza === 'saida').map(l => l.valor)); acum += e - s; return {m, e, s, acum}; });
  const semD = aberto.filter(l => !l.vencimento && l.natureza === 'entrada');
  const perSel = `<div class="card fcFiltros noprint"><div class="fcG"><label>Período<select data-rel="per">${opts([{v:'mes', t:'Mês'}, {v:'ano', t:'Ano'}, {v:'livre', t:'De… até…'}], REL.per)}</select></label>
    ${REL.per === 'mes' ? `<label>Mês<input type="month" data-rel="mes" value="${REL.mes}"></label>` : REL.per === 'ano' ? `<label>Ano<input type="number" data-rel="ano" value="${REL.ano}"></label>` : `<label>De<input type="date" data-rel="de" value="${de}"></label><label>Até<input type="date" data-rel="ate" value="${ate}"></label>`}
    <div class="fcBt">${regSeg()}</div></div></div>`;
  return `<h1>💰 Financeiro<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button>${relMenu('dre')}</h1>${finAbasHtml('relatorios')}${perSel}
    <div class="grid2"><div class="card" style="margin:0"><h2>📈 Demonstrativo de resultado <span class="small muted" style="font-weight:400">${fmtD(de)} a ${fmtD(ate)} · ${FIN_REG === 'comp' ? 'competência' : 'caixa'}</span></h2>${dreHtml(r, false)}</div>
      <div><div class="card" style="margin:0 0 14px"><h2>⚖️ Honorários por área</h2>${barras(area)}</div><div class="card" style="margin:0"><h2>🏷️ Honorários por tipo</h2>${barras(porConta)}</div></div></div>
    <div class="card"><h2>📊 Últimos 12 meses <span class="small muted" style="font-weight:400">— <span style="color:var(--ok)">■</span> receitas · <span style="color:var(--bad)">■</span> despesas · resultado embaixo</span></h2>
      <div class="rel12">${meses.map((m, i) => `<div><div class="b"><i style="height:${mR[i].kinds.rec / mx * 100}%;background:var(--ok)"></i><i style="height:${-mR[i].kinds.desp / mx * 100}%;background:var(--bad)"></i></div><small>${nomeMesLongo(m).slice(0, 3)}/${m.slice(2, 4)}</small><b class="${mR[i].operacional < 0 ? 'neg' : ''}">${(mR[i].operacional / 1000).toLocaleString('pt-BR', {maximumFractionDigits:1})} mil</b></div>`).join('')}</div></div>
    <div class="card"><h2>🔮 Previsão de caixa <span class="small muted" style="font-weight:400">— saldo hoje ${money(saldoHoje)} + contas em aberto</span></h2>
      <table class="dre"><tr><th>Mês</th><th class="right">A receber</th><th class="right">A pagar</th><th class="right">Saldo previsto</th></tr>${prev.map((x, i) => `<tr><td>${nomeMesLongo(x.m)}${i === 0 ? ' (com atrasados)' : ''}</td><td class="right pos">${money(x.e)}</td><td class="right neg">${money(-x.s)}</td><td class="right"><b class="${x.acum < 0 ? 'neg' : ''}">${money(x.acum)}</b></td></tr>`).join('')}</table>
      ${semD.length ? `<div class="small muted" style="margin-top:6px">📌 Mais ${money(sum(semD.map(l => l.valor)))} a receber sem data (ao final do processo), fora da previsão.</div>` : ''}</div>` + honContratadosHtml();
}

/* ----- ações e filtros ----- */
document.addEventListener('change', e => { const k = e.target.dataset?.mov, r = e.target.dataset?.rel;
  if(k){ MOV[k] = e.target.value; if(k === 'cli') MOV.proc = ''; render(); } if(r){ REL[r] = e.target.value; render(); } });
Object.assign(A, {
  finReg: d => { FIN_REG = d.v; render(); },
  movVis: d => { MOV.vis = d.v; render(); }, movConta: d => { MOV.cb = d.id; MOV.vis = 'conta'; },
  movPer: d => { const t = today(); if(d.p === 'mes'){ MOV.de = t.slice(0, 8) + '01'; MOV.ate = t; } else if(d.p === 'ant'){ MOV.de = addMonths(t.slice(0, 8) + '01', -1); MOV.ate = addDays(t.slice(0, 8) + '01', -1); } else { MOV.de = t.slice(0, 5) + '01-01'; MOV.ate = t; } render(); },
  transfNova: () => formTransf(null), transfEditar: d => formTransf(transfs().find(x => x.id === d.id)), retiradaNova: () => formRetirada(),
  repLancar: d => formFin({natureza:'saida', pessoaId:d.p, conta:pcPorChave('cli_repasse')?.id, categoria:CAT_REP, descricao:'Repasse ao cliente', valor:Number(d.v), vencimento:today()}),
  fcSemConta: () => { FC.entrada.sit = 'pago'; },
});

/* ----- verificação ----- */
VINCULOS.verificar.push(() => {
  const out = [], tOrf = transfs().filter(t => !cbById(t.origem) || !cbById(t.destino));
  if(tOrf.length) out.push({area:'💰 Financeiro', titulo:`${tOrf.length} transferência(s) com conta bancária excluída`, txt:'Os saldos ficam incompletos. Abra em Movimentações e corrija.', href:'#/financeiro/movimentacoes', grave:true});
  const parOrf = db.financeiro.filter(l => l.parRetirada && !byId('financeiro', l.parRetirada));
  if(parOrf.length) out.push({area:'💰 Financeiro', titulo:`${parOrf.length} retirada(s) sem o lançamento correspondente`, txt:'A saída do escritório e a entrada no pessoal devem existir juntas.', href:'#/financeiro/movimentacoes'});
  return out;
});
