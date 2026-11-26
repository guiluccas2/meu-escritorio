/* ===== Compromissos: subtipos por tipo · lembretes e preparação · recorrência · arquivos no Google Drive · próximos passos =====
   Campos novos no compromisso (db.prazos): tags, relacionados[ids], conversas[ids], lembretes[], recorr{}, serieId, arquivos[], gcalOver{} */

/* ----- subtipos por tipo ----- */
const SUBTIPOS_PADRAO = {
  'Audiência':['Inicial / conciliação', 'UNA', 'Instrução', 'Instrução e julgamento', 'Julgamento', 'Sessão de julgamento', 'Mediação', 'Justificação'],
  'Perícia':['Médica', 'Contábil', 'Insalubridade / periculosidade', 'Grafotécnica', 'Social', 'Engenharia'],
  'Prazo processual':['Contestação', 'Réplica', 'Recurso', 'Contrarrazões', 'Manifestação', 'Embargos de declaração', 'Cumprimento / cálculos', 'Especificação de provas', 'Alegações finais'],
  'Reunião':['Presencial', 'Videochamada', 'Telefone'],
  'Diligência':['Protocolo', 'Cartório', 'INSS', 'Fórum', 'Cópias / documentos'],
  'Tarefa':['Interna', 'Administrativa', 'Marketing / redes sociais'],
  'Retorno ao cliente':['Ligação', 'WhatsApp', 'E-mail'],
};
/* ----- audiência: presencial ou online (campos modalidade, local = endereço, sala · plataforma, audLink, audId, audSenha) ----- */
const ehAud = p => /audi[êe]ncia/i.test(p?.tipo || '');
const audOnline = p => ehAud(p) && p.modalidade === 'Online';
// local do compromisso: audiência online → link (ou “Online – plataforma”); presencial → endereço
const compLocal = p => audOnline(p) ? (p.audLink || p.local || 'Online' + (p.plataforma ? ' – ' + p.plataforma : '')) : (p.local || '');
const localMsg = p => audOnline(p) ? ', por videoconferência' + (p.plataforma ? ' (' + p.plataforma + ')' : '') + (p.audLink ? ': ' + p.audLink : '') : p.local ? ', em ' + p.local + (ehAud(p) && p.sala ? ' — ' + p.sala : '') : '';
const subtiposDe = t => (db.meta.subtiposPorTipo || {})[t] ?? SUBTIPOS_PADRAO[t] ?? [];
function subtipoAdd(t, v){ const l = [...subtiposDe(t)]; if(!l.includes(v)) l.push(v); db.meta.subtiposPorTipo = {...(db.meta.subtiposPorTipo || {}), [t]:l}; save(); }
function formSubtipos(t, volta){
  openForm({title:`Subtipos de “${t}”`, data:{l:subtiposDe(t).join('\n')}, fields:[{k:'l', label:'Um por linha (apague a linha para remover)', type:'textarea', rows:10, full:true}],
    onSave:v => { db.meta.subtiposPorTipo = {...(db.meta.subtiposPorTipo || {}), [t]:String(v.l || '').split('\n').map(x => x.trim()).filter(Boolean)}; save(); toast('Subtipos salvos'); if(volta) setTimeout(volta, 0); }});
}

/* ----- lembretes e preparação ----- */
// o cadastro do próprio usuário (Pessoas → “Este cadastro sou eu”): destino “eu mesmo” dos lembretes
const euMesmo = () => memo('pes:eu', () => db.pessoas.find(x => x.souEu) || null);
const telDe = x => x?.telefone || telsDe(x || {})[0]?.numero || '';
const LEMB_T = {whats:{ic:'🟢', t:'WhatsApp'}, email:{ic:'✉️', t:'E-mail'}, tarefa:{ic:'📋', t:'Tarefa de preparação'}, notif:{ic:'🔔', t:'Notificação para mim'}};
const UNID = {min:{t:'minuto(s)', ms:6e4}, h:{t:'hora(s)', ms:36e5}, d:{t:'dia(s)', ms:864e5}, sem:{t:'semana(s)', ms:6048e5}};
const LEMB_MODELOS_PADRAO = {
  'Audiência':[{tipo:'whats', qtd:7, unid:'d', hora:'09:00', para:['cliente']}, {tipo:'email', qtd:1, unid:'d', hora:'09:00', para:['cliente', 'testemunhas']},
    {tipo:'tarefa', qtd:7, unid:'d', titulo:'Estudar o processo e preparar as perguntas'}, {tipo:'tarefa', qtd:5, unid:'d', titulo:'Confirmar as testemunhas'}, {tipo:'notif', qtd:2, unid:'h'}],
  'Perícia':[{tipo:'whats', qtd:7, unid:'d', hora:'09:00', para:['cliente'], msg:'Olá, {nome}! Lembrando da sua perícia{subtipo} no dia {data}{hora}{local}. Leve documento com foto e os exames/laudos que tiver. Qualquer dúvida, estou à disposição.'},
    {tipo:'whats', qtd:1, unid:'d', hora:'09:00', para:['cliente']}, {tipo:'notif', qtd:2, unid:'h'}],
  'Reunião':[{tipo:'whats', qtd:1, unid:'d', hora:'09:00', para:['cliente']}, {tipo:'notif', qtd:1, unid:'h'}],
  'Prazo processual':[{tipo:'notif', qtd:2, unid:'d', hora:'09:00'}],
};
const lembModelo = t => ((db.meta.lembModelos || {})[t] ?? LEMB_MODELOS_PADRAO[t] ?? []).map(l => ({...l, id:uid()}));
const MSG_LEMB = 'Olá, {nome}! Lembrando: {titulo} no dia {data}{hora}{local}. Qualquer dúvida, estou à disposição.';
const lembDesc = l => `${Math.abs(l.qtd)} ${UNID[l.unid]?.t || l.unid} ${l.qtd < 0 ? 'depois' : 'antes'}${['d', 'sem'].includes(l.unid) && l.tipo !== 'tarefa' && l.tipo !== 'notif' ? ' às ' + (l.hora || '09:00') : ''}`;
// momento do lembrete (Date) — contado a partir do início do compromisso
function lembQuando(p, l){ if(!p.data) return null; const [hh, mm] = String(p.hora && !p.diaInteiro ? p.hora : '09:00').split(':').map(Number), base = parseD(p.data); base.setHours(hh, mm, 0, 0);
  const d = new Date(base.getTime() - (Number(l.qtd) || 0) * (UNID[l.unid]?.ms || 864e5));
  if(['d', 'sem'].includes(l.unid)){ const [h2, m2] = String(l.hora || '09:00').split(':').map(Number); d.setHours(h2, m2, 0, 0); } return d; }
