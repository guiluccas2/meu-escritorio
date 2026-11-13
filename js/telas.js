// Meu Escritório — Componentes e telas (Início, Atendimentos, Agenda, Processos, Clientes, Leads, Financeiro, Backup…)
'use strict';
/* ================= COMPONENTES ================= */
function convItem(c, ctx = {}){
  const t = today();
  let next = '';
  if(c.proximaAcao || c.proximaData){
    const cls = c.retornoFeito ? 'done' : (c.proximaData && c.proximaData < t ? 'late' : '');
    next = `<div class="tl-next ${cls}">${c.retornoFeito ? '✔' : '⏰'} <span><b>Combinado:</b> ${esc(c.proximaAcao || 'retornar')}${c.proximaData ? ` — até ${fmtD(c.proximaData)} (${rel(c.proximaData)})` : ''}</span>
      ${c.retornoFeito ? '' : `<span class="sp"></span><button class="mini" data-act="convDone" data-id="${c.id}">marcar como feito</button>`}</div>`;
  }
  return `<div class="tl-item ${c.leadId && !c.pessoaId ? 'lead' : ''}">
    <div class="tl-meta">💬 <b>${fmtDT(c.dataHora)}</b> · ${esc(c.canal || '')}${c.iniciadoPor ? ` · <span title="Quem iniciou o contato">${c.iniciadoPor === 'escritorio' ? '↗ escritório procurou' : '↙ cliente procurou'}</span>` : ''}${c.categoria ? ` <span class="tag grey">${esc(c.categoria)}</span>` : ''}
      ${ctx.noPessoa ? '' : (c.pessoaId ? ' · ' + linkP(c.pessoaId) : (c.leadId ? ' · ' + linkLead(c.leadId) : ''))}
      ${!ctx.noProc && c.processoId ? ' · 📁 ' + linkProc(c.processoId) : ''}</div>
    ${c.assunto ? `<div class="tl-title">${esc(c.assunto)}</div>` : ''}
    <div class="tl-body${ctx.clamp ? ' clamp' : ''}">${nl2br(c.relato)}</div>${ctx.clamp ? '<button class="verMais" data-act="verMais">ver mais ▾</button>' : ''}${next}
    <div class="tl-actions"><button class="mini" data-act="editConv" data-id="${c.id}">editar</button></div></div>`;
}
function andItem(a){
  return `<div class="tl-item and"><div class="tl-meta">📄 <b>${fmtD(a.data)}</b>${a.tipo ? ' · ' + esc(a.tipo) : ''}</div>
    <div class="tl-body">${nl2br(a.descricao)}</div>
    <div class="tl-actions"><button class="mini" data-act="editAnd" data-id="${a.id}">editar</button></div></div>`;
}
function prazoItem(p, ctx = {}){
  const t = today(); const cls = p.concluido ? 'done' : atrasado(p) ? 'late' : !p.data ? '' : (p.data === t ? 'today' : '');
  const ck = (p.checklist || []).length ? `<span class="tag ${p.checklist.every(c => c.ok) ? 'ok' : 'grey'}" title="Lista de verificação">☑ ${p.checklist.filter(c => c.ok).length}/${p.checklist.length}</span>` : '';
  const sel = ctx.sel ? `<input type="checkbox" data-psel="${p.id}" title="Selecionar">` : `<input type="checkbox" data-act="togglePrazo" data-id="${p.id}" ${p.concluido ? 'checked' : ''} title="Marcar como realizado">`;
  return `<div class="li ${cls}">${sel}
    <div class="grow"><b>${esc(p.titulo)}</b> <span class="tag ${['Audiência','Perícia'].includes(p.tipo) ? 'warn' : 'grey'}">${esc(p.tipo || '')}${p.subtipo ? ' · ' + esc(p.subtipo) : ''}</span>
      ${p.situacao && p.situacao !== 'Pendente' ? `<span class="tag ${p.situacao === 'Realizado' ? 'ok' : 'grey'}">${esc(p.situacao.toLowerCase())}</span>` : ''} ${ck}
    <div class="sub">${p.data ? `${fmtD(p.data)}${p.dataFim && p.dataFim !== p.data ? ' a ' + fmtD(p.dataFim) : ''}${horaTxt(p) ? ' · ' + horaTxt(p) : ''} · <b>${rel(p.data)}</b>` : '<b>sem data</b>'}${p.local ? ' · ' + esc(p.local) : ''}
    ${!ctx.noProc && p.processoId ? ' · 📁 ' + linkProc(p.processoId) : ''}${!ctx.noPessoa && p.pessoaId ? ' · ' + linkP(p.pessoaId) : ''}</div>
    ${reagSelo(p)}${avisosPrazo(p)}
    ${p.obs && ctx.obs ? `<div class="sub">${esc(p.obs)}</div>` : ''}</div>
    ${ctx.sel && !p.concluido ? `<button class="mini" data-act="prazoConcluir" data-id="${p.id}" title="Marcar como realizado">✔ concluir</button>` : ''}${ctx.sel && p.concluido ? `<button class="mini" data-act="prazoReabrir" data-id="${p.id}">↩ desfazer</button>` : ''}
    <button class="mini" data-act="editPrazo" data-id="${p.id}">editar</button></div>`;
}
const FIN_HEAD = ctx => `<thead><tr><th class="sel"><input type="checkbox" data-selall title="Selecionar todos"></th><th>Venc.</th><th></th>${ctx.noPessoa ? '' : '<th>Cliente</th>'}<th>Descrição</th><th class="right">Valor</th><th>Situação</th><th></th></tr></thead>`;
function finRow(l, ctx = {}){
  const e = l.natureza === 'entrada', pr = byId('processos', l.processoId);
  return `<tr><td class="sel"><input type="checkbox" data-sel="${l.id}"></td><td class="nowrap">${fmtD(l.vencimento)}</td><td title="${e ? 'Entrada' : 'Saída'}" style="color:${e ? 'var(--ok)' : 'var(--bad)'};font-weight:700">${e ? '⬆' : '⬇'}</td>
    ${ctx.noPessoa ? '' : `<td>${linkP(l.pessoaId) || '<span class="muted">—</span>'}</td>`}
    <td>${esc(l.descricao)} <span class="tag grey">${esc(l.categoria || '')}</span>
      ${!ctx.noProc && pr ? `<div class="small">📁 <a href="#/processo/${pr.id}">${esc(procCode(pr) || pr.numero || pr.titulo || 'processo')}</a></div>` : ''}
      ${l.saldoDe ? `<div class="small" style="color:var(--warn)">↳ saldo restante de pagamento parcial</div>` : ''}
      ${l.acordoId && !ctx.noAcordo ? `<div class="small">🤝 <a href="#/acordo/${l.acordoId}">ver acordo</a></div>` : ''}
      ${l.pagoEm ? `<div class="small muted">${e ? 'Recebido' : 'Pago'} em ${fmtD(l.pagoEm)} · ${money(realV(l))}${l.forma ? ' · ' + esc(l.forma) : ''}</div>` : ''}</td>
    <td class="right nowrap" style="color:${e ? 'var(--ok)' : 'var(--bad)'}">${e ? '' : '− '}${money(l.pagoEm ? realV(l) : l.valor)}</td><td>${finTag(l)}</td>
    <td class="nowrap right">${l.pagoEm || finStatus(l) === 'aguardando' ? '' : `<button class="mini" data-act="payFin" data-id="${l.id}"${ctx.noAcordo ? ' data-direct="1"' : ''}>${e ? 'receber' : (l.categoria === CAT_REP ? 'repassar' : 'pagar')}</button> `}<button class="mini" data-act="editFin" data-id="${l.id}">editar</button></td></tr>`;
}
function finRowParcela(g, ctx = {}){ // várias entradas da mesma parcela de acordo, em uma linha
  const l = g[0], a = byId('acordos', l.acordoId), pr = byId('processos', l.processoId), tot = sum(g.map(x => x.valor));
  return `<tr><td class="sel"><input type="checkbox" data-sel="${g.map(x => x.id).join(',')}"></td><td class="nowrap">${fmtD(l.vencimento)}</td><td style="color:var(--ok);font-weight:700" title="Entrada">⬆</td>
    ${ctx.noPessoa ? '' : `<td>${linkP(l.pessoaId) || '<span class="muted">—</span>'}</td>`}
    <td>🤝 <a href="#/acordo/${l.acordoId}">${esc(a?.descricao || 'Acordo')}</a> — parcela ${l.parcela}/${a?.parcelas || '?'}
      <div class="small muted">${g.map(x => `${esc(x.categoria === CAT_CLI ? 'do cliente' : x.categoria.replace('Honorários ', ''))} ${money(x.valor)}`).join(' · ')}</div>
      ${pr ? `<div class="small">📁 <a href="#/processo/${pr.id}">${esc(procCode(pr) || pr.numero || pr.titulo || 'processo')}</a></div>` : ''}</td>
    <td class="right nowrap" style="color:var(--ok)">${money(tot)}</td><td>${finTag(l)}</td>
    <td class="nowrap right"><button class="mini" data-act="recParc" data-id="${l.acordoId}" data-k="${l.parcela}">receber</button> <a class="mini" href="#/acordo/${l.acordoId}">abrir</a></td></tr>`;
}
function finTable(list, ctx = {}){
  if(!list.length) return '<div class="empty">Nenhum lançamento.</div>';
  return `<div class="tablewrap"><table>${FIN_HEAD(ctx)}<tbody>${list.map(l => finRow(l, ctx)).join('')}</tbody></table></div>`;
}
const nomeMesLongo = m => { const t = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'}); return t.charAt(0).toUpperCase() + t.slice(1); };
function finTableMes(list, {realizados, agrupar} = {}){
  if(!list.length) return '<div class="empty">Nenhum lançamento.</div>';
  const t = today(), grupos = new Map();
  const chave = l => { const d = (realizados ? l.pagoEm : l.vencimento) || '';
    return !realizados && !l.pagoEm && finStatus(l) === 'vencido' ? '0-venc' : '1-' + d.slice(0, 7); };
  list.forEach(l => { let k = chave(l);
    if(!realizados && !l.pagoEm && finStatus(l) === 'aguardando'){ // repasse que aguarda a parcela: fica junto dela
      const ent = list.find(x => x.acordoId === l.acordoId && x.parcela === l.parcela && x.natureza === 'entrada' && !x.pagoEm); if(ent) k = chave(ent); }
    if(!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(l); });
  grupos.forEach(ls => ls.sort((a, b) => (realizados ? 0 : (a.acordoId && a.acordoId === b.acordoId ? (a.parcela - b.parcela) : 0)) || ((realizados ? b.pagoEm || '' : a.vencimento || '').localeCompare(realizados ? a.pagoEm || '' : b.vencimento || '')) || (a.natureza === b.natureza ? 0 : a.natureza === 'entrada' ? -1 : 1)));
  const keys = [...grupos.keys()].sort((a, b) => realizados ? b.localeCompare(a) : a.localeCompare(b));
  const cols = 8;
  const body = keys.map(k => {
    const ls = grupos.get(k), v = x => realizados ? realV(x) : x.valor;
    const ent = sum(ls.filter(x => x.natureza === 'entrada').map(v)), sai = sum(ls.filter(x => x.natureza === 'saida').map(v));
    const titulo = k === '0-venc' ? '🔴 Vencidos / atrasados' : nomeMesLongo(k.slice(2));
    // agrupa entradas da mesma parcela de acordo
    const rows = [], vistos = new Set();
    ls.forEach(l => {
      if(agrupar && l.acordoId && l.natureza === 'entrada' && !l.pagoEm){
        const key = l.acordoId + '|' + l.parcela; if(vistos.has(key)) return; vistos.add(key);
        const g = ls.filter(x => x.acordoId === l.acordoId && x.parcela === l.parcela && x.natureza === 'entrada' && !x.pagoEm);
        rows.push(g.length > 1 ? finRowParcela(g) : finRow(l));
      } else rows.push(finRow(l));
    });
    return `<tr><td colspan="${cols}" style="background:var(--bg);padding:10px;border-bottom:2px solid var(--line)"><div style="display:flex;gap:12px;flex-wrap:wrap;align-items:baseline">
      <b style="font-size:15px${k === '0-venc' ? ';color:var(--bad)' : ''}">${titulo}</b><span class="sp"></span>
      <span class="small">${realizados ? 'Recebido' : 'A receber'} <b style="color:var(--ok)">${money(ent)}</b> · ${realizados ? 'Pago' : 'A pagar'} <b style="color:var(--bad)">${money(sai)}</b> · Saldo <b>${money(ent - sai)}</b></span></div></td></tr>${rows.join('')}`;
  }).join('');
  return `<div class="tablewrap"><table>${FIN_HEAD({})}<tbody>${body}</tbody></table></div>`;
}
const statBox = (l, v, cls = '') => `<div class="stat ${cls}"><div class="l">${l}</div><div class="n" style="font-size:18px">${money(v)}</div></div>`;
function finResumo(list){
  const r = list.filter(isRec), venc = sum(list.filter(l => l.natureza === 'entrada' && finStatus(l) === 'vencido').map(l => l.valor));
  const cliIn = sum(list.filter(l => l.natureza === 'entrada' && l.categoria === CAT_CLI && l.pagoEm).map(realV));
  const rep = sum(list.filter(l => l.natureza === 'saida' && l.categoria === CAT_REP && l.pagoEm).map(realV));
  const hasCli = list.some(l => l.categoria === CAT_CLI || l.categoria === CAT_REP);
  const desp = list.filter(l => l.natureza === 'saida' && catKind(l.categoria) === 'reemb' && l.pagoEm), reemb = list.filter(l => l.natureza === 'entrada' && catKind(l.categoria) === 'reemb' && l.pagoEm);
  return `<div class="stats" style="margin-bottom:12px">
    ${statBox('Honorários previstos', sum(r.map(l => l.valor)))}${statBox('Honorários recebidos', sum(r.filter(l => l.pagoEm).map(realV)), 'ok')}${statBox('Vencido a receber', venc, venc ? 'bad' : '')}
    ${hasCli ? statBox('Recebido para o cliente', cliIn) + statBox('Repassado ao cliente', rep) + statBox('Saldo do cliente a repassar', cliIn - rep, cliIn - rep > 0.004 ? 'warn' : '') : ''}
    ${desp.length || reemb.length ? statBox('Despesas adiantadas', sum(desp.map(realV))) + statBox('Despesas reembolsadas', sum(reemb.map(realV))) : ''}
  </div>`;
}
function acordoResumo(a){
  const ls = acordoLanc(a.id), ks = [...new Set(ls.map(l => l.parcela))], n = ks.length; let rec = 0;
  ks.forEach(k => { if(parcRecebida(a.id, k)) rec++; });
  const prox = ls.filter(l => !l.pagoEm && l.natureza === 'entrada').sort(byDateAsc('vencimento'))[0];
  const repPend = ls.filter(l => l.categoria === CAT_REP && !l.pagoEm && parcRecebida(a.id, l.parcela));
  return {n, rec, prox, repPend, saldo:saldoClientes(ls)};
}
function acordoItem(a){
  const r = acordoResumo(a), t = today();
  return `<div class="li"><div class="grow"><b><a href="#/acordo/${a.id}">🤝 ${esc(a.descricao)}</a></b> <span class="tag ${r.rec === r.n ? 'ok' : ''}">${r.rec}/${r.n} parcelas recebidas</span>
    <div class="sub">${linkP(a.pessoaId)}${a.processoId ? ' · 📁 ' + linkProc(a.processoId) : ''} · total ${money((Number(a.principal) || 0) + (Number(a.sucumbencia) || 0))}</div>
    <div class="sub">${r.prox ? `Próxima parcela: <b style="color:${r.prox.vencimento < t ? 'var(--bad)' : 'inherit'}">${fmtD(r.prox.vencimento)}</b> (${rel(r.prox.vencimento)})` : 'Todas as parcelas recebidas ✔'}
    ${r.repPend.length ? ` · <b style="color:var(--warn)">${r.repPend.length} repasse(s) pendente(s): ${money(sum(r.repPend.map(l => l.valor)))}</b>` : ''}</div></div>
    <a class="mini" href="#/acordo/${a.id}">abrir</a></div>`;
}
const info = (l, v, full) => v ? `<div class="${full ? 'full' : ''}"><span>${esc(l)}</span>${v}</div>` : '';

/* ================= TELAS ================= */
const V = document.getElementById('view');
const VIEWS = {};
let listFn = null;
const F = { pes:{q:'', tipo:'', ord:'pasta'}, proc:{q:'', status:'ativos', area:'', ord:'pasta'}, conv:{q:'', canal:'', cat:'', ini:'', pend:false}, ag:{vis:'lista', sit:'pend', q:'', tipo:'', per:'todos', de:'', ate:'', atras:false, mostrarConc:false, area:''}, fin:{st:'pend', nat:'', cat:'', mes:'', q:'', agrupar:true}, lead:{q:''}, imp:{trib:''} };
const tabs = { proc:'conv', pes:'conv', fin:'lanc' };

const PAINEL_PADRAO = {
  ind:{atras:1, hoje:1, sem:1, ret:1, leads:1, recMes:1, sCli:1, vencRec:0, procAtivos:0, exitos:0, prevMes:0, semAnd:0},
  blocos:{atalhos:1, hoje:1, prazos:1, retornos:1, leads:1, fin:1, maior:1, conversas:1},
  nConv:3, calTudo:true, menu:{conversas:1, agenda:1, processos:1, pessoas:1, leads:1, financeiro:1, config:1} };
const REAG_FIXOS = ['Audiência', 'Perícia'];
function painelCfg(){ const c = db.meta.painel || {};
  return {reag:{ativo: c.reag?.ativo !== false, tipos:{...Object.fromEntries(OPT.tipoPrazo.map(t => [t, REAG_FIXOS.includes(t) ? 0 : 1])), ...(c.reag?.tipos || {})}}, ind:{...PAINEL_PADRAO.ind, ...(c.ind || {})}, blocos:{...PAINEL_PADRAO.blocos, ...(c.blocos || {})}, menu:{...PAINEL_PADRAO.menu, ...(c.menu || {})},
    nConv:c.nConv || 3, calTudo:c.calTudo !== false}; }
function aplicarMenu(){ const m = painelCfg().menu; document.querySelectorAll('#nav a').forEach(a => { a.style.display = m[a.dataset.v] === 0 ? 'none' : ''; }); }
let calMes = null, calSel = null;
const COR_EV = {prazo:'c-prazo', aud:'c-aud', ret:'c-ret', fin:'c-fin', reu:'c-reu'};
const NOME_EV = {prazo:'Prazo', aud:'Audiência', ret:'Retorno', fin:'Financeiro', reu:'Compromisso'};
function eventosDia(d, tudo = true){
  const ev = [];
  db.prazos.filter(p => !p.concluido && p.data === d).forEach(p => {
    const tipo = p.tipo === 'Audiência' || p.tipo === 'Perícia' ? 'aud' : (p.tipo === 'Prazo processual' ? 'prazo' : 'reu');
    if(!tudo && tipo === 'reu') return;
    ev.push({tipo, hora:p.hora, titulo:p.titulo, sub:[p.tipo !== 'Prazo processual' && p.tipo !== 'Audiência' ? p.tipo : '', p.local, pessoaNome(p.pessoaId), procCode(byId('processos', p.processoId))].filter(Boolean).join(' · '),
      btn:`<button class="mini" data-act="editPrazo" data-id="${p.id}">abrir</button>`}); });
  if(tudo){
    db.conversas.filter(c => c.proximaData === d && !c.retornoFeito).forEach(c => ev.push({tipo:'ret', titulo:'Retorno: ' + (c.proximaAcao || 'falar com o cliente'), sub:pessoaNome(c.pessoaId) || byId('leads', c.leadId)?.nome || '',
      btn:`<button class="mini" data-act="convDone" data-id="${c.id}">feito</button>`}));
    const vistos = new Set();
    db.financeiro.filter(l => !l.pagoEm && l.natureza === 'entrada' && l.vencimento === d).forEach(l => {
      const k = l.acordoId ? l.acordoId + '|' + l.parcela : l.id; if(vistos.has(k)) return; vistos.add(k);
      const v = l.acordoId ? sum(acordoLanc(l.acordoId, l.parcela).filter(x => x.natureza === 'entrada' && !x.pagoEm).map(x => x.valor)) : l.valor;
      ev.push({tipo:'fin', titulo:'A receber ' + money(v), sub:(l.acordoId ? (byId('acordos', l.acordoId)?.descricao || 'Acordo') + ' — parcela ' + l.parcela : l.descricao) + (l.pessoaId ? ' · ' + pessoaNome(l.pessoaId) : ''),
        btn: l.acordoId ? `<button class="mini" data-act="recParc" data-id="${l.acordoId}" data-k="${l.parcela}">receber</button>` : `<button class="mini" data-act="payFin" data-id="${l.id}">receber</button>`}); });
  }
  const ord = {aud:0, reu:1, prazo:2, ret:3, fin:4};
  return ev.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99') || ord[a.tipo] - ord[b.tipo]);
}
function blocoHoje(){
  const t = today(), ev = eventosDia(t), n = k => ev.filter(e => e.tipo === k).length, atras = db.prazos.filter(atrasado).length, dt = parseD(t);
  return `<div class="hojeBox"><div class="lbl">HOJE</div><div class="dia">${pad(dt.getDate())}</div><div class="mes">${dt.toLocaleDateString('pt-BR', {month:'short'}).replace('.', '')} · ${dt.toLocaleDateString('pt-BR', {weekday:'long'})}</div>
    <a href="#/agenda"><span>Audiências</span><b>${n('aud')}</b></a>
    <a href="#/agenda"><span>Prazos</span><b>${n('prazo')}</b></a>
    <a href="#/agenda"><span>Reuniões / compromissos</span><b>${n('reu')}</b></a>
    <a href="#/conversas" data-act="filtroRet"><span>Retornos a clientes</span><b>${n('ret')}</b></a>
    <a href="#/financeiro"><span>Recebimentos previstos</span><b>${n('fin')}</b></a>
    <a href="#/agenda" class="alerta"><span>⚠️ Prazos atrasados</span><b>${atras}</b></a></div>`;
}
function blocoCal(tudo){
  const t = today(); calMes = calMes || t.slice(0, 7);
  const [y, m] = calMes.split('-').map(Number), first = new Date(y, m - 1, 1), ini = addDays(isoDate(first), -first.getDay());
  const nm = first.toLocaleDateString('pt-BR', {month:'long', year:'numeric'}), nomeM = nm.charAt(0).toUpperCase() + nm.slice(1);
  let cells = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'].map(d => `<div class="dw">${d}</div>`).join('');
  for(let i = 0; i < 42; i++){
    const d = addDays(ini, i), dd = parseD(d), wd = dd.getDay(), ev = eventosDia(d, tudo), tipos = [...new Set(ev.map(e => e.tipo))];
    const cls = ['d', d.slice(0, 7) !== calMes ? 'fora' : '', wd === 0 || wd === 6 ? 'fds' : '', holidays(dd.getFullYear()).has(d) ? 'fer' : '', d === t ? 'hoje' : '', d === (calSel || t) ? 'sel' : ''].filter(Boolean).join(' ');
    cells += `<div class="${cls}" data-act="calDia" data-d="${d}" title="${ev.length ? ev.length + ' item(ns) — clique para ver' : ''}"><span class="n">${dd.getDate()}</span><div class="dots">${tipos.map(k => `<i class="${COR_EV[k]}"></i>`).join('')}</div></div>`;
  }
  return `<div class="card" style="margin:0"><h2>${nomeM}<span class="sp"></span><button class="mini" data-act="calMes" data-d="-1" title="Mês anterior">‹</button><button class="mini" data-act="calMes" data-d="0">hoje</button><button class="mini" data-act="calMes" data-d="1" title="Próximo mês">›</button></h2>
    <div class="calGrid">${cells}</div>
    <div class="legenda">${Object.keys(COR_EV).filter(k => tudo || k === 'prazo' || k === 'aud').map(k => `<span><i class="${COR_EV[k]}"></i>${NOME_EV[k]}</span>`).join('')}<span style="color:var(--bad)">■ feriado nacional</span></div></div>`;
}
function blocoAgenda(tudo){
  const t = today(), d = calSel || t, ev = eventosDia(d, tudo), dt = parseD(d).toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long'});
  return `<div class="card agenda" style="margin:0"><h2>📅 Agenda do dia<span class="sp"></span><button class="mini" data-act="newPrazo" data-data="${d}">+ compromisso</button></h2>
    <div class="small muted" style="margin:-6px 0 6px">${d === t ? 'Hoje, ' : ''}${dt}${d !== t ? ` (${rel(d)})` : ''} · clique em um dia do calendário para ver a agenda dele</div>
    ${ev.length ? ev.map(e => `<div class="agItem"><div class="bar ${COR_EV[e.tipo]}"></div><div class="hr">${e.hora || '—'}</div><div class="grow"><b>${esc(e.titulo)}</b> <span class="tag grey">${NOME_EV[e.tipo]}</span><div class="small muted">${esc(e.sub || '')}</div></div>${e.btn || ''}</div>`).join('')
      : '<div class="empty">Nada agendado para este dia.</div>'}</div>`;
}
function formPersonalizar(){
  const c = painelCfg();
  const ck = (k, l) => { const [g, n] = k.split('.'); return `<label><input type="checkbox" data-pk="${k}" ${c[g][n] ? 'checked' : ''}> ${l}</label>`; };
  const sec = (t, itens) => `<div class="psec">${t}</div><div class="pgrid">${itens.map(([k, l]) => ck(k, l)).join('')}</div>`;
  openForm({ title:'⚙️ Personalizar área de trabalho', fields:[{type:'html', html:
    sec('Indicadores do topo', [['ind.atras','Prazos atrasados'], ['ind.hoje','Prazos para hoje'], ['ind.sem','Próximos 7 dias'], ['ind.ret','Retornos a clientes'], ['ind.leads','Leads em andamento'], ['ind.recMes','Honorários recebidos no mês'],
      ['ind.sCli','Valores de clientes a repassar'], ['ind.vencRec','A receber vencido'], ['ind.procAtivos','Processos ativos'], ['ind.exitos','Êxitos a apurar'], ['ind.prevMes','Recebimentos previstos no mês'], ['ind.semAnd','Processos sem andamento há 60 dias']]) +
    `<div class="psec">🔁 Reagendamento automático</div><label class="chk"><input type="checkbox" id="pReag" ${c.reag.ativo ? 'checked' : ''}> Passar para o dia seguinte o que não for concluído no dia</label>
    <div class="small muted" style="margin:4px 0 6px">Prazos processuais guardam o <b>prazo fatal</b> e ficam em vermelho se ele passar. Audiências e perícias normalmente não devem mudar de data sozinhas.</div>
    <div class="pgrid">${OPT.tipoPrazo.map(t => `<label><input type="checkbox" data-reag="${esc(t)}" ${c.reag.tipos[t] ? 'checked' : ''}> ${esc(t)}</label>`).join('')}</div>` +
    sec('Blocos da tela inicial', [['blocos.atalhos','Atalhos (registrar conversa, novo prazo…)'], ['blocos.hoje','Hoje + calendário + agenda do dia'], ['blocos.prazos','Prazos e compromissos (próximos 7 dias)'], ['blocos.retornos','Retornos combinados com clientes'],
      ['blocos.leads','Leads para contatar'], ['blocos.fin','Financeiro: vencidos e próximos 15 dias'], ['blocos.maior','Clientes atingindo a maioridade'], ['blocos.conversas','Últimas conversas']]) +
    `<div class="pgrid" style="margin-top:10px"><label>Quantidade de conversas exibidas: <select id="pNConv" style="width:auto;margin-left:6px">${opts([3, 5, 10].map(n => ({v:String(n), t:String(n)})), String(c.nConv))}</select></label>
      <label>Calendário mostra: <select id="pCal" style="width:auto;margin-left:6px">${opts([{v:'1', t:'tudo'}, {v:'0', t:'só prazos e audiências'}], c.calTudo ? '1' : '0')}</select></label></div>` +
    sec('Itens do menu lateral', [['menu.conversas','Atendimentos'], ['menu.agenda','Prazos e agenda'], ['menu.processos','Processos'], ['menu.pessoas','Clientes e partes'], ['menu.leads','Leads'], ['menu.financeiro','Financeiro'], ['menu.config','Backup e dados']]) +
    `<p class="small muted" style="margin-top:12px">As escolhas ficam salvas e valem para todos os seus aparelhos (sincronizadas pelo Dropbox). Para voltar ao padrão, <a href="#" id="pPadrao">clique aqui</a>.</p>`}],
    after: f => { f.querySelector('#pPadrao').onclick = e => { e.preventDefault(); f.querySelectorAll('[data-pk]').forEach(x => { const [g, n] = x.dataset.pk.split('.'); x.checked = !!PAINEL_PADRAO[g][n]; }); f.querySelector('#pNConv').value = '3'; f.querySelector('#pCal').value = '1'; }; },
    onSave: () => {
      const n = {ind:{}, blocos:{}, menu:{}};
      mForm.querySelectorAll('[data-pk]').forEach(x => { const [g, k] = x.dataset.pk.split('.'); n[g][k] = x.checked ? 1 : 0; });
      n.nConv = parseInt(mForm.querySelector('#pNConv').value, 10) || 3; n.calTudo = mForm.querySelector('#pCal').value === '1';
      if(!n.menu.config && !confirm('Você escondeu “Backup e dados” do menu. Ele continua acessível pelo link “Personalizar área de trabalho” → aqui, e pelo endereço #/config. Continuar?')) return false;
      n.reag = {ativo:mForm.querySelector('#pReag').checked, tipos:Object.fromEntries([...mForm.querySelectorAll('[data-reag]')].map(x => [x.dataset.reag, x.checked ? 1 : 0]))};
      db.meta.painel = n; save(); toast('Área de trabalho personalizada');
    } });
}
VIEWS.painel = () => {
  const t = today(), w = addDays(t, 7);
  const pend = db.prazos.filter(p => !p.concluido).sort(byDateAsc('data'));
  const atras = pend.filter(atrasado), hoje = pend.filter(p => p.data === t && !atrasado(p)), sem = pend.filter(p => p.data > t && p.data <= w && !atrasado(p));
  const ret = db.conversas.filter(c => c.proximaData && !c.retornoFeito).sort(byDateAsc('proximaData'));
  const retAtr = ret.filter(c => c.proximaData <= t);
  const leadsAt = db.leads.filter(l => !['Fechado','Perdido'].includes(l.status));
  const leadsF = leadsAt.filter(l => !l.proximoContato || l.proximoContato <= addDays(t, 2)).sort(byDateAsc('proximoContato'));
  const mes = t.slice(0, 7);
  const recMes = sum(db.financeiro.filter(l => isRec(l) && l.pagoEm && l.pagoEm.startsWith(mes)).map(realV));
  const sCli = saldoClientes();
  const finItems = [], seen = new Set();
  db.financeiro.filter(l => !l.pagoEm).sort(byDateAsc('vencimento')).forEach(l => {
    const isRep = l.categoria === CAT_REP && l.acordoId;
    if(isRep){ if(!parcRecebida(l.acordoId, l.parcela)) return; }
    else if(l.vencimento > addDays(t, 15)) return;
    if(l.acordoId && l.natureza === 'entrada'){
      const key = l.acordoId + '|' + l.parcela; if(seen.has(key)) return; seen.add(key);
      const g = acordoLanc(l.acordoId, l.parcela).filter(x => x.natureza === 'entrada' && !x.pagoEm), a = byId('acordos', l.acordoId);
      finItems.push({venc:l.vencimento, e:true, valor:sum(g.map(x => x.valor)), titulo:`${a?.descricao || 'Acordo'} — parcela ${l.parcela}/${a?.parcelas || '?'}`, pessoaId:l.pessoaId,
        btn:`<button class="mini" data-act="recParc" data-id="${l.acordoId}" data-k="${l.parcela}">receber</button>`});
    } else finItems.push({venc:l.vencimento, e:l.natureza === 'entrada', valor:l.valor, titulo:l.descricao, pessoaId:l.pessoaId,
      btn:`<button class="mini" data-act="payFin" data-id="${l.id}">${l.natureza === 'entrada' ? 'receber' : (l.categoria === CAT_REP ? 'repassar' : 'pagar')}</button>`});
  });
  const dt = new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  const vazio = !db.pessoas.length && !db.leads.length;
  const cfg = painelCfg(), I = cfg.ind, B = cfg.blocos;
  const ult = [...db.conversas].sort(byDateDesc('dataHora')).slice(0, cfg.nConv);
  const procAtivos = db.processos.filter(p => !INATIVOS.includes(p.status));
  const lim60 = addDays(t, -60);
  const semAnd = procAtivos.filter(p => { const ua = db.andamentos.filter(a => a.processoId === p.id).map(a => a.data).sort().pop(); return (ua || p.dataInicio || (p.criadoEm || '').slice(0, 10) || t) < lim60; });
  const vencRec = sum(db.financeiro.filter(l => l.natureza === 'entrada' && finStatus(l) === 'vencido').map(l => l.valor));
  const prevMes = sum(db.financeiro.filter(l => l.natureza === 'entrada' && !l.pagoEm && (l.vencimento || '').startsWith(mes)).map(l => l.valor));
  const nEx = exitosPend().length;
  const stat = (on, html) => on ? html : '';
  return `<h1>Início <small>${dt}</small></h1>
  ${vazio ? `<div class="card" style="border-color:var(--pri2)"><h2>👋 Bem-vindo!</h2>
    <p>Comece cadastrando um cliente ou um lead. Na ficha de cada cliente você registra as conversas, os processos, os prazos e os honorários.</p></div>` : ''}
  ${B.atalhos ? `<div class="quick">
    <button class="btn primary" data-act="newConv">💬 Registrar conversa</button>
    <button class="btn" data-act="newAnd">📄 Novo andamento</button>
    <button class="btn" data-act="newPrazo">📅 Novo prazo</button>
    <button class="btn" data-act="newPessoa">👤 Novo cliente</button>
    <button class="btn" data-act="newProc">📁 Novo processo</button>
    <button class="btn" data-act="newLead">🎯 Novo lead</button>
    <button class="btn" data-act="newAcordo">🤝 Novo acordo</button>
    <button class="btn" data-act="newFin">💰 Novo lançamento</button>
  </div>` : ''}
  ${rapidoHtml()}
  <div class="stats">
    ${(() => { const np = monNovas('publicacao').length, nm = monNovas('movimento').length; return np + nm ? `<a class="stat ${np ? 'warn' : ''}" href="#/publicacoes"><div class="n">${np}</div><div class="l">Publicações novas${nm ? ` · ${nm} movimentação(ões) a confirmar` : ''}</div></a>` : ''; })()}
    ${stat(I.atras, `<a class="stat ${atras.length ? 'bad' : ''}" href="#/agenda"><div class="n">${atras.length}</div><div class="l">Prazos atrasados</div></a>`)}
    ${stat(I.hoje, `<a class="stat ${hoje.length ? 'warn' : ''}" href="#/agenda"><div class="n">${hoje.length}</div><div class="l">Prazos para hoje</div></a>`)}
    ${stat(I.sem, `<a class="stat" href="#/agenda"><div class="n">${sem.length}</div><div class="l">Próximos 7 dias</div></a>`)}
    ${stat(I.ret, `<a class="stat ${retAtr.length ? 'bad' : ''}" href="#/conversas" data-act="filtroRet"><div class="n">${ret.length}</div><div class="l">Retornos a clientes${retAtr.length ? ` (${retAtr.length} vencidos)` : ''}</div></a>`)}
    ${stat(I.leads, `<a class="stat" href="#/leads"><div class="n">${leadsAt.length}</div><div class="l">Leads em andamento</div></a>`)}
    ${stat(I.recMes, `<a class="stat ok" href="#/financeiro"><div class="n" style="font-size:19px">${money(recMes)}</div><div class="l">Honorários recebidos no mês</div></a>`)}
    ${stat(I.sCli && sCli > 0.004, `<a class="stat warn" href="#/financeiro"><div class="n" style="font-size:19px">${money(sCli)}</div><div class="l">Valores de clientes em sua conta (a repassar)</div></a>`)}
    ${stat(I.vencRec, `<a class="stat ${vencRec ? 'bad' : ''}" href="#/financeiro"><div class="n" style="font-size:19px">${money(vencRec)}</div><div class="l">A receber — vencido</div></a>`)}
    ${stat(I.prevMes, `<a class="stat" href="#/financeiro"><div class="n" style="font-size:19px">${money(prevMes)}</div><div class="l">A receber ainda neste mês</div></a>`)}
    ${stat(I.procAtivos, `<a class="stat" href="#/processos"><div class="n">${procAtivos.length}</div><div class="l">Processos ativos</div></a>`)}
    ${stat(I.exitos, `<a class="stat ${nEx ? 'warn' : ''}" href="#/financeiro" data-act="tab" data-g="fin" data-tab="exitos"><div class="n">${nEx}</div><div class="l">Êxitos a apurar</div></a>`)}
    ${stat(I.semAnd, `<a class="stat ${semAnd.length ? 'warn' : ''}" href="#/processos"><div class="n">${semAnd.length}</div><div class="l">Processos sem andamento há 60 dias</div></a>`)}
  </div>
  ${B.hoje ? `<div class="hojeWrap">${blocoHoje()}${blocoCal(cfg.calTudo)}${blocoAgenda(cfg.calTudo)}</div>` : ''}
  ${B.prazos || B.retornos || B.leads || B.fin ? `<div class="grid2">
    ${B.prazos ? `<div class="card"><h2>📅 Prazos e compromissos<span class="sp"></span><a class="small" href="#/agenda">ver agenda</a></h2>
      ${[...atras, ...hoje, ...sem].map(p => prazoItem(p)).join('') || '<div class="empty">Nada atrasado nem para os próximos 7 dias. 👍</div>'}</div>` : ''}
    ${B.retornos ? `<div class="card"><h2>⏰ Retornos combinados com clientes<span class="sp"></span><a class="small" href="#/conversas" data-act="filtroRet">ver todos</a></h2>
      ${ret.slice(0, 10).map(c => `<div class="li ${c.proximaData < t ? 'late' : c.proximaData === t ? 'today' : ''}"><div class="grow"><b>${esc(c.proximaAcao || 'Retornar ao cliente')}</b>
        <div class="sub">${c.pessoaId ? linkP(c.pessoaId) : linkLead(c.leadId)} · até ${fmtD(c.proximaData)} (<b>${rel(c.proximaData)}</b>)${c.processoId ? ' · 📁 ' + linkProc(c.processoId) : ''}</div></div>
        <button class="mini" data-act="convDone" data-id="${c.id}">feito</button></div>`).join('') || '<div class="empty">Nenhum retorno pendente.</div>'}</div>` : ''}
    ${B.leads ? `<div class="card"><h2>🎯 Leads para contatar<span class="sp"></span><a class="small" href="#/leads">funil</a></h2>
      ${leadsF.slice(0, 8).map(l => `<div class="li ${l.proximoContato && l.proximoContato < t ? 'late' : ''}"><div class="grow"><b><a href="#/lead/${l.id}">${esc(l.nome)}</a></b> <span class="tag grey">${esc(l.status)}</span>
        <div class="sub">${l.proximoContato ? 'contato ' + rel(l.proximoContato) : 'sem data de contato definida'}${l.area ? ' · ' + esc(l.area) : ''}${l.telefone ? ' · ' + wa(l.telefone) : ''}</div></div></div>`).join('') || '<div class="empty">Nenhum lead aguardando contato.</div>'}</div>` : ''}
    ${B.fin ? `<div class="card"><h2>💰 Financeiro: vencidos, próximos 15 dias e repasses<span class="sp"></span><a class="small" href="#/financeiro">financeiro</a></h2>
      ${finItems.slice(0, 12).map(x => `<div class="li ${x.venc < t ? 'late' : ''}"><div class="grow"><b style="color:${x.e ? 'var(--ok)' : 'var(--bad)'}">${x.e ? '⬆' : '⬇'} ${money(x.valor)}</b> · ${esc(x.titulo)}
        <div class="sub">${linkP(x.pessoaId) || 'escritório'} · venc. ${fmtD(x.venc)} (${rel(x.venc)})</div></div>${x.btn}</div>`).join('') || '<div class="empty">Nada vencido, a vencer ou a repassar.</div>'}</div>` : ''}
  </div>` : ''}
  ${B.maior ? (() => { const lim = addDays(t, 120), ms = db.pessoas.filter(x => x.menor && x.nascimento && dataMaioridade(x.nascimento) <= lim).sort((a, b) => dataMaioridade(a.nascimento).localeCompare(dataMaioridade(b.nascimento)));
    return ms.length ? `<div class="card" style="margin-top:16px"><h2>👶 Clientes atingindo a maioridade (próximos 120 dias)</h2>${ms.map(x => { const d = dataMaioridade(x.nascimento);
      return `<div class="li ${d <= t ? 'late' : ''}"><div class="grow"><b>${linkP(x.id)}</b> — completa 18 anos em ${fmtD(d)} (<b>${rel(d)}</b>)<div class="sub">${esc(repTxt(x))}${d <= t ? ' · revise a representação no cadastro' : ''}</div></div></div>`; }).join('')}</div>` : ''; })() : ''}
  ${B.conversas ? `<div class="card" style="margin-top:16px"><h2>💬 Últimas conversas <span class="small muted" style="font-weight:400">(${cfg.nConv} mais recentes)</span><span class="sp"></span><a class="small" href="#/conversas">ver todas</a></h2>
    ${ult.map(c => convItem(c, {clamp:true})).join('') || '<div class="empty">Nenhuma conversa registrada ainda.</div>'}</div>` : ''}
  <div class="personalizar"><a href="#" data-act="personalizar">⚙️ Personalizar área de trabalho</a></div>`;
};

VIEWS.conversas = () => {
  listFn = () => {
    const f = F.conv, t = today();
    let l = db.conversas.filter(c => (!f.canal || c.canal === f.canal) && (!f.cat || c.categoria === f.cat) && (!f.ini || c.iniciadoPor === f.ini) && (!f.pend || (c.proximaData && !c.retornoFeito))
      && has(f.q, c.assunto, c.relato, c.proximaAcao, pessoaNome(c.pessoaId), byId('leads', c.leadId)?.nome, procLabel(byId('processos', c.processoId))));
    l.sort(f.pend ? byDateAsc('proximaData') : byDateDesc('dataHora'));
    document.getElementById('list').innerHTML = `<div class="muted small" style="margin-bottom:8px">${l.length} registro(s)</div>` + (l.slice(0, 300).map(c => convItem(c)).join('') || '<div class="empty">Nenhuma conversa encontrada.</div>');
  };
  return `<h1>💬 Atendimentos e conversas<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn primary" data-act="newConv">+ Registrar conversa</button></h1>
  <div class="toolbar"><input type="search" data-f="conv.q" value="${esc(F.conv.q)}" placeholder="Filtrar por cliente, assunto, conteúdo…">
    <select data-f="conv.canal"><option value="">Todos os canais</option>${opts(OPT.canal, F.conv.canal)}</select>
    <select data-f="conv.cat"><option value="">Todas as categorias</option>${opts(OPT.catAtend, F.conv.cat)}</select>
    <select data-f="conv.ini">${opts([{v:'', t:'Iniciado por qualquer um'}, {v:'cliente', t:'Iniciado pelo cliente'}, {v:'escritorio', t:'Iniciado pelo escritório'}], F.conv.ini)}</select>
    <label class="chk"><input type="checkbox" data-f="conv.pend" ${F.conv.pend ? 'checked' : ''}> Só retornos pendentes</label></div>
  <div id="list"></div>`;
};

let agMes = null, agSem = null, agCalVis = 'mes';
const PALETA_AREA = ['#2d6aa3','#2e9d5a','#8e6bbf','#d9a400','#d35400','#c0392b','#16a085','#7f8c8d','#b03a7c','#2c3e50'];
const corArea = a => { const i = OPT.area.indexOf(a); return a ? PALETA_AREA[(i >= 0 ? i : a.length) % PALETA_AREA.length] : '#5b7c99'; };
const corTipo = p => p.concluido ? '#9aa5b1' : ['Audiência','Perícia'].includes(p.tipo) ? '#d48806' : p.tipo === 'Prazo processual' ? '#c0392b' : p.tipo === 'Reunião' ? '#8e6bbf' : '#5b7c99';
function filtroAgenda(usarPeriodo, ignorarSit){
  const f = F.ag, t = today();
  let ini = '', fim = '';
  if(usarPeriodo){
    if(f.per === 'hoje'){ ini = fim = t; }
    else if(f.per === 'semana'){ ini = addDays(t, -parseD(t).getDay()); fim = addDays(ini, 6); }
    else if(f.per === 'mes'){ ini = t.slice(0, 8) + '01'; fim = addDays(addMonths(ini, 1), -1); }
    else if(f.per === 'prox30'){ ini = t; fim = addDays(t, 30); }
    else if(f.per === 'pers'){ ini = f.de; fim = f.ate; }
  }
  return db.prazos.filter(p => {
    if(!ignorarSit && f.sit === 'pend' && p.concluido) return false;
    if(!ignorarSit && f.sit !== 'pend' && f.sit !== 'todas' && (p.situacao || (p.concluido ? 'Realizado' : 'Pendente')) !== f.sit) return false;
    if(f.tipo && p.tipo !== f.tipo) return false;
    if(f.atras && !atrasado(p)) return false;
    if(f.area && byId('processos', p.processoId)?.area !== f.area) return false;
    if((ini || fim) && (!p.data || (ini && p.data < ini) || (fim && p.data > fim))) return false;
    const pr = byId('processos', p.processoId);
    return has(f.q, p.titulo, p.obs, p.local, p.subtipo, pessoaNome(p.pessoaId), pessoaNome(pr?.clienteId), procLabel(pr));
  });
}
VIEWS.agenda = () => {
  const f = F.ag, t = today(), vis = f.vis;
  const seg = (k, l) => `<button class="${vis === k ? 'on' : ''}" data-act="agVis" data-v="${k}">${l}</button>`;
  const filtros = `<div class="card" style="padding:12px"><div class="toolbar" style="margin:0">
    <input type="search" data-f="ag.q" value="${esc(F.ag.q)}" placeholder="Cliente, processo, pasta, descrição…">
    ${vis === 'lista' ? `<select data-f="ag.per">${opts([{v:'todos', t:'Período: todos'}, {v:'hoje', t:'Hoje'}, {v:'semana', t:'Esta semana'}, {v:'mes', t:'Este mês'}, {v:'prox30', t:'Próximos 30 dias'}, {v:'pers', t:'Personalizado…'}], f.per)}</select>
      ${f.per === 'pers' ? `<input type="date" data-f="ag.de" value="${esc(f.de)}" title="De"><input type="date" data-f="ag.ate" value="${esc(f.ate)}" title="Até">` : ''}` : ''}
    <select data-f="ag.tipo"><option value="">Tipo: todos</option>${opts(OPT.tipoPrazo, f.tipo)}</select>
    ${vis !== 'quadro' ? `<select data-f="ag.sit">${opts([{v:'pend', t:'Situação: pendentes'}, ...OPT.situacao.filter(x => x !== 'Pendente').map(x => ({v:x, t:x + 's'})), {v:'todas', t:'Todas as situações'}], f.sit)}</select>` : ''}
    <select data-f="ag.area"><option value="">Todas as áreas</option>${opts(OPT.area, f.area)}</select>
    <label class="chk"><input type="checkbox" data-f="ag.atras" ${f.atras ? 'checked' : ''}> só atrasados</label>
    ${vis === 'quadro' ? `<label class="chk"><input type="checkbox" data-f="ag.mostrarConc" ${f.mostrarConc ? 'checked' : ''}> mostrar concluídos</label>` : ''}
    <button class="btn" data-act="agLimpar">Limpar filtros</button></div></div>`;
  const head = `<h1>📅 Prazos e agenda<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn primary" data-act="newPrazo">+ Novo compromisso / tarefa</button></h1>${rapidoHtml()}
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px"><div class="seg">${seg('lista', '☰ Lista')}${seg('cal', '🗓️ Calendário')}${seg('quadro', '▦ Quadro')}</div>
    ${vis === 'quadro' ? '<span class="sp"></span><a class="btn" href="#/listas/colunas">⚙️ Editar colunas</a>' : ''}</div>${filtros}`;
  listFn = () => {
    const el = document.getElementById('list');
    if(vis === 'cal') el.innerHTML = agendaCal(); else if(vis === 'quadro') el.innerHTML = agendaQuadro(); else el.innerHTML = agendaLista();
    updateBulk();
  };
  return head + '<div id="list"></div>';
};
function agendaLista(){
  const f = F.ag, t = today(), l = filtroAgenda(true);
  let html = '';
  if(f.sit === 'pend'){
    const comData = l.filter(p => p.data).sort((a, b) => a.data.localeCompare(b.data) || (a.hora || '99').localeCompare(b.hora || '99')), semData = l.filter(p => !p.data);
    const g = [['🔴 Atrasados', p => atrasado(p)], ['🟠 Hoje', p => p.data === t && !atrasado(p)], ['Amanhã', p => p.data === addDays(t, 1) && !atrasado(p)],
      ['Próximos 7 dias', p => p.data > addDays(t, 1) && p.data <= addDays(t, 7)], ['Próximos 30 dias', p => p.data > addDays(t, 7) && p.data <= addDays(t, 30)], ['Mais adiante', p => p.data > addDays(t, 30)]];
    html = g.map(([n, fn]) => { const it = comData.filter(fn); return it.length ? `<div class="card"><h2>${n} <span class="tag grey">${it.length}</span><span class="sp"></span><label class="chk small"><input type="checkbox" data-pselall> selecionar</label></h2>${it.map(p => prazoItem(p, {obs:true, sel:true})).join('')}</div>` : ''; }).join('')
      + (semData.length ? `<div class="card"><h2>📌 Sem data <span class="tag grey">${semData.length}</span><span class="sp"></span><label class="chk small"><input type="checkbox" data-pselall> selecionar</label></h2>${semData.map(p => prazoItem(p, {obs:true, sel:true})).join('')}</div>` : '');
  } else { const it = [...l].sort((a, b) => (b.data || '').localeCompare(a.data || '')).slice(0, 400);
    html = it.length ? `<div class="card"><h2>${it.length} compromisso(s)<span class="sp"></span><label class="chk small"><input type="checkbox" data-pselall> selecionar</label></h2>${it.map(p => prazoItem(p, {obs:true, sel:true})).join('')}</div>` : ''; }
  return html || '<div class="card empty">Nenhum compromisso encontrado.</div>';
}
function agendaCal(){
  const t = today(), l = filtroAgenda(false).filter(p => p.data);
  const chip = (p, quebra) => `<span class="chip" data-act="editPrazo" data-id="${p.id}" style="background:${corTipo(p)}${quebra ? ';white-space:normal' : ''}" title="${esc(p.titulo + (p.local ? ' — ' + p.local : ''))}">${p.diaInteiro ? '' : (p.hora || '')} ${esc(procCode(byId('processos', p.processoId)))} ${esc(p.titulo)}</span>`;
  const doDia = d => l.filter(p => p.data === d || (p.dataFim && p.data < d && p.dataFim >= d)).sort((a, b) => (a.hora || '00').localeCompare(b.hora || '00'));
  const nav = `<button class="mini" data-act="agNav" data-d="-1">‹ anterior</button><button class="mini" data-act="agNav" data-d="0">hoje</button><button class="mini" data-act="agNav" data-d="1">próximo ›</button>`;
  const segV = `<div class="seg"><button class="${agCalVis === 'semana' ? 'on' : ''}" data-act="agCalVis" data-v="semana">Semana</button><button class="${agCalVis === 'mes' ? 'on' : ''}" data-act="agCalVis" data-v="mes">Mês</button></div>`;
  const leg = `<div class="legenda" style="margin-top:10px"><span><i style="background:#c0392b"></i>Prazo processual</span><span><i style="background:#d48806"></i>Audiência / perícia</span><span><i style="background:#8e6bbf"></i>Reunião</span><span><i style="background:#5b7c99"></i>Outros</span><span><i style="background:#9aa5b1"></i>Concluído</span><span>· clique num dia vazio para criar</span></div>`;
  if(agCalVis === 'semana'){
    agSem = agSem || addDays(t, -parseD(t).getDay());
    const dias = Array.from({length:7}, (_, i) => addDays(agSem, i));
    const tit = `${fmtD(dias[0]).slice(0, 5)} a ${fmtD(dias[6])}`;
    return `<div class="card"><h2>${nav}<span class="sp"></span>Semana de ${tit}<span class="sp"></span>${segV}</h2>
      <div class="bigCal">${dias.map(d => { const dd = parseD(d); return `<div class="h">${dd.toLocaleDateString('pt-BR', {weekday:'short'})} ${dd.getDate()}</div>`; }).join('')}
      ${dias.map(d => `<div class="c ${d === t ? 'hoje' : ''}" style="min-height:300px" data-act="agDia" data-d="${d}">${doDia(d).map(p => chip(p, true)).join('')}</div>`).join('')}</div>${leg}</div>`;
  }
  agMes = agMes || t.slice(0, 7);
  const [y, m] = agMes.split('-').map(Number), first = new Date(y, m - 1, 1), ini = addDays(isoDate(first), -first.getDay());
  const nm = first.toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  const semanas = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  let cells = ['dom','seg','ter','qua','qui','sex','sáb'].map(d => `<div class="h">${d}</div>`).join('');
  for(let i = 0; i < semanas * 7; i++){ const d = addDays(ini, i), dd = parseD(d), its = doDia(d);
    cells += `<div class="c ${d.slice(0, 7) !== agMes ? 'fora' : ''} ${d === t ? 'hoje' : ''} ${holidays(dd.getFullYear()).has(d) ? 'fer' : ''}" data-act="agDia" data-d="${d}"><div class="dn">${d === t ? '<b>' + dd.getDate() + '</b>' : dd.getDate()}</div>${its.slice(0, 4).map(p => chip(p)).join('')}${its.length > 4 ? `<span class="small muted">+${its.length - 4} mais</span>` : ''}</div>`; }
  return `<div class="card"><h2>${nav}<span class="sp"></span>${nm.charAt(0).toUpperCase() + nm.slice(1)}<span class="sp"></span>${segV}</h2><div class="bigCal">${cells}</div>${leg}</div>`;
}
function agendaQuadro(){
  const f = F.ag, t = today(), cols = colunas().filter(c => !c.oculto);
  const l = filtroAgenda(false, true), vis = f.mostrarConc ? l.filter(p => p.situacao !== 'Redesignado') : l.filter(p => !p.concluido);
  const card = p => { const pr = byId('processos', p.processoId), cli = pessoaNome(p.pessoaId || pr?.clienteId), late = atrasado(p);
    const ck = (p.checklist || []).length ? `<span class="${p.checklist.every(c => c.ok) ? 'due ok' : 'due n'}">☑ ${p.checklist.filter(c => c.ok).length}/${p.checklist.length}</span>` : '';
    const ci = cols.findIndex(c => c.id === colunaDe(p));
    return `<div class="kcd ${p.concluido ? 'feito' : ''}" draggable="true" data-pcard="${p.id}">
      <div style="display:flex;gap:6px;align-items:flex-start"><div class="lb" style="background:${corArea(pr?.area)}" title="${esc(pr?.area || 'sem processo')}"></div><span class="sp"></span>
        ${p.concluido ? `<button class="mini kbtn" data-act="prazoReabrir" data-id="${p.id}" title="Desfazer a conclusão">↩ desfazer</button>` : `<button class="mini kbtn" data-act="prazoConcluir" data-id="${p.id}" title="Marcar como concluído">✔</button>`}</div>
      <div class="ktit" data-act="editPrazo" data-id="${p.id}">${pr ? `<b>${esc(procCode(pr) || '')}</b> · ` : ''}${cli ? esc(cli) + ' — ' : ''}${esc(p.titulo)}</div>
      <div class="meta">${p.data ? `<span class="due ${p.concluido ? 'ok' : late ? 'late' : 'n'}">🕑 ${parseD(p.data).toLocaleDateString('pt-BR', {day:'numeric', month:'short'})}${p.hora && !p.diaInteiro ? ' ' + p.hora : ''}</span>` : '<span class="due n">sem data</span>'}
        ${p.subtipo ? `<span class="due n">⚖️ ${esc(p.subtipo)}</span>` : ''}${ck}${p.dataFatal && !p.concluido ? `<span class="due ${p.dataFatal < t ? 'late' : 'n'}" title="Prazo fatal">⚠️ fatal ${parseD(p.dataFatal).toLocaleDateString('pt-BR', {day:'numeric', month:'short'})}</span>` : ''}${p.reagendadoDe && !p.concluido && p.reagendadoDe !== p.data ? `<span class="due n" title="Reagendado de ${fmtD(p.reagendadoDe)}">🔁${p.reagendamentos > 1 ? p.reagendamentos + '×' : ''}</span>` : ''}${agendaDesatualizada(p) || clienteDesatualizado(p) ? '<span class="due late" title="A data mudou — atualizar agenda / avisar cliente">⚠️ data mudou</span>' : ''}
        <span class="sp"></span>${ci > 0 ? `<button class="mini kbtn" data-act="pMove" data-id="${p.id}" data-dir="-1" title="Coluna anterior">◀</button>` : ''}${ci < cols.length - 1 ? `<button class="mini kbtn" data-act="pMove" data-id="${p.id}" data-dir="1" title="Próxima coluna">▶</button>` : ''}</div></div>`; };
  const areas = [...new Set(vis.map(p => byId('processos', p.processoId)?.area).filter(Boolean))];
  return `<div class="kb" style="grid-template-columns:repeat(${cols.length},minmax(210px,1fr))">${cols.map(c => { const it = vis.filter(p => colunaDe(p) === c.id).sort((a, b) => (a.concluido - b.concluido) || (a.data || '9999').localeCompare(b.data || '9999'));
      return `<div class="kbc pcol" data-colid="${esc(c.id)}"><h3><span>${esc(c.v)}</span><span>${it.filter(p => !p.concluido).length}</span></h3>${it.map(card).join('')}<div class="kbadd" data-act="newPrazo" data-coluna="${esc(c.id)}">＋ Adicionar cartão</div></div>`; }).join('')}</div>
    <div class="legenda" style="margin-top:8px">${areas.map(a => `<span><i style="background:${corArea(a)}"></i>${esc(a)}</span>`).join('')}<span>· arraste os cartões entre as colunas (ou use ◀ ▶) — mover não altera data nem situação · ✔ conclui</span></div>`;
}

VIEWS.pessoas = () => {
  listFn = () => {
    const f = F.pes;
    const l = db.pessoas.filter(p => (!f.tipo || p.tipo === f.tipo) && has(f.q, p.nome, p.doc, digits(p.doc), p.telefone, p.email, p.pasta, nomesReps(p)));
    const byNome = (a, b) => a.nome.localeCompare(b.nome, 'pt-BR');
    l.sort(f.ord === 'nome' ? byNome : f.ord === 'pasta_desc' ? (a, b) => (isNaN(parseInt(a.pasta, 10)) - isNaN(parseInt(b.pasta, 10))) || cmpPasta(b.pasta, a.pasta) || byNome(a, b) : (a, b) => cmpPasta(a.pasta, b.pasta) || byNome(a, b));
    document.getElementById('list').innerHTML = l.length ? `<div class="card tablewrap"><table><thead><tr><th>Pasta</th><th>Nome</th><th>Tipo</th><th>Contato</th><th>Processos</th><th>Cliente desde</th><th>Última conversa</th></tr></thead><tbody>
      ${l.map(p => { const np = db.processos.filter(x => envolve(x, p.id)).length;
        const uc = db.conversas.filter(c => c.pessoaId === p.id).sort(byDateDesc('dataHora'))[0];
        return `<tr data-href="#/pessoa/${p.id}"><td><b>${esc(p.pasta || '')}</b></td><td><b>${esc(p.nome)}</b>${p.menor ? ' <span class="tag warn">👶 menor/incapaz</span>' : ''}${p.doc ? `<div class="small muted">${esc(p.doc)}</div>` : ''}${p.menor ? `<div class="small muted">${esc(repTxt(p))}</div>` : ''}</td><td><span class="tag ${p.tipo === 'Cliente' ? '' : 'grey'}">${esc(p.tipo)}</span></td>
        <td class="small">${esc(p.telefone || '')}${p.email ? '<br>' + esc(p.email) : ''}</td><td>${np || ''}</td><td class="small nowrap">${fmtD(p.dataContratacao)}</td>
        <td class="small">${uc ? fmtD(uc.dataHora) + ' (' + rel(uc.dataHora.slice(0, 10)) + ')' : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="card empty">Ninguém encontrado.</div>';
  };
  return `<h1>👤 Clientes e partes<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn primary" data-act="newPessoa">+ Nova pessoa</button></h1>
  <div class="toolbar"><input type="search" data-f="pes.q" value="${esc(F.pes.q)}" placeholder="Nome, nº da pasta, CPF/CNPJ, telefone…">
    <select data-f="pes.tipo"><option value="">Todos os tipos</option>${opts(OPT.tipoPessoa, F.pes.tipo)}</select>
    <select data-f="pes.ord">${opts([{v:'pasta', t:'Ordem: pasta (crescente)'}, {v:'pasta_desc', t:'Ordem: pasta (mais recentes)'}, {v:'nome', t:'Ordem: nome'}], F.pes.ord)}</select></div><div id="list"></div>`;
};

VIEWS.pessoa = id => {
  const p = byId('pessoas', id); if(!p) return notFound();
  const convs = db.conversas.filter(c => c.pessoaId === id).sort(byDateDesc('dataHora'));
  const procs = db.processos.filter(x => envolve(x, id))
    .sort((a, b) => ((a.clienteId === id ? 0 : 1) - (b.clienteId === id ? 0 : 1)) || ((parseInt(a.seq, 10) || 999) - (parseInt(b.seq, 10) || 999)));
  const prz = db.prazos.filter(x => !x.concluido && (x.pessoaId === id || procs.some(pr => pr.id === x.processoId && pr.clienteId === id))).sort(byDateAsc('data'));
  const fin = db.financeiro.filter(l => l.pessoaId === id).sort(byDateAsc('vencimento')), avulsos = fin.filter(l => !l.acordoId);
  const acs = db.acordos.filter(a => a.pessoaId === id).sort(byDateDesc('data'));
  const lead = db.leads.find(l => l.pessoaId === id);
  const tel = [p.telefone, p.telefone2].filter(Boolean).map(t => esc(t) + ' ' + wa(t)).join('<br>');
  const idd = idade(p.nascimento), repsP = repsDe(p), repDe = representados(id);
  const alertaMaior = p.menor && p.nascimento ? (idd >= 18 ? `<div class="bn" style="margin:0 0 16px"><span>⚠️ ${esc(p.nome)} completou 18 anos em ${fmtD(dataMaioridade(p.nascimento))}. Revise a representação e atualize o cadastro (desmarque “menor/incapaz” se for o caso).</span></div>`
    : `<div class="bn ok" style="margin:0 0 16px;background:var(--priSoft);color:var(--pri)"><span>👶 Menor de idade (${idd} anos) — completa 18 anos em <b>${fmtD(dataMaioridade(p.nascimento))}</b> (${rel(dataMaioridade(p.nascimento))}).</span></div>`) : '';
  return `${alertaMaior}<h1>${esc(p.nome)} <span class="tag">${esc(p.tipo)}</span>${p.menor ? ` <span class="tag warn">👶 ${idd != null && idd >= 16 && idd < 18 ? 'relativamente incapaz' : 'menor / incapaz'}</span>` : ''}${p.pasta ? ` <span class="tag warn">📂 Pasta ${esc(p.pasta)}</span>` : ''}<span class="sp"></span>
    <button class="btn primary" data-act="newConv" data-pessoa="${id}">💬 Registrar conversa</button>
    <button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn" data-act="editPessoa" data-id="${id}">Editar dados</button></h1>
  <div class="card"><div class="info">
    ${info('Pasta', p.pasta ? '<b>' + esc(p.pasta) + '</b>' : '')}${info('Cliente desde', p.dataContratacao ? fmtD(p.dataContratacao) : '')}
    ${info('CPF / CNPJ', esc(p.doc))}${info('Telefone', tel)}${info('E-mail', p.email ? `<a href="mailto:${esc(p.email)}">${esc(p.email)}</a>` : '')}
    ${info('Nascimento', p.nascimento ? fmtD(p.nascimento) : '')}${info('RG', esc(p.rg))}${info('Profissão', esc(p.profissao))}${info('Estado civil', esc(p.estadoCivil))}
    ${p.menor ? info('Representação legal', repsP.length ? repsP.map(r => { const rp = byId('pessoas', r.pessoaId);
        return `${linkP(r.pessoaId)} <span class="muted small">(${esc(r.relacao || '')})</span>${rp.telefone ? ' · ' + esc(rp.telefone) + ' ' + wa(rp.telefone) : ''}${rp.doc ? ' · CPF ' + esc(rp.doc) : ''}`; }).join('<br>') : '<span style="color:var(--bad)">representante não informado — clique em “Editar dados”</span>', true) : ''}
    ${repDe.length ? info('Representante legal de', repDe.map(x => `${linkP(x.id)} <span class="muted small">(${esc((x.representantes.find(r => r.pessoaId === id) || {}).relacao || '')}${x.nascimento ? ', ' + idade(x.nascimento) + ' anos' : ''})</span>${x.pasta ? ` <span class="tag warn">pasta ${esc(x.pasta)}</span>` : ''}`).join('<br>'), true) : ''}
    ${info('Indicado por', esc(p.indicacao))}${info('Origem', lead ? linkLead(lead.id) : '')}${info('Endereço', esc(p.endereco), true)}${info('Observações', nl2br(p.obs), true)}
    ${!p.doc && !tel && !p.email && !p.endereco ? '<div class="muted small">Dados cadastrais incompletos — clique em “Editar dados”.</div>' : ''}
  </div></div>
  <div class="cols">
    <div class="card"><h2>💬 Histórico de conversas <span class="tag grey">${convs.length}</span><span class="sp"></span><button class="mini" data-act="newConv" data-pessoa="${id}">+ registrar</button></h2>
      ${convs.map(c => convItem(c, {noPessoa:true})).join('') || '<div class="empty">Nenhuma conversa registrada com esta pessoa.</div>'}</div>
    <div class="stack">
      <div class="card"><h2>📁 Processos <span class="tag grey">${procs.length}</span><span class="sp"></span><button class="mini" data-act="newProc" data-pessoa="${id}">+ novo</button></h2>
        ${procs.map(pr => `<div class="li"><div class="grow">${pr.clienteId === id && procCode(pr) ? `<span class="tag warn">${esc(procCode(pr))}</span> ` : ''}<b><a href="#/processo/${pr.id}">${esc(pr.titulo || 's/ título')}</a></b> <span class="tag ${INATIVOS.includes(pr.status) ? 'grey' : 'ok'}">${esc(pr.status || '')}</span>
          ${pr.clienteId === id && contratoResumo(pr) ? `<div class="sub">💰 ${esc(contratoResumo(pr))}</div>` : ''}<div class="sub">${esc(pr.numero || 's/ nº')}${(() => { const pp = papelNoProcesso(pr, id), cn = esc(pessoaNome(pr.clienteId));
            if(pp === 'cliente') return nomesContrarios(pr).length ? ' · x ' + esc(nomesContrarios(pr).join(', ')) : '';
            const xr = (pr.partes || []).find(y => y.pessoaId === id), de = xr && xr.polo === 'representante' && xr.representaId ? ' de ' + esc(pessoaNome(xr.representaId)) : '';
            if(pp === 'testemunha'){ const tt = (pr.testemunhas || []).find(y => y.pessoaId === id); return ` · <b>testemunha</b>${tt?.arroladaPor ? ' (arrolada por: ' + esc(tt.arroladaPor.toLowerCase()) + ')' : ''} — cliente: ${cn}`; }
            return ' · <b>' + ({contraria:'parte contrária', litisconsorte:'litisconsorte do cliente'}[pp] || esc((POLO_LBL[pp] || 'participante').toLowerCase())) + de + '</b> (cliente: ' + cn + ')'; })()}${pr.dataInicio && pr.clienteId === id ? ' · desde ' + fmtD(pr.dataInicio) : ''}</div></div></div>`).join('') || '<div class="empty">Nenhum processo.</div>'}</div>
      <div class="card"><h2>📅 Prazos pendentes<span class="sp"></span><button class="mini" data-act="newPrazo" data-pessoa="${id}">+ novo</button></h2>
        ${prz.map(x => prazoItem(x, {noPessoa:true})).join('') || '<div class="empty">Nenhum prazo pendente.</div>'}</div>
    </div>
  </div>
  <div class="card"><h2>💰 Financeiro<span class="sp"></span><button class="mini" data-act="newAcordo" data-pessoa="${id}">+ acordo / condenação</button> <button class="mini" data-act="newFin" data-pessoa="${id}">+ lançamento</button></h2>
    ${fin.length ? finResumo(fin) : ''}
    ${acs.length ? `<h2 style="margin-top:6px">🤝 Acordos e condenações</h2>${acs.map(acordoItem).join('')}` : ''}
    ${avulsos.length || !acs.length ? `<h2 style="margin-top:14px">Lançamentos avulsos</h2>${finTable(avulsos, {noPessoa:true})}` : ''}
  </div>`;
};

VIEWS.processos = () => {
  listFn = () => {
    const f = F.proc, t = today();
    const l = db.processos.filter(p => (f.status === 'todos' || (f.status === 'ativos' ? !INATIVOS.includes(p.status) : p.status === f.status)) && (!f.area || p.area === f.area)
      && has(f.q, procCode(p), p.numero, digits(p.numero), p.titulo, pessoaNome(p.clienteId), nomesPartes(p), p.vara, p.comarca, p.tribunal, p.sistema, p.outrasPartes));
    const pasta = p => byId('pessoas', p.clienteId)?.pasta, sq = (a, b) => (parseInt(a.seq, 10) || 0) - (parseInt(b.seq, 10) || 0);
    l.sort(f.ord === 'cliente' ? (a, b) => pessoaNome(a.clienteId).localeCompare(pessoaNome(b.clienteId), 'pt-BR') || sq(a, b) : (a, b) => cmpPasta(pasta(a), pasta(b)) || pessoaNome(a.clienteId).localeCompare(pessoaNome(b.clienteId), 'pt-BR') || sq(a, b));
    document.getElementById('list').innerHTML = l.length ? `<div class="card tablewrap"><table><thead><tr><th>Pasta</th><th>Ação / Número</th><th>Cliente</th><th>Parte contrária</th><th>Juízo</th><th>Situação</th><th>Próximo prazo</th></tr></thead><tbody>
      ${l.map(p => { const nx = db.prazos.filter(x => x.processoId === p.id && !x.concluido && x.data).sort(byDateAsc('data'))[0];
        return `<tr data-href="#/processo/${p.id}"><td class="nowrap"><b>${esc(procCode(p)) || '<span class="muted">—</span>'}</b></td><td><b>${esc(p.titulo || '')}</b>${p.principalId || db.processos.some(x => x.principalId === p.id) ? ` <span class="tag" title="${esc(p.principalId ? (p.tipoVinculo || 'Vinculado') + ' de ' + procLabel(byId('processos', p.principalId)) : 'Tem processos vinculados')}">🔗 ${esc(p.principalId ? (p.tipoVinculo || 'vinculado') : 'principal')}</span>` : ''}<div class="small muted">${esc(p.numero || 's/ nº')}${p.area ? ' · ' + esc(p.area) : ''}</div></td>
        <td>${esc(pessoaNome(p.clienteId))}${p.posicao ? `<div class="small muted">${esc(p.posicao)}</div>` : ''}</td><td>${(() => { const n = nomesContrarios(p); return esc(n.slice(0, 2).join(', ')) + (n.length > 2 ? ` <span class="muted small">+${n.length - 2}</span>` : ''); })()}</td>
        <td class="small">${esc([p.vara, p.comarca].filter(Boolean).join(' · '))}${p.tribunal || p.sistema ? `<div class="muted">${esc([p.tribunal, p.sistema].filter(Boolean).join(' · '))}</div>` : ''}</td>
        <td><span class="tag ${INATIVOS.includes(p.status) ? 'grey' : 'ok'}">${esc(p.status || '')}</span></td>
        <td class="small">${nx ? `<b style="color:${nx.data < t ? 'var(--bad)' : nx.data === t ? 'var(--warn)' : 'inherit'}">${fmtD(nx.data)}</b><div class="muted">${esc(nx.titulo)}</div>` : '<span class="muted">—</span>'}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<div class="card empty">Nenhum processo encontrado.</div>';
  };
  const nImp = db.importar.filter(i => i.status === 'pendente').length;
  return `<h1>📁 Processos<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><a class="btn" href="#/importar">📥 Importar da OAB${nImp ? ` (${nImp})` : ''}</a><button class="btn primary" data-act="newProc">+ Novo processo</button></h1>
  <div class="toolbar"><input type="search" data-f="proc.q" value="${esc(F.proc.q)}" placeholder="Pasta (ex.: 152.2), número, ação, cliente, parte contrária…">
    <select data-f="proc.status">${opts([{v:'ativos', t:'Em andamento'}, {v:'todos', t:'Todos'}, ...OPT.statusProc.map(s => ({v:s, t:s}))], F.proc.status)}</select>
    <select data-f="proc.area"><option value="">Todas as áreas</option>${opts(OPT.area, F.proc.area)}</select>
    <select data-f="proc.ord">${opts([{v:'pasta', t:'Ordem: pasta'}, {v:'cliente', t:'Ordem: cliente'}], F.proc.ord)}</select></div><div id="list"></div>`;
};

VIEWS.processo = id => {
  const p = byId('processos', id); if(!p) return notFound();
  const convs = db.conversas.filter(c => c.processoId === id).sort(byDateDesc('dataHora'));
  const ands = db.andamentos.filter(a => a.processoId === id).sort(byDateDesc('data'));
  const prz = db.prazos.filter(x => x.processoId === id).sort((a, b) => (a.concluido - b.concluido) || (a.concluido ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data)));
  const fin = db.financeiro.filter(l => l.processoId === id).sort(byDateAsc('vencimento')), avulsos = fin.filter(l => !l.acordoId);
  const acs = db.acordos.filter(a => a.processoId === id).sort(byDateDesc('data'));
  const tab = tabs.proc === 'hon' ? 'fin' : tabs.proc;
  const code = procCode(p);
  const T = (k, l, n) => `<button data-act="tab" data-g="proc" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n != null ? ` (${n})` : ''}</button>`;
  let body = '';
  if(tab === 'conv') body = `<div class="toolbar"><button class="btn primary" data-act="newConv" data-pessoa="${p.clienteId}" data-proc="${id}">💬 Registrar conversa</button></div>` + (convs.map(c => convItem(c, {noProc:true})).join('') || '<div class="empty">Nenhuma conversa vinculada a este processo.</div>');
  if(tab === 'and') body = `<div class="toolbar"><button class="btn primary" data-act="newAnd" data-proc="${id}">📄 Novo andamento</button>${digits(p.numero).length === 20 ? `<button class="btn" data-act="navHist" data-id="${id}" title="Copia as instruções para o Claude no Chrome trazer todas as movimentações deste processo do site do tribunal">🌐 Histórico completo pelo navegador</button>` : ''}</div>` + (ands.map(andItem).join('') || '<div class="empty">Nenhum andamento registrado.</div>');
  if(tab === 'prz') body = `<div class="toolbar"><button class="btn primary" data-act="newPrazo" data-proc="${id}" data-pessoa="${p.clienteId}">📅 Novo prazo</button></div>` + (prz.map(x => prazoItem(x, {noProc:true, obs:true})).join('') || '<div class="empty">Nenhum prazo.</div>');
  if(tab === 'fin') body = contratoCard(p) + `<div class="toolbar"><button class="btn primary" data-act="newAcordo" data-pessoa="${p.clienteId}" data-proc="${id}">🤝 Novo acordo / condenação</button><button class="btn" data-act="newFin" data-pessoa="${p.clienteId}" data-proc="${id}">💰 Novo lançamento</button></div>`
    + (fin.length ? finResumo(fin) : '') + (acs.length ? acs.map(acordoItem).join('') + '<div style="height:12px"></div>' : '') + (avulsos.length || !acs.length ? finTable(avulsos, {noPessoa:true, noProc:true}) : '');
  if(tab === 'test') body = abaTestemunhas(p);
  if(tab === 'tudo'){
    const fam = procFamilia(p), comVinc = fam.length > 1 && tabs.procVinc !== false;
    const doProc = (pr, eu) => { const rot = eu ? '' : `<div class="tl-vinc">🔗 ${esc(rotuloVinculo(pr))} · <a href="#/processo/${pr.id}">${esc(procLabel(pr))}</a></div>`;
      return [...db.conversas.filter(c => c.processoId === pr.id).map(c => ({d:c.dataHora, h:rot + convItem(c, {noProc:true})})), ...db.andamentos.filter(a => a.processoId === pr.id).map(a => ({d:a.data, h:rot + andItem(a)}))]; };
    const all = (comVinc ? fam : [p]).flatMap(pr => doProc(pr, pr.id === id)).sort((a, b) => String(b.d).localeCompare(String(a.d)));
    body = (fam.length > 1 ? `<div class="toolbar"><label class="small" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-act="procVinc" ${comVinc ? 'checked' : ''}> incluir os processos vinculados (${fam.length - 1}): ${fam.filter(x => x.id !== id).map(x => esc(rotuloVinculo(x)) + ' ' + esc(procCode(x) || x.numero || '')).join(', ')}</label></div>` : '')
      + (all.map(x => x.h).join('') || '<div class="empty">Nada registrado ainda.</div>'); }
  return `<h1>${code ? `<span class="tag warn">📂 ${esc(code)}</span> ` : ''}${esc(p.titulo || 'Processo')} <span class="tag ${INATIVOS.includes(p.status) ? 'grey' : 'ok'}">${esc(p.status || '')}</span><span class="sp"></span>
    <button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn" data-act="editProc" data-id="${id}">Editar dados</button></h1>${monBannerProc(id)}
  <div class="card"><div class="info">
    ${info('Número', `<b>${esc(p.numero || 's/ nº')}</b>${p.numero ? ` <button class="mini" data-act="copy" data-txt="${esc(p.numero)}">copiar</button>` : ''}`)}
    ${(() => { const pp = byId('processos', p.principalId); return pp ? info('🔗 Vinculado a', `<a href="#/processo/${pp.id}">${esc(procLabel(pp))}</a> <span class="tag">${esc(p.tipoVinculo || 'vinculado')}</span>`) : ''; })()}
    ${(() => { const vs = procVinculados(id); return info('🔗 Processos vinculados', (vs.map(v => `<div><a href="#/processo/${v.id}">${esc(procLabel(v))}</a> <span class="tag">${esc(v.tipoVinculo || 'vinculado')}</span> <span class="tag ${INATIVOS.includes(v.status) ? 'grey' : 'ok'}">${esc(v.status || '')}</span></div>`).join('')) + `<a href="#" class="small" data-act="newProcVinc" data-id="${id}">+ novo processo vinculado</a>`, true); })()}
    ${info('Pasta', code ? `<b>${esc(code)}</b> <span class="muted small">(pasta ${esc(code.split('.')[0])}, ${esc(p.seq)}º processo)</span>` : '')}${info('Início da atuação', p.dataInicio ? fmtD(p.dataInicio) : '')}
    ${info('Cliente', linkP(p.clienteId) + (p.posicao ? ` <span class="muted small">(${esc(p.posicao)})</span>` : '') + repSub(p.clienteId))}
    ${(() => { const pc = poloCliente(p), lista = polo => { const arr = [];
        if(pc === polo) arr.push(linkP(p.clienteId) + ' <span class="tag">cliente</span>');
        (p.partes || []).filter(x => x.polo === polo).forEach(x => arr.push(linkP(x.pessoaId) + (pc && pc === polo ? ' <span class="tag grey">litisconsorte</span>' : '')));
        return arr.join('<br>'); };
      const outros = (p.partes || []).filter(x => x.polo !== 'ativo' && x.polo !== 'passivo')
        .map(x => `${linkP(x.pessoaId)} <span class="tag grey">${esc(POLO_LBL[x.polo] || 'participante')}${x.polo === 'representante' && x.representaId ? ' de ' + esc(pessoaNome(x.representaId)) : ''}</span>`).join('<br>');
      return info('Polo ativo (autores)', lista('ativo')) + info('Polo passivo (réus)', lista('passivo')) + info('Outros participantes', outros); })()}
    ${info('Advogado contrário', esc(p.advContrario))}${info('Observações sobre as partes', esc(p.outrasPartes))}
    ${info('Área', esc(p.area))}${info('Tribunal', esc(p.tribunal))}${info('Sistema', p.sistema ? `<b>${esc(p.sistema)}</b>` : '')}${info('Vara / Órgão', esc(p.vara))}${info('Comarca', esc(p.comarca))}
    ${info('Distribuição', p.dataDistribuicao ? fmtD(p.dataDistribuicao) : '')}${info('Valor da causa', p.valorCausa ? money(p.valorCausa) : '')}
    ${info('Honorários contratados', contratoResumo(p) ? esc(contratoResumo(p)) + ` <a href="#" class="small" data-act="tab" data-g="proc" data-tab="fin">detalhes</a>` : `<a href="#" data-act="editContrato" data-id="${id}">+ informar</a>`, true)}
    ${info('Consulta', p.link ? `<a href="${esc(p.link)}" target="_blank" rel="noopener">abrir no tribunal ↗</a>` : '')}${info('Observações / estratégia', nl2br(p.obs), true)}
  </div></div>
  <div class="card"><div class="tabs">${T('conv', '💬 Conversas com o cliente', convs.length)}${T('and', '📄 Andamentos', ands.length)}${T('prz', '📅 Prazos', prz.filter(x => !x.concluido).length)}${T('fin', '💰 Financeiro', avulsos.length + acs.length)}${T('test', '🧑‍⚖️ Testemunhas', (p.testemunhas || []).length)}${T('tudo', '🕑 Linha do tempo')}</div>${body}</div>`;
};

VIEWS.leads = () => {
  const cols = OPT.statusLead, t = today();
  const l = db.leads.filter(x => has(F.lead.q, x.nome, x.telefone, x.descricao, x.area, x.origem));
  const fechados = db.leads.filter(x => x.status === 'Fechado').length, perdidos = db.leads.filter(x => x.status === 'Perdido').length;
  const taxa = fechados + perdidos ? Math.round(fechados / (fechados + perdidos) * 100) : null;
  const orig = {}; db.leads.forEach(x => { const o = x.origem || 'Não informada'; orig[o] = orig[o] || {t:0, f:0}; orig[o].t++; if(x.status === 'Fechado') orig[o].f++; });
  return `<h1>🎯 Leads (funil de clientes)<span class="sp"></span><button class="btn primary" data-act="newLead">+ Novo lead</button></h1>
  <div class="toolbar"><input type="search" id="leadQ" value="${esc(F.lead.q)}" placeholder="Filtrar leads…">
    <span class="muted small">Arraste os cartões entre as colunas para mudar a etapa.${taxa != null ? ` · Taxa de conversão: <b>${taxa}%</b>` : ''}</span></div>
  <div class="kanban" style="grid-template-columns:repeat(${cols.length},minmax(200px,1fr))">${cols.map(c => { const it = l.filter(x => x.status === c).sort(byDateAsc('proximoContato'));
    return `<div class="kcol" data-col="${esc(c)}"><h3>${esc(c)} <span class="tag grey">${it.length}</span></h3>
      ${it.map(x => `<div class="kcard" draggable="true" data-lead="${x.id}" data-href="#/lead/${x.id}"><b>${esc(x.nome)}</b>
        <div class="muted">${esc([x.area, x.origem].filter(Boolean).join(' · '))}</div>
        ${x.valorEstimado ? `<div>${money(x.valorEstimado)}</div>` : ''}
        ${x.proximoContato && !['Fechado','Perdido'].includes(x.status) ? `<div style="color:${x.proximoContato < t ? 'var(--bad)' : x.proximoContato === t ? 'var(--warn)' : 'var(--muted)'}">📞 ${fmtD(x.proximoContato)} (${rel(x.proximoContato)})</div>` : ''}
        <div class="kact">${c !== cols[0] ? `<button class="mini" data-act="leadMove" data-id="${x.id}" data-dir="-1" title="Etapa anterior">◀</button>` : ''}${c !== cols[cols.length - 1] ? `<button class="mini" data-act="leadMove" data-id="${x.id}" data-dir="1" title="Próxima etapa">▶</button>` : ''}</div>
      </div>`).join('')}</div>`; }).join('')}</div>
  ${Object.keys(orig).length ? `<div class="card" style="margin-top:16px"><h2>De onde vêm os leads</h2><div class="tablewrap"><table><thead><tr><th>Origem</th><th>Leads</th><th>Fechados</th><th>Conversão</th></tr></thead><tbody>
    ${Object.entries(orig).sort((a, b) => b[1].t - a[1].t).map(([o, v]) => `<tr><td>${esc(o)}</td><td>${v.t}</td><td>${v.f}</td><td>${Math.round(v.f / v.t * 100)}%</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
};

VIEWS.lead = id => {
  const l = byId('leads', id); if(!l) return notFound();
  const convs = db.conversas.filter(c => c.leadId === id).sort(byDateDesc('dataHora'));
  return `<h1>🎯 ${esc(l.nome)} <span class="tag ${l.status === 'Fechado' ? 'ok' : l.status === 'Perdido' ? 'bad' : ''}">${esc(l.status)}</span><span class="sp"></span>
    <button class="btn primary" data-act="newConv" data-lead="${id}">💬 Registrar contato</button>
    ${l.pessoaId && byId('pessoas', l.pessoaId) ? `<a class="btn" href="#/pessoa/${l.pessoaId}">Ver ficha do cliente</a>` : `<button class="btn ok" data-act="convertLead" data-id="${id}">✔ Converter em cliente</button>`}
    <button class="btn" data-act="editLead" data-id="${id}">Editar</button></h1>
  <div class="card"><div class="info">
    ${info('Telefone', l.telefone ? esc(l.telefone) + ' ' + wa(l.telefone) : '')}${info('E-mail', esc(l.email))}${info('Origem', esc(l.origem))}${info('Indicado por', esc(l.indicadoPor))}
    ${info('Área', esc(l.area))}${info('Próximo contato', l.proximoContato ? fmtD(l.proximoContato) + ' (' + rel(l.proximoContato) + ')' : '')}
    ${info('Honorários estimados', l.valorEstimado ? money(l.valorEstimado) : '')}${info('Cadastrado em', l.criadoEm ? fmtD(l.criadoEm.slice(0, 10)) : '')}
    ${info('Motivo da perda', esc(l.motivoPerda))}${info('Resumo do caso', nl2br(l.descricao), true)}
  </div></div>
  <div class="card"><h2>Histórico de contatos <span class="tag grey">${convs.length}</span></h2>
    ${convs.map(c => convItem(c, {noPessoa:true})).join('') || '<div class="empty">Nenhum contato registrado. Use “Registrar contato” para anotar ligações e conversas.</div>'}</div>`;
};

let finMes = null, finPA = 'receber';
const exitosPend = () => db.processos.flatMap(p => (p.contrato?.itens || []).filter(it => (it.tipo === 'percentual' || it.tipo === 'beneficios') && it.status !== 'apurado').map(it => ({p, it})));
VIEWS.financeiro = () => {
  const t = today(), mes = t.slice(0, 7), L = db.financeiro, tab = tabs.fin;
  const recM = m => sum(L.filter(l => isRec(l) && l.pagoEm && l.pagoEm.startsWith(m)).map(realV));
  const despM = m => sum(L.filter(l => isDesp(l) && l.pagoEm && l.pagoEm.startsWith(m)).map(realV));
  const sCli = saldoClientes(), res = recM(mes) - despM(mes);
  const vencRec = sum(L.filter(l => l.natureza === 'entrada' && finStatus(l) === 'vencido').map(l => l.valor));
  const pagAtr = sum(L.filter(l => l.natureza === 'saida' && finStatus(l) === 'vencido').map(l => l.valor));
  const meses = []; for(let i = 5; i >= 0; i--) meses.push(addMonths(mes + '-01', -i).slice(0, 7));
  const mx = Math.max(1, ...meses.map(recM), ...meses.map(despM));
  const nomeMes = m => new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString('pt-BR', {month:'short', year:'2-digit'});
  const bar = (v, c) => `<div title="${money(v)}" style="width:42%;height:${Math.max(2, v / mx * 110)}px;background:${c};border-radius:4px 4px 0 0"></div>`;
  const grafico = `<div class="card"><h2>Últimos 6 meses <span class="small muted" style="font-weight:400">— <span style="color:var(--ok)">■</span> honorários recebidos · <span style="color:var(--bad)">■</span> despesas do escritório (repasses a clientes não entram)</span></h2>
    <div style="display:flex;gap:10px;align-items:flex-end;height:150px">${meses.map(m => `<div style="flex:1;text-align:center;font-size:12px">
      <div style="display:flex;gap:3px;align-items:flex-end;justify-content:center;height:115px">${bar(recM(m), 'var(--ok)')}${bar(despM(m), 'var(--bad)')}</div>
      <div class="muted" style="margin-top:4px">${nomeMes(m)}</div><div class="small">${recM(m) - despM(m) ? money(recM(m) - despM(m)).replace(/,\d\d$/, '') : ''}</div></div>`).join('')}</div></div>`;
  const head = `<h1>💰 Financeiro<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn" data-act="newAcordo">🤝 Novo acordo / condenação</button><button class="btn" data-act="newFin" data-nat="saida">⬇ Nova saída</button><button class="btn primary" data-act="newFin" data-nat="entrada">⬆ Nova entrada</button></h1>
  ${(() => {
    const M = finMes || mes, MA = addMonths(M + '-01', -1).slice(0, 7), atual = M === mes;
    const ent = m => sum(L.filter(l => l.natureza === 'entrada' && l.pagoEm && l.pagoEm.startsWith(m)).map(realV)), sai = m => sum(L.filter(l => l.natureza === 'saida' && l.pagoEm && l.pagoEm.startsWith(m)).map(realV));
    const pendM = m => L.filter(l => !l.pagoEm && (l.vencimento || '').startsWith(m) && finStatus(l) !== 'aguardando').length;
    const nmC = m => { const x = new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString('pt-BR', {month:'short'}).replace('.', ''); return x.charAt(0).toUpperCase() + x.slice(1) + '/' + m.slice(2, 4); };
    const nmL = m => { const x = new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString('pt-BR', {month:'long'}); return x.charAt(0).toUpperCase() + x.slice(1); };
    const k = v => v >= 1000 ? (v / 1000).toLocaleString('pt-BR', {maximumFractionDigits:1}) + ' mil' : v.toLocaleString('pt-BR', {maximumFractionDigits:0});
    const ms = []; for(let i = -9; i <= 2; i++) ms.push(addMonths(M + '-01', i).slice(0, 7));
    const strip = `<div class="card" style="padding:10px 12px"><div style="display:flex;gap:8px;align-items:center"><button class="mini" data-act="finMesNav" data-d="-3" title="Meses anteriores">‹</button>
      <div class="mstrip" style="flex:1">${ms.map(m => `<div class="m ${m === M ? 'on' : ''} ${m === mes ? 'atual' : ''}" data-act="finMes" data-m="${m}" title="Ver ${nmL(m)}"><b>${nmC(m)}</b><span class="up">↑ ${k(ent(m))}</span> <span class="dn">↓ ${k(sai(m))}</span><div class="pd">pend. ${pendM(m)}</div></div>`).join('')}</div>
      <button class="mini" data-act="finMesNav" data-d="3" title="Próximos meses">›</button>${M !== mes ? '<button class="mini" data-act="finMes" data-m="' + mes + '">mês atual</button>' : ''}</div></div>`;
    const hon = m => recM(m), desp = m => despM(m), pct = (a, b) => b ? Math.round((a - b) / Math.abs(b) * 100) : (a ? 100 : 0);
    const vt = (a, b, inv) => { const p = pct(a, b); if(!a && !b) return '<span class="var">—</span>'; const bom = inv ? p <= 0 : p >= 0; return `<span class="var ${bom ? 'up' : 'dn'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p)}%</span>`; };
    const mx = Math.max(hon(M), hon(MA), desp(M), desp(MA), Math.abs(hon(M) - desp(M)), Math.abs(hon(MA) - desp(MA)), 1), bar = (v, c) => `<div style="height:${Math.max(3, Math.max(0, v) / mx * 110)}px;background:${c}" title="${money(v)}"></div>`;
    const pa = L.filter(l => !l.pagoEm && l.natureza === (finPA === 'pagar' ? 'saida' : 'entrada') && finStatus(l) !== 'aguardando' && (((l.vencimento || '').startsWith(M)) || (atual && l.vencimento < M + '-01'))).sort(byDateAsc('vencimento'));
    const paAtr = pa.filter(l => l.vencimento < t);
    return strip + `<div class="grid2 fin3">
      <div class="card" style="margin:0"><h2>${nmL(M)}${atual ? ' até o momento' : M > mes ? ' (previsão)' : ''}</h2><div class="small muted">Recebimentos e pagamentos realizados no mês</div>
        <div style="margin:12px 0;text-align:center"><div class="muted small">Saldo do mês</div><div style="font-size:26px;font-weight:700;color:${ent(M) - sai(M) >= 0 ? 'var(--ok)' : 'var(--bad)'}">${money(ent(M) - sai(M))}</div></div>
        <div class="li"><div class="grow">⬆ Entrou</div><b style="color:var(--ok)">${money(ent(M))}</b></div><div class="li"><div class="grow">⬇ Saiu</div><b style="color:var(--bad)">${money(sai(M))}</b></div>
        <div class="li"><div class="grow">Honorários (receita)</div><b>${money(hon(M))}</b></div><div class="li"><div class="grow">Despesas do escritório</div><b>${money(desp(M))}</b></div>
        <div class="small muted" style="margin-top:6px">Entradas e saídas incluem valores de clientes e repasses; honorários e despesas, não.</div></div>
      <div class="card" style="margin:0"><h2>Comparação com ${nmL(MA).toLowerCase()}</h2>
        <div class="cmp"><div class="g"><div class="bars">${bar(hon(MA), '#9fd3b4')}${bar(hon(M), 'var(--ok)')}</div><div style="margin-top:6px">Honorários ${vt(hon(M), hon(MA))}</div></div>
          <div class="g"><div class="bars">${bar(desp(MA), '#f1b0aa')}${bar(desp(M), 'var(--bad)')}</div><div style="margin-top:6px">Despesas ${vt(desp(M), desp(MA), true)}</div></div>
          <div class="g"><div class="bars">${bar(hon(MA) - desp(MA), '#a9c4e0')}${bar(hon(M) - desp(M), 'var(--pri)')}</div><div style="margin-top:6px">Resultado ${vt(hon(M) - desp(M), hon(MA) - desp(MA))}</div></div></div>
        <div class="small muted" style="text-align:center;margin-top:6px">barra clara = ${nmL(MA).toLowerCase()} · barra escura = ${nmL(M).toLowerCase()}${atual ? ' (até hoje)' : ''}</div>
        <div class="small" style="margin-top:8px">Honorários: ${money(hon(MA))} → <b>${money(hon(M))}</b><br>Despesas: ${money(desp(MA))} → <b>${money(desp(M))}</b><br>Resultado: ${money(hon(MA) - desp(MA))} → <b>${money(hon(M) - desp(M))}</b></div></div>
      <div class="card" style="margin:0"><h2>Para acontecer<span class="sp"></span><div class="seg"><button class="${finPA !== 'pagar' ? 'on' : ''}" data-act="finPA" data-v="receber">A receber</button><button class="${finPA === 'pagar' ? 'on' : ''}" data-act="finPA" data-v="pagar">A pagar</button></div></h2>
        <div style="font-size:15px">Total ${finPA === 'pagar' ? 'a pagar' : 'a receber'} em ${nmL(M).toLowerCase()}${atual ? ' (com atrasados)' : ''}: <b>${money(sum(pa.map(l => l.valor)))}</b></div>
        ${paAtr.length ? `<div class="small" style="color:var(--bad)">em atraso: <b>${money(sum(paAtr.map(l => l.valor)))}</b></div>` : ''}
        ${pa.slice(0, 6).map(l => `<div class="li ${l.vencimento < t ? 'late' : ''}"><div class="grow"><b>${money(l.valor)}</b> · ${esc(l.descricao)}<div class="sub">${esc(pessoaNome(l.pessoaId) || 'escritório')} · ${fmtD(l.vencimento)} (${rel(l.vencimento)})</div></div><button class="mini" data-act="payFin" data-id="${l.id}">${finPA === 'pagar' ? (l.categoria === CAT_REP ? 'repassar' : 'pagar') : 'receber'}</button></div>`).join('') || '<div class="empty">Nada pendente neste mês. 👍</div>'}
        ${pa.length > 6 ? `<div class="small muted">+ ${pa.length - 6} outro(s) na lista abaixo</div>` : ''}</div></div>
      <div class="toolbar" style="margin-top:12px;gap:14px;font-size:13.5px">${sCli > 0.004 ? `<span class="tag warn" style="font-size:13px">Valores de clientes a repassar: <b>${money(sCli)}</b></span>` : ''}${vencRec ? `<span class="tag bad" style="font-size:13px">A receber vencido: <b>${money(vencRec)}</b></span>` : ''}${pagAtr ? `<span class="tag bad" style="font-size:13px">A pagar atrasado: <b>${money(pagAtr)}</b></span>` : ''}
        <span class="tag grey" style="font-size:13px">Total a receber em aberto: <b>${money(sum(L.filter(l => l.natureza === 'entrada' && !l.pagoEm).map(l => l.valor)))}</b></span><span class="tag grey" style="font-size:13px">Total a pagar em aberto: <b>${money(sum(L.filter(l => l.natureza === 'saida' && !l.pagoEm).map(l => l.valor)))}</b></span></div>`;
  })()}
  <div class="tabs"><button data-act="tab" data-g="fin" data-tab="lanc" class="${tab === 'lanc' ? 'on' : ''}">📋 Recebimentos e pagamentos${F.fin.mes ? ' — ' + new Date(+F.fin.mes.slice(0, 4), +F.fin.mes.slice(5) - 1, 1).toLocaleDateString('pt-BR', {month:'long', year:'numeric'}) : ''}</button>${F.fin.mes ? '<button data-act="finTodos" title="Mostrar todos os meses">✕ todos os meses</button>' : ''}<button data-act="tab" data-g="fin" data-tab="acordos" class="${tab === 'acordos' ? 'on' : ''}">🤝 Acordos e condenações (${db.acordos.length})</button><button data-act="tab" data-g="fin" data-tab="exitos" class="${tab === 'exitos' ? 'on' : ''}">⏳ Êxitos a apurar (${exitosPend().length})</button></div>`;
  if(tab === 'exitos'){
    const pend = exitosPend(), semC = db.processos.filter(p => !INATIVOS.includes(p.status) && !(p.contrato?.itens || []).length);
    const ord = (a, b) => cmpPasta(byId('pessoas', a.clienteId)?.pasta, byId('pessoas', b.clienteId)?.pasta) || (parseInt(a.seq, 10) || 0) - (parseInt(b.seq, 10) || 0);
    return head + `<div class="card"><h2>⏳ Honorários de êxito aguardando resultado <span class="tag grey">${pend.length}</span></h2>
      ${pend.length ? `<div class="tablewrap"><table><thead><tr><th>Pasta</th><th>Processo</th><th>Cliente</th><th>Situação</th><th>Combinado</th><th></th></tr></thead><tbody>
      ${pend.sort((a, b) => ord(a.p, b.p)).map(({p, it}) => `<tr><td class="nowrap"><b>${esc(procCode(p))}</b></td><td><a href="#/processo/${p.id}">${esc(p.titulo || p.numero || 'processo')}</a><div class="small muted">${esc(p.numero || '')}${p.area ? ' · ' + esc(p.area) : ''}</div></td>
        <td>${linkP(p.clienteId)}</td><td><span class="tag ${INATIVOS.includes(p.status) ? 'grey' : 'ok'}">${esc(p.status || '')}</span></td><td>${esc(itemTxt(it))}</td>
        <td class="right"><button class="mini" data-act="apurar" data-p="${p.id}" data-i="${it.id}">apurar</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Nenhum honorário de êxito pendente.</div>'}</div>
      ${semC.length ? `<div class="card"><h2>Processos em andamento sem honorários informados <span class="tag warn">${semC.length}</span></h2>
        ${semC.sort(ord).map(p => `<div class="li"><div class="grow"><b><a href="#/processo/${p.id}">${esc(procLabel(p))}</a></b><div class="sub">${esc(pessoaNome(p.clienteId))}${p.area ? ' · ' + esc(p.area) : ''}</div></div><button class="mini" data-act="editContrato" data-id="${p.id}">informar</button></div>`).join('')}</div>` : ''}`;
  }
  if(tab === 'acordos') return head + `<div class="card">${[...db.acordos].sort(byDateDesc('data')).map(acordoItem).join('') || '<div class="empty">Nenhum acordo ou condenação lançado. Use “Novo acordo / condenação” para gerar as parcelas automaticamente.</div>'}</div>`;
  listFn = () => {
    const f = F.fin;
    const l = L.filter(x => {
      const st = finStatus(x);
      if(f.st === 'pend' && st === 'ok') return false; if(f.st === 'vencidos' && st !== 'vencido') return false; if(f.st === 'real' && st !== 'ok') return false;
      if(f.nat && x.natureza !== f.nat) return false; if(f.cat && x.categoria !== f.cat) return false;
      if(f.mes && !((f.st === 'real' ? x.pagoEm : x.vencimento) || '').startsWith(f.mes)) return false;
      return has(f.q, x.descricao, x.categoria, pessoaNome(x.pessoaId), procLabel(byId('processos', x.processoId)));
    }).sort(f.st === 'real' ? byDateDesc('pagoEm') : byDateAsc('vencimento'));
    window._finList = l;
    const ent = sum(l.filter(x => x.natureza === 'entrada').map(x => f.st === 'real' ? realV(x) : x.valor)), sai = sum(l.filter(x => x.natureza === 'saida').map(x => f.st === 'real' ? realV(x) : x.valor));
    const lbl = f.st === 'real' ? ['Recebido', 'Pago', 'Saldo'] : f.st === 'todos' ? ['Entradas', 'Saídas', 'Saldo'] : ['A receber', 'A pagar', 'Saldo previsto'];
    document.getElementById('list').innerHTML = `<div class="card"><div style="display:flex;gap:18px;flex-wrap:wrap;margin-bottom:10px;font-size:15px">
      <span>${l.length} lançamento(s)</span><span>${lbl[0]}: <b style="color:var(--ok)">${money(ent)}</b></span><span>${lbl[1]}: <b style="color:var(--bad)">${money(sai)}</b></span><span>${lbl[2]}: <b>${money(ent - sai)}</b></span></div>
      ${finTableMes(l.slice(0, 1500), {realizados: f.st === 'real', agrupar: f.agrupar})}${l.length > 1500 ? '<div class="small muted">Mostrando os primeiros 1.500 — use os filtros.</div>' : ''}</div>`;
  };
  return head + `<div class="toolbar"><input type="search" data-f="fin.q" value="${esc(F.fin.q)}" placeholder="Cliente, descrição, processo…">
    <select data-f="fin.st">${opts([{v:'pend', t:'Tudo em aberto'}, {v:'vencidos', t:'Vencidos / atrasados'}, {v:'real', t:'Realizados'}, {v:'todos', t:'Todos'}], F.fin.st)}</select>
    <select data-f="fin.nat">${opts([{v:'', t:'Entradas e saídas'}, {v:'entrada', t:'Só entradas'}, {v:'saida', t:'Só saídas'}], F.fin.nat)}</select>
    <select data-f="fin.cat"><option value="">Todas as categorias</option>${opts([...catOpts('entrada'), ...catOpts('saida')], F.fin.cat)}</select>
    <input type="month" data-f="fin.mes" value="${esc(F.fin.mes)}" title="Filtrar por mês">
    <label class="chk" title="Mostra cada parcela de acordo em uma linha só"><input type="checkbox" data-f="fin.agrupar" ${F.fin.agrupar ? 'checked' : ''}> agrupar parcelas de acordos</label>
    <button class="btn" data-act="exportCsv">⬇ Exportar planilha</button></div><div id="list"></div>` + grafico;
};

VIEWS.acordo = id => {
  const a = byId('acordos', id); if(!a) return notFound();
  const ls = acordoLanc(id), n = parseInt(a.parcelas, 10) || 1, conta = a.modo !== 'cliente', t = today(), r = acordoResumo(a), pl = planoAcordo(a);
  const pct = Number(a.pctContratual) || 0;
  const cell = l => l ? `<a href="#" data-act="editFin" data-id="${l.id}" title="Clique para ver ou corrigir">${money(l.valor)}</a>` : '<span class="muted">—</span>';
  const rows = [];
  const ks = [...new Set(ls.map(l => l.parcela))].sort((x, y) => x - y);
  for(const k of ks){
    const g = ls.filter(l => l.parcela === k), ent = g.filter(l => l.natureza === 'entrada');
    const cli = g.find(l => l.categoria === CAT_CLI), hon = g.find(l => l.categoria === CAT_HC), suc = g.find(l => l.categoria === CAT_HS), rep = g.find(l => l.categoria === CAT_REP && !l.pagoEm) || g.find(l => l.categoria === CAT_REP);
    const venc = (cli || suc)?.vencimento || addMonths(a.primeiroVenc, k - 1);
    const recebida = ent.length > 0 && ent.every(l => l.pagoEm), parcial = !recebida && ent.some(l => l.pagoEm);
    const st = recebida ? `<span class="tag ok">recebida ${fmtD(ent[0].pagoEm)}</span>` : parcial ? '<span class="tag warn">parcial</span>' : venc < t ? '<span class="tag bad">vencida</span>' : '<span class="tag">a receber</span>';
    const rs = !rep ? '' : rep.pagoEm ? `<span class="tag ok">repassado ${fmtD(rep.pagoEm)}</span>` : recebida ? `<span class="tag ${rep.vencimento < t ? 'bad' : 'warn'}">repassar até ${fmtD(rep.vencimento)}</span>` : '<span class="tag grey">aguardando</span>';
    const act = !recebida ? `<button class="mini" data-act="recParc" data-id="${id}" data-k="${k}">receber</button>` : (rep && !rep.pagoEm ? `<button class="mini" data-act="payFin" data-id="${rep.id}">repassar</button>` : '');
    const total = conta ? sum(ent.map(l => l.valor)) : (pl[k - 1]?.p || 0) + (suc?.valor || 0);
    const pP = principalParcela(a, k) / 100, pcC = pP ? (conta ? (cli?.valor || 0) : pP - (hon?.valor || 0)) / pP * 100 : 0;
    rows.push(`<tr><td class="sel"><input type="checkbox" data-sel="${g.map(l => l.id).join(',')}" title="Selecionar parcela"></td><td>${k}/${n}</td><td class="nowrap">${fmtD(venc)}</td><td class="right nowrap"><b>${money(total)}</b></td>
      ${conta ? `<td class="right nowrap">${cell(cli)}<div class="small muted">${pctTxt(pcC)}</div></td>` : `<td class="right nowrap muted">${money(pl[k - 1]?.p || 0)}</td>`}<td class="right nowrap">${cell(hon)}<div class="small muted">${pctTxt(100 - pcC)}</div></td><td class="right nowrap">${cell(suc)}</td>
      <td>${st}</td>${conta ? `<td>${rs}</td>` : ''}<td class="right nowrap">${act}</td></tr>`);
  }
  const recebido = sum(ls.filter(l => l.natureza === 'entrada' && l.pagoEm).map(realV));
  const honTot = sum(ls.filter(isRec).map(l => l.valor)), honRec = sum(ls.filter(l => isRec(l) && l.pagoEm).map(realV));
  const cliTot = sum(ls.filter(l => l.categoria === CAT_CLI).map(l => l.valor)), repassado = sum(ls.filter(l => l.categoria === CAT_REP && l.pagoEm).map(realV));
  const totalAc = (Number(a.principal) || 0) + (Number(a.sucumbencia) || 0);
  return `<h1>🤝 ${esc(a.descricao)} <span class="tag ${r.rec === n ? 'ok' : ''}">${r.rec}/${n} parcelas recebidas</span><span class="sp"></span>
    <a class="btn" href="#/financeiro" data-act="tab" data-g="fin" data-tab="acordos">← Acordos</a><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn" data-act="editAcordo" data-id="${id}">Editar / excluir</button></h1>
  <div class="card"><div class="info">
    ${info('Cliente', linkP(a.pessoaId))}${info('Processo', linkProc(a.processoId))}${info('Data', fmtD(a.data))}
    ${info('Total', '<b>' + money(totalAc) + '</b>')}${info('Principal (cliente)', money(a.principal))}${info('Honorários sucumbenciais', a.sucumbencia ? money(a.sucumbencia) : '')}
    ${info('Parcelas', `${n}× a partir de ${fmtD(a.primeiroVenc)}`)}
    ${info('Pagamento', conta ? `Na conta do escritório — repasse ao cliente da parte dele no principal${Number(a.diasRepasse) ? ` em até ${a.diasRepasse} dia(s)` : ''}` : 'Direto ao cliente — ele paga os honorários ao escritório')}
    ${info('Honorários contratuais', (() => { const ps = [...new Set(ls.map(l => l.parcela))].map(k => { const pp = principalParcela(a, k); const hh = Math.round(sum(ls.filter(l => l.parcela === k && l.categoria === CAT_HC).map(l => l.valor)) * 100); return pp ? Math.round(hh / pp * 1000) / 10 : 0; });
      return new Set(ps).size > 1 ? `variável por parcela (padrão ${pct}%) — veja a tabela` : (ps.length ? pctTxt(ps[0]) : pct + '%') + ' do principal'; })())}${info('Observações', nl2br(a.obs), true)}
  </div></div>
  <div class="stats">
    ${statBox(`Recebido até agora (de ${money(conta ? totalAc : honTot)})`, recebido, 'ok')}${statBox(`Seus honorários recebidos (de ${money(honTot)})`, honRec, 'ok')}
    ${conta ? statBox(`Repassado ao cliente (de ${money(cliTot)})`, repassado) + statBox('Saldo do cliente em sua conta (a repassar)', r.saldo, r.saldo > 0.004 ? 'warn' : '') : ''}
  </div>
  <div class="card"><div class="toolbar"><button class="btn primary" data-act="divAcordo" data-id="${id}">⚖ Alterar divisão cliente × honorários</button><span class="small muted">Ex.: parcelas 1 a 5 com 100% ao cliente; parcelas 20 a 24 com 40%. A sucumbência é sempre sua.</span></div>
  <div class="tablewrap"><table><thead><tr><th class="sel"><input type="checkbox" data-selall title="Selecionar todas"></th><th>Parcela</th><th>Vencimento</th><th class="right">Valor da parcela</th>
    <th class="right">${conta ? 'Do cliente' : 'Principal (pago ao cliente)'}</th><th class="right">Contratuais</th><th class="right">Sucumbência</th><th>Recebimento</th>${conta ? '<th>Repasse</th>' : ''}<th></th></tr></thead>
    <tbody>${rows.join('')}</tbody></table></div>
    <div class="small muted noprint" style="margin-top:8px">Clique em um valor para corrigir (ex.: parcela paga com correção ou multa). “Receber” registra de uma vez a parcela toda. Marque as caixinhas para excluir ou dar baixa em várias parcelas.</div>
    <details style="margin-top:12px"><summary class="small" style="cursor:pointer">Ver os ${ls.length} lançamentos individuais deste acordo</summary><div style="margin-top:8px">${finTable([...ls].sort((x, y) => x.parcela - y.parcela || x.natureza.localeCompare(y.natureza)), {noPessoa:true, noProc:true, noAcordo:true})}</div></details></div>`;
};

VIEWS.busca = q => {
  q = q || ''; document.getElementById('busca').value = q;
  const P = db.pessoas.filter(p => has(q, p.nome, p.pasta, p.doc, digits(p.doc), p.telefone, p.email, p.obs, nomesReps(p)));
  const PR = db.processos.filter(p => has(q, p.numero, digits(p.numero), p.titulo, p.obs, p.vara, p.comarca, p.outrasPartes, pessoaNome(p.clienteId), nomesPartes(p)));
  const C = db.conversas.filter(c => has(q, c.assunto, c.relato, c.proximaAcao)).sort(byDateDesc('dataHora'));
  const A = db.andamentos.filter(a => has(q, a.descricao)).sort(byDateDesc('data'));
  const L = db.leads.filter(l => has(q, l.nome, l.telefone, l.email, l.descricao));
  const tot = P.length + PR.length + C.length + A.length + L.length;
  return `<h1>🔎 Resultados para “${esc(q)}” <small>${tot} encontrado(s)</small></h1>
  ${P.length ? `<div class="card"><h2>👤 Pessoas</h2>${P.map(p => `<div class="li"><div class="grow"><b>${linkP(p.id)}</b> <span class="tag grey">${esc(p.tipo)}</span><div class="sub">${esc([p.pasta ? 'Pasta ' + p.pasta : '', p.doc, p.telefone, p.email].filter(Boolean).join(' · '))}</div></div></div>`).join('')}</div>` : ''}
  ${PR.length ? `<div class="card"><h2>📁 Processos</h2>${PR.map(p => `<div class="li"><div class="grow"><b>${linkProc(p.id)}</b><div class="sub">${esc(pessoaNome(p.clienteId))} · ${esc(p.status || '')}</div></div></div>`).join('')}</div>` : ''}
  ${L.length ? `<div class="card"><h2>🎯 Leads</h2>${L.map(l => `<div class="li"><div class="grow"><b>${linkLead(l.id)}</b> <span class="tag grey">${esc(l.status)}</span></div></div>`).join('')}</div>` : ''}
  ${C.length ? `<div class="card"><h2>💬 Conversas</h2>${C.slice(0, 50).map(c => convItem(c)).join('')}</div>` : ''}
  ${A.length ? `<div class="card"><h2>📄 Andamentos</h2>${A.slice(0, 50).map(a => `<div class="small muted">📁 ${linkProc(a.processoId)}</div>` + andItem(a)).join('')}</div>` : ''}
  ${!tot ? '<div class="card empty">Nada encontrado.</div>' : ''}`;
};

let listaSel = 'catAtend';
VIEWS.listas = arg => {
  if(arg && listaDef(arg)) listaSel = arg;
  const d = listaDef(listaSel);
  const nav = LISTAS.map(x => `<a href="#/listas/${x.k}" class="${x.k === listaSel ? 'on' : ''}">${esc(x.nome)}</a>`).join('');
  let corpo;
  if(d.especial === 'msgs'){
    corpo = `<h2>${esc(d.nome)}<span class="sp"></span><button class="btn" data-act="lsAddMsg">+ Novo modelo</button><button class="btn primary" data-act="lsSalvarMsgs">Salvar</button></h2>
      <p class="small muted">Use os marcadores, que são trocados automaticamente: <code>{nome}</code> (quem recebe), <code>{cliente}</code>, <code>{compromisso}</code>, <code>{processo}</code>, <code>{data}</code>, <code>{dia_semana}</code>, <code>{hora}</code>, <code>{local}</code>, <code>{observacoes}</code>. Use *asteriscos* para negrito no WhatsApp.</p>
      ${modelosMsg().map(m => `<div class="msgRow" data-id="${esc(m.id)}" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:10px"><div style="display:flex;gap:8px;margin-bottom:6px"><input class="mNome" value="${esc(m.v)}"><button class="mini" data-act="lsDelMsg" data-id="${esc(m.id)}">🗑 excluir</button></div><textarea class="mTxt" rows="8">${esc(m.texto)}</textarea></div>`).join('')}`;
  } else {
    const col = d.especial === 'colunas', its = col ? colunas() : listaItens(d.k), fixo = x => col ? COLUNAS_FIXAS.includes(x.id) : (d.fixos || []).includes(x.v);
    corpo = `<h2>${esc(d.nome)}<span class="sp"></span><button class="btn" data-act="lsAdd">+ Adicionar opção</button><button class="btn primary" data-act="lsSalvar">Salvar alterações</button></h2>
      <p class="small muted">${col ? 'As colunas organizam o quadro; mover cartões entre elas não altera datas nem situação. As colunas com 🔒 recebem itens automaticamente (sem data → Em análise; prazos e tarefas → Tarefas/prazos; audiências e perícias → Audiências) e podem ser renomeadas, mas não excluídas.'
        : 'Use ▲▼ para mudar a ordem. Renomear atualiza os registros que já usam a opção. “Visível” desmarcado tira a opção das listas sem afetar o que já foi cadastrado. Opções com 🔒 têm função no sistema e não podem ser renomeadas nem excluídas.'}</p>
      <div id="lsItens">${its.map((x, i) => `<div class="lsItem" data-orig="${esc(x.v)}" ${col ? `data-id="${esc(x.id)}"` : ''}><button class="mini" data-act="lsUp" title="Subir">▲</button><button class="mini" data-act="lsDown" title="Descer">▼</button>
        <input class="lsV" value="${esc(x.v)}" ${fixo(x) && !col ? 'readonly title="Opção protegida"' : ''}><label class="chk small"><input type="checkbox" class="lsVis" ${x.oculto ? '' : 'checked'}> visível</label>
        ${fixo(x) ? '<span title="Opção protegida — usada pelo sistema" style="width:70px;text-align:center">🔒</span>' : '<button class="mini" data-act="lsDel">🗑 excluir</button>'}</div>`).join('')}</div>
      ${!col ? `<div class="small muted" style="margin-top:10px">Para voltar às opções originais: <a href="#" data-act="lsPadrao">restaurar padrão desta lista</a>.</div>` : ''}`;
  }
  return `<h1>⚙️ Listas e opções<span class="sp"></span><a class="btn" href="#/config">← Backup e dados</a></h1>
    <div class="lsBox"><div class="card lsNav" style="padding:8px">${nav}</div><div class="card">${corpo}</div></div>`;
};
VIEWS.config = () => {
  const fsOk = 'showSaveFilePicker' in window;
  const n = c => db[c].length;
  const dc = driveCfg(), arquivoLocal = location.protocol === 'file:';
  const cardDrive = `<div class="card" style="border:2px solid var(--pri2)"><h2>☁️ Sincronização com o Dropbox ${driveAtivo() ? '<span class="tag ok">ativa</span>' : '<span class="tag grey">desligada</span>'}</h2>
    ${arquivoLocal ? `<p>Disponível na <b>versão publicada</b> do programa (endereço https). Esta cópia está sendo aberta como arquivo do computador. Para levar seus dados para a versão publicada: clique em <b>“Baixar backup agora”</b> abaixo e, na versão publicada, use <b>“Restaurar a partir de um backup”</b>.</p>`
    : driveAtivo() ? `<p>Os dados ficam no arquivo <b>${ARQ_NOME}</b>, na pasta <b>Aplicativos</b> do seu Dropbox, e são sincronizados entre todos os aparelhos conectados. Este aparelho mantém uma cópia para funcionar sem internet.</p>
      <div class="info" style="margin-bottom:10px">${info('Situação', esc(statusTxt()))}${info('Última sincronização', drive.ultimo ? drive.ultimo.toLocaleString('pt-BR') : '—')}${info('Alterações pendentes neste aparelho', isDirty() ? '<b style="color:var(--warn)">sim</b>' : 'não')}</div>
      <div class="toolbar">${temSessao() ? '<button class="btn primary" data-act="driveSyncNow">🔄 Sincronizar agora</button>' : '<button class="btn primary" data-act="driveLogin">Conectar ao Dropbox</button><button class="btn" data-act="dbxCodigo">Conectar com código</button>'}
      <a class="btn" href="https://www.dropbox.com/home/Aplicativos" target="_blank" rel="noopener">Abrir o Dropbox ↗</a><button class="btn danger" data-act="driveOff">Desligar neste aparelho</button></div>
      <p class="small muted">A conexão é feita uma vez por aparelho e se mantém. Se um dia aparecer “Conectar” no topo, basta um clique.</p>`
    : `<p>Guarde os dados no <b>seu Dropbox</b> e use o mesmo cadastro no celular e no computador.</p>
      ${DROPBOX_APP_KEY_PADRAO ? `<input id="cfgAppKey" type="hidden" value="${esc(appKey())}">` : `<div class="fld" style="margin-bottom:10px"><label for="cfgAppKey">Chave do app no Dropbox (“App key”) — configuração feita uma única vez, veja o guia</label><input id="cfgAppKey" value="${esc(appKey())}" placeholder="ex.: a1b2c3d4e5f6g7h" autocomplete="off" autocapitalize="off" spellcheck="false"></div>`}
      <div class="toolbar"><button class="btn primary" data-act="driveOn">Conectar ao Dropbox</button><button class="btn" data-act="driveOnCodigo">Ativar com código (se o retorno automático não funcionar)</button></div>
      <p class="small muted">O app só tem acesso à <b>pasta própria dele</b> dentro de Aplicativos no seu Dropbox — não enxerga seus outros arquivos.</p>`}
  </div>
  ${arquivoLocal ? '' : `<div class="card"><h2>📲 Instalar o app</h2>
    ${instalarEvt ? '<div class="toolbar"><button class="btn primary" data-act="instalar">Instalar neste aparelho</button></div>' : ''}
    <ul class="small"><li><b>Windows:</b> no Edge ou Chrome, clique no ícone de instalar na barra de endereço (ou menu ⋯ → Aplicativos → Instalar este site como aplicativo).</li>
    <li><b>Android:</b> no Chrome, menu ⋮ → <b>Instalar app</b> (ou “Adicionar à tela inicial”).</li>
    <li><b>iPhone / iPad:</b> no <b>Safari</b>, botão Compartilhar → <b>Adicionar à Tela de Início</b>.</li></ul></div>`}`;
  return `<h1>💾 Backup e dados</h1>
  ${cardDrive}
  <div class="card"><h2>Onde ficam os seus dados</h2>
    ${driveAtivo() ? `<p>Com a sincronização ativa, a cópia principal fica no seu <b>Dropbox</b> e cada aparelho guarda uma cópia local para funcionar sem internet. Mesmo assim, baixe um backup de vez em quando e guarde em outro lugar (abaixo).</p></div>`
    : `<p>Tudo fica gravado <b>somente neste aparelho, dentro deste navegador</b>. Nada é enviado para a internet. Por isso:</p>
    <ul><li>Use sempre o <b>mesmo navegador</b>${location.protocol === 'file:' ? ' e mantenha este arquivo na mesma pasta' : ''}.</li>
    <li><b>Não limpe os “dados de navegação / cookies”</b> do navegador sem antes fazer backup.</li>
    <li>Faça backup com frequência — ou ative a sincronização com o Dropbox.</li></ul></div>`}
  ${driveAtivo() ? '' : `  <div class="card"><h2>🔄 Backup automático em arquivo ${fileHandle && filePerm ? '<span class="tag ok">ativo</span>' : '<span class="tag warn">desligado</span>'}</h2>
    ${fsOk ? `<p>Escolha um arquivo para o programa salvar uma cópia <b>a cada alteração</b>. Dica: salve-o dentro de uma pasta do <b>OneDrive, Google Drive ou Dropbox</b> — assim você tem backup na nuvem e pode abrir em outro computador.</p>
      ${fileHandle ? `<p class="small">Arquivo atual: <b>${esc(fileHandle.name)}</b>${db.meta.lastFileSave ? ' · última gravação: ' + new Date(db.meta.lastFileSave).toLocaleString('pt-BR') : ''}</p>` : ''}
      <div class="toolbar"><button class="btn primary" data-act="chooseFile">${fileHandle ? 'Trocar arquivo' : 'Escolher arquivo de backup automático'}</button>
      ${fileHandle && !filePerm ? '<button class="btn ok" data-act="reactivateFile">Reativar backup automático</button>' : ''}
      ${fileHandle ? '<button class="btn" data-act="openFromFile">Carregar dados deste arquivo</button><button class="btn danger" data-act="unlinkFile">Desligar</button>' : ''}</div>
      <p class="small muted">Por segurança, o navegador pede para reativar a permissão cada vez que o programa é aberto (um clique no aviso amarelo do topo).</p>`
    : `<p class="muted">Seu navegador não permite gravação automática em arquivo. Use o <b>Google Chrome</b> ou o <b>Microsoft Edge</b> para ter esse recurso, ou faça o backup manual abaixo.</p>`}</div>
`}
  <div class="card"><h2>📦 Backup manual</h2>
    <p>Baixa um arquivo com todos os dados. Guarde em local seguro (pen drive, nuvem, e-mail).${db.meta.lastBackup ? ` Último backup manual: <b>${new Date(db.meta.lastBackup).toLocaleString('pt-BR')}</b>.` : ''}</p>
    <div class="toolbar"><button class="btn primary" data-act="exportJson">⬇ Baixar backup agora</button><button class="btn" data-act="importJson">⬆ Restaurar a partir de um backup</button></div></div>
  <div class="card"><h2>Resumo da base</h2><div class="info">
    ${info('Pessoas', n('pessoas'))}${info('Processos', n('processos'))}${info('Andamentos', n('andamentos'))}${info('Conversas', n('conversas'))}
    ${info('Prazos', n('prazos'))}${info('Leads', n('leads'))}${info('Lançamentos financeiros', n('financeiro'))}${info('Acordos / condenações', n('acordos'))}
    ${info('Última alteração', db.meta.updated ? new Date(db.meta.updated).toLocaleString('pt-BR') : '—')}</div></div>
  <div class="card"><h2>🎨 Aparência</h2><div class="temaSeg" role="group" aria-label="Aparência"><button data-act="temaSet" data-v="light">Claro</button><button data-act="temaSet" data-v="dark">Escuro</button><button data-act="temaSet" data-v="auto">Auto</button></div>
    <p class="small muted" style="margin:8px 0 0">Também fica no rodapé do menu lateral (no celular: “Mais”). Versão do sistema: <b>${VERSAO}</b></p></div>
  <div class="card"><h2>Atalhos</h2><p class="small"><b>Alt + N</b>: registrar conversa · <b>Alt + B</b>: buscar · <b>Esc</b>: fechar janela</p></div>
  ${arquivoLocal ? '' : (() => { const u = iaUso();
    return `<div class="card"><h2>✨ Inteligência artificial (preencher com IA) ${iaKey() ? '<span class="tag ok">ativa neste aparelho</span>' : '<span class="tag grey">desligada</span>'}</h2>
    <p>Preenche compromissos, conversas e andamentos a partir de textos, prints e PDFs, usando o Claude (Anthropic) com a <b>sua</b> chave de API. O custo é cobrado pela Anthropic na sua conta, por uso.</p>
    <div class="fld" style="margin-bottom:10px"><label for="iaKeyIn">Chave de API da Anthropic (começa com sk-ant-) — fica guardada só neste aparelho</label><input id="iaKeyIn" type="password" autocomplete="off" placeholder="${iaKey() ? '•••••••• (chave salva — digite outra para trocar)' : 'sk-ant-…'}"></div>
    <div class="toolbar"><button class="btn primary" data-act="iaSalvarKey">Salvar chave</button>${iaKey() ? '<button class="btn" data-act="iaTestar">Testar conexão</button><button class="btn danger" data-act="iaRemoverKey">Remover deste aparelho</button>' : ''}<span id="iaTesteSt" class="small muted"></span></div>
    <div class="small muted">Uso neste aparelho em ${new Date(+u.mes.slice(0, 4), +u.mes.slice(5) - 1, 1).toLocaleDateString('pt-BR', {month:'long'})}: <b>${u.n}</b> preenchimento(s) · custo estimado <b>US$ ${iaCustoUsd(u).toFixed(2)}</b>. Defina um limite mensal de gastos no painel da Anthropic. O conteúdo enviado é processado pela Anthropic; avalie o envio de dados sensíveis de clientes.</div></div>`; })()}
  <div class="card"><h2>⚙️ Listas e opções</h2><p>Crie, renomeie, reordene ou oculte as opções das caixas de seleção do sistema (categorias, tipos, áreas, colunas do quadro, modelos de mensagem…).</p><a class="btn primary" href="#/listas">Abrir Listas e opções</a></div>
  <div class="card"><h2>📄 Modelos de honorários</h2><p class="small muted">Usados ao cadastrar processos e ao informar os honorários contratados. Para criar um novo, monte os itens em um processo e clique em “salvar estes itens como modelo”.</p>
    ${modelos().map((m, i) => `<div class="li"><div class="grow"><b>${esc(m.nome)}</b>${m.area ? ` <span class="tag grey">${esc(m.area)}</span>` : ''}<div class="sub">${esc(m.itens.map(itemTxt).join(' + '))}</div></div><button class="mini" data-act="delModelo" data-i="${i}">excluir</button></div>`).join('') || '<div class="empty">Nenhum modelo.</div>'}
    <div style="margin-top:8px"><button class="mini" data-act="resetModelos">restaurar modelos padrão</button></div></div>
  <div class="card"><h2 style="color:var(--bad)">Zona de perigo</h2><button class="btn danger" data-act="clearAll">Apagar todos os dados</button></div>`;
};

function notFound(){ return '<div class="card">Registro não encontrado (pode ter sido excluído). <a href="#/painel">Voltar ao início</a></div>'; }

