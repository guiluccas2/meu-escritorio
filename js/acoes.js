// Meu Escritório — Navegação, ações dos botões, seleção múltipla e backup
'use strict';
/* ================= ROTEAMENTO ================= */
function go(h){ if(location.hash === h) render(); else location.hash = h; }
let lastRoute = '';
function render(){
  reagendarPendentes();
  const parts = (location.hash || '#/painel').slice(2).split('/');
  const view = VIEWS[parts[0]] ? parts[0] : 'painel', arg = parts[1] ? decodeURIComponent(parts.slice(1).join('/')) : undefined;
  listFn = null;
  if(view !== 'busca') document.getElementById('busca').value = '';
  const y = window.scrollY;
  V.innerHTML = VIEWS[view](arg) || '';
  if(listFn) listFn();
  V.querySelectorAll('.tl-body.clamp').forEach(b => { if(b.scrollHeight <= b.clientHeight + 2){ b.classList.remove('clamp'); b.nextElementSibling?.classList.contains('verMais') && b.nextElementSibling.remove(); } });
  aplicarMenu();
  const route = view + '/' + (arg || '');
  if(route !== lastRoute) window.scrollTo(0, 0); else window.scrollTo(0, y);
  lastRoute = route;
  updateBulk();
  const navV = {importar:'processos', pessoa:'pessoas', processo:'processos', lead:'leads', acordo:'financeiro', listas:'config'}[view] || view;
  document.querySelectorAll('#nav a, #tabbar a').forEach(a => a.classList.toggle('on', a.dataset.v === navV));
  sideToggle(false);
  renderBanner(); updateCounts();
}
window.addEventListener('hashchange', render);
function updateCounts(){
  const t = today(), w = addDays(t, 7);
  const badge = (id, total, urgentes, tip) => { const el = document.getElementById(id); if(!el) return;
    el.hidden = !total; el.textContent = total; el.classList.toggle('calm', !urgentes); el.title = tip;
    const tb = document.getElementById({cPrz:'tbPrz', cPub:'tbMais'}[id]); if(tb){ tb.hidden = el.hidden; tb.textContent = el.textContent; tb.className = el.className; } };
  // Atendimentos: retornos combinados com clientes ainda não feitos
  const ret = db.conversas.filter(c => c.proximaData && !c.retornoFeito), retU = ret.filter(c => c.proximaData <= t).length;
  badge('cRet', ret.length, retU, `${ret.length} retorno(s) pendente(s)` + (retU ? ` — ${retU} vencido(s) ou para hoje` : ' — nenhum atrasado'));
  // Prazos e agenda: todos os pendentes
  const prz = db.prazos.filter(x => !x.concluido), przA = prz.filter(atrasado).length, przH = prz.filter(x => x.data === t).length;
  badge('cPrz', prz.length, przA + przH, `${prz.length} prazo(s)/compromisso(s) pendente(s)` + (przA ? ` — ${przA} atrasado(s)` : '') + (przH ? ` — ${przH} hoje` : '') + (!przA && !przH ? ' — nenhum atrasado' : ''));
  // Publicações e movimentações novas
  const mPub = db.monitor.filter(m => m.status === 'nova' && m.tipo === 'publicacao').length, mMov = db.monitor.filter(m => m.status === 'nova' && m.tipo !== 'publicacao').length;
  badge('cPub', mPub + mMov, mPub, `${mPub} publicação(ões) nova(s) · ${mMov} movimentação(ões) a confirmar`);
  // Leads em andamento
  const leads = db.leads.filter(l => !['Fechado','Perdido'].includes(l.status)), leadU = leads.filter(l => l.proximoContato && l.proximoContato <= t).length;
  badge('cLead', leads.length, leadU, `${leads.length} lead(s) em andamento` + (leadU ? ` — ${leadU} com contato atrasado ou para hoje` : ''));
  // Financeiro: vencidos, repasses pendentes e o que vence nos próximos 7 dias
  let venc = 0, rep = 0, prox = 0;
  db.financeiro.forEach(l => { if(l.pagoEm) return; const st = finStatus(l); if(st === 'aguardando') return;
    if(l.categoria === CAT_REP && l.acordoId){ rep++; return; }
    if(st === 'vencido') venc++; else if(l.vencimento <= w) prox++; });
  badge('cFin', venc + rep + prox, venc + rep, [venc && `${venc} lançamento(s) vencido(s)`, rep && `${rep} repasse(s) a clientes pendente(s)`, prox && `${prox} a vencer nos próximos 7 dias`].filter(Boolean).join(' — ') || '');
}