const lembData = (p, l) => { const d = lembQuando(p, l); return d ? isoDate(d) : ''; };
function lembDestinos(p, l){
  const out = [], pr = byId('processos', p.processoId), cli = byId('pessoas', p.pessoaId || pr?.clienteId), add = (x, papel) => { if(x && !out.some(o => o.id === x.id)) out.push({id:x.id, nome:x.nome, tel:telDe(x), email:x.email || '', papel}); };
  if((l.para || []).includes('cliente')) add(cli, 'cliente');
  if((l.para || []).includes('testemunhas') && pr) (pr.testemunhas || []).forEach(t => add(byId('pessoas', t.pessoaId), 'testemunha'));
  if((l.para || []).includes('eu')){ const eu = euMesmo(); if(eu) add(eu, 'eu'); }
  (l.outros || []).forEach((o, i) => { if(o.nome || o.tel || o.email) out.push({id:i ? 'o' + i + ':' + digits(o.tel || o.email || o.nome) : 'o0', nome:o.nome || 'contato', tel:o.tel || '', email:o.email || '', papel:'outro'}); });
  return out;
}
const lembMsg = (p, l, nome) => String(l.msg || MSG_LEMB).replace(/\{nome\}/g, String(nome || '').split(' ')[0]).replace(/\{titulo\}/g, p.titulo || '').replace(/\{data\}/g, p.data ? fmtD(p.data) : '')
  .replace(/\{hora\}/g, p.hora && !p.diaInteiro ? ' às ' + p.hora : '').replace(/\{local\}/g, localMsg(p)).replace(/\{subtipo\}/g, p.subtipo ? ' (' + p.subtipo.toLowerCase() + ')' : '');

function lembEditorHtml(){ return `<div class="small muted" style="margin-bottom:6px">Avisos e tarefas ligados a este compromisso, contados a partir do início dele. Os automáticos vêm dos <a href="#/workflows" onclick="closeModal()">🔀 Workflows</a> (aparecem depois de salvar, marcados ⚙️). <a href="#" id="lbSalvaModelo">criar workflow com estes lembretes</a></div>
  <div id="lbLista"></div><div id="lbEd"></div>
  <div class="lbAdd">${Object.entries(LEMB_T).map(([k, v]) => `<button type="button" class="mini" data-lbnovo="${k}">+ ${v.ic} ${v.t}</button>`).join('')}</div>`; }
