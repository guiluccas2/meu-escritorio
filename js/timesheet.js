/* ===== Timesheet: cronômetro e horas trabalhadas por processo / cliente =====
   Lançamentos em db.horas: {id, data, ini, fim, min, processoId, pessoaId, atividade, descricao}
   Cronômetro em db.meta.timer (vai junto pelo Dropbox, então continua no outro aparelho):
   {ini: ms do último “iniciar/retomar”, acum: ms já acumulados, pausado, comecouEm, processoId, pessoaId, atividade, descricao} */
const tsCfg = () => ({arred:0, ...(db.meta.horasCfg || {})}); // sem valor/hora fixo: o valor é calculado na tela de Horas
const tsFat = h => h.fat !== false; // faturável (cobrar do cliente) — padrão: sim
const tsTimer = () => db.meta.timer && db.meta.timer.comecouEm ? db.meta.timer : null;
const tsDecorrido = t => !t ? 0 : (t.acum || 0) + (t.pausado ? 0 : Math.max(0, Date.now() - (t.ini || Date.now())));
const tsRelogio = ms => { const s = Math.floor(ms / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); };
const fmtMin = m => { m = Math.round(m || 0); return Math.floor(m / 60) + 'h' + pad(m % 60); };
const tsHora = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
// “1h30”, “1:30”, “90”, “1,5h”, “45min” → minutos
function tsParseDur(s){ s = String(s || '').trim().toLowerCase().replace(/\s/g, ''); if(!s) return 0; let m;
  if((m = s.match(/^(\d+)[:h](\d{1,2})(m|min)?$/))) return +m[1] * 60 + +m[2];
  if((m = s.match(/^(\d+(?:[.,]\d+)?)h$/))) return Math.round(parseFloat(m[1].replace(',', '.')) * 60);
  if((m = s.match(/^(\d+)(m|min)?$/))) return +m[1];
  return 0; }
const tsMinEntre = (a, b) => { if(!a || !b) return 0; const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number); let d = h2 * 60 + m2 - (h1 * 60 + m1); if(d < 0) d += 1440; return d; };
const tsAlvo = h => { const pr = byId('processos', h.processoId), pe = byId('pessoas', h.pessoaId || pr?.clienteId); return {pr, pe, txt:[pe?.nome, pr ? (pr.titulo || procLabel(pr)) : ''].filter(Boolean).join(' · ') || 'Escritório (interno)'}; };

/* ----- chip do cronômetro no topo ----- */
let tsChipUlt = '';
function tsChip(){
  const el = document.getElementById('tsChip'), btn = document.getElementById('tsBtn'); if(!el) return;
  const t = tsTimer();
  if(!t){ if(tsChipUlt){ el.innerHTML = ''; tsChipUlt = ''; } btn?.classList.remove('on'); return; }
  const chave = [t.comecouEm, t.pausado, t.processoId, t.pessoaId].join('|');
  if(chave !== tsChipUlt){ tsChipUlt = chave;
    el.innerHTML = `<span class="tchip ${t.pausado ? 'pausa' : ''}" data-act="tsAbrir" title="Cronômetro — clique para pausar, parar ou trocar o processo"><span class="dot"></span><span class="nm">${esc(tsAlvo(t).txt)}</span><b></b>
      <button type="button" data-act="${t.pausado ? 'tsRetomar' : 'tsPausar'}" title="${t.pausado ? 'Retomar' : 'Pausar'}">${t.pausado ? '▶' : '⏸'}</button><button type="button" data-act="tsParar" title="Parar e salvar">⏹</button></span>`; }
  btn?.classList.add('on');
  const b = el.querySelector('b'); if(b) b.textContent = tsRelogio(tsDecorrido(t));
  const big = document.getElementById('tsBig'); if(big) big.textContent = tsRelogio(tsDecorrido(t));
}
setInterval(tsChip, 1000);