/* ================= AÇÕES ================= */
const A = {
  newPessoa: () => formPessoa(),
  editPessoa: d => formPessoa(byId('pessoas', d.id)),
  newProc: d => formProc(d.pessoa ? {clienteId:d.pessoa} : {}),
  editProc: d => formProc(byId('processos', d.id)),
  newConv: d => { if(!d.pessoa && !d.lead && !d.proc){ const m = location.hash.match(/^#\/(pessoa|processo|lead)\/(.+)$/);
      if(m){ if(m[1] === 'pessoa') d.pessoa = m[2]; if(m[1] === 'lead') d.lead = m[2]; if(m[1] === 'processo'){ d.proc = m[2]; d.pessoa = byId('processos', m[2])?.clienteId; } } }
    formConv({pessoaId:d.pessoa || '', processoId:d.proc || '', leadId:d.lead || ''}); },
  editConv: d => formConv(byId('conversas', d.id)),
  convDone: d => { upsert('conversas', {id:d.id, retornoFeito:true, retornoFeitoEm:today()}); toast('Retorno marcado como feito'); render();
    const c = byId('conversas', d.id); if(c && confirm('Deseja registrar como foi esse retorno ao cliente?')) formConv({pessoaId:c.pessoaId || '', processoId:c.processoId || '', leadId:c.leadId || '', assunto:'Retorno: ' + (c.proximaAcao || '')}); },
  filtroRet: () => { F.conv.pend = true; },
  newAnd: d => formAnd({processoId:d.proc}),
  editAnd: d => formAnd(byId('andamentos', d.id)),
  newPrazo: d => formPrazo({processoId:d.proc || '', pessoaId:d.pessoa || '', ...(d.data ? {data:d.data, dataFim:d.data, tipo:'Reunião'} : {}), ...(d.coluna ? {coluna:d.coluna} : {})}),
  editPrazo: d => formPrazo(byId('prazos', d.id)),
  togglePrazo: (d, el) => { upsert('prazos', {id:d.id, situacao:el.checked ? 'Realizado' : 'Pendente', concluido:el.checked, concluidoEm:el.checked ? today() : ''}); toast(el.checked ? 'Realizado ✔' : 'Reaberto'); setTimeout(render, 250); },
  prazoConcluir: d => { upsert('prazos', {id:d.id, situacao:'Realizado', concluido:true, concluidoEm:today()}); render(); toastDesfazer('Marcado como realizado ✔', () => { upsert('prazos', {id:d.id, situacao:'Pendente', concluido:false, concluidoEm:''}); render(); }); },
  prazoReabrir: d => { upsert('prazos', {id:d.id, situacao:'Pendente', concluido:false, concluidoEm:''}); render(); toast('Conclusão desfeita — voltou a pendente'); },
  posPrazo: d => posPrazo(d.id, agendaDesatualizada(byId('prazos', d.id) || {}) ? 'mudou' : 'agenda'),
  avisarWhats: d => formWhats(d.id, d.mod),
  newLead: () => formLead(),
  editLead: d => formLead(byId('leads', d.id)),
  convertLead: d => convertLead(d.id),
  leadMove: d => { const l = byId('leads', d.id); const i = OPT.statusLead.indexOf(l.status) + Number(d.dir); if(i < 0 || i >= OPT.statusLead.length) return; setLeadStatus(l, OPT.statusLead[i]); },
  newFin: d => formFin({pessoaId:d.pessoa || '', processoId:d.proc || '', ...(d.nat ? {natureza:d.nat} : {})}),
  editFin: d => formFin(byId('financeiro', d.id)),
  payFin: d => payFin(d.id, !!d.direct),
  newAcordo: d => formAcordo({pessoaId:d.pessoa || '', processoId:d.proc || ''}),
  editAcordo: d => formAcordo(byId('acordos', d.id)),
  recParc: d => receiveParcela(d.id, parseInt(d.k, 10)),
  print: () => window.print(),
  newTest: d => formTestemunha(d.p),
  editTest: d => { const p = byId('processos', d.p); formTestemunha(d.p, (p?.testemunhas || []).find(t => t.id === d.id)); },
  iaSalvarKey: () => { const k = (document.getElementById('iaKeyIn')?.value || '').trim(); if(!k) return toast('Cole a chave no campo');
    if(!/^sk-ant-/.test(k)) return alert('A chave de API da Anthropic começa com “sk-ant-”. Confira se copiou a chave completa.');
    try{ localStorage.setItem('escritorio_ia_key', k); }catch(e){ return alert('Não foi possível salvar neste navegador.'); } iaModP = null; toast('Chave salva neste aparelho'); render(); },
  iaRemoverKey: () => { if(!confirm('Remover a chave da IA deste aparelho?')) return; try{ localStorage.removeItem('escritorio_ia_key'); }catch(e){} render(); },
  iaTestar: async () => { const st = document.getElementById('iaTesteSt'); st.textContent = '⏳ testando…';
    try{ await iaChamar('Responda apenas com o JSON pedido.', [{type:'text', text:'Responda ok = true.'}], iaObj({ok:S.bool})); st.textContent = '✅ Conexão funcionando'; }
    catch(e){ st.textContent = '⚠️ ' + e.message; } },
  tema: () => { const ordem = ['auto', 'light', 'dark'], atual = temaAtual(), prox = ordem[(ordem.indexOf(atual) + 1) % 3];
    try{ if(prox === 'auto') localStorage.removeItem('escritorio_tema'); else localStorage.setItem('escritorio_tema', prox); }catch(e){}
    if(prox === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = prox;
    mostrarTema(); toast({auto:'Aparência automática (segue o aparelho)', light:'Modo claro', dark:'Modo escuro'}[prox]); },
  finMes: d => { finMes = d.m; F.fin.mes = d.m === today().slice(0, 7) && !F.fin.mes ? '' : d.m; tabs.fin = 'lanc'; render(); },
  finMesNav: d => { finMes = addMonths((finMes || today().slice(0, 7)) + '-01', Number(d.d)).slice(0, 7); render(); },
  finPA: d => { finPA = d.v; render(); },
  finTodos: () => { F.fin.mes = ''; tabs.fin = 'lanc'; render(); },
  agVis: d => { F.ag.vis = d.v; render(); },
  agCalVis: d => { agCalVis = d.v; render(); },
  agNav: d => { const t = today(); if(agCalVis === 'semana'){ agSem = d.d === '0' ? addDays(t, -parseD(t).getDay()) : addDays(agSem || addDays(t, -parseD(t).getDay()), 7 * Number(d.d)); }
    else agMes = d.d === '0' ? t.slice(0, 7) : addMonths((agMes || t.slice(0, 7)) + '-01', Number(d.d)).slice(0, 7); render(); },
  agDia: d => formPrazo({data:d.d, dataFim:d.d, tipo:'Reunião'}),
  agLimpar: () => { Object.assign(F.ag, {sit:'pend', q:'', tipo:'', per:'todos', de:'', ate:'', atras:false, area:''}); render(); },
  pMove: d => { const p = byId('prazos', d.id), cs = colunas().filter(c => !c.oculto), i = cs.findIndex(c => c.id === colunaDe(p)) + Number(d.dir); if(i < 0 || i >= cs.length) return; upsert('prazos', {id:p.id, coluna:cs[i].id}); render(); },
  lsUp: (d, el) => { const r = el.closest('.lsItem'), p = r.previousElementSibling; if(p) r.parentNode.insertBefore(r, p); },
  lsDown: (d, el) => { const r = el.closest('.lsItem'), n = r.nextElementSibling; if(n) r.parentNode.insertBefore(n, r); },
  lsDel: (d, el) => { const r = el.closest('.lsItem'); if(confirm('Excluir a opção “' + r.querySelector('.lsV').value + '”?\n\nRegistros que já a usam continuam com esse valor.')) r.remove(); },
  lsAdd: () => { const box = document.getElementById('lsItens'), col = listaSel === 'colunas';
    box.insertAdjacentHTML('beforeend', `<div class="lsItem" data-orig="" ${col ? `data-id="c${Date.now().toString(36)}"` : ''}><button class="mini" data-act="lsUp">▲</button><button class="mini" data-act="lsDown">▼</button><input class="lsV" value="" placeholder="Nova opção"><label class="chk small"><input type="checkbox" class="lsVis" checked> visível</label><button class="mini" data-act="lsDel">🗑 excluir</button></div>`);
    box.lastElementChild.querySelector('.lsV').focus(); },
  lsSalvar: () => {
    const col = listaSel === 'colunas', rows = [...document.querySelectorAll('#lsItens .lsItem')];
    const novo = [], vistos = new Set(), renomes = [];
    for(const r of rows){ const v = r.querySelector('.lsV').value.trim(), o = r.dataset.orig; if(!v) continue;
      if(vistos.has(v.toLowerCase())) return alert('A opção “' + v + '” está repetida.'); vistos.add(v.toLowerCase());
      const it = {v}; if(col) it.id = r.dataset.id; if(!r.querySelector('.lsVis').checked) it.oculto = true;
      if(!col && o && o !== v) renomes.push([o, v]); novo.push(it); }
    if(!novo.filter(x => !x.oculto).length) return alert('Deixe pelo menos uma opção visível.');
    renomes.forEach(([a, b]) => renomearOpcao(listaSel, a, b));
    db.meta.listas = {...(db.meta.listas || {}), [listaSel]:novo}; save(); render(); toast('Lista salva' + (renomes.length ? ` — ${renomes.length} renomeação(ões) aplicada(s) aos registros` : ''));
  },
  lsPadrao: () => { if(!confirm('Restaurar as opções originais desta lista? Registros já cadastrados não são alterados.')) return; const m = {...(db.meta.listas || {})}; delete m[listaSel]; db.meta.listas = m; save(); render(); },
  lsAddMsg: () => { const m = modelosMsg().map(x => ({...x})); m.push({id:'m' + Date.now().toString(36), v:'Novo modelo', texto:'Olá, {nome}!\n\n'}); db.meta.listas = {...(db.meta.listas || {}), msgs:m}; save(); render(); },
  lsDelMsg: d => { if(modelosMsg().length <= 1) return alert('Mantenha pelo menos um modelo.'); if(!confirm('Excluir este modelo de mensagem?')) return; db.meta.listas = {...(db.meta.listas || {}), msgs:modelosMsg().filter(x => x.id !== d.id)}; save(); render(); },
  lsSalvarMsgs: () => { const m = [...document.querySelectorAll('.msgRow')].map(r => ({id:r.dataset.id, v:r.querySelector('.mNome').value.trim() || 'Modelo', texto:r.querySelector('.mTxt').value})); db.meta.listas = {...(db.meta.listas || {}), msgs:m}; save(); toast('Modelos salvos'); },
  personalizar: () => formPersonalizar(),
  calDiaX: () => {},
  calDia: d => { calSel = d.d; if(d.d.slice(0, 7) !== calMes) calMes = d.d.slice(0, 7); render(); },
  calMes: d => { const t = today(); if(d.d === '0'){ calMes = t.slice(0, 7); calSel = t; } else { calMes = addMonths((calMes || t.slice(0, 7)) + '-01', Number(d.d)).slice(0, 7); } render(); },
  verMais: (d, el) => { const b = el.previousElementSibling; b.classList.toggle('clamp'); el.textContent = b.classList.contains('clamp') ? 'ver mais ▾' : 'ver menos ▴'; },
  editContrato: d => formContrato(d.id),
  apurar: d => formApurar(d.p, d.i),
  jaLancado: d => formJaLancado(d.p, d.i),
  desfazApur: d => { const p = byId('processos', d.p), it = p?.contrato?.itens?.find(x => x.id === d.i); if(!it) return;
    const ls = itemLanc(it);
    if(ls.some(l => l.pagoEm)){ alert('Já há valores recebidos desta apuração. Exclua ou estorne os recebimentos no financeiro antes de desfazer.'); return; }
    if(!confirm('Desfazer a apuração?' + (ls.length ? `\n\n${ls.length} lançamento(s) a receber serão excluídos.` : '') + (it.acordoId ? '\n\nO acordo vinculado NÃO será excluído, apenas desvinculado.' : ''))) return;
    db.financeiro = db.financeiro.filter(l => l.contratoItemId !== it.id || l.pagoEm);
    ['apuradoEm', 'baseValor', 'valorApurado', 'acordoId', 'jaLancado', 'notaLanc', 'valorCalculado'].forEach(k => delete it[k]); it.status = 'pendente'; save(); render(); toast('Apuração desfeita'); },
  delModelo: d => { const m = modelos()[+d.i]; if(m && confirm('Excluir o modelo “' + m.nome + '”?')){ db.meta.modelosHon.splice(+d.i, 1); save(); render(); } },
  resetModelos: () => { if(confirm('Incluir de volta os modelos padrão (os seus continuam)?')){ const nomes = new Set(modelos().map(m => m.nome)); db.meta.modelosHon = [...modelos(), ...JSON.parse(JSON.stringify(MODELOS_PADRAO)).filter(m => !nomes.has(m.nome))]; save(); render(); } },
  tab: (d, el) => { tabs[d.g] = d.tab; if(el.tagName !== 'A' || el.getAttribute('href') === '#') render(); },
  copy: d => { navigator.clipboard?.writeText(d.txt).then(() => toast('Copiado')); },
  exportJson, importJson: () => document.getElementById('importFile').click(),
  exportCsv, chooseFile, reactivateFile, openFromFile,
  unlinkFile: async () => { if(!confirm('Desligar o backup automático? (o arquivo não será apagado)')) return; fileHandle = null; filePerm = false; await idbSet('fh', null); render(); },
  clearAll: () => { if(!confirm('ATENÇÃO: isto apaga TODOS os dados deste programa.\n\nFaça um backup antes. Continuar?')) return;
    if(prompt('Para confirmar, digite APAGAR') !== 'APAGAR') return; db = norm({}); save(); go('#/painel'); toast('Dados apagados'); },
};
function setLeadStatus(l, st){
  upsert('leads', {id:l.id, status:st}); render();
  if(st === 'Fechado' && !l.pessoaId) setTimeout(() => convertLead(l.id), 50);
  if(st === 'Perdido'){ const m = prompt('Motivo da perda (opcional):', l.motivoPerda || ''); if(m !== null){ upsert('leads', {id:l.id, motivoPerda:m}); render(); } }
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if(el && !el.closest('#mForm')){
    const fn = A[el.dataset.act]; if(fn){ if((el.tagName !== 'A' || el.getAttribute('href') === '#') && el.type !== 'checkbox') e.preventDefault(); fn({...el.dataset}, el); if(el.tagName !== 'A') return; }
  }
  const row = e.target.closest('[data-href]');
  if(row && !e.target.closest('a,button,input,select')) go(row.dataset.href);
});
document.addEventListener('input', e => {
  const el = e.target;
  if(el.dataset.f){ const [g, k] = el.dataset.f.split('.'); F[g][k] = el.type === 'checkbox' ? el.checked : el.value; if(listFn){ listFn(); updateBulk(); } }
  if(el.id === 'leadQ'){ F.lead.q = el.value; const pos = el.selectionStart; render(); const n = document.getElementById('leadQ'); n.focus(); n.setSelectionRange(pos, pos); }
});
document.addEventListener('change', e => { const el = e.target; if(el.dataset.f && el.tagName === 'SELECT'){ const [g, k] = el.dataset.f.split('.'); F[g][k] = el.value; if((g === 'ag' && k === 'per') || g === 'imp') return render(); if(listFn){ listFn(); updateBulk(); } } });
/* arrastar leads */
document.addEventListener('dragstart', e => { const pc = e.target.closest?.('[data-pcard]'); if(pc){ e.dataTransfer.setData('text/plain', 'pcard:' + pc.dataset.pcard); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const col = e.target.closest?.('.pcol'); if(col){ e.preventDefault(); document.querySelectorAll('.pcol.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
document.addEventListener('drop', e => { const col = e.target.closest?.('.pcol'); if(!col) return; e.preventDefault(); col.classList.remove('over');
  const v = e.dataTransfer.getData('text/plain'); if(!v.startsWith('pcard:')) return; const p = byId('prazos', v.slice(6)); if(p && colunaDe(p) !== col.dataset.colid){ upsert('prazos', {id:p.id, coluna:col.dataset.colid}); render(); } });
document.addEventListener('dragstart', e => { const c = e.target.closest?.('[data-lead]'); if(c){ e.dataTransfer.setData('text/plain', c.dataset.lead); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const col = e.target.closest?.('.kcol'); if(col){ e.preventDefault(); document.querySelectorAll('.kcol.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
document.addEventListener('dragleave', e => { const col = e.target.closest?.('.kcol'); if(col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
document.addEventListener('drop', e => { const col = e.target.closest?.('.kcol'); if(!col) return; e.preventDefault(); col.classList.remove('over');
  const l = byId('leads', e.dataTransfer.getData('text/plain')); if(l && l.status !== col.dataset.col) setLeadStatus(l, col.dataset.col); });
/* busca global */
const busca = document.getElementById('busca');
busca.addEventListener('keydown', e => { if(e.key === 'Enter' && busca.value.trim()) go('#/busca/' + encodeURIComponent(busca.value.trim())); });
document.addEventListener('keydown', e => {
  if(e.key === 'Escape' && !modal.classList.contains('hidden')) closeModal();
  if(e.altKey && (e.key === 'n' || e.key === 'N')){ e.preventDefault(); A.newConv({}); }
  if(e.altKey && (e.key === 'b' || e.key === 'B')){ e.preventDefault(); busca.focus(); busca.select(); }
});
const sideToggle = on => { document.getElementById('side').classList.toggle('open', on); document.getElementById('sideBack').classList.toggle('on', on); };
document.getElementById('menuBtn').onclick = () => sideToggle(!document.getElementById('side').classList.contains('open'));
document.getElementById('sideBack').onclick = () => sideToggle(false);
document.getElementById('tbMenu').onclick = e => { e.preventDefault(); sideToggle(!document.getElementById('side').classList.contains('open')); };

/* ================= SELEÇÃO MÚLTIPLA ================= */
const selIds = () => [...new Set([...document.querySelectorAll('#view [data-sel]:checked')].flatMap(c => c.dataset.sel.split(',')))].filter(id => byId('financeiro', id));
function updateBulk(){
  const box = document.getElementById('bulk'), ids = selIds();
  const pids = [...document.querySelectorAll('#view [data-psel]:checked')].map(x => x.dataset.psel);
  document.querySelectorAll('#view .card').forEach(c => { const h = c.querySelector('[data-pselall]'); if(!h) return; const all = c.querySelectorAll('[data-psel]'), on = c.querySelectorAll('[data-psel]:checked'); h.checked = all.length > 0 && on.length === all.length; h.indeterminate = on.length > 0 && on.length < all.length; });
  if(pids.length){ document.body.classList.add('hasbulk'); box.hidden = false;
    box.innerHTML = `<b>${pids.length} compromisso(s) selecionado(s)</b><button class="btn ok" data-act="bpConcluir">✔ Concluir</button><button class="btn" data-act="bpSit">Mudar situação</button><button class="btn" data-act="bpData">📅 Mudar data</button><button class="btn" data-act="bpCol">▦ Mover para coluna</button><button class="btn danger" data-act="bpDel">🗑 Excluir</button><button class="btn" data-act="bulkClear">Limpar</button>`; return; }
  document.querySelectorAll('#view table').forEach(t => { const all = t.querySelectorAll('[data-sel]'), on = t.querySelectorAll('[data-sel]:checked'), h = t.querySelector('[data-selall]');
    if(h){ h.checked = all.length > 0 && on.length === all.length; h.indeterminate = on.length > 0 && on.length < all.length; } });
  document.body.classList.toggle('hasbulk', ids.length > 0);
  if(!ids.length){ box.hidden = true; box.innerHTML = ''; return; }
  const marc = document.querySelectorAll('#view [data-sel]:checked').length;
  const ls = ids.map(id => byId('financeiro', id)), saldo = sum(ls.map(l => l.natureza === 'saida' ? -l.valor : l.valor)), pend = ls.filter(l => !l.pagoEm).length;
  box.hidden = false;
  box.innerHTML = `<b>${marc !== ids.length ? `${marc} parcela(s) marcada(s) = ${ids.length} lançamentos` : `${ids.length} lançamento(s) selecionado(s)`}</b><span class="muted small">saldo ${money(saldo)}</span>
    ${pend ? `<button class="btn ok" data-act="bulkReal">✔ Dar baixa (${pend})</button>` : ''}${/^#\/acordo\//.test(location.hash) ? '<button class="btn primary" data-act="bulkDiv">⚖ Alterar divisão</button>' : ''}<button class="btn danger" data-act="bulkDel">🗑 Excluir</button><button class="btn" data-act="bulkClear">Limpar seleção</button>`;
}
const pSel = () => [...document.querySelectorAll('#view [data-psel]:checked')].map(x => byId('prazos', x.dataset.psel)).filter(Boolean);
document.addEventListener('change', e => {
  if(e.target.matches?.('[data-pselall]')){ e.target.closest('.card').querySelectorAll('[data-psel]').forEach(x => x.checked = e.target.checked); updateBulk(); }
  else if(e.target.matches?.('[data-psel]')) updateBulk();
});
A.bpConcluir = () => { const ls = pSel().filter(p => !p.concluido), ant = ls.map(p => ({id:p.id, situacao:p.situacao, concluido:p.concluido, concluidoEm:p.concluidoEm || ''}));
  ls.forEach(p => Object.assign(p, {situacao:'Realizado', concluido:true, concluidoEm:today()})); save(); render();
  toastDesfazer(`${ls.length} compromisso(s) marcado(s) como realizado(s)`, () => { ant.forEach(a => Object.assign(byId('prazos', a.id), a)); save(); render(); }); };
A.bpSit = () => { const ls = pSel(); openForm({title:`Mudar situação de ${ls.length} compromisso(s)`, data:{sit:'Realizado'}, fields:[{k:'sit', label:'Nova situação', type:'select', empty:false, options:OPT.situacao.filter(x => x !== 'Redesignado')}, {type:'html', html:'<div class="small muted">Para redesignar, edite cada compromisso (é preciso informar a nova data de cada um).</div>'}],
  onSave: o => { ls.forEach(p => Object.assign(p, {situacao:o.sit, concluido:o.sit !== 'Pendente', concluidoEm:o.sit !== 'Pendente' ? (p.concluidoEm || today()) : ''})); save(); toast('Situação alterada'); } }); };
A.bpData = () => { const ls = pSel(); openForm({title:`Mudar a data de ${ls.length} compromisso(s)`, data:{d:today()}, fields:[{k:'d', label:'Nova data', type:'date', req:true}, {type:'html', html:'<div class="small muted">O horário de cada um é mantido. Se algum já estava na agenda do celular ou o cliente tinha sido avisado, aparecerá o lembrete para atualizar.</div>'}],
  onSave: o => { ls.forEach(p => { const dur = p.data && p.dataFim ? Math.round((parseD(p.dataFim) - parseD(p.data)) / 86400000) : 0; p.data = o.d; p.dataFim = dur ? addDays(o.d, dur) : o.d; }); save(); toast('Datas alteradas'); } }); };
A.bpCol = () => { const ls = pSel(); openForm({title:`Mover ${ls.length} cartão(ões) para a coluna`, data:{}, fields:[{k:'c', label:'Coluna do quadro', type:'select', empty:false, options:colunas().filter(c => !c.oculto).map(c => ({v:c.id, t:c.v}))}],
  onSave: o => { ls.forEach(p => p.coluna = o.c); save(); toast('Movido(s)'); } }); };
A.bpDel = () => { const ls = pSel(); if(!confirm(`Excluir ${ls.length} compromisso(s)? Esta ação não pode ser desfeita (a não ser restaurando um backup).`)) return; const del = new Set(ls.map(p => p.id)); db.prazos = db.prazos.filter(p => !del.has(p.id)); save(); render(); toast('Excluído(s)'); };
let lastSel = null;
document.addEventListener('click', e => {
  const c = e.target.closest('#view [data-sel]');
  if(c){ if(e.shiftKey && lastSel && lastSel !== c && document.contains(lastSel)){
      const all = [...c.closest('table').querySelectorAll('[data-sel]')], i = all.indexOf(lastSel), j = all.indexOf(c);
      if(i >= 0 && j >= 0) all.slice(Math.min(i, j), Math.max(i, j) + 1).forEach(x => x.checked = c.checked); }
    lastSel = c; updateBulk(); return; }
  const h = e.target.closest('#view [data-selall]');
  if(h){ h.closest('table').querySelectorAll('[data-sel]').forEach(x => x.checked = h.checked); updateBulk(); }
});
A.divAcordo = d => formDivisao(d.id);
A.bulkDiv = () => { const m = location.hash.match(/^#\/acordo\/(.+)$/); if(!m) return;
  const ks = [...new Set(selIds().map(id => byId('financeiro', id)).filter(l => l && l.acordoId === m[1]).map(l => l.parcela))];
  formDivisao(m[1], ks.length ? ks : null); };
A.bulkClear = () => { document.querySelectorAll('#view [data-sel]:checked,#view [data-selall],#view [data-psel]:checked,#view [data-pselall]').forEach(x => x.checked = false); updateBulk(); };
A.bulkDel = () => {
  const ids = selIds(); if(!ids.length) return;
  const ls = ids.map(id => byId('financeiro', id)), real = ls.filter(l => l.pagoEm).length, acs = new Set(ls.filter(l => l.acordoId).map(l => l.acordoId));
  if(!confirm(`Excluir ${ids.length} lançamento(s)?` + (real ? `\n\nATENÇÃO: ${real} deles já foram recebidos/pagos.` : '') + (acs.size ? `\n\n${ls.filter(l => l.acordoId).length} pertencem a acordo(s). Acordos que ficarem sem nenhuma parcela também serão excluídos.` : '') + '\n\nEsta ação não pode ser desfeita (a não ser restaurando um backup).')) return;
  const del = new Set(ids);
  db.financeiro = db.financeiro.filter(l => !del.has(l.id));
  const vazios = [...acs].filter(id => !db.financeiro.some(l => l.acordoId === id));
  db.acordos = db.acordos.filter(a => !vazios.includes(a.id));
  save(); toast(ids.length + ' lançamento(s) excluído(s)' + (vazios.length ? ` e ${vazios.length} acordo(s)` : ''));
  const m = location.hash.match(/^#\/acordo\/(.+)$/); if(m && vazios.includes(m[1])) go('#/financeiro'); else render();
};
A.bulkReal = () => {
  const ls = selIds().map(id => byId('financeiro', id)).filter(l => !l.pagoEm); if(!ls.length) return;
  openForm({ title:'Dar baixa em vários lançamentos', data:{pagoEm:today()},
    fields:[{type:'html', html:`<b>${ls.length} lançamento(s)</b> — entradas ${money(sum(ls.filter(l => l.natureza === 'entrada').map(l => l.valor)))} · saídas ${money(sum(ls.filter(l => l.natureza === 'saida').map(l => l.valor)))}<div class="small muted">Cada um será marcado como recebido/pago pelo seu valor previsto.</div>`},
      {k:'pagoEm', label:'Data', type:'date', req:true}, {k:'forma', label:'Forma', type:'select', options:() => OPT.forma, lista:'forma'}],
    onSave: out => { ls.forEach(l => Object.assign(l, {pagoEm:out.pagoEm, valorPago:l.valor, forma:out.forma || l.forma || ''})); save(); toast(ls.length + ' baixa(s) registrada(s)'); } });
};

/* ================= BACKUP ================= */
function download(name, content, type){ const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type})); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function exportJson(){ db.meta.lastBackup = new Date().toISOString(); save(); download(`backup-escritorio-${today()}.json`, JSON.stringify(db, null, 1), 'application/json'); toast('Backup baixado'); render(); }
function validDb(d){ return d && typeof d === 'object' && (COL.some(c => Array.isArray(d[c])) || Array.isArray(d.honorarios)); }
function restore(d){
  if(!validDb(d)){ alert('Arquivo inválido: não parece um backup deste programa.'); return false; }
  const cnt = COL.map(c => `${c}: ${(d[c] || []).length}`).join('\n');
  if(!confirm('Restaurar este backup?\n\n' + cnt + '\n\nOs dados atuais serão SUBSTITUÍDOS.')) return false;
  db = norm(d); save(); go('#/painel'); toast('Backup restaurado'); return true;
}
document.getElementById('importFile').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try{ restore(JSON.parse(await f.text())); }catch(err){ alert('Não foi possível ler o arquivo: ' + err.message); }
});
function exportCsv(){
  const l = window._finList || db.financeiro;
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const num = v => v === '' || v == null ? '' : String(Number(v).toFixed(2)).replace('.', ',');
  const stx = {ok:'realizado', vencido:'vencido', aberto:'pendente', aguardando:'aguardando recebimento'};
  const rows = [['Vencimento','Tipo','Categoria','Pasta','Cliente','Processo','Descrição','Valor','Situação','Realizado em','Valor efetivo','Forma']]
    .concat(l.map(x => [fmtD(x.vencimento), x.natureza === 'saida' ? 'Saída' : 'Entrada', x.categoria, byId('pessoas', x.pessoaId)?.pasta || '', pessoaNome(x.pessoaId), procLabel(byId('processos', x.processoId)),
      x.descricao, num(x.natureza === 'saida' ? -x.valor : x.valor), stx[finStatus(x)], fmtD(x.pagoEm), num(x.pagoEm ? realV(x) : ''), x.forma]));
  download(`financeiro-${today()}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8');
}
/* backup automático em arquivo (Chrome/Edge) */
let fileHandle = null, filePerm = false, fsTimer = null;
function idb(){ return new Promise((res, rej) => { const r = indexedDB.open('escritorio_fs', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k){ try{ const d = await idb(); return await new Promise(r => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); }catch(e){ return null; } }
async function idbSet(k, v){ try{ const d = await idb(); await new Promise(r => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = r; t.onerror = r; }); }catch(e){} }
async function chooseFile(){
  try{ const h = await window.showSaveFilePicker({suggestedName:'escritorio-dados.json', types:[{description:'Dados do escritório', accept:{'application/json':['.json']}}]});
    fileHandle = h; filePerm = true; await idbSet('fh', h); await writeFile(); toast('Backup automático ativado'); render();
  }catch(e){ if(e.name !== 'AbortError') alert('Não foi possível usar este arquivo: ' + e.message); }
}
async function reactivateFile(){ if(!fileHandle) return; try{ filePerm = (await fileHandle.requestPermission({mode:'readwrite'})) === 'granted'; }catch(e){ filePerm = false; }
  if(filePerm){ await writeFile(); toast('Backup automático reativado'); } render(); }
async function openFromFile(){
  if(!fileHandle) return;
  try{ if((await fileHandle.queryPermission({mode:'read'})) !== 'granted' && (await fileHandle.requestPermission({mode:'readwrite'})) !== 'granted') return;
    const txt = await (await fileHandle.getFile()).text(); if(!txt.trim()) return alert('O arquivo está vazio.');
    restore(JSON.parse(txt)); }catch(e){ alert('Não foi possível ler: ' + e.message); }
}
async function writeFile(){
  if(!fileHandle || !filePerm) return;
  try{ db.meta.lastFileSave = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(db));
    const w = await fileHandle.createWritable(); await w.write(JSON.stringify(db, null, 1)); await w.close();
  }catch(e){ filePerm = false; renderBanner(); }
}
function autoFileSave(){ clearTimeout(fsTimer); fsTimer = setTimeout(writeFile, 600); }
function renderBanner(){
  const b = document.getElementById('banner'); const hasData = COL.some(c => db[c].length);
  if(driveAtivo()){
    const st = drive.status;
    b.innerHTML = st === 'auth' || st === 'pendente-auth' ? `<div class="bn"><span>☁️ ${isDirty() ? '<b>Há alterações deste aparelho aguardando envio.</b> ' : ''}Conecte este aparelho ao Dropbox para sincronizar os dados.</span><span class="sp"></span><button class="btn primary" data-act="driveLogin">Conectar ao Dropbox</button><button class="btn" data-act="dbxCodigo">Conectar com código</button></div>`
      : st === 'erro' ? `<div class="bn"><span>⚠️ Problema na sincronização: ${esc(drive.erro)}</span><span class="sp"></span><button class="btn" data-act="driveSyncNow">Tentar de novo</button></div>` : '';
    return;
  }
  if(location.protocol !== 'file:' && DROPBOX_APP_KEY_PADRAO && !driveCfg().ativo && !driveCfg().recusado){
    b.innerHTML = `<div class="bn"><span>☁️ <b>Conecte este aparelho ao Dropbox</b> para usar os mesmos dados no celular e no computador.</span><span class="sp"></span><button class="btn primary" data-act="driveOnPadrao">Conectar ao Dropbox</button><button class="btn" data-act="driveAgoraNao">Agora não</button></div>`; return;
  }
  if(fileHandle && !filePerm){ b.innerHTML = `<div class="bn">🔄 O backup automático está pausado (o navegador pede confirmação a cada abertura).<span class="sp"></span><button class="btn ok" data-act="reactivateFile">Reativar agora</button></div>`; return; }
  if(fileHandle && filePerm){ b.innerHTML = ''; return; }
  const last = db.meta.lastBackup ? new Date(db.meta.lastBackup) : null;
  if(hasData && (!last || (Date.now() - last) / 86400000 > 7)){
    b.innerHTML = `<div class="bn">⚠️ ${last ? 'Seu último backup foi há mais de 7 dias.' : 'Você ainda não fez nenhum backup.'} Os dados ficam só neste navegador.<span class="sp"></span><button class="btn" data-act="exportJson">Baixar backup</button><a class="btn" href="#/config">Configurar backup automático</a></div>`;
  } else b.innerHTML = '';
}
window.addEventListener('beforeprint', () => { document.getElementById('printInfo').innerHTML = 'Relatório emitido em ' + new Date().toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}); });
window.addEventListener('beforeunload', e => { if(fsTimer){ clearTimeout(fsTimer); writeFile(); }
  if(typeof driveAtivo === 'function' && driveAtivo() && isDirty() && temSessao()){ driveSync('saída'); e.preventDefault(); e.returnValue = ''; } });