function lembEditorLigar(f, p){
  f._lembs = (formCfg?.data?.lembretes || p.lembretes || []).map(l => ({...l}));
  const tipoAtual = () => f.elements.tipo?.value || p.tipo;
  const pinta = () => { const ctx = {...p, data:f.elements.data.value, hora:f.elements.hora.value, diaInteiro:f.elements.diaInteiro.checked, processoId:f.elements.processoId.value, pessoaId:f.elements.pessoaId.value, titulo:f.elements.titulo.value};
    f.querySelector('#lbLista').innerHTML = f._lembs.map((l, i) => { const dt = lembData(ctx, l), ds = l.tipo === 'tarefa' || l.tipo === 'notif' ? [] : lembDestinos(ctx, l);
      return `<div class="lb ${l.tipo}"><div class="ic">${LEMB_T[l.tipo].ic}</div><div><b>${l.tipo === 'tarefa' ? 'Tarefa: ' + esc(l.titulo || '(sem título)') : LEMB_T[l.tipo].t + (ds.length ? ' para ' + esc(ds.map(d => d.papel === 'eu' ? 'mim' : d.nome.split(' ')[0]).join(', ')) : '')}</b> — ${lembDesc(l)}${dt ? ` <span class="muted">(${fmtD(dt)})</span>` : ''}
        ${l.tipo !== 'tarefa' && l.tipo !== 'notif' && !ds.length ? '<div class="small" style="color:var(--warn)">ninguém para avisar — escolha o cliente/processo ou inclua um contato</div>' : ''}${l.tipo === 'email' && ds.length && ds.some(d => !d.email) ? `<div class="small" style="color:var(--warn)">sem e-mail cadastrado: ${esc(ds.filter(d => !d.email).map(d => d.nome).join(', '))}</div>` : ''}${l.tarefaId && byId('prazos', l.tarefaId)?.concluido ? ' <span class="tag ok">feita</span>' : ''}${l.wf ? ` <span class="tag grey" title="Criado pelo workflow">⚙️ ${esc(wfs().find(w => w.id === l.wf)?.titulo || 'workflow')}</span>` : ''}</div>
        <span><button type="button" class="mini" data-lbed="${i}">✎</button> <button type="button" class="mini" data-lbrm="${i}">✕</button></span></div>`; }).join('') || '<div class="small muted">Nenhum lembrete.</div>';
    const s = f.querySelector('#gLemb summary .small'); if(s) s.textContent = f._lembs.length ? `(${f._lembs.length})` : 'avisos e tarefas antes do compromisso'; };
  f._lembPinta = pinta;
  const edita = i => { const novo = typeof i === 'string', l = novo ? {id:uid(), tipo:i, qtd:i === 'notif' ? 1 : i === 'tarefa' ? 3 : 1, unid:i === 'notif' ? 'h' : 'd', hora:'09:00', para:['cliente']} : f._lembs[i];
    const wz = l.tipo === 'whats', linhaC = (o = {}) => `<div class="lOr"><input class="lOn" list="lbPesDl" value="${esc(o.nome || '')}" placeholder="Nome"><input class="lOc" value="${esc((wz ? o.tel : o.email) || '')}" placeholder="${wz ? 'Celular com DDD' : 'E-mail'}"><button type="button" class="mini lOx" title="Remover este contato">✕</button></div>`;
    const eu = euMesmo();
    f.querySelector('#lbEd').innerHTML = `<div class="lbForm"><b>${LEMB_T[l.tipo].ic} ${LEMB_T[l.tipo].t}</b>
      <div class="lbG"><label>Quanto tempo antes<input type="number" min="0" class="lQ" value="${l.qtd}"></label><label>Unidade<select class="lU">${Object.entries(UNID).map(([k, v]) => `<option value="${k}" ${l.unid === k ? 'selected' : ''}>${v.t}</option>`).join('')}</select></label>
        <label class="lHw">Horário (quando for em dias/semanas)<input type="time" class="lH" value="${l.hora || '09:00'}"></label></div>
      ${l.tipo === 'tarefa' ? `<label>Título da tarefa<input class="lT" value="${esc(l.titulo || '')}" placeholder="ex.: Estudar o processo e preparar as perguntas"></label>` : ''}
      ${l.tipo === 'whats' || l.tipo === 'email' ? `<div class="lbP"><span class="small muted">Para:</span><label class="chk"><input type="checkbox" class="lPc" ${(l.para || []).includes('cliente') ? 'checked' : ''}> cliente</label><label class="chk"><input type="checkbox" class="lPt" ${(l.para || []).includes('testemunhas') ? 'checked' : ''}> testemunhas do processo</label>
        ${wz ? `<label class="chk"><input type="checkbox" class="lPe" ${(l.para || []).includes('eu') ? 'checked' : ''}> eu mesmo${eu ? ` <span class="muted">(${esc(eu.nome.split(' ')[0])}${telDe(eu) ? ' · ' + esc(telDe(eu)) : ' — <b style="color:var(--warn)">sem celular no cadastro</b>'})</span>` : ''}</label>` : ''}</div>
        ${wz && !eu ? `<div class="small lPeAv" style="color:var(--warn);display:${(l.para || []).includes('eu') ? '' : 'none'}">Para mandar para você mesmo, abra o seu cadastro em 👥 Pessoas (ou crie um) e marque <b>“👤 Este cadastro sou eu”</b>.</div>` : ''}
        <div class="small muted" style="margin-top:6px">Outros contatos ${wz ? '(nome e celular)' : '(nome e e-mail)'} — digite o nome de alguém já cadastrado para puxar ${wz ? 'o celular' : 'o e-mail'}:</div>
        <div class="lOs">${(l.outros || []).map(linhaC).join('')}</div><button type="button" class="mini lOadd">+ incluir contato</button>
        <datalist id="lbPesDl">${memo('pes:dlTel', () => db.pessoas.filter(x => telDe(x) || x.email).map(x => `<option value="${esc(x.nome)}">`).join(''))}</datalist>
        <label>Mensagem <span class="small muted">— use {nome}, {titulo}, {data}, {hora}, {local}</span><textarea class="lM" rows="3" placeholder="${esc(MSG_LEMB)}">${esc(l.msg || '')}</textarea></label>` : ''}
      <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn primary" id="lbOk">OK</button><button type="button" class="btn" id="lbCanc">Cancelar</button></div></div>`;
    const ed = f.querySelector('#lbEd'), hw = () => { ed.querySelector('.lHw').style.display = ['d', 'sem'].includes(ed.querySelector('.lU').value) && l.tipo !== 'tarefa' ? '' : 'none'; };
    ed.querySelector('.lU').onchange = hw; hw();
    const lOs = ed.querySelector('.lOs');
    if(lOs){ const nova = () => { lOs.insertAdjacentHTML('beforeend', linhaC()); lOs.lastElementChild.querySelector('.lOn').focus(); };
      ed.querySelector('.lOadd').onclick = nova; if(!lOs.children.length && !(l.para || []).length) nova();
      lOs.addEventListener('click', e => { if(e.target.closest('.lOx')) e.target.closest('.lOr').remove(); });
      lOs.addEventListener('change', e => { if(!e.target.classList.contains('lOn')) return; const c = e.target.nextElementSibling, x = db.pessoas.find(y => y.nome === e.target.value.trim());
        if(x && !c.value.trim()) c.value = wz ? fmtTel(telDe(x)) : (x.email || ''); });
      const pe = ed.querySelector('.lPe'), av = ed.querySelector('.lPeAv'); if(pe && av) pe.onchange = () => { av.style.display = pe.checked ? '' : 'none'; }; }
    ed.querySelector('#lbCanc').onclick = () => { ed.innerHTML = ''; };
    ed.querySelector('#lbOk').onclick = () => { l.qtd = Number(ed.querySelector('.lQ').value) || 0; l.unid = ed.querySelector('.lU').value; l.hora = ed.querySelector('.lH').value || '09:00';
      if(l.tipo === 'tarefa') l.titulo = ed.querySelector('.lT').value.trim() || 'Preparação';
      if(l.tipo === 'whats' || l.tipo === 'email'){ l.para = [ed.querySelector('.lPc').checked && 'cliente', ed.querySelector('.lPt').checked && 'testemunhas', ed.querySelector('.lPe')?.checked && 'eu'].filter(Boolean);
        l.outros = [...ed.querySelectorAll('.lOr')].map(r => ({on:r.querySelector('.lOn').value.trim(), oc:r.querySelector('.lOc').value.trim()})).filter(x => x.on || x.oc)
          .map(({on, oc}) => wz ? {nome:on, tel:fmtTel(oc)} : {nome:on, email:oc}); l.msg = ed.querySelector('.lM').value.trim(); }
      if(novo) f._lembs.push(l); ed.innerHTML = ''; pinta(); };
  };
  f.querySelector('.lbAdd').addEventListener('click', e => { const b = e.target.closest('[data-lbnovo]'); if(b) edita(b.dataset.lbnovo); });
  f.querySelector('#lbLista').addEventListener('click', e => { const ed = e.target.closest('[data-lbed]'), rm = e.target.closest('[data-lbrm]');
    if(ed) edita(+ed.dataset.lbed); if(rm){ f._lembs.splice(+rm.dataset.lbrm, 1); pinta(); } });
  f.querySelector('#lbSalvaModelo').onclick = e => { e.preventDefault(); if(!f._lembs.length) return toast('Inclua os lembretes primeiro'); if(!confirm('Abrir um workflow novo com estes lembretes? O que não foi salvo neste compromisso será perdido.')) return; wfDeLembretes(tipoAtual(), f._lembs); };
  ['data', 'hora', 'diaInteiro', 'processoId', 'pessoaId', 'titulo'].forEach(n => f.elements[n]?.addEventListener('change', pinta));
  // os lembretes automáticos agora vêm dos Workflows (gatilho “Ao criar um compromisso”), depois de salvar
  pinta();
}
// cria / atualiza / remove as tarefas de preparação (compromissos vinculados)
function lembSincronizarTarefas(p, anteriores = []){
  const atuais = new Set((p.lembretes || []).filter(l => l.tipo === 'tarefa' && l.tarefaId).map(l => l.tarefaId));
  anteriores.filter(l => l.tipo === 'tarefa' && l.tarefaId && !atuais.has(l.tarefaId)).forEach(l => { const t = byId('prazos', l.tarefaId); if(t && !t.concluido) removeItem('prazos', t.id); });
  let mudou = false;
  (p.lembretes || []).filter(l => l.tipo === 'tarefa').forEach(l => { const data = lembData(p, l), t = l.tarefaId && byId('prazos', l.tarefaId);
    const base = {titulo:l.titulo || 'Preparação', data, processoId:p.processoId || '', pessoaId:p.pessoaId || '', relacionados:[p.id], lembDe:{pai:p.id, lemb:l.id}, obs:`Preparação para: ${p.titulo}${p.data ? ' — ' + fmtD(p.data) + (p.hora ? ' às ' + p.hora : '') : ''}`};
    if(t){ if(!t.concluido) upsert('prazos', {id:t.id, ...base}); }
    else if(data){ const n = upsert('prazos', {tipo:'Tarefa', situacao:'Pendente', concluido:false, coluna:'tarefas', ...(/testemunh/i.test(base.titulo) ? {contatoCom:'Testemunha'} : {}), ...base}); l.tarefaId = n.id; mudou = true; } });
  const rel = new Set([...(p.relacionados || []), ...(p.lembretes || []).filter(l => l.tarefaId).map(l => l.tarefaId)]);
  if(mudou || rel.size !== (p.relacionados || []).length){ const q = byId('prazos', p.id); if(q){ q.lembretes = p.lembretes; q.relacionados = [...rel]; save(); } }
}
// WhatsApp a enviar (hoje ou atrasados, enquanto o compromisso não passou); comFeitos = inclui os já enviados/dispensados (ficam riscados na lista)
// todos os WhatsApp dos compromissos futuros (um item por destinatário), com o dia de envio — semTel: destinatário sem celular no cadastro
const lembWhatsTodos = () => memo('lembw:todos', () => { const out = [], t = today();
  db.prazos.forEach(p => { if(p.concluido || !p.data || p.data < t || !(p.lembretes || []).length) return;
    p.lembretes.forEach(l => { if(l.tipo !== 'whats') return; const dt = lembData(p, l); if(!dt) return;
      lembDestinos(p, l).forEach(d => out.push({p, l, d, dt, feito:(l.enviados || {})[d.id] || '', disp:!!(l.dispensados || {})[d.id], semTel:!d.tel})); }); });
  return out.sort((a, b) => a.dt.localeCompare(b.dt) || (a.p.hora || '').localeCompare(b.p.hora || '')); });
const lembWhatsPorDia = () => memo('lembw:dia', () => { const m = new Map(); lembWhatsTodos().forEach(x => (m.get(x.dt) || m.set(x.dt, []).get(x.dt)).push(x)); return m; });
function lembWhatsPendentes(dia = today(), comFeitos){
  return lembWhatsTodos().filter(x => x.dt <= dia && (comFeitos || !x.feito)).sort((a, b) => !!a.feito - !!b.feito || a.dt.localeCompare(b.dt));
}
// programados para depois de hoje (aparecem no calendário e na lista “Programados”)
const lembWhatsDoDia = d => d > today() ? (lembWhatsPorDia().get(d) || []) : [];
function lembMarcar(pid, lid, did, dispensa){ const p = byId('prazos', pid), l = (p?.lembretes || []).find(x => x.id === lid); if(!l) return;
  l.enviados = {...(l.enviados || {}), [did]:new Date().toISOString()}; const ds = {...(l.dispensados || {})}; if(dispensa) ds[did] = 1; else delete ds[did]; l.dispensados = ds; save(); }