/* ----- ações do cronômetro ----- */
function tsIniciar(dados){
  const pr = byId('processos', dados.processoId);
  db.meta.timer = {processoId:dados.processoId || '', pessoaId:dados.pessoaId || pr?.clienteId || '', atividade:dados.atividade || '', descricao:dados.descricao || '', fat:dados.fat !== false,
    ini:Date.now(), acum:0, pausado:false, comecouEm:new Date().toISOString()};
  save(); tsChip(); toast('⏱️ Cronômetro iniciado' + (tsAlvo(db.meta.timer).txt ? ' — ' + tsAlvo(db.meta.timer).txt : ''));
}
function tsPausar(){ const t = tsTimer(); if(!t || t.pausado) return; t.acum = tsDecorrido(t); t.pausado = true; save(); tsChip(); toast('⏸ Cronômetro pausado'); }
function tsRetomar(){ const t = tsTimer(); if(!t || !t.pausado) return; t.ini = Date.now(); t.pausado = false; save(); tsChip(); toast('▶ Cronômetro retomado'); }
function tsDescartar(){ if(!confirm('Descartar o tempo deste cronômetro? Nada será lançado.')) return; db.meta.timer = null; save(); tsChip(); closeModal(); toast('Cronômetro descartado'); }
function tsParar(){
  const t = tsTimer(); if(!t) return;
  const ms = tsDecorrido(t), cfg = tsCfg(); let min = Math.round(ms / 60000);
  if(cfg.arred > 0 && min > 0) min = Math.ceil(min / cfg.arred) * cfg.arred;
  const fim = new Date(), ini = new Date(t.comecouEm);
  const reg = {data:isoDate(ini), ini:tsHora(ini), fim:tsHora(fim), min, processoId:t.processoId, pessoaId:t.pessoaId, atividade:t.atividade, descricao:t.descricao, fat:t.fat !== false};
  if(min < 1){ if(confirm('Menos de 1 minuto marcado. Descartar?')){ db.meta.timer = null; save(); tsChip(); closeModal(); } return; }
  // muito tempo (esqueceu ligado?) ou pausas: abre o lançamento para conferir antes de salvar
  if(ms > 8 * 3600e3){ db.meta.timer = null; save(); tsChip(); formHora(reg, `⚠️ O cronômetro ficou ligado por ${fmtMin(ms / 60000)} — confira o tempo antes de salvar.`); return; }
  db.meta.timer = null; upsert('horas', reg); tsChip(); closeModal(); render();
  toast(`✔ ${fmtMin(min)} lançadas — ${tsAlvo(reg).txt}`);
}
// abrir: sem cronômetro → escolher processo e iniciar; com cronômetro → ver, pausar, parar, trocar o processo
function tsAbrir(pre = {}){
  const t = tsTimer();
  const hoje = db.horas.filter(h => h.data === today()), totHoje = sum(hoje.map(h => h.min || 0));
  const campos = [
    {k:'processoId', label:'Processo', type:'select', options:() => procOpts(), emptyLabel:'— sem processo —'},
    {k:'pessoaId', label:'Cliente', type:'select', options:pessoasOpts, emptyLabel:'— escritório (interno) —'},
    {k:'atividade', label:'Atividade', type:'select', options:() => OPT.atividade, lista:'atividade'},
    {k:'descricao', label:'Descrição (opcional)', ph:'ex.: réplica à contestação; reunião sobre acordo'},
    {k:'fat', label:'Faturável (cobrar do cliente)', type:'check'}];
  const resumo = `<div class="small muted" style="text-align:center">Hoje: <b>${fmtMin(totHoje)}</b> em ${hoje.length} lançamento(s) · <a href="#/horas" data-tsfecha>ver relatório</a></div>`;
  if(!t){
    openForm({title:'⏱️ Cronômetro', data:{atividade:OPT.atividade[0], fat:true, ...pre}, fields:[{type:'html', html:`<div class="tsBig">00:00:00</div>`}, ...campos,
      {type:'html', html:`<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn" id="tsManual">+ Lançar horas sem cronômetro</button></div>${resumo}`}],
      after:f => { const pr = f.elements.processoId, ps = f.elements.pessoaId;
        pr.addEventListener('change', () => { const p = byId('processos', pr.value); if(p) ps.value = p.clienteId || ''; });
        const sb = f.querySelector('.mfoot button[type=submit]'); sb.textContent = '▶ Iniciar'; sb.classList.add('ok');
        f.querySelector('#tsManual').onclick = () => formHora({data:today(), processoId:pr.value, pessoaId:ps.value, atividade:f.elements.atividade.value, descricao:f.elements.descricao.value, fat:f.elements.fat.checked});
        f.querySelector('[data-tsfecha]').onclick = () => closeModal(); },
      onSave:out => { tsIniciar(out); }});
    return;
  }
  openForm({title:t.pausado ? '⏸ Cronômetro pausado' : '⏱️ Cronômetro ligado', data:{...t, fat:t.fat !== false}, fields:[{type:'html', html:`<div class="tsBig" id="tsBig">${tsRelogio(tsDecorrido(t))}</div>
      <div class="small muted" style="text-align:center;margin-top:-6px">desde ${new Date(t.comecouEm).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'})}${t.pausado ? ' · pausado' : ''}</div>`}, ...campos,
    {type:'html', html:`<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center"><button type="button" class="btn" id="tsPR">${t.pausado ? '▶ Retomar' : '⏸ Pausar'}</button><button type="button" class="btn danger" id="tsDesc">Descartar</button></div>${resumo}`}],
    after:f => {
      const sb = f.querySelector('.mfoot button[type=submit]'); sb.textContent = '⏹ Parar e salvar';
      const pr = f.elements.processoId, ps = f.elements.pessoaId;
      pr.addEventListener('change', () => { const p = byId('processos', pr.value); if(p) ps.value = p.clienteId || ''; });
      // trocar processo / atividade com o cronômetro ligado: grava na hora
      onForm(f, 'change', e => { if(!['processoId', 'pessoaId', 'atividade', 'descricao', 'fat'].includes(e.target.name)) return; const tt = tsTimer(); if(!tt) return;
        ['processoId', 'pessoaId', 'atividade', 'descricao'].forEach(k => { tt[k] = f.elements[k].value; }); tt.fat = f.elements.fat.checked; save(); tsChip(); });
      f.querySelector('#tsPR').onclick = () => { const tt = tsTimer(); tt.pausado ? tsRetomar() : tsPausar(); tsAbrir(); };
      f.querySelector('#tsDesc').onclick = tsDescartar;
      f.querySelector('[data-tsfecha]').onclick = () => closeModal(); },
    onSave:out => { Object.assign(tsTimer(), out); tsParar(); return false; }});
}

