// Meu Escritório — Publicações do DJEN, movimentações (robô: PUSH e DataJud) e importação de processos da OAB
'use strict';
/* ================= PUBLICAÇÕES (DJEN) E MOVIMENTAÇÕES (DataJud) ================= */
const MON_OAB_PADRAO = [{numero:'355980', uf:'SP'}];
const MON_LS = 'escritorio_monitor_v1';   // estado deste aparelho (últimas buscas)
function monCfg(){ const m = db.meta.monitor || {};
  return {oabs: Array.isArray(m.oabs) && m.oabs.length ? m.oabs : MON_OAB_PADRAO, ativo: m.ativo !== false, roboUrl: m.roboUrl || '', roboToken: m.roboToken || ''}; }
function monLocal(){ try{ return JSON.parse(localStorage.getItem(MON_LS)) || {}; }catch(e){ return {}; } }
function setMonLocal(o){ try{ localStorage.setItem(MON_LS, JSON.stringify({...monLocal(), ...o})); }catch(e){} }
const mascaraCnj = s => { const d = digits(s); return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16)}` : String(s || ''); };
const limparHtml = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|tr)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
// DJEN: publicação = 1º dia útil após a disponibilização; o prazo começa no dia útil seguinte à publicação
const pubDataPublicacao = disp => { let d = addDays(disp, 1); while(!isBusiness(d, false)) d = addDays(d, 1); return d; };
const pubInicioPrazo = disp => { let d = addDays(pubDataPublicacao(disp), 1); while(!isBusiness(d, true)) d = addDays(d, 1); return d; };
function procPorNumero(n){ const d = digits(n); return d.length === 20 ? db.processos.find(p => digits(p.numero) === d) || null : null; }
const monProc = it => byId('processos', it.processoId) || procPorNumero(it.numero);
const monNovas = tipo => db.monitor.filter(m => m.status === 'nova' && (!tipo || m.tipo === tipo));
const monEm = ts => ts ? new Date(ts).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : 'nunca';
let monBusy = {djen:false, robo:false, agenda:false};

function pubDoDjen(x, id, o){
  const num = x.numeroprocessocommascara || x.numero_processo || x.numeroProcesso || '';
  let disp = String(x.data_disponibilizacao || '').slice(0, 10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(disp)){ const m = String(x.datadisponibilizacao || '').match(/(\d{2})\/(\d{2})\/(\d{4})/); disp = m ? `${m[3]}-${m[2]}-${m[1]}` : today(); }
  const pr = procPorNumero(num);
  return {id, tipo:'publicacao', fonte:'DJEN', status:'nova', numero:mascaraCnj(num), data:disp, tribunal:x.siglaTribunal || '', orgao:x.nomeOrgao || '',
    titulo:[x.tipoComunicacao, x.tipoDocumento, x.nomeClasse].filter(Boolean).join(' · '), texto:limparHtml(x.texto).slice(0, 30000), link:x.link || '',
    processoId:pr?.id || '', oab:`${o.numero}/${o.uf}`, cancelada: x.ativo === false || !!x.data_cancelamento, criadoEm:disp};
}
async function djenBuscar(motivo){
  const cfg = monCfg(); if(!cfg.ativo || monBusy.djen) return {novos:0, erro:''};
  monBusy.djen = true; setMonLocal({djenTent:Date.now()});
  const t = today(), L = monLocal();
  const ini = L.djenAte && L.djenAte > addDays(t, -30) ? L.djenAte : addDays(t, -10);
  const existentes = new Set(db.monitor.map(m => m.id)), novos = []; let erro = '';
  try{
    for(const o of cfg.oabs){
      for(let pag = 1; pag <= 20; pag++){
        const q = new URLSearchParams({numeroOab:digits(o.numero), ufOab:String(o.uf || '').toUpperCase(), dataDisponibilizacaoInicio:ini, dataDisponibilizacaoFim:t, pagina:pag, itensPorPagina:100});
        const r = await fetch('https://comunicaapi.pje.jus.br/api/v1/comunicacao?' + q, {headers:{Accept:'application/json'}});
        if(!r.ok) throw new Error('o DJEN respondeu com erro ' + r.status);
        const j = await r.json(), it = j.items || [];
        it.forEach(x => { const id = 'djen:' + (x.id || x.hash); if(existentes.has(id)) return; existentes.add(id); novos.push(pubDoDjen(x, id, o)); });
        if(it.length < 100) break;
      }
    }
  }catch(e){ erro = /fetch|network|load/i.test(e.message) ? 'sem conexão com o DJEN' : e.message; }
  if(novos.length){ db.monitor.push(...novos); save(); }
  setMonLocal(erro ? {djenErro:erro} : {djenAte:t, djenUlt:Date.now(), djenErro:''});
  monBusy.djen = false;
  if(novos.length){ toast(`📰 ${novos.length} publicação(ões) nova(s) no DJEN`); roboEnviarPubs(novos); }
  if(novos.length || motivo === 'manual' || naTelaPub()) renderSeguro(); else updateCounts();
  return {novos:novos.length, erro};
}
async function roboChamar(params, corpo){
  const c = monCfg(); if(!c.roboUrl || !c.roboToken) throw new Error('robô não configurado');
  const r = corpo ? await fetch(c.roboUrl, {method:'POST', body:JSON.stringify({token:c.roboToken, ...corpo}), keepalive:!!corpo.agenda})
                  : await fetch(c.roboUrl + (c.roboUrl.includes('?') ? '&' : '?') + new URLSearchParams({token:c.roboToken, ...params}));
  let j; try{ j = await r.json(); }catch(e){ throw new Error('o robô não respondeu corretamente (confira o endereço e a implantação)'); }
  if(!j.ok) throw new Error(j.erro || 'erro no robô');
  return j;
}
function roboEnviarPubs(itens){
  if(!monCfg().roboUrl) return;
  roboChamar(null, {publicacoes: itens.map(({id, tipo, fonte, numero, data, tribunal, orgao, titulo, texto, link}) => ({id, tipo, fonte, numero, data, tribunal, orgao, titulo, texto:String(texto || '').slice(0, 20000), link}))}).catch(() => {});
}
async function roboSincronizar(motivo){
  const c = monCfg(); if(!c.roboUrl || !c.roboToken || monBusy.robo) return {novos:0, erro:''};
  monBusy.robo = true; setMonLocal({roboTent:Date.now()});
  const L = monLocal(); let erro = '', novos = 0;
  try{
    const nums = [...new Set(db.processos.filter(p => !INATIVOS.includes(p.status)).map(p => digits(p.numero)).filter(d => d.length === 20))].sort(), h = nums.join(',');
    if(h !== L.roboLista || Date.now() - (L.roboListaEm || 0) > 3 * 864e5){ await roboChamar(null, {processos:nums}); setMonLocal({roboLista:h, roboListaEm:Date.now()}); }
    const r = await roboChamar({acao:'itens', desde:L.roboDesde || ''});
    const ex = new Set(db.monitor.map(m => m.id)); let maxC = L.roboDesde || '';
    (r.itens || []).forEach(i => { if(String(i.capturadoEm) > maxC) maxC = String(i.capturadoEm); if(!i.id || ex.has(i.id)) return; ex.add(i.id);
      const pr = procPorNumero(i.numero), dt = String(i.data || '').slice(0, 10);
      db.monitor.push({id:i.id, tipo:i.tipo === 'publicacao' ? 'publicacao' : 'movimento', fonte:i.fonte || 'DataJud', status:'nova', numero:mascaraCnj(i.numero), data:dt, tribunal:i.tribunal || '', orgao:i.orgao || '',
        titulo:i.titulo || '', texto:String(i.texto || '').slice(0, 30000), link:i.link || '', processoId:pr?.id || '', criadoEm:dt}); novos++; });
    if(novos) save();
    setMonLocal({roboDesde:maxC, roboUlt:Date.now(), roboErro:'', roboExec:r.ultimaExecucao || ''});
  }catch(e){ erro = /fetch|network|load/i.test(e.message) ? 'sem conexão com o robô' : e.message; setMonLocal({roboErro:erro}); }
  monBusy.robo = false;
  if(novos){ toast(`⚖️ ${novos} movimentação(ões) nova(s) (PUSH / DataJud)`); renderSeguro(); } else if(motivo === 'manual' || naTelaPub()) renderSeguro(); else updateCounts();
  return {novos, erro};
}
// agenda enviada ao robô para o e-mail diário (próximos 30 dias + atrasados)
function agendaParaRobo(){
  const lim = addDays(today(), 30);
  return db.prazos.filter(p => !p.concluido && p.data && p.data <= lim).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || ''))).slice(0, 250).map(p => {
    const pr = byId('processos', p.processoId), pe = byId('pessoas', p.pessoaId || pr?.clienteId);
    return {id:p.id, data:p.data, hora:p.diaInteiro ? '' : (p.hora || ''), horaFim:p.diaInteiro ? '' : (p.horaFim || ''), tipo:p.tipo || '', subtipo:p.subtipo || '', titulo:String(p.titulo || '').slice(0, 200),
      processo:pr ? procLabel(pr).slice(0, 160) : '', cliente:pe?.nome || '', local:String(p.local || '').slice(0, 200), dataFatal:p.dataFatal || '', reagendadoDe:p.reagendadoDe || ''}; });
}
async function roboEnviarAgenda(forcar){
  const c = monCfg(); if(!c.roboUrl || !c.roboToken || monBusy.agenda || !navigator.onLine) return;
  const ag = agendaParaRobo(), h = JSON.stringify(ag), L = monLocal();
  if(!forcar && h === L.agendaHash && Date.now() - (L.agendaEm || 0) < 12 * 3600e3) return;
  monBusy.agenda = true;
  try{ await roboChamar(null, {agenda:ag}); setMonLocal({agendaHash:h, agendaEm:Date.now(), agendaErro:''}); }
  catch(e){ setMonLocal({agendaErro:e.message}); }
  finally{ monBusy.agenda = false; if(naTelaPub()) renderSeguro(); }
}
const naTelaPub = () => location.hash.startsWith('#/publicacoes');
function monitorAuto(){
  if(document.visibilityState !== 'visible' || !navigator.onLine) return;
  const L = monLocal(), agora = Date.now(), c = monCfg();
  const vencido = (ult, tent) => agora - (ult || 0) > 2 * 3600e3 && agora - (tent || 0) > 20 * 60e3;
  if(c.ativo && vencido(L.djenUlt, L.djenTent)) djenBuscar('auto');
  if(c.roboUrl && vencido(L.roboUlt, L.roboTent)) roboSincronizar('auto');
  if(c.roboUrl) roboEnviarAgenda();
}
function monLimpar(){ // guarda o texto completo por 120 dias depois de tratado; remove após ~13 meses
  const t = today(), lim = addDays(t, -120), limDel = addDays(t, -400); let mud = false;
  db.monitor = db.monitor.filter(m => { if(m.status !== 'nova' && m.data < limDel){ mud = true; return false; } return true; });
  db.monitor.forEach(m => { if(m.status !== 'nova' && m.data < lim && m.texto){ m.texto = ''; mud = true; } });
  if(mud) save();
}
function pubDescricao(it){
  return `Publicação no DJEN (${it.tribunal}${it.orgao ? ' — ' + it.orgao : ''}). Disponibilizada em ${fmtD(it.data)}; considera-se publicada em ${fmtD(pubDataPublicacao(it.data))}.${it.titulo ? '\n' + it.titulo : ''}\n\n${it.texto || ''}`.trim();
}
function iaPrefill(txt){ const el = document.getElementById('iaTxt'); if(el) el.value = txt; }
function monBannerProc(id){
  const n = db.monitor.filter(m => m.status === 'nova' && monProc(m)?.id === id);
  if(!n.length) return '';
  const np = n.filter(m => m.tipo === 'publicacao').length, nm = n.length - np;
  return `<div class="card" style="border-color:var(--warn);background:var(--warnSoft);padding:10px 14px">📰 ${[np ? `<b>${np}</b> publicação(ões) nova(s)` : '', nm ? `<b>${nm}</b> movimentação(ões) a confirmar` : ''].filter(Boolean).join(' e ')} neste processo. <a href="#/publicacoes" data-act="tab" data-g="mon" data-tab="${np ? 'pub' : 'mov'}">Ver ›</a></div>`;
}
function pubItem(it){
  const pr = monProc(it), nova = it.status === 'nova';
  const st = {lida:'<span class="tag grey">lida</span>', ignorada:'<span class="tag grey">ignorada</span>', registrada:'<span class="tag ok">andamento registrado</span>', prazo:'<span class="tag ok">prazo criado</span>'}[it.status] || '';
  return `<div class="li"><div class="grow">
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">${pr ? `<a href="#/processo/${pr.id}"><b>${esc(procLabel(pr))}</b></a>` : `<b>${esc(it.numero || 's/ nº')}</b> <span class="tag warn">processo não cadastrado</span>`}
      <span class="tag grey">${esc(it.tribunal)}</span>${it.cancelada ? '<span class="tag bad">cancelada</span>' : ''}${st}</div>
    ${it.orgao || it.titulo ? `<div class="sub">${esc([it.orgao, it.titulo].filter(Boolean).join(' · '))}</div>` : ''}
    <div class="sub">Disponibilizada em <b>${fmtD(it.data)}</b> · publicação em <b>${fmtD(pubDataPublicacao(it.data))}</b> · prazo começa a contar em <b>${fmtD(pubInicioPrazo(it.data))}</b></div>
    ${it.texto ? `<div class="tl-body clamp" style="margin-top:6px">${nl2br(it.texto)}</div><button class="verMais" data-act="verMais">ver mais ▾</button>` : ''}
    <div class="toolbar" style="margin:8px 0 0">${nova ? `
      <button class="btn primary" data-act="pubAnd" data-id="${esc(it.id)}">📄 Registrar andamento</button>
      <button class="btn" data-act="pubPrazo" data-id="${esc(it.id)}">📅 Criar prazo</button>
      ${pr ? '' : `<button class="btn" data-act="pubCadProc" data-id="${esc(it.id)}">📁 Cadastrar processo</button>`}
      <button class="mini" data-act="monStatus" data-id="${esc(it.id)}" data-st="lida">✔ marcar como lida</button>
      <button class="mini" data-act="monStatus" data-id="${esc(it.id)}" data-st="ignorada">ignorar</button>` : `<button class="mini" data-act="monStatus" data-id="${esc(it.id)}" data-st="nova">↩ voltar para novas</button>`}
      ${it.link ? `<a class="mini" href="${esc(it.link)}" target="_blank" rel="noopener">documento ↗</a>` : ''}</div>
  </div></div>`;
}
function movLinha(it){
  const nova = it.status === 'nova';
  return `<div class="li"><div style="min-width:78px"><b>${fmtD(it.data)}</b><div><span class="tag ${/^PUSH/.test(it.fonte) ? 'ok' : 'grey'}" title="Origem">${esc(/^PUSH/.test(it.fonte) ? 'PUSH' : it.fonte || 'DataJud')}</span></div></div><div class="grow"><b>${esc(it.titulo)}</b>${it.texto ? ` <span class="sub">— ${esc(it.texto)}</span>` : ''}${it.orgao ? `<div class="sub">${esc(it.orgao)}</div>` : ''}</div>
    ${nova ? `<button class="mini" data-act="movConfirmar" data-id="${esc(it.id)}" title="Registrar como andamento">✔ confirmar</button><button class="mini" data-act="monStatus" data-id="${esc(it.id)}" data-st="descartada" title="Descartar">✕</button>`
      : `<span class="tag ${it.status === 'confirmada' ? 'ok' : 'grey'}">${it.status === 'confirmada' ? 'virou andamento' : 'descartada'}</span><button class="mini" data-act="monStatus" data-id="${esc(it.id)}" data-st="nova">↩</button>`}</div>`;
}
VIEWS.publicacoes = () => {
  const tab = tabs.mon || 'pub', L = monLocal(), c = monCfg();
  const pubs = monNovas('publicacao').sort((a, b) => a.data.localeCompare(b.data)), movs = monNovas('movimento');
  const T = (k, l, n) => `<button data-act="tab" data-g="mon" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n != null ? ` (${n})` : ''}</button>`;
  let body = '';
  if(tab === 'pub') body = (pubs.length > 1 ? `<div class="toolbar"><span class="small muted">Mais antigas primeiro.</span><span class="sp"></span><button class="mini" data-act="monTodasLidas" data-tipo="publicacao">marcar todas como lidas</button></div>` : '')
    + (pubs.map(pubItem).join('') || '<div class="empty">Nenhuma publicação nova. 🎉</div>');
  if(tab === 'mov'){
    const grupos = {}; movs.forEach(m => { const k = monProc(m)?.id || m.numero; (grupos[k] = grupos[k] || []).push(m); });
    body = (!c.roboUrl ? `<div class="card" style="background:var(--warnSoft)">Para receber as movimentações do DataJud, configure o <b>robô</b> (Google Apps Script) em <a href="#" data-act="monConfig">⚙️ Configurar</a>.</div>` : '')
      + `<p class="small muted"><span class="tag ok">PUSH</span> vem dos e-mails do PUSH dos tribunais (chega no mesmo dia). <span class="tag grey">DataJud</span> vem do CNJ e pode atrasar dias ou semanas. Confirme para virar andamento do processo.</p>`
      + (Object.keys(grupos).map(k => { const its = grupos[k].sort((a, b) => b.data.localeCompare(a.data)), pr = monProc(its[0]);
        return `<div class="card"><h2>${pr ? `<a href="#/processo/${pr.id}">${esc(procLabel(pr))}</a>` : esc(its[0].numero)}<span class="sp"></span><button class="mini" data-act="movConfirmarTodas" data-k="${esc(k)}">✔ confirmar todas (${its.length})</button><button class="mini" data-act="movDescartarTodas" data-k="${esc(k)}">descartar todas</button></h2>${its.map(movLinha).join('')}</div>`; }).join('')
      || '<div class="empty">Nenhuma movimentação nova.</div>');
  }
  if(tab === 'hist'){ const h = db.monitor.filter(m => m.status !== 'nova').sort((a, b) => b.data.localeCompare(a.data)).slice(0, 150);
    body = h.map(m => m.tipo === 'publicacao' ? pubItem(m) : movLinha(m)).join('') || '<div class="empty">Nada tratado ainda.</div>'; }
  const linha = (rot, ult, err) => `${rot}: ${err ? `<b style="color:var(--bad)">⚠️ ${esc(err)}</b>` : 'ok'} · última busca ${monEm(ult)}`;
  return `<h1>📰 Publicações e andamentos<span class="sp"></span><button class="btn" data-act="monBuscar">🔄 Buscar agora</button><button class="btn" data-act="monConfig">⚙️ Configurar</button></h1>
  <div class="small muted" style="margin:-6px 0 12px">${c.ativo ? linha(`DJEN (OAB ${c.oabs.map(o => esc(o.numero + '/' + o.uf)).join(', ')})`, L.djenUlt, L.djenErro) : 'DJEN: busca desligada'}
    <br>${c.roboUrl ? linha('Robô (PUSH / DataJud)', L.roboUlt, L.roboErro) + (L.roboExec ? ` · robô rodou em ${monEm(L.roboExec)}` : '') + `<br>Agenda para o e-mail diário: ${L.agendaErro ? `<b style="color:var(--bad)">⚠️ ${esc(L.agendaErro)}</b>` : 'enviada em ' + monEm(L.agendaEm)}` : 'Robô (PUSH / DataJud): não configurado'}</div>
  <div class="card"><div class="tabs">${T('pub', '📰 Publicações', pubs.length)}${T('mov', '⚖️ Movimentações', movs.length)}${T('hist', '🗂️ Histórico')}</div>${body}
  <p class="small muted" style="margin:12px 0 0">Ferramenta de apoio: não substitui a conferência no DJEN, no Domicílio Judicial Eletrônico e nos sistemas dos tribunais (comunicações pessoais e intimações feitas dentro dos sistemas não passam pelo DJEN).</p></div>`;
};
Object.assign(A, {
  monBuscar: async () => { toast('🔄 Buscando…'); const [a, b] = await Promise.all([djenBuscar('manual'), roboSincronizar('manual')]);
    const msg = [a.erro ? 'DJEN: ' + a.erro : `DJEN: ${a.novos} nova(s)`, monCfg().roboUrl ? (b.erro ? 'Robô: ' + b.erro : `Movimentações: ${b.novos} nova(s)`) : ''].filter(Boolean).join(' · ');
    toast(msg); renderSeguro(); },
  monStatus: d => { const it = byId('monitor', d.id); if(!it) return; upsert('monitor', {id:it.id, status:d.st}); render(); },
  monTodasLidas: d => { const l = monNovas(d.tipo); if(!l.length || !confirm(`Marcar ${l.length} publicação(ões) como lidas?`)) return; l.forEach(m => m.status = 'lida'); save(); render(); },
  pubAnd: d => { const it = byId('monitor', d.id); if(!it) return; const pr = monProc(it);
    formAnd({processoId:pr?.id || '', data:pubDataPublicacao(it.data), tipo:'Publicação / Intimação', descricao:pubDescricao(it)}, salvo => upsert('monitor', {id:it.id, status:'registrada', andamentoId:salvo.id, processoId:salvo.processoId || it.processoId}));
    iaPrefill(pubDescricao(it)); },
  pubPrazo: d => { const it = byId('monitor', d.id); if(!it) return; const pr = monProc(it);
    formPrazo({processoId:pr?.id || '', pessoaId:pr?.clienteId || '', tipo:'Prazo processual', obs:`Publicação DJEN disponibilizada em ${fmtD(it.data)} (publicação em ${fmtD(pubDataPublicacao(it.data))}).`}, salvo => upsert('monitor', {id:it.id, status:'prazo', prazoId:salvo.id}));
    iaPrefill(pubDescricao(it)); },
  pubCadProc: d => { const it = byId('monitor', d.id); if(it) formProc({numero:it.numero}); },
  movConfirmar: d => { movConfirmarLista([byId('monitor', d.id)].filter(Boolean)); },
  movConfirmarTodas: d => { const l = monNovas('movimento').filter(m => (monProc(m)?.id || m.numero) === d.k); if(l.length && confirm(`Registrar ${l.length} movimentação(ões) como andamentos?`)) movConfirmarLista(l); },
  movDescartarTodas: d => { const l = monNovas('movimento').filter(m => (monProc(m)?.id || m.numero) === d.k); if(!l.length || !confirm(`Descartar ${l.length} movimentação(ões)?`)) return; l.forEach(m => m.status = 'descartada'); save(); render(); },
  monConfig: () => {
    const c = monCfg();
    openForm({ title:'⚙️ Publicações e andamentos — configuração', data:{oabs:c.oabs.map(o => `${o.numero}/${o.uf}`).join('; '), ativo:c.ativo, roboUrl:c.roboUrl, roboToken:c.roboToken},
      fields:[
        {type:'sect', label:'📰 Publicações (DJEN) — buscadas pelo próprio app'},
        {k:'ativo', label:'Buscar publicações automaticamente (ao abrir o app e a cada 2 horas)', type:'check', full:true},
        {k:'oabs', label:'Inscrições na OAB (número/UF; separe várias com ponto e vírgula)', full:true, ph:'355980/SP; 123456/RJ'},
        {type:'sect', label:'⚖️ Robô (Google Apps Script) — movimentações (PUSH e DataJud) e e-mail diário'},
        {k:'roboUrl', label:'Endereço do robô (URL do app da Web, termina em /exec)', full:true, ph:'https://script.google.com/macros/s/…/exec'},
        {k:'roboToken', label:'Código de acesso do robô (aparece ao executar “configurar”)', full:true},
        {type:'html', html:'<p class="small muted">Com o robô configurado, o app também envia a ele os seus <b>prazos e compromissos dos próximos 30 dias</b> (descrição, data, processo e cliente), para o e-mail diário das 8h trazer a agenda do dia.</p>'},
        {type:'html', html:'<p class="small muted">Estas configurações são sincronizadas entre os seus aparelhos. O robô recebe apenas os números dos processos ativos.</p>'},
      ],
      onSave: out => {
        const oabs = String(out.oabs || '').split(/[;,\n]+/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/(\d[\d.]*)\s*\/?\s*([A-Za-z]{2})?/); return m ? {numero:digits(m[1]), uf:(m[2] || 'SP').toUpperCase()} : null; }).filter(Boolean);
        const url = String(out.roboUrl || '').trim();
        if(url && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url)){ toast('O endereço do robô deve começar com https://script.google.com/'); return false; }
        const ant = monCfg();
        db.meta.monitor = {oabs: oabs.length ? oabs : MON_OAB_PADRAO, ativo: !!out.ativo, roboUrl:url, roboToken:String(out.roboToken || '').trim()};
        if(ant.roboUrl !== url) setMonLocal({roboDesde:'', roboLista:'', roboUlt:0, roboTent:0});
        if(JSON.stringify(ant.oabs) !== JSON.stringify(db.meta.monitor.oabs)) setMonLocal({djenAte:'', djenUlt:0, djenTent:0});
        save(); toast('Configuração salva'); setTimeout(() => { A.monBuscar(); roboEnviarAgenda(true); }, 300);
      } });
  },
});
function movConfirmarLista(l){
  let n = 0;
  l.forEach(it => { const pr = monProc(it); if(!pr){ toast('Processo não cadastrado: ' + it.numero); return; }
    const push = /^PUSH/.test(it.fonte || '');
    const a = upsert('andamentos', {processoId:pr.id, data:it.data, tipo:push ? 'Movimentação (PUSH)' : 'Movimentação (DataJud)', descricao:[it.titulo, push ? '' : it.texto].filter(Boolean).join(' — ') + (it.orgao ? `\n(${it.orgao})` : ''), origem:push ? 'PUSH' : 'DataJud', monitorId:it.id});
    it.status = 'confirmada'; it.andamentoId = a.id; it.processoId = pr.id; n++; });
  save(); if(n) toast(`${n} andamento(s) registrado(s)`); render();
}


/* ================= IMPORTAR PROCESSOS DA OAB (pelas intimações do DJEN) ================= */
const nomeProprio = s => String(s || '').toLowerCase().replace(/(^|[\s\-'(])([a-zà-ú])/g, (m, a, b) => a + b.toUpperCase()).replace(/\b(D[aoe]s?|E|Em|Com)\b/g, w => w.toLowerCase()).replace(/^./, c => c.toUpperCase())
  .replace(/\b(Ltda|S\.?a\.?|Me|Epp|Eireli|Inss|Cpf|Cnpj)\b/gi, w => w.toUpperCase());
const poloDjen = p => /^a/i.test(String(p || '')) ? 'ativo' : /^p/i.test(String(p || '')) ? 'passivo' : '';
let impBusca = null; // {rodando, msg, achados}
async function djenVarrer(desde){
  const cfg = monCfg(), t = today(), mapa = {}, existentes = new Set(db.processos.map(p => digits(p.numero)).filter(Boolean));
  const jaFila = new Set(db.importar.map(i => digits(i.numero)));
  impBusca = {rodando:true, msg:'Iniciando…', achados:0, consultas:0};
  const prog = () => { const el = document.getElementById('impProg'); if(el) el.textContent = impBusca.msg; };
  const janela = async (o, ini, fim, dias) => {
    for(let pag = 1; pag <= 50; pag++){
      const q = new URLSearchParams({numeroOab:digits(o.numero), ufOab:String(o.uf || '').toUpperCase(), dataDisponibilizacaoInicio:ini, dataDisponibilizacaoFim:fim, pagina:pag, itensPorPagina:100});
      let r; for(let k = 0; k < 4; k++){ r = await fetch('https://comunicaapi.pje.jus.br/api/v1/comunicacao?' + q, {headers:{Accept:'application/json'}}); if(r.status !== 429 && r.status < 500) break; await new Promise(z => setTimeout(z, 3000 * (k + 1))); }
      impBusca.consultas++;
      if(!r.ok){ if(dias > 7 && (r.status === 400 || r.status === 422)) return 'menor'; throw new Error('o DJEN respondeu com erro ' + r.status); }
      const j = await r.json(), it = j.items || [];
      it.forEach(x => {
        const d = digits(x.numero_processo || x.numeroprocessocommascara); if(d.length !== 20 || existentes.has(d) || jaFila.has(d)) return;
        const disp = String(x.data_disponibilizacao || '').slice(0, 10);
        const g = mapa[d] = mapa[d] || {numero:mascaraCnj(d), tribunal:x.siglaTribunal || '', orgao:'', classe:'', partes:{}, advogados:{}, n:0, primeira:disp, ultima:disp};
        g.n++; if(disp && disp < g.primeira) g.primeira = disp;
        if(disp >= g.ultima){ g.ultima = disp; if(x.nomeOrgao) g.orgao = x.nomeOrgao; if(x.nomeClasse) g.classe = x.nomeClasse; }
        if(!g.orgao) g.orgao = x.nomeOrgao || ''; if(!g.classe) g.classe = x.nomeClasse || '';
        (x.destinatarios || []).forEach(p => { const nm = String(p.nome || '').trim(); if(nm && !g.partes[norm_s(nm)]) g.partes[norm_s(nm)] = {nome:nm, polo:poloDjen(p.polo)}; });
        (x.destinatarioadvogados || []).forEach(a => { const ad = a.advogado || a; const nm = String(ad.nome || '').trim(); if(nm) g.advogados[norm_s(nm)] = nm + (ad.numero_oab ? ` (OAB ${ad.numero_oab}/${ad.uf_oab || ''})` : ''); });
      });
      impBusca.achados = Object.keys(mapa).length;
      impBusca.msg = `Consultando ${fmtD(ini)} a ${fmtD(fim)}… ${impBusca.achados} processo(s) novo(s) encontrado(s) até agora`; prog();
      if(it.length < 100) break;
      await new Promise(z => setTimeout(z, 250));
    }
  };
  try{
    for(const o of cfg.oabs){
      let ini = desde;
      while(ini <= t){
        let dias = 30, fim = addDays(ini, dias - 1); if(fim > t) fim = t;
        if(await janela(o, ini, fim, dias) === 'menor'){ for(let a = ini; a <= fim; a = addDays(a, 7)){ const b = addDays(a, 6) > fim ? fim : addDays(a, 6); await janela(o, a, b, 7); } }
        ini = addDays(fim, 1);
      }
    }
    const novos = Object.entries(mapa).map(([d, g]) => ({id:'imp:' + d, numero:g.numero, tribunal:g.tribunal, orgao:g.orgao, classe:g.classe, partes:Object.values(g.partes), advogados:Object.values(g.advogados),
      comunicacoes:g.n, primeira:g.primeira, ultima:g.ultima, status:'pendente', criadoEm:t}));
    if(novos.length){ db.importar.push(...novos); save(); }
    impBusca = {rodando:false, msg:`✅ Busca concluída: ${novos.length} processo(s) novo(s) para revisar (${impBusca.consultas} consulta(s) ao DJEN).`};
  }catch(e){
    impBusca = {rodando:false, msg:'⚠️ ' + (/fetch|network|load/i.test(e.message) ? 'sem conexão com o DJEN' : e.message) + ' — tente de novo; o que já foi encontrado não se perde se você repetir a busca.'};
  }
  if(location.hash.startsWith('#/importar')) renderSeguro();
}
function impInfo(it){ const d = digits(it.numero), j = d[13], tr = d.slice(14, 16);
  const temOpt = (lista, v) => lista.includes(v) ? v : '';
  return {trab: j === '5', area: j === '5' ? temOpt(OPT.area, 'Trabalhista') : '',
    sistema: j === '5' ? temOpt(OPT.sistema, 'PJe — Justiça do Trabalho') : j === '4' ? temOpt(OPT.sistema, 'PJe') : (j === '8' && tr === '26') ? temOpt(OPT.sistema, 'e-SAJ') : ''}; }
function impCard(it){
  const sug = it.partes.findIndex(p => db.pessoas.some(x => x.tipo === 'Cliente' && norm_s(x.nome).trim() === norm_s(p.nome).trim()));
  const pol = {ativo:'polo ativo', passivo:'polo passivo'};
  return `<div class="card" data-imp="${esc(it.id)}"><h2 style="flex-wrap:wrap">${esc(it.numero)} <span class="tag grey">${esc(it.tribunal)}</span><span class="sp"></span>
    ${it.status === 'pendente' ? `<button class="btn primary" data-act="impCadastrar" data-id="${esc(it.id)}">📁 Revisar e cadastrar</button><button class="mini" data-act="impStatus" data-id="${esc(it.id)}" data-st="descartado">descartar</button>`
      : `<span class="tag ${it.status === 'importado' ? 'ok' : 'grey'}">${it.status === 'importado' ? 'cadastrado' : 'descartado'}</span>${it.processoId && byId('processos', it.processoId) ? ` <a class="mini" href="#/processo/${it.processoId}">abrir</a>` : ''}<button class="mini" data-act="impStatus" data-id="${esc(it.id)}" data-st="pendente">↩ voltar</button>`}</h2>
    <div class="sub">${esc([nomeProprio(it.classe), it.orgao].filter(Boolean).join(' · '))}</div>
    <div class="sub">${it.comunicacoes} intimação(ões) no DJEN · de ${fmtD(it.primeira)} a ${fmtD(it.ultima)}</div>
    ${it.partes.length ? `<div style="margin-top:8px"><div class="small muted" style="margin-bottom:4px">Partes intimadas — marque quem é o seu <b>cliente</b>:</div>
      ${it.partes.map((p, i) => `<label class="impParte"><input type="radio" name="cli-${esc(it.id)}" value="${i}" ${i === sug ? 'checked' : ''} ${it.status !== 'pendente' ? 'disabled' : ''}> ${esc(nomeProprio(p.nome))} ${p.polo ? `<span class="tag grey">${pol[p.polo]}</span>` : ''}${i === sug ? ' <span class="tag ok">já é cliente</span>' : ''}</label>`).join('')}</div>`
      : '<div class="small muted" style="margin-top:6px">O DJEN não informou as partes.</div>'}
    ${it.advogados.length ? `<div class="small muted" style="margin-top:6px">Advogados intimados: ${esc(it.advogados.slice(0, 6).join('; '))}</div>` : ''}</div>`;
}
VIEWS.importar = () => {
  const tab = tabs.imp || 'pendente';
  const lista = db.importar.filter(i => tab === 'pendente' ? i.status === 'pendente' : i.status !== 'pendente').sort((a, b) => b.ultima.localeCompare(a.ultima));
  const nP = db.importar.filter(i => i.status === 'pendente').length;
  const T = (k, l, n) => `<button data-act="tab" data-g="imp" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n != null ? ` (${n})` : ''}</button>`;
  const tribs = [...new Set(lista.map(i => i.tribunal))].sort();
  const fT = F.imp?.trib || '', vis = lista.filter(i => !fT || i.tribunal === fT);
  return `<h1>📥 Importar processos da OAB<span class="sp"></span><a class="btn" href="#/processos">← Processos</a></h1>
  <div class="card"><p style="margin-top:0">Busca no <b>DJEN</b> todas as intimações da OAB ${esc(monCfg().oabs.map(o => o.numero + '/' + o.uf).join(', '))} desde a data escolhida e lista os processos que <b>ainda não estão cadastrados</b>. Nada entra no sistema sem a sua revisão.</p>
    <p class="small muted">Limitação: só aparecem processos em que houve intimação pelo DJEN (obrigatório desde 16/05/2025; alguns tribunais publicam lá desde antes). Processos sem intimação nesse período, em segredo de justiça ou com intimação feita só pelo sistema do tribunal não aparecem.</p>
    <div class="toolbar" style="margin:0"><label class="small">Desde <input type="date" id="impDesde" value="${esc(db.meta.impDesde || '2024-01-01')}" style="width:auto"></label>
      <button class="btn primary" data-act="impBuscar" ${impBusca?.rodando ? 'disabled' : ''}>🔎 Buscar no DJEN</button><span id="impProg" class="small">${esc(impBusca?.msg || '')}</span></div></div>
  <div class="card"><div class="tabs">${T('pendente', '📝 A revisar', nP)}${T('feito', '🗂️ Cadastrados / descartados')}</div>
    ${lista.length ? `<div class="toolbar">${tribs.length > 1 ? `<select data-f="imp.trib" style="width:auto"><option value="">Todos os tribunais</option>${opts(tribs, fT)}</select>` : ''}<span class="small muted">Mais recentes primeiro.</span>
      ${tab === 'pendente' && vis.length ? `<span class="sp"></span><button class="mini" data-act="impDescartarTodos">descartar todos os listados</button>` : ''}</div>` : ''}
    ${vis.map(impCard).join('') || `<div class="empty">${tab === 'pendente' ? 'Nenhum processo a revisar. Use “Buscar no DJEN” acima.' : 'Nada ainda.'}</div>`}</div>`;
};
Object.assign(A, {
  impBuscar: () => { const d = document.getElementById('impDesde')?.value || '2024-01-01'; if(d < '2020-01-01') return toast('Escolha uma data a partir de 2020');
    db.meta.impDesde = d; save(); djenVarrer(d); render(); },
  impStatus: d => { const it = byId('importar', d.id); if(!it) return; upsert('importar', {id:it.id, status:d.st}); render(); },
  impDescartarTodos: () => { const fT = F.imp?.trib || ''; const l = db.importar.filter(i => i.status === 'pendente' && (!fT || i.tribunal === fT));
    if(!l.length || !confirm(`Descartar ${l.length} processo(s) da lista?`)) return; l.forEach(i => i.status = 'descartado'); save(); render(); },
  impCadastrar: d => {
    const it = byId('importar', d.id); if(!it) return;
    const sel = document.querySelector(`input[name="cli-${CSS.escape(it.id)}"]:checked`), cli = sel ? it.partes[+sel.value] : null;
    let cliente = null, criado = null;
    if(cli){ cliente = db.pessoas.find(x => norm_s(x.nome).trim() === norm_s(cli.nome).trim());
      if(!cliente){ criado = cliente = upsert('pessoas', {nome:nomeProprio(cli.nome), tipo:'Cliente', ...novoClienteExtra('Cliente')}); } }
    const inf = impInfo(it), outros = it.partes.filter(p => p !== cli);
    const posicao = cli?.polo === 'ativo' ? (inf.trab ? 'Reclamante' : 'Autor') : cli?.polo === 'passivo' ? (inf.trab ? 'Reclamado' : 'Réu') : '';
    let salvo = false;
    formProc({titulo:it.classe ? nomeProprio(it.classe) : '', numero:it.numero, ...(cliente ? {clienteId:cliente.id, seq:nextSeq(cliente.id)} : {}), posicao, area:inf.area, sistema:inf.sistema,
      tribunal:it.tribunal, vara:it.orgao, dataInicio:it.primeira, status:'Ativo',
      outrasPartes:outros.map(p => nomeProprio(p.nome)).join('; '),
      obs:`Importado do DJEN em ${fmtD(today())} (${it.comunicacoes} intimação(ões) entre ${fmtD(it.primeira)} e ${fmtD(it.ultima)}).` + (outros.length ? `\nPartes intimadas: ${outros.map(p => nomeProprio(p.nome) + (p.polo ? ` (${p.polo === 'ativo' ? 'polo ativo' : 'polo passivo'})` : '')).join('; ')}.` : '')},
      r => { salvo = true; upsert('importar', {id:it.id, status:'importado', processoId:r.id}); setTimeout(() => toast('Processo cadastrado — continue a revisão da lista'), 200); });
    if(criado) novasPessoas.add(criado.id);
    if(criado){ const w = setInterval(() => { if(!modal.classList.contains('hidden')) return; clearInterval(w);
      if(!salvo && !db.processos.some(p => p.clienteId === criado.id) && !db.conversas.some(c => c.pessoaId === criado.id)) removeItem('pessoas', criado.id); }, 400); }
  },
});