function lembDesfazer(pid, lid, did){ const p = byId('prazos', pid), l = (p?.lembretes || []).find(x => x.id === lid); if(!l) return;
  const e = {...(l.enviados || {})}, ds = {...(l.dispensados || {})}; delete e[did]; delete ds[did]; l.enviados = e; l.dispensados = ds; save(); }
// abre o compromisso já no lembrete, para editar a mensagem / os destinatários
function lembEditar(pid, lid){ const p = byId('prazos', pid); if(!p) return; formPrazo(p);
  setTimeout(() => { const g = mForm.querySelector('#gLemb'); if(g){ g.open = true; g.scrollIntoView({block:'start'}); } const i = (p.lembretes || []).findIndex(x => x.id === lid); mForm.querySelector(`[data-lbed="${i}"]`)?.click(); }, 80); }
const lembBotoes = (x, mini) => { const a = `data-p="${x.p.id}" data-l="${x.l.id}" data-d="${x.d.id}"`;
  if(x.semTel && !x.feito) return `<span style="white-space:nowrap"><button class="mini" data-act="lembEditar" ${a} title="Editar os destinatários">✎ editar</button> <button class="mini" data-act="lembDispensar" ${a} title="Não enviar">✕</button></span>`;
  return x.feito ? `<span style="white-space:nowrap"><button class="mini" data-act="lembDesfazer" ${a} title="Volta para a lista de envios">↩ desfazer</button> <button class="mini" data-act="lembEditar" ${a} title="Editar a mensagem / os destinatários">✎ editar</button></span>`
    : `<span style="white-space:nowrap"><button class="${mini ? 'mini' : 'btn ok'}" ${mini ? 'style="border-color:#25d366;color:#128c3e"' : ''} data-act="lembEnviar" ${a}>🟢 ${mini ? 'enviar' : 'Enviar'}</button> <button class="mini" data-act="lembEditar" ${a} title="Editar a mensagem / os destinatários">✎</button> <button class="mini" data-act="lembDispensar" ${a} title="Não enviar">✕</button></span>`; };
const lembFeitoTxt = x => x.feito ? (x.disp ? '✕ dispensado' : '✔ enviado') + ' em ' + new Date(x.feito).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '';
const lembDestTxt = x => x.semTel && !x.feito ? '<b style="color:var(--warn)">⚠️ sem celular no cadastro — inclua o número ou edite o lembrete</b> · ' : '';
function lembCardHtml(dia = today()){
  const ls = lembWhatsPendentes(dia, true), prog = lembWhatsTodos().filter(x => x.dt > dia && !x.feito); if(!ls.length && !prog.length) return ''; const pend = ls.filter(x => !x.feito).length;
  const progHtml = prog.length ? `<details class="lbProg"${ls.length ? '' : ' open'}><summary>📆 Programados <span class="tag grey">${prog.length}</span> <span class="small muted">— aparecem para enviar no dia marcado</span></summary>${prog.slice(0, 60).map(x => `<div class="lb whats lbFut"><div class="ic">📆</div><div><span class="lbTx"><b>${fmtD(x.dt).slice(0, 5)}</b>${x.l.hora && ['d', 'sem'].includes(x.l.unid) ? ' ' + esc(x.l.hora) : ''} · <b>${esc(x.d.papel === 'eu' ? 'Eu mesmo' : x.d.nome)}</b> — ${esc(x.p.titulo)} (${fmtD(x.p.data)}${x.p.hora ? ' às ' + x.p.hora : ''})</span><small>${lembDestTxt(x)}${esc(lembMsg(x.p, x.l, x.d.nome).slice(0, 90))}…</small></div>
    <span style="white-space:nowrap"><button class="mini" data-act="lembEditar" data-p="${x.p.id}" data-l="${x.l.id}" data-d="${x.d.id}" title="Editar a mensagem / os destinatários">✎</button>${x.semTel ? '' : ` <button class="mini" style="border-color:#25d366;color:#128c3e" data-act="lembEnviar" data-p="${x.p.id}" data-l="${x.l.id}" data-d="${x.d.id}" title="Enviar agora, antes do dia marcado">🟢 enviar já</button>`}</span></div>`).join('')}${prog.length > 60 ? `<div class="small muted">+ ${prog.length - 60} mais adiante</div>` : ''}</details>` : '';
  if(!ls.length) return `<div class="card"><h2>🟢 Lembretes de WhatsApp <span class="tag ok">nada para hoje</span></h2>${progHtml}</div>`;
  return `<div class="card"><h2>🟢 Lembretes para enviar ${pend ? `<span class="tag warn">${pend}</span>` : '<span class="tag ok">✔ todos enviados</span>'}</h2>${ls.map(x => `<div class="lb whats${x.feito ? ' lbFeito' : ''}"><div class="ic">${x.feito ? '✔' : '🟢'}</div><div><span class="lbTx"><b>${esc(x.d.papel === 'eu' ? 'Eu mesmo' : x.d.nome)}</b>${x.d.papel !== 'cliente' && x.d.papel !== 'eu' ? ` <span class="tag grey">${esc(x.d.papel)}</span>` : ''} — ${esc(x.p.titulo)} (${fmtD(x.p.data)}${x.p.hora ? ' às ' + x.p.hora : ''})</span><small>${x.feito ? `<b class="lbOk">${lembFeitoTxt(x)}</b> · ` : lembDestTxt(x) + (x.dt < dia ? '⚠️ era para ' + fmtD(x.dt) + ' · ' : '')}<span class="lbTx">${esc(lembMsg(x.p, x.l, x.d.nome).slice(0, 110))}…</span></small></div>
    ${lembBotoes(x)}</div>`).join('')}${progHtml}</div>`;
}
// notificações para mim + aviso no 🔔
setInterval(() => { if(!db) return; const agora = Date.now();
  db.prazos.filter(p => !p.concluido && p.data && (p.lembretes || []).some(l => l.tipo === 'notif' && !l.feito)).forEach(p => p.lembretes.filter(l => l.tipo === 'notif' && !l.feito).forEach(l => {
    const q = lembQuando(p, l); if(q && q.getTime() <= agora && agora - q.getTime() < 6 * 3600e3){ l.feito = true; save();
      if(typeof ntEnviar === 'function' && 'Notification' in window && Notification.permission === 'granted') ntEnviar(`⏰ ${p.titulo}`, `${fmtD(p.data)}${p.hora ? ' às ' + p.hora : ''}${p.local ? ' · ' + p.local : ''}`, '#/agenda', 'lemb' + l.id);
      toast(`⏰ Lembrete: ${p.titulo} — ${fmtD(p.data)}${p.hora ? ' às ' + p.hora : ''}`); } })); }, 60000);
{ const ntBase2 = ntAvisos; ntAvisos = function(){ const av = ntBase2(), w = lembWhatsPendentes();
    if(w.length) av.unshift({id:'lembw', sig:w.map(x => x.p.id + x.l.id + x.d.id).join(), ic:'🟢', t:`${w.length} lembrete(s) de WhatsApp para enviar`, s:w.slice(0, 3).map(x => x.d.nome.split(' ')[0] + ' — ' + x.p.titulo).join(' · '), href:'#/agenda', nivel:'warn', tipo:'aviso'});
    return av; }; }