/* ----- lançamento manual / edição ----- */
function formHora(h = {}, aviso = ''){
  const isNew = !h.id;
  openForm({title:isNew ? '⏱️ Lançar horas' : '⏱️ Editar lançamento', data:{data:today(), atividade:OPT.atividade[0], ...h, fat:h.fat !== false, dur:h.min ? fmtMin(h.min) : ''}, fields:[
    ...(aviso ? [{type:'html', html:`<div class="bn" style="margin:0">${aviso}</div>`}] : []),
    {k:'data', label:'Data', type:'date', req:true},
    {k:'ini', label:'Início', type:'time'}, {k:'fim', label:'Fim', type:'time'},
    {k:'dur', label:'Tempo (se não informar início e fim)', ph:'ex.: 1h30, 45min, 2h'},
    {k:'processoId', label:'Processo', type:'select', options:() => procOpts(), emptyLabel:'— sem processo —'},
    {k:'pessoaId', label:'Cliente', type:'select', options:pessoasOpts, emptyLabel:'— escritório (interno) —'},
    {k:'atividade', label:'Atividade', type:'select', options:() => OPT.atividade, lista:'atividade'},
    {k:'descricao', label:'Descrição', full:true, ph:'ex.: réplica à contestação'},
    {k:'fat', label:'Faturável (cobrar do cliente)', type:'check'}],
    after:f => { const pr = f.elements.processoId, ps = f.elements.pessoaId, ini = f.elements.ini, fim = f.elements.fim, dur = f.elements.dur;
      pr.addEventListener('change', () => { const p = byId('processos', pr.value); if(p) ps.value = p.clienteId || ''; });
      const calc = () => { const m = tsMinEntre(ini.value, fim.value); if(m) dur.value = fmtMin(m); };
      ini.addEventListener('change', calc); fim.addEventListener('change', calc);
      dur.addEventListener('change', () => { const m = tsParseDur(dur.value); if(m && ini.value){ const [h0, m0] = ini.value.split(':').map(Number), t = (h0 * 60 + m0 + m) % 1440; fim.value = pad(Math.floor(t / 60)) + ':' + pad(t % 60); } }); },
    onSave:v => { const min = tsParseDur(v.dur) || tsMinEntre(v.ini, v.fim);
      if(!min){ toast('Informe início e fim, ou o tempo (ex.: 1h30)'); return false; }
      const {dur, ...rest} = v; const r = upsert('horas', {...h, ...rest, min}); toast(`${isNew ? 'Lançado' : 'Atualizado'}: ${fmtMin(min)} — ${tsAlvo(r).txt}`); },
    onDelete:isNew ? null : () => { if(!confirm('Excluir este lançamento de horas?')) return false; removeItem('horas', h.id); }});
}
/* ----- tela “Horas trabalhadas” ----- */
const FH = {per:'mes', ref:null, de:'', ate:'', pessoaId:'', processoId:'', valor:''};
function tsPeriodo(){
  const t = today(); if(!FH.ref) FH.ref = t;
  if(FH.per === 'semana'){ const ini = addDays(FH.ref, -parseD(FH.ref).getDay()), fim = addDays(ini, 6); return {ini, fim, nome:`Semana de ${fmtD(ini).slice(0, 5)} a ${fmtD(fim)}`}; }
  if(FH.per === 'periodo'){ const ini = FH.de || t.slice(0, 8) + '01', fim = FH.ate || t; return {ini, fim, nome:`${fmtD(ini)} a ${fmtD(fim)}`}; }
  const ini = FH.ref.slice(0, 8) + '01', fim = addDays(addMonths(ini, 1), -1), nm = parseD(ini).toLocaleDateString('pt-BR', {month:'long', year:'numeric'});
  return {ini, fim, nome:nm.charAt(0).toUpperCase() + nm.slice(1)};
}
function tsBarras(pares, cor){
  const max = Math.max(1, ...pares.map(x => x[1]));
  return pares.map(([n, m, href]) => `<div class="hBar"><div class="hBarT"><span>${href ? `<a href="${href}">${esc(n)}</a>` : esc(n)}</span><b>${fmtMin(m)}</b></div><div class="hBarB"><i style="width:${m / max * 100}%;${cor ? 'background:' + cor : ''}"></i></div></div>`).join('') || '<div class="empty">Nada lançado no período.</div>';
}
function tsTabela(hs, ctx = {}){
  if(!hs.length) return '<div class="empty">Nenhum lançamento.</div>';
  return `<div class="tablewrap"><table><thead><tr><th>Data</th>${ctx.noAlvo ? '' : '<th>Cliente / processo</th>'}<th>Atividade</th><th>Descrição</th><th style="text-align:right">Tempo</th><th></th></tr></thead><tbody>
    ${hs.map(h => { const a = tsAlvo(h); return `<tr><td style="white-space:nowrap">${fmtD(h.data)}${h.ini ? `<div class="small muted">${h.ini}${h.fim ? '–' + h.fim : ''}</div>` : ''}</td>
      ${ctx.noAlvo ? '' : `<td>${a.pe ? linkP(a.pe.id) : '<span class="muted">Escritório (interno)</span>'}${a.pr ? `<div class="small"><a href="#/processo/${a.pr.id}">${esc(a.pr.titulo || procLabel(a.pr))}</a></div>` : ''}</td>`}
      <td>${esc(h.atividade || '')}${tsFat(h) ? '' : ' <span class="tag grey">não faturável</span>'}</td><td>${esc(h.descricao || '')}</td><td style="text-align:right;font-weight:600;white-space:nowrap">${fmtMin(h.min)}</td>
      <td style="text-align:right"><button class="mini" data-act="editHora" data-id="${h.id}">editar</button></td></tr>`; }).join('')}</tbody></table></div>`;
}
VIEWS.horas = () => {
  const P = tsPeriodo(), cfg = tsCfg();
  const hs = db.horas.filter(h => h.data >= P.ini && h.data <= P.fim && (!FH.pessoaId || (h.pessoaId || byId('processos', h.processoId)?.clienteId) === FH.pessoaId))
    .sort((a, b) => (b.data + (b.ini || '')).localeCompare(a.data + (a.ini || '')));
  const tot = sum(hs.map(h => h.min || 0)), emProc = sum(hs.filter(h => h.processoId).map(h => h.min || 0)), totFat = sum(hs.filter(tsFat).map(h => h.min || 0));
  const agrupa = fn => { const m = new Map(); hs.forEach(h => { const [k, n, href] = fn(h); const x = m.get(k) || [n, 0, href]; x[1] += h.min || 0; m.set(k, x); }); return [...m.values()].sort((a, b) => b[1] - a[1]); };
  const porCli = agrupa(h => { const a = tsAlvo(h); return a.pe ? [a.pe.id, a.pe.nome, '#/pessoa/' + a.pe.id] : ['_', 'Escritório (interno)', '']; });
  const porAtiv = agrupa(h => [h.atividade || '—', h.atividade || 'Sem atividade', '']);
  const porProc = agrupa(h => { const pr = byId('processos', h.processoId); return pr ? [pr.id, (pessoaNome(pr.clienteId) ? pessoaNome(pr.clienteId) + ' · ' : '') + (pr.titulo || procLabel(pr)), '#/processo/' + pr.id] : ['_', 'Sem processo', '']; });
  const nav = FH.per === 'periodo' ? `<input type="date" id="fhDe" value="${P.ini}"> a <input type="date" id="fhAte" value="${P.fim}">`
    : `<button class="mini" data-act="fhNav" data-d="-1">‹</button><b style="min-width:150px;text-align:center">${P.nome}</b><button class="mini" data-act="fhNav" data-d="1">›</button><button class="mini" data-act="fhNav" data-d="0">hoje</button>`;
  const seg = `<div class="seg">${[['semana', 'Semana'], ['mes', 'Mês'], ['periodo', 'Período']].map(([v, t]) => `<button class="${FH.per === v ? 'on' : ''}" data-act="fhPer" data-v="${v}">${t}</button>`).join('')}</div>`;
  const t = tsTimer();
  return `<h1>⏱️ Horas trabalhadas<span class="sp"></span><button class="btn" data-act="horasCsv">⬇ Exportar (Excel)</button><button class="btn" data-act="newHora">+ Lançar horas</button><button class="btn primary" data-act="tsAbrir">${t ? '⏱️ Cronômetro ligado' : '▶ Iniciar cronômetro'}</button></h1>
  <div class="toolbar" style="align-items:center;gap:8px;flex-wrap:wrap">${seg}${nav}<span class="sp" style="flex:1"></span>
    <select id="fhCli" style="width:auto"><option value="">Todos os clientes</option>${opts(db.pessoas.filter(p => p.tipo === 'Cliente').sort((a, b) => a.nome.localeCompare(b.nome)).map(p => ({v:p.id, t:p.nome})), FH.pessoaId)}</select></div>
  <div class="stats"><div class="stat"><div class="n">${fmtMin(tot)}</div><div class="l">Total — ${esc(P.nome)}</div></div>
    <div class="stat"><div class="n">${fmtMin(emProc)}</div><div class="l">Em processos</div></div>
    <div class="stat"><div class="n">${fmtMin(tot - emProc)}</div><div class="l">Atendimento / interno (sem processo)</div></div>
    <div class="stat calcV"><div class="l">🧮 Calcular valor — ${fmtMin(totFat)} faturáveis</div><div style="display:flex;gap:6px;align-items:center;margin:4px 0">R$ <input id="fhValor" type="number" min="0" step="0.01" placeholder="valor da hora" value="${FH.valor || ''}" style="width:110px"> /h</div><div class="n" id="fhValorRes">${FH.valor ? money(totFat / 60 * FH.valor) : '—'}</div></div></div>
  <div class="grid2"><div class="card"><h2>Por cliente</h2>${tsBarras(porCli)}</div><div class="card"><h2>Por atividade</h2>${tsBarras(porAtiv, '#0f9b8e')}</div></div>
  <div class="card"><h2>Por processo</h2>${tsBarras(porProc, '#7c5cc4')}</div>
  <div class="card"><h2>Lançamentos <span class="tag grey">${hs.length}</span></h2>${tsTabela(hs)}</div>`;
};
// aba / quadro nas fichas
function tsAbaProcesso(p){
  const hs = db.horas.filter(h => h.processoId === p.id).sort((a, b) => (b.data + (b.ini || '')).localeCompare(a.data + (a.ini || ''))), tot = sum(hs.map(h => h.min || 0)), cfg = tsCfg();
  const mes = today().slice(0, 7), totMes = sum(hs.filter(h => h.data.startsWith(mes)).map(h => h.min || 0));
  return `<div class="toolbar"><button class="btn primary" data-act="tsIniciarAqui" data-proc="${p.id}">▶ Iniciar cronômetro neste processo</button><button class="btn" data-act="newHora" data-proc="${p.id}">+ Lançar horas</button></div>
    <div class="small" style="margin:0 0 10px">Total dedicado: <b>${fmtMin(tot)}</b> · neste mês: <b>${fmtMin(totMes)}</b>${hs.some(h => !tsFat(h)) ? ` · faturáveis: <b>${fmtMin(sum(hs.filter(tsFat).map(h => h.min || 0)))}</b>` : ''}</div>
    ${hs.length ? tsBarras((() => { const m = new Map(); hs.forEach(h => m.set(h.atividade || 'Sem atividade', (m.get(h.atividade || 'Sem atividade') || 0) + (h.min || 0))); return [...m].sort((a, b) => b[1] - a[1]); })(), '#0f9b8e') + '<div style="height:10px"></div>' : ''}
    ${tsTabela(hs, {noAlvo:true})}`;
}
function tsQuadroPessoa(id){
  const hs = db.horas.filter(h => (h.pessoaId || byId('processos', h.processoId)?.clienteId) === id); if(!hs.length) return '';
  const tot = sum(hs.map(h => h.min || 0)), mes = today().slice(0, 7), totMes = sum(hs.filter(h => h.data.startsWith(mes)).map(h => h.min || 0)), cfg = tsCfg();
  const m = new Map(); hs.forEach(h => { const pr = byId('processos', h.processoId), k = pr ? pr.id : '_'; const x = m.get(k) || [pr ? (pr.titulo || procLabel(pr)) : 'Sem processo (atendimento)', 0, pr ? '#/processo/' + pr.id : '']; x[1] += h.min || 0; m.set(k, x); });
  return `<div class="card"><h2>⏱️ Horas dedicadas<span class="sp"></span><button class="mini" data-act="tsIniciarAqui" data-pessoa="${id}">▶ cronômetro</button> <button class="mini" data-act="horasDoCliente" data-id="${id}">ver lançamentos</button></h2>
    <div class="small" style="margin:-4px 0 8px">Total: <b>${fmtMin(tot)}</b> · neste mês: <b>${fmtMin(totMes)}</b>${hs.some(h => !tsFat(h)) ? ` · faturáveis: <b>${fmtMin(sum(hs.filter(tsFat).map(h => h.min || 0)))}</b>` : ''}</div>
    ${tsBarras([...m.values()].sort((a, b) => b[1] - a[1]))}</div>`;
}
function tsCsv(){
  const P = tsPeriodo(), hs = db.horas.filter(h => h.data >= P.ini && h.data <= P.fim && (!FH.pessoaId || (h.pessoaId || byId('processos', h.processoId)?.clienteId) === FH.pessoaId)).sort((a, b) => (a.data + (a.ini || '')).localeCompare(b.data + (b.ini || '')));
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"', vh = Number(FH.valor) || 0;
  const linhas = [['Data', 'Início', 'Fim', 'Cliente', 'Processo', 'Número', 'Atividade', 'Descrição', 'Faturável', 'Minutos', 'Horas', ...(vh ? ['Valor (R$)'] : [])].map(q).join(';'),
    ...hs.map(h => { const a = tsAlvo(h); return [fmtD(h.data), h.ini || '', h.fim || '', a.pe?.nome || 'Escritório (interno)', a.pr?.titulo || '', a.pr?.numero || '', h.atividade || '', h.descricao || '', tsFat(h) ? 'sim' : 'não', h.min, (h.min / 60).toFixed(2).replace('.', ','),
      ...(vh ? [tsFat(h) ? (h.min / 60 * vh).toFixed(2).replace('.', ',') : '0,00'] : [])].map(q).join(';'); })];
  download(`horas-${P.ini}-a-${P.fim}.csv`, '﻿' + linhas.join('\r\n'), 'text/csv;charset=utf-8');
}
Object.assign(A, {
  tsAbrir: () => tsAbrir(), tsPausar: () => tsPausar(), tsRetomar: () => tsRetomar(),
  tsParar: () => { if(confirm(`Parar o cronômetro e lançar ${fmtMin(tsDecorrido(tsTimer()) / 60000)}?`)) tsParar(); },
  tsIniciarAqui: d => { if(tsTimer()){ toast('Já há um cronômetro ligado — pare-o ou troque o processo nele'); tsAbrir(); return; } const pr = byId('processos', d.proc); tsAbrir({processoId:d.proc || '', pessoaId:d.pessoa || pr?.clienteId || ''}); },
  newHora: d => { const pr = byId('processos', d.proc); formHora({data:today(), processoId:d.proc || '', pessoaId:pr?.clienteId || ''}); },
  editHora: d => formHora(byId('horas', d.id)),
  horasCsv: () => tsCsv(),
  horasDoCliente: d => { FH.pessoaId = d.id; FH.per = 'periodo'; FH.de = '2000-01-01'; FH.ate = today(); go('#/horas'); },
  fhPer: d => { FH.per = d.v; if(d.v === 'periodo' && !FH.de){ FH.de = today().slice(0, 8) + '01'; FH.ate = today(); } render(); },
  fhNav: d => { const r = FH.ref || today(); FH.ref = d.d === '0' ? today() : FH.per === 'semana' ? addDays(r, 7 * Number(d.d)) : addMonths(r.slice(0, 8) + '01', Number(d.d)); render(); },
  equipe: () => openForm({title:'👥 Comunicação interna', soFechar:true, fields:[{type:'html', html:`<div style="text-align:center;padding:10px 6px"><div style="font-size:44px">🚧</div><b>Em breve</b>
    <p class="small muted">Mensagens, recados e tarefas entre a equipe. Fica disponível quando o sistema passar a ter mais de um usuário.</p></div>`}]}),
});
document.addEventListener('input', e => { if(e.target.id !== 'fhValor') return; FH.valor = e.target.value;
  const r = document.getElementById('fhValorRes'), tf = sum(db.horas.filter(h => { const P = tsPeriodo(); return h.data >= P.ini && h.data <= P.fim && tsFat(h) && (!FH.pessoaId || (h.pessoaId || byId('processos', h.processoId)?.clienteId) === FH.pessoaId); }).map(h => h.min || 0));
  if(r) r.textContent = Number(FH.valor) ? money(tf / 60 * Number(FH.valor)) : '—'; });
document.addEventListener('change', e => {
  if(e.target.id === 'fhCli'){ FH.pessoaId = e.target.value; render(); }
  if(e.target.id === 'fhDe' || e.target.id === 'fhAte'){ FH[e.target.id === 'fhDe' ? 'de' : 'ate'] = e.target.value; render(); }
});