/* ----- e-mails automáticos (o robô envia pela conta Google dele) ----- */
function emailsParaRobo(){
  const out = [], agora = Date.now();
  db.prazos.filter(p => !p.concluido && p.data).forEach(p => (p.lembretes || []).filter(l => l.tipo === 'email').forEach(l => { const q = lembQuando(p, l); if(!q || q.getTime() < agora - 2 * 864e5) return;
    lembDestinos(p, l).filter(d => d.email).forEach(d => { if((l.enviados || {})[d.id]) return;
      out.push({id:`${p.id}:${l.id}:${d.id}`, quando:q.toISOString(), para:d.email, assunto:`Lembrete: ${p.titulo} — ${fmtD(p.data)}${p.hora && !p.diaInteiro ? ' às ' + p.hora : ''}`,
        corpo:lembMsg(p, l, d.nome) + '\n\n—\nGuilherme Garcia Advogado'}); }); }));
  return out;
}
let emailBusy = false;
async function emailsSincronizar(forcar){
  if(emailBusy || !monCfg().roboUrl || !navigator.onLine) return;
  const lista = emailsParaRobo(), h = JSON.stringify(lista), L = monLocal();
  if(!forcar && h === L.emailsHash && Date.now() - (L.emailsEm || 0) < 3 * 3600e3) return;
  emailBusy = true;
  try{ const r = await roboChamar(null, {emails:lista}); setMonLocal({emailsHash:h, emailsEm:Date.now(), emailsErro:''});
    (r.emailsEnviados || []).forEach(id => { const [pid, lid, did] = id.split(':'); lembMarcar(pid, lid, did); }); }
  catch(e){ setMonLocal({emailsErro:e.message}); } finally { emailBusy = false; }
}
setInterval(() => emailsSincronizar(), 10 * 60e3); setTimeout(() => emailsSincronizar(), 8000);

/* ----- recorrência ----- */
const FREQ = {d:'Diário', s:'Semanal', m:'Mensal', a:'Anual'};
const DIAS_CURTO = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function recEditorHtml(){ return `<label class="chk"><input type="checkbox" id="rcOn"> Compromisso que se repete</label><div id="rcBox" style="display:none;margin-top:8px">
  <div class="seg rcFreq">${Object.entries(FREQ).map(([k, v]) => `<button type="button" data-rf="${k}">${v}</button>`).join('')}</div>
  <div class="lbG" style="margin-top:8px"><label>A cada<input type="number" min="1" id="rcCada" value="1"></label><label id="rcDiasL" style="grid-column:span 2">Nos dias<div class="rcDias">${DIAS_CURTO.map((d, i) => `<label class="chk"><input type="checkbox" data-rd="${i}"> ${d}</label>`).join('')}</div></label></div>
  <div class="lbG"><label>Termina<select id="rcFim"><option value="nunca">nunca</option><option value="data">em uma data</option><option value="vezes">após um número de vezes</option></select></label><label id="rcAteL">Até<input type="date" id="rcAte"></label><label id="rcVezesL">Vezes<input type="number" min="1" id="rcVezes" value="10"></label></div>
  <div class="small muted" id="rcResumo"></div></div>`; }
function recEditorLigar(f, p){
  const r = formCfg?.data?.recorr || p.recorr || null, $ = s => f.querySelector(s); let freq = r?.freq || 's';
  $('#rcOn').checked = !!r; if(r){ $('#rcCada').value = r.cada || 1; $('#rcFim').value = r.fim || 'nunca'; $('#rcAte').value = r.ate || ''; $('#rcVezes').value = r.vezes || 10; }
  const diasSel = new Set(r?.dias || [parseD(f.elements.data.value || today()).getDay()]);
  f.querySelectorAll('[data-rd]').forEach(c => { c.checked = diasSel.has(+c.dataset.rd); });
  const upd = () => { $('#rcBox').style.display = $('#rcOn').checked ? '' : 'none'; f.querySelectorAll('[data-rf]').forEach(b => b.classList.toggle('on', b.dataset.rf === freq));
    $('#rcDiasL').style.display = freq === 's' ? '' : 'none'; $('#rcAteL').style.display = $('#rcFim').value === 'data' ? '' : 'none'; $('#rcVezesL').style.display = $('#rcFim').value === 'vezes' ? '' : 'none';
    const v = recLer(f); $('#rcResumo').textContent = v ? recResumo(v) + ' · o sistema cria as ocorrências dos próximos 3 meses e vai criando mais com o tempo.' : ''; };
  f.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { freq = b.dataset.rf; upd(); }); f._recFreq = () => freq;
  ['#rcOn', '#rcCada', '#rcFim', '#rcAte', '#rcVezes'].forEach(s => $(s).addEventListener('input', upd)); f.querySelectorAll('[data-rd]').forEach(c => c.addEventListener('change', upd)); upd();
}
function recLer(f){ const $ = s => f.querySelector(s); if(!$('#rcOn')?.checked) return null;
  return {freq:f._recFreq ? f._recFreq() : 's', cada:Math.max(1, +$('#rcCada').value || 1), dias:[...f.querySelectorAll('[data-rd]:checked')].map(c => +c.dataset.rd), fim:$('#rcFim').value, ate:$('#rcAte').value, vezes:Math.max(1, +$('#rcVezes').value || 1)}; }
const recResumo = r => `${FREQ[r.freq]}${r.cada > 1 ? `, a cada ${r.cada} ${{d:'dias', s:'semanas', m:'meses', a:'anos'}[r.freq]}` : ''}${r.freq === 's' && r.dias?.length ? ' (' + r.dias.sort().map(i => DIAS_CURTO[i]).join(', ') + ')' : ''}${r.fim === 'data' && r.ate ? ' até ' + fmtD(r.ate) : r.fim === 'vezes' ? `, ${r.vezes} vezes` : ''}`;
// datas da série a partir da 1ª ocorrência
function recDatas(inicio, r, ate){
  const out = []; const lim = r.fim === 'data' && r.ate && r.ate < ate ? r.ate : ate, max = r.fim === 'vezes' ? r.vezes : 400;
  if(r.freq === 's'){ const dias = r.dias?.length ? r.dias : [parseD(inicio).getDay()], dom0 = addDays(inicio, -parseD(inicio).getDay());
    for(let w = 0; out.length < max; w += r.cada){ const sem = addDays(dom0, 7 * w); if(sem > lim) break; dias.slice().sort().forEach(i => { const d = addDays(sem, i); if(d >= inicio && d <= lim && out.length < max) out.push(d); }); } }
  else for(let k = 0; out.length < max; k++){ const d = r.freq === 'd' ? addDays(inicio, k * r.cada) : r.freq === 'm' ? addMonths(inicio, k * r.cada) : addMonths(inicio, 12 * k * r.cada); if(d > lim) break; out.push(d); }
  return out;
}
const SERIE_CAMPOS = ['titulo', 'tipo', 'subtipo', 'hora', 'horaFim', 'diaInteiro', 'local', 'modalidade', 'plataforma', 'sala', 'audLink', 'audId', 'audSenha', 'processoId', 'pessoaId', 'obs', 'tags', 'recorr', 'coluna'];
function serieGerar(base){
  if(!base.recorr || !base.data) return 0; const serie = base.serieId || base.id, ate = addDays(today(), 92);
  const ja = new Set(db.prazos.filter(x => (x.serieId || x.id) === serie).map(x => x.data)); let n = 0;
  recDatas(base.serieInicio || base.data, base.recorr, ate).forEach(d => { if(ja.has(d)) return; const c = {situacao:'Pendente', concluido:false, serieId:serie, serieInicio:base.serieInicio || base.data, data:d, dataFim:d};
    SERIE_CAMPOS.forEach(k => { if(base[k] !== undefined) c[k] = JSON.parse(JSON.stringify(base[k])); });
    c.checklist = (base.checklist || []).map(x => ({t:x.t, ok:false})); c.lembretes = (base.lembretes || []).filter(l => l.tipo !== 'tarefa').map(({tarefaId, enviados, feito, ...l}) => ({...l, id:uid()}));
    upsert('prazos', c); ja.add(d); n++; });
  const b = byId('prazos', base.id); if(b && !b.serieId){ b.serieId = serie; b.serieInicio = b.serieInicio || b.data; save(); }
  return n;
}
function seriesEstender(){ if(!db) return; const vistas = new Map();
  db.prazos.filter(x => x.recorr && x.serieId).forEach(x => { const s = vistas.get(x.serieId); if(!s || x.data > s.data) vistas.set(x.serieId, x); });
  vistas.forEach(ult => { if(ult.recorr.fim !== 'vezes') serieGerar(ult); }); }
setTimeout(seriesEstender, 4000); setInterval(seriesEstender, 6 * 3600e3);

/* ----- arquivos no Google Drive (pasta do cliente / do processo) ----- */
const arqCfg = () => db.meta.arqCfg || {};
function arqAlvo(p){ const pr = byId('processos', p.processoId), cli = byId('pessoas', p.pessoaId || pr?.clienteId); if(!cli?.pasta) return null;
  const varios = db.processos.filter(x => x.clienteId === cli.id).length > 1;
  return {cliente:cli.pasta, nome:cli.nome, proc:pr && varios ? procCode(pr) : '', procNome:pr ? (pr.titulo || '') : '', procNum:pr?.numero || '', seq:pr?.seq || ''}; }
function arqEditorHtml(msg){ return `<div id="arqDest" class="arqPath small muted">${msg || 'Escolha o cliente ou o processo (em Vínculos) para saber em que pasta os arquivos vão.'}</div><div id="arqLista"></div>
  <label class="arqDrop" id="arqDrop"><input type="file" multiple id="arqIn" hidden>⬆️ Arraste os arquivos aqui ou <b>clique para escolher</b><br><span class="small">vão direto para a pasta no seu Google Drive (até ~20 MB cada)</span></label><div id="arqSt" class="small"></div>`; }
// alvoFn: onde guardar (padrão: pasta do cliente/processo). Atendimentos usam {…, sub:'Atendimentos'} ou {lead:nome, sub:'Atendimentos'} (robô versão 9)
function arqEditorLigar(f, p, alvoFn = arqAlvo, msgSem){
  f._arqs = [...(formCfg?.data?.arquivos || p.arquivos || [])];
  const lista = () => { f.querySelector('#arqLista').innerHTML = f._arqs.map((a, i) => `<div class="lb"><div class="ic">📄</div><div><a href="${esc(a.url)}" target="_blank" rel="noopener"><b>${esc(a.nome)}</b></a><small>${a.em ? fmtD(a.em.slice(0, 10)) : ''}</small></div><button type="button" class="mini" data-arqrm="${i}" title="Tirar da lista (o arquivo continua no Drive)">✕</button></div>`).join(''); };
  lista(); f.querySelector('#arqLista').addEventListener('click', e => { const b = e.target.closest('[data-arqrm]'); if(b){ f._arqs.splice(+b.dataset.arqrm, 1); lista(); } });
  let pasta = null;
  const ctx = () => ({...p, processoId:f.elements.processoId ? f.elements.processoId.value : p.processoId, pessoaId:f.elements.pessoaId ? f.elements.pessoaId.value : p.pessoaId});
  const resolve = async () => { const alvo = alvoFn(ctx()), dest = f.querySelector('#arqDest');
    if(!arqCfg().ativos){ dest.innerHTML = '⚙️ Configure as pastas <b>Ativos</b> e <b>Encerrados</b> do Google Drive em <a href="#/config" onclick="closeModal()">Configurações → 📁 Arquivos</a>.'; return null; }
    if(!alvo){ dest.textContent = msgSem || 'Escolha o cliente ou o processo (em Vínculos) — a pasta é encontrada pelo número do cliente.'; return null; }
    if((alvo.lead || alvo.sub) && (monLocal().roboVersao || 0) && monLocal().roboVersao < 9){ dest.innerHTML = '<span style="color:var(--bad)">⚠️ Para guardar arquivos de atendimentos, cole a versão nova do robô (9) no Apps Script e atualize a implantação.</span>'; return null; }
    dest.textContent = 'Localizando a pasta no Drive…';
    try{ const r = await roboChamar(null, {arqPasta:alvo}); pasta = r.pasta; dest.innerHTML = `📁 ${esc(r.pasta.caminho)} <a href="${esc(r.pasta.url)}" target="_blank" rel="noopener" style="float:right">abrir pasta ↗</a>`; return pasta; }
    catch(e){ dest.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(/desconhec|arqPasta/.test(e.message) ? 'o robô está desatualizado — cole a versão nova' : e.message)}</span>`; return null; } };
  f.querySelector('#gArq')?.addEventListener('toggle', e => { if(e.target.open && !pasta) resolve(); });
  ['processoId', 'pessoaId'].forEach(n => f.elements[n]?.addEventListener('change', () => { pasta = null; if(f.querySelector('#gArq')?.open) resolve(); }));
  const envia = async files => { const st = f.querySelector('#arqSt'); if(!pasta && !(await resolve())) return;
    for(const file of files){ if(file.size > 20e6){ st.innerHTML += `<div style="color:var(--bad)">⚠️ ${esc(file.name)}: maior que 20 MB — use “abrir pasta” e envie direto pelo Drive</div>`; continue; }
      st.textContent = `Enviando ${file.name}…`;
      try{ const b64 = await lerBase64(file), r = await roboChamar(null, {arqEnviar:{pastaId:pasta.id, nome:file.name, tipo:file.type || 'application/octet-stream', base64:b64}});
        f._arqs.push({nome:r.arquivo.nome, url:r.arquivo.url, em:new Date().toISOString()}); lista(); st.textContent = `✔ ${file.name} enviado`; }
      catch(e){ st.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(file.name)}: ${esc(e.message)}</span>`; } } };
  const inp = f.querySelector('#arqIn'), drop = f.querySelector('#arqDrop');
  inp.onchange = () => { envia([...inp.files]); inp.value = ''; };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('on'); }); drop.addEventListener('dragleave', () => drop.classList.remove('on'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('on'); envia([...e.dataTransfer.files]); });
}
function formArqCfg(){
  const c = arqCfg();
  openForm({title:'📁 Arquivos no Google Drive', data:{ativos:c.ativos || '', encerrados:c.encerrados || ''}, fields:[
    {type:'html', html:`<p class="small" style="margin-top:0">O sistema guarda os arquivos (ex.: ata de audiência) na <b>pasta do cliente</b>, encontrada pelo número: <b>P0159 - Maria</b>. Quando o cliente tem mais de um processo, vai para a subpasta do processo: <b>P0159.1 - …</b>. Se a pasta não existir, ela é criada nesse padrão.<br><br>Quando <b>todos os processos</b> de um cliente ficam encerrados ou arquivados, a pasta dele é <b>movida sozinha para Encerrados</b> (e volta para Ativos se um processo for reaberto).</p>`},
    {k:'ativos', label:'Link da pasta “Ativos” no Google Drive', req:true, full:true, ph:'https://drive.google.com/drive/folders/…'},
    {k:'encerrados', label:'Link da pasta “Encerrados” no Google Drive', req:true, full:true, ph:'https://drive.google.com/drive/folders/…'},
    {type:'html', html:`<div id="arqCfgSt" class="small"></div>`}],
    onSave:v => { const st = mForm.querySelector('#arqCfgSt'); st.textContent = 'Conferindo as pastas…';
      roboChamar(null, {arqCfg:{ativos:v.ativos, encerrados:v.encerrados}}).then(r => { if(!r.ativos) throw new Error('o robô está desatualizado — cole a versão nova e rode “autorizarCadastro”');
        db.meta.arqCfg = {ativos:v.ativos, encerrados:v.encerrados, ativosNome:r.ativos, encerradosNome:r.encerrados}; arqEstadoInicial(); save(); closeModal(); render(); toast(`✔ Pastas: “${r.ativos}” e “${r.encerrados}”`); })
        .catch(e => { st.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(e.message)}</span>`; });
      return false; }});
}
// pasta do cliente vai para Encerrados quando todos os processos estão encerrados (e volta se reabrir)
const arqEstadoCli = id => { const ps = db.processos.filter(x => x.clienteId === id); return !ps.length ? '' : ps.every(x => INATIVOS.includes(x.status)) ? 'enc' : 'ativ'; };
function arqEstadoInicial(){ const m = {}; db.pessoas.filter(x => x.pasta).forEach(x => { const e = arqEstadoCli(x.id); if(e) m[x.id] = e; }); db.meta.arqEstado = m; }
let arqTimer = null, arqBusy = false;
function arqAgendar(){ clearTimeout(arqTimer); arqTimer = setTimeout(arqVerificar, 5000); }
async function arqVerificar(){
  if(arqBusy || !arqCfg().ativos || !monCfg().roboUrl || !navigator.onLine) return; if(!db.meta.arqEstado){ arqEstadoInicial(); save(); return; }
  const mudar = db.pessoas.filter(x => x.pasta).map(x => ({x, e:arqEstadoCli(x.id)})).filter(({x, e}) => e && db.meta.arqEstado[x.id] !== e);
  if(!mudar.length) return; arqBusy = true;
  for(const {x, e} of mudar.slice(0, 10)){ try{ await roboChamar(null, {arqMover:{cliente:x.pasta, nome:x.nome, destino:e}}); db.meta.arqEstado = {...db.meta.arqEstado, [x.id]:e}; save();
      toast(`📁 Pasta ${x.pasta} movida para ${e === 'enc' ? 'Encerrados' : 'Ativos'}`); }catch(err){ break; } }
  arqBusy = false;
}
setInterval(arqVerificar, 15 * 60e3);

/* ----- vínculos: compromissos relacionados e conversas ----- */
function vincHtml(){ return `<label>🔗 Compromissos relacionados</label><div id="vcRel" class="vcList"></div><button type="button" class="mini" id="vcRelAdd">+ vincular compromisso</button>
  <label style="margin-top:10px">💬 Conversas relacionadas</label><div id="vcConv" class="vcList"></div><button type="button" class="mini" id="vcConvAdd">+ vincular conversa</button><div id="vcPick"></div>`; }
function vincLigar(f, p){
  f._rel = [...(formCfg?.data?.relacionados || p.relacionados || [])]; f._conv = [...(formCfg?.data?.conversas || p.conversas || [])];
  const pinta = () => { f.querySelector('#vcRel').innerHTML = f._rel.map(id => byId('prazos', id)).filter(Boolean).map(x => `<span class="vcChip">🔗 ${esc(x.titulo)} <span class="muted">(${x.data ? fmtD(x.data) : 's/ data'})</span> <button type="button" data-vrm="${x.id}">✕</button></span>`).join('') || '<span class="small muted">nenhum</span>';
    f.querySelector('#vcConv').innerHTML = f._conv.map(id => byId('conversas', id)).filter(Boolean).map(c => `<span class="vcChip">💬 ${fmtD(String(c.dataHora || '').slice(0, 10))} — ${esc((c.assunto || c.relato || '').slice(0, 50))} <button type="button" data-vcrm="${c.id}">✕</button></span>`).join('') || '<span class="small muted">nenhuma</span>'; };
  const pick = (itens, cb) => { const box = f.querySelector('#vcPick'); box.innerHTML = `<div class="vcPick"><input placeholder="procure…"><div class="vcPickL"></div></div>`; const inp = box.querySelector('input'), l = box.querySelector('.vcPickL');
    const draw = () => { const q = norm_s(inp.value); l.innerHTML = itens.filter(o => norm_s(o.t).includes(q)).slice(0, 25).map(o => `<button type="button" data-v="${o.v}">${esc(o.t)}</button>`).join('') || '<div class="small muted">nada encontrado</div>';
      l.querySelectorAll('button').forEach(b => b.onclick = () => { cb(b.dataset.v); box.innerHTML = ''; pinta(); }); };
    inp.oninput = draw; draw(); inp.focus(); };
  const ctxProc = () => f.elements.processoId.value, ctxPes = () => f.elements.pessoaId.value || byId('processos', ctxProc())?.clienteId;
  f.querySelector('#vcRelAdd').onclick = () => pick(db.prazos.filter(x => x.id !== p.id && !f._rel.includes(x.id)).sort((a, b) => (ctxProc() && b.processoId === ctxProc()) - (ctxProc() && a.processoId === ctxProc()) || (b.data || '').localeCompare(a.data || ''))
    .map(x => ({v:x.id, t:`${x.data ? fmtD(x.data) : 's/ data'} · ${x.titulo}${x.processoId ? ' · ' + (procCode(byId('processos', x.processoId)) || '') : ''}`})), v => f._rel.push(v));
  f.querySelector('#vcConvAdd').onclick = () => pick(db.conversas.filter(c => !f._conv.includes(c.id) && (!ctxPes() || c.pessoaId === ctxPes() || (ctxProc() && c.processoId === ctxProc()))).sort(byDateDesc('dataHora'))
    .map(c => ({v:c.id, t:`${fmtD(String(c.dataHora || '').slice(0, 10))} · ${pessoaNome(c.pessoaId)} · ${(c.assunto || c.relato || '').slice(0, 60)}`})), v => f._conv.push(v));
  f.querySelector('#vcRel').addEventListener('click', e => { const b = e.target.closest('[data-vrm]'); if(b){ f._rel = f._rel.filter(x => x !== b.dataset.vrm); pinta(); } });
  f.querySelector('#vcConv').addEventListener('click', e => { const b = e.target.closest('[data-vcrm]'); if(b){ f._conv = f._conv.filter(x => x !== b.dataset.vcrm); pinta(); } });
  pinta();
}
// vínculo vale para os dois lados
function vincEspelhar(p, antes = []){ const agora = new Set(p.relacionados || []);
  (p.relacionados || []).forEach(id => { const o = byId('prazos', id); if(o && !(o.relacionados || []).includes(p.id)) o.relacionados = [...(o.relacionados || []), p.id]; });
  antes.filter(id => !agora.has(id)).forEach(id => { const o = byId('prazos', id); if(o) o.relacionados = (o.relacionados || []).filter(x => x !== p.id); }); save(); }

/* ----- próximos passos (depois de “Salvar e continuar”) ----- */
// compromisso sem cliente: mensagem para mandar a quem você escolher no WhatsApp
const ppWaTxt = p => lembMsg(p, {msg:'📅 {titulo} no dia {data}{hora}{local}.'}, '');
function proximosPassos(id){
  const p = byId('prazos', id); if(!p) return; const cfg = gcalCfg(), ev = p.data ? gcalEvento(p, cfg) : null, o = p.gcalOver || {}, direto = gcalDireto(), pr = byId('processos', p.processoId), cli = byId('pessoas', p.pessoaId || pr?.clienteId);
  const lembs = (p.lembretes || []).map(l => `${LEMB_T[l.tipo].ic} ${lembData(p, l) ? fmtD(lembData(p, l)).slice(0, 5) : ''} ${l.tipo === 'tarefa' ? esc(l.titulo || '') : LEMB_T[l.tipo].t.toLowerCase()}`).join(' · ');
  const cor = CORES_GCAL.find(c => c.v === (o.cor ?? ev?.cor))?.h || '#039be5';
  openForm({title:'➡️ Próximos passos', soFechar:true, fields:[{type:'html', html:`<div class="small muted" style="margin:-4px 0 12px">✔ Compromisso salvo: <b>${esc(p.titulo)}</b>${p.data ? ' — ' + fmtD(p.data) + (p.hora ? ' às ' + p.hora : '') : ''}. Tudo abaixo é opcional; depois você volta ao compromisso.</div>
    ${p.lembrete === false && !p.gcalId ? `<div class="pp"><h4>📅🟢 Lembrete</h4><div class="small muted">“Criar lembrete” está desmarcado neste compromisso — volte ao compromisso e marque a caixa para enviar à Google Agenda e ao WhatsApp.</div></div>` : `    <div class="pp"><h4>📅 Google Agenda ${p.gcalId ? '<span class="tag ok">✔ já está na agenda</span>' : ''}</h4>${ev ? `<div class="ppG"><div><div class="evPrev" style="background:${cor}">${esc(o.titulo || ev.titulo)}<small>${fmtD(p.data)}${ev.hora ? ' · ' + ev.hora + '–' + ev.horaFim : ' · dia inteiro'}${ev.local ? ' · ' + esc(ev.local) : ''}</small></div><div class="small muted" style="margin-top:6px">Assim vai aparecer na sua agenda.</div></div>
      <div><label class="small muted">Título (só deste compromisso)<input id="ppTit" value="${esc(o.titulo || '')}" placeholder="${esc(ev.titulo)}"></label>
        <label class="small muted">Cor<select id="ppCor"><option value="">padrão do tipo</option>${CORES_GCAL.filter(c => c.v).map(c => `<option value="${c.v}" ${o.cor === c.v ? 'selected' : ''}>● ${c.t}</option>`).join('')}</select></label>
        <label class="small muted">Notificações<select id="ppLemb"><option value="">padrão do tipo</option>${[['0', 'no horário'], ['30', '30 min antes'], ['60', '1 hora antes'], ['1440', '1 dia antes'], ['10080,1440,120', '1 semana · 1 dia · 2 horas antes'], ['nenhuma', 'sem notificação']].map(([v, t]) => `<option value="${v}" ${(o.lemb || '') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div></div>
      <div style="text-align:right;margin-top:8px"><button type="button" class="btn primary" id="ppGcal">📅 ${p.gcalId ? 'Atualizar na' : 'Enviar à'} Google Agenda</button></div>` : '<div class="small muted">Sem data — não vai para a agenda.</div>'}</div>
    ${cli ? `<div class="pp"><h4>🟢 Avisar ${esc(cli.nome.split(' ')[0])} agora</h4><div class="small">${esc(lembMsg(p, {msg:'Olá, {nome}! Informamos: {titulo} no dia {data}{hora}{local}. Qualquer dúvida, estou à disposição.'}, cli.nome))}</div><div style="text-align:right;margin-top:8px"><button type="button" class="btn ok" id="ppWa">🟢 Abrir mensagem no WhatsApp</button></div></div>` : `<div class="pp"><h4>🟢 Enviar pelo WhatsApp</h4><div class="small">${esc(ppWaTxt(p))}</div><div style="text-align:right;margin-top:8px"><a class="btn ok" id="ppWaLivre" href="https://wa.me/?text=${encodeURIComponent(ppWaTxt(p))}" target="_blank" rel="noopener">🟢 Abrir no WhatsApp (escolher o contato)</a></div></div>`}`}
    <div class="pp"><h4>⏰ Lembretes e preparação <span class="small muted" style="font-weight:400">${(p.lembretes || []).length ? (p.lembretes || []).length + ' programado(s)' : 'nenhum'}</span></h4><div class="small">${lembs || 'Inclua avisos (WhatsApp, e-mail) e tarefas de preparação no compromisso.'}</div><div style="text-align:right;margin-top:8px"><button type="button" class="btn" id="ppLembAj">ajustar</button></div></div>`}],
    after:f => { const sb = f.querySelector('.mfoot'); sb.innerHTML = `<button type="button" class="btn" data-act="wfManual" data-col="prazos" data-id="${p.id}" title="Executar um workflow neste compromisso">⚙️ Executar workflow</button><span class="sp"></span><button type="button" class="btn primary" id="ppVolta">← Voltar ao compromisso</button>`;
      f.querySelector('#ppVolta').onclick = () => formPrazo(byId('prazos', id));
      const g = f.querySelector('#ppGcal'); if(g) g.onclick = () => { const q = byId('prazos', id); q.gcalOver = {titulo:f.querySelector('#ppTit').value.trim(), cor:f.querySelector('#ppCor').value, lemb:f.querySelector('#ppLemb').value}; save();
        if(direto){ gcalEnviarAgora(id); g.textContent = '✔ Enviado'; g.disabled = true; } else { window.open(googleUrl(q), '_blank', 'noopener'); upsert('prazos', {id, agendaEnviada:pzKey(q)}); g.textContent = '✔ Aberto no Google'; } };
      const w = f.querySelector('#ppWa'); if(w) w.onclick = () => formWhats(id);
      f.querySelector('#ppLembAj').onclick = () => { formPrazo(byId('prazos', id)); setTimeout(() => { const d = mForm.querySelector('#gLemb'); if(d){ d.open = true; d.scrollIntoView({block:'start'}); } }, 80); }; }});
}

Object.assign(A, {
  lembEnviar: d => { const p = byId('prazos', d.p), l = (p?.lembretes || []).find(x => x.id === d.l), dest = l && lembDestinos(p, l).find(x => x.id === d.d); if(!dest) return;
    if(!dest.tel){ toast('⚠️ ' + dest.nome + ' está sem celular no cadastro'); return; }
    const u = waLink(dest.tel, lembMsg(p, l, dest.nome)); if(u) window.open(u, '_blank', 'noopener'); lembMarcar(d.p, d.l, d.d); render(); },
  lembDispensar: d => { lembMarcar(d.p, d.l, d.d, true); render(); toast('Lembrete dispensado — ↩ desfazer volta para a lista'); },
  lembDesfazer: d => { lembDesfazer(d.p, d.l, d.d); render(); toast('Lembrete voltou para a lista de envios'); },
  lembEditar: d => lembEditar(d.p, d.l),
  arqCfg: () => formArqCfg(),
});
