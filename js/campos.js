/* ===== Processos: tags coloridas, cores das áreas, marcos do processo — e campos personalizados (processo, cliente, compromisso, lead) ===== */

/* ----- tribunal pelo número CNJ ----- */
function tribunalDoNumero(num){ const d = digits(num); if(d.length !== 20) return ''; const j = d[13], tr = d.slice(14, 16);
  if(j === '5') return tr === '00' ? 'TST' : 'TRT-' + +tr; if(j === '4') return 'TRF-' + +tr; if(j === '3') return 'STJ'; if(j === '1') return 'STF';
  if(j === '8') return typeof UF_TJ !== 'undefined' && UF_TJ[tr] ? 'TJ' + UF_TJ[tr] : ''; return ''; }
// sugestões de uma lista = opções salvas + valores já usados nos processos
const sugestoes = (lista, campo) => [...new Set([...OPT[lista], ...db.processos.map(p => p[campo]).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pt-BR'));

/* ----- tags e cores ----- */
const TAGS_PADRAO = [{id:'t1', nome:'Particular', cor:'#2563eb'}, {id:'t2', nome:'Defensoria / Convênio', cor:'#7c3aed'}, {id:'t3', nome:'Êxito', cor:'#16a34a'},
  {id:'t4', nome:'Justiça gratuita', cor:'#0891b2'}, {id:'t5', nome:'Prioridade (idoso / doença grave)', cor:'#d97706'}, {id:'t6', nome:'Urgente', cor:'#dc2626'}];
const tagsProc = () => Array.isArray(db.meta.tagsProc) ? db.meta.tagsProc : TAGS_PADRAO;
// tags dos clientes e partes: lista própria
const TAGS_PES_PADRAO = [{id:'p1', nome:'Prefere contato à tarde', cor:'#2563eb'}, {id:'p2', nome:'Inadimplente', cor:'#dc2626'}, {id:'p3', nome:'VIP', cor:'#d97706'},
  {id:'p4', nome:'Defensoria / Convênio', cor:'#7c3aed'}, {id:'p5', nome:'Indica clientes', cor:'#16a34a'}];
const tagsPes = () => Array.isArray(db.meta.tagsPes) ? db.meta.tagsPes : TAGS_PES_PADRAO;
const tagsLista = l => l === 'pes' ? tagsPes() : tagsProc();
const TAG_META = {proc:'tagsProc', pes:'tagsPes'};
const CORES_AREA_PADRAO = {'Cível':'#2563eb', 'Trabalhista':'#ea580c', 'Família e Sucessões':'#db2777', 'Previdenciário':'#059669', 'Consumidor':'#7c3aed', 'Tributário':'#475569', 'Criminal':'#991b1b', 'Empresarial':'#0e7490', 'Administrativo':'#4d7c0f', 'Outro':'#6b7280'};
const corArea = a => { if(!a) return '#5b7c99'; const c = (db.meta.coresArea || {})[a] || CORES_AREA_PADRAO[a]; if(c) return c; const i = OPT.area.indexOf(a); return typeof PALETA_AREA !== 'undefined' ? PALETA_AREA[(i >= 0 ? i : a.length) % PALETA_AREA.length] : '#6b7280'; };
const areaTag = a => a ? `<span class="tag areaTag" style="--c:${corArea(a)}"><i></i>${esc(a)}</span>` : '';
const tagChip = t => `<span class="tagC" style="--c:${t.cor}">${esc(t.nome)}</span>`;
const tagsDe = (p, l = 'proc') => (p.tags || []).map(id => tagsLista(l).find(t => t.id === id)).filter(Boolean);
const tagsHtml = (p, l = 'proc') => tagsDe(p, l).map(tagChip).join(' ');
function tagsEditorHtml(sel, l = 'proc'){
  return `<div class="tagsEd" id="tagsEd" data-tl="${l}">${tagsLista(l).map(t => `<button type="button" class="tagC ${sel.includes(t.id) ? 'on' : ''}" style="--c:${t.cor}" data-tg="${t.id}">${esc(t.nome)}</button>`).join('')}<button type="button" class="mini" id="tagNova">+ nova tag</button></div>`;
}
function tagsEditorLigar(f){
  const box = f.querySelector('#tagsEd'); if(!box) return; const l = box.dataset.tl || 'proc';
  box.addEventListener('click', e => { const b = e.target.closest('[data-tg]'); if(b) b.classList.toggle('on'); });
  f.querySelector('#tagNova').onclick = () => { const nome = (prompt('Nome da nova tag:') || '').trim(); if(!nome) return;
    const cores = ['#2563eb', '#7c3aed', '#16a34a', '#0891b2', '#d97706', '#dc2626', '#db2777', '#0e7490', '#4d7c0f', '#475569'];
    const t = {id:(l === 'pes' ? 'p' : 't') + uid().slice(0, 8), nome, cor:cores[tagsLista(l).length % cores.length]}; db.meta[TAG_META[l]] = [...tagsLista(l), t]; save();
    f.querySelector('#tagNova').insertAdjacentHTML('beforebegin', `<button type="button" class="tagC on" style="--c:${t.cor}" data-tg="${t.id}">${esc(t.nome)}</button>`);
    toast('Tag criada — a cor pode ser mudada em Configurações → Tags e cores'); };
}
const tagsLer = f => [...f.querySelectorAll('#tagsEd [data-tg].on')].map(b => b.dataset.tg);

/* ----- marcos do processo ----- */
const TIPOS_MARCO = [
  {v:'Distribuição / ajuizamento'},
  {v:'Citação', ref:'citação de quem? ex.: 1º réu — Empresa X'},
  {v:'Decisão interlocutória', ref:'qual decisão? ex.: saneamento, gratuidade'},
  {v:'Liminar / tutela de urgência', ref:'o que foi pedido', res:['Deferida', 'Deferida parcialmente', 'Indeferida', 'Sem pedido']},
  {v:'Sentença', ref:'observação (opcional)', res:['Procedente', 'Parcialmente procedente', 'Improcedente', 'Extinta sem resolução do mérito', 'Homologatória de acordo']},
  {v:'Acórdão', ref:'qual recurso? ex.: recurso ordinário, apelação, embargos de declaração', res:['Provido', 'Parcialmente provido', 'Não provido', 'Não conhecido']},
  {v:'Trânsito em julgado'},
  {v:'Início da liquidação / execução'},
  {v:'Arquivamento definitivo'},
  {v:'Outro', ref:'descreva'}];
const tipoMarco = v => TIPOS_MARCO.find(t => t.v === v) || {v};
function marcoRowHtml(m = {}){
  const t = tipoMarco(m.tipo || TIPOS_MARCO[0].v);
  return `<div class="marco-row"><select class="mTipo">${opts(TIPOS_MARCO.map(x => x.v), t.v)}</select><input type="date" class="mData" value="${esc(m.data || '')}">
    <select class="mRes" style="${t.res ? '' : 'display:none'}"><option value="">— resultado —</option>${opts(t.res || [], m.resultado || '')}</select>
    <input class="mRef" value="${esc(m.ref || '')}" placeholder="${esc(t.ref || 'observação (opcional)')}"><button type="button" class="mini mRm" title="Remover">✕</button><input type="hidden" class="mId" value="${esc(m.id || '')}"></div>`;
}
function marcosEditorLigar(f){
  const box = f.querySelector('#marcosBox'); if(!box) return;
  box.addEventListener('change', e => { if(!e.target.classList.contains('mTipo')) return; const row = e.target.closest('.marco-row'), t = tipoMarco(e.target.value), r = row.querySelector('.mRes');
    r.style.display = t.res ? '' : 'none'; r.innerHTML = '<option value="">— resultado —</option>' + opts(t.res || [], ''); row.querySelector('.mRef').placeholder = t.ref || 'observação (opcional)'; });
  box.addEventListener('click', e => { if(e.target.classList.contains('mRm')) e.target.closest('.marco-row').remove(); });
  f.querySelector('#marcoAdd').onclick = () => { box.insertAdjacentHTML('beforeend', marcoRowHtml({})); box.lastElementChild.querySelector('.mData').focus(); };
}
const marcosLer = f => [...f.querySelectorAll('.marco-row')].map(r => ({id:r.querySelector('.mId').value || uid(), tipo:r.querySelector('.mTipo').value, data:r.querySelector('.mData').value,
  resultado:r.querySelector('.mRes').style.display === 'none' ? '' : r.querySelector('.mRes').value, ref:r.querySelector('.mRef').value.trim()})).filter(m => m.data || m.ref || m.resultado).sort((a, b) => (a.data || '9').localeCompare(b.data || '9'));
const ultimaLiminar = p => [...(p.marcos || [])].filter(m => m.tipo === 'Liminar / tutela de urgência').sort((a, b) => (b.data || '').localeCompare(a.data || ''))[0];
function marcosVerHtml(p){
  const ms = p.marcos || []; if(!ms.length) return '';
  return `<div class="marcosV">${ms.map(m => `<div class="mV"><b>${m.data ? fmtD(m.data) : '<span class="muted">s/ data</span>'}</b><span>${esc(m.tipo)}${m.resultado ? ` — <b>${esc(m.resultado)}</b>` : ''}${m.ref ? ` <span class="muted">(${esc(m.ref)})</span>` : ''}</span></div>`).join('')}</div>`;
}

/* ----- campos personalizados ----- */
const ONDE_CAMPOS = {processo:'Processo', pessoa:'Cliente / pessoa', prazo:'Compromisso (agenda)', lead:'Lead'};
const COL_ONDE = {processo:'processos', pessoa:'pessoas', prazo:'prazos', lead:'leads'};
const TIPOS_CAMPO = [{v:'texto', t:'Texto'}, {v:'textarea', t:'Texto longo'}, {v:'numero', t:'Número'}, {v:'valor', t:'Valor (R$)'}, {v:'data', t:'Data'}, {v:'sim', t:'Sim / não'}, {v:'lista', t:'Lista de opções'}];
const camposDe = onde => (db.meta.campos || []).filter(c => (c.onde || []).includes(onde));
function campoInputHtml(c, v){
  const n = `cp_${c.id}`, val = v ?? '';
  if(c.tipo === 'textarea') return `<textarea name="${n}" rows="3">${esc(val)}</textarea>`;
  if(c.tipo === 'sim') return `<label class="chk"><input type="checkbox" name="${n}" ${val ? 'checked' : ''}> ${esc(c.titulo)}</label>`;
  if(c.tipo === 'lista') return `<select name="${n}"><option value=""></option>${opts(c.opcoes || [], val)}</select>`;
  const tp = {numero:'number', valor:'number', data:'date'}[c.tipo] || 'text';
  return `<input name="${n}" type="${tp}" ${c.tipo === 'valor' ? 'step="0.01" min="0"' : ''} value="${esc(val)}">`;
}
function camposSecaoHtml(onde, extra = {}){
  const cs = camposDe(onde);
  return `<div class="cpBox full" data-onde="${onde}"><div class="cpCampos">${cs.map(c => `<div class="fld ${c.tipo === 'textarea' ? 'full' : ''}" data-cp="${c.id}">${c.tipo === 'sim' ? '' : `<label>${esc(c.titulo)}${c.obrig ? ' *' : ''}</label>`}${campoInputHtml(c, extra[c.id])}</div>`).join('')
    || '<div class="small muted">Nenhum campo personalizado ainda.</div>'}</div>
    <div class="cpNovo" hidden><div class="cpNovoG"><label>Título do campo<input class="cpT" placeholder="ex.: Nº do contrato, Senha do INSS, Indicado por"></label>
      <label>Tipo<select class="cpTipo">${opts(TIPOS_CAMPO, 'texto')}</select></label>
      <label class="cpOpsL" hidden>Opções (separe por ponto e vírgula)<input class="cpOps" placeholder="ex.: Sim; Não; Em análise"></label></div>
      <div class="cpNovoC"><span class="small muted">Aparece em:</span>${Object.entries(ONDE_CAMPOS).map(([k, l]) => `<label class="chk"><input type="checkbox" class="cpOnde" value="${k}" ${k === onde ? 'checked disabled' : ''}> ${l}</label>`).join('')}</div>
      <div class="cpNovoC"><label class="chk"><input type="checkbox" class="cpObrig"> Obrigatório</label><label class="chk"><input type="checkbox" class="cpUnico"> Apenas valores únicos (não repetir em outro cadastro)</label></div>
      <div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="btn primary cpCriar">Criar campo</button><button type="button" class="btn cpCanc">Cancelar</button></div></div>
    <div style="margin-top:8px"><button type="button" class="mini cpAbrir">+ criar novo campo</button> <a href="#/config" class="small cpGer">gerenciar campos</a></div></div>`;
}
function camposLigar(f){
  let box = f.querySelector('.cpBox'); if(!box) return; const onde = box.dataset.onde;
  if(!box.dataset.lig){ box.outerHTML = camposSecaoHtml(onde, formCfg?.data?.extra || {}); box = f.querySelector('.cpBox'); } box.dataset.lig = '1';
  const nv = box.querySelector('.cpNovo'), tipo = box.querySelector('.cpTipo');
  box.querySelector('.cpAbrir').onclick = () => { nv.hidden = false; box.querySelector('.cpT').focus(); };
  box.querySelector('.cpCanc').onclick = () => { nv.hidden = true; };
  box.querySelector('.cpGer').onclick = e => { if(!confirm('Sair deste formulário para gerenciar os campos? O que não foi salvo aqui será perdido.')) e.preventDefault(); else closeModal(); };
  tipo.onchange = () => { box.querySelector('.cpOpsL').hidden = tipo.value !== 'lista'; };
  box.querySelector('.cpCriar').onclick = () => {
    const titulo = box.querySelector('.cpT').value.trim(); if(!titulo) return toast('Dê um título ao campo');
    const c = {id:'c' + uid().slice(0, 8), titulo, tipo:tipo.value, opcoes:tipo.value === 'lista' ? box.querySelector('.cpOps').value.split(';').map(x => x.trim()).filter(Boolean) : [],
      onde:[onde, ...[...box.querySelectorAll('.cpOnde:checked:not(:disabled)')].map(x => x.value)], obrig:box.querySelector('.cpObrig').checked, unico:box.querySelector('.cpUnico').checked};
    if(c.tipo === 'lista' && !c.opcoes.length) return toast('Informe as opções da lista');
    db.meta.campos = [...(db.meta.campos || []), c]; save();
    const atual = camposColetar(f, true); box.outerHTML = camposSecaoHtml(onde, atual); f.querySelector('.cpBox').dataset.lig = '1'; camposLigar(f);
    f.querySelector(`[data-cp="${c.id}"] [name]`)?.focus(); toast(`Campo “${titulo}” criado`);
  };
}
// lê (e confere) os campos personalizados do formulário; false = parar o salvamento
function camposColetar(f, semConferir){
  const box = f.querySelector('.cpBox'); if(!box) return undefined; const onde = box.dataset.onde, out = {...(formCfg?.data?.extra || {})};
  for(const c of camposDe(onde)){ const el = f.elements['cp_' + c.id]; if(!el) continue;
    const v = c.tipo === 'sim' ? el.checked : String(el.value || '').trim(); out[c.id] = v;
    if(semConferir) continue;
    if(c.obrig && !v){ box.closest('details')?.setAttribute('open', ''); el.focus(); toast('Preencha: ' + c.titulo); return false; }
    if(c.unico && v && c.tipo !== 'sim'){ const eu = formCfg?.data?.id, dup = (db[COL_ONDE[onde]] || []).find(x => x.id !== eu && String(x.extra?.[c.id] ?? '').trim().toLowerCase() === v.toLowerCase());
      if(dup){ box.closest('details')?.setAttribute('open', ''); el.focus(); toast(`“${c.titulo}” já usado em: ${dup.nome || dup.titulo || 'outro cadastro'}`); return false; } } }
  return out;
}
function camposVerHtml(onde, extra){
  if(!extra) return ''; const fm = (c, v) => c.tipo === 'sim' ? (v ? 'Sim' : '') : c.tipo === 'data' ? fmtD(v) : c.tipo === 'valor' ? money(v) : esc(v);
  return camposDe(onde).filter(c => extra[c.id] !== undefined && extra[c.id] !== '' && extra[c.id] !== false).map(c => info(c.titulo, fm(c, extra[c.id]), c.tipo === 'textarea')).join('');
}
// campos para incluir em qualquer formulário (seção fechada)
const camposFields = (onde, rec = {}) => [{type:'grupo', label:'🧩 Campos personalizados', fechado:!camposDe(onde).some(c => c.obrig || (rec.extra && rec.extra[c.id])), dica:camposDe(onde).length ? `(${camposDe(onde).length})` : 'crie os campos que quiser'},
  {type:'html', html:camposSecaoHtml(onde, rec.extra || {})}];

/* ----- Configurações: tags, cores das áreas e campos personalizados ----- */
function formTagsCores(){
  const linhas = (l, id) => `<div id="${id}">${tagsLista(l).map(t => `<div class="tgRow" data-id="${t.id}"><input type="color" value="${t.cor}"><input class="tgN" value="${esc(t.nome)}"><button type="button" class="mini tgDel">✕</button></div>`).join('')}</div>`;
  openForm({title:'🏷️ Tags e cores', fields:[{type:'html', html:`<div class="sect" style="margin-top:0">Tags dos processos</div>${linhas('proc', 'tgList')}<button type="button" class="mini tgAdd" data-l="tgList" data-p="t">+ nova tag</button>
    <div class="sect">Tags dos clientes e partes</div>${linhas('pes', 'tgListPes')}<button type="button" class="mini tgAdd" data-l="tgListPes" data-p="p">+ nova tag</button>
    <div class="sect">Cor de cada área</div>
    <div class="gcCores">${OPT.area.map(a => `<label><span>${esc(a)}</span><input type="color" data-area="${esc(a)}" value="${corArea(a)}"></label>`).join('')}</div>`}],
    after:f => { f.querySelectorAll('.tgAdd').forEach(b => b.onclick = () => f.querySelector('#' + b.dataset.l).insertAdjacentHTML('beforeend', `<div class="tgRow" data-id="${b.dataset.p}${uid().slice(0, 8)}"><input type="color" value="#2563eb"><input class="tgN" placeholder="Nome da tag"><button type="button" class="mini tgDel">✕</button></div>`));
      onForm(f, 'click', e => { if(!e.target.classList.contains('tgDel')) return; const r = e.target.closest('.tgRow'), col = r.parentNode.id === 'tgListPes' ? 'pessoas' : 'processos', n = db[col].filter(p => (p.tags || []).includes(r.dataset.id)).length;
        if(n && !confirm(`Esta tag está em ${n} cadastro(s). Excluir mesmo assim?`)) return; r.remove(); }); },
    onSave:() => { const ler = id => [...mForm.querySelectorAll(`#${id} .tgRow`)].map(r => ({id:r.dataset.id, nome:r.querySelector('.tgN').value.trim(), cor:r.querySelector('[type=color]').value})).filter(t => t.nome);
      const tp = ler('tgList'), tq = ler('tgListPes'), ip = new Set(tp.map(t => t.id)), iq = new Set(tq.map(t => t.id));
      db.processos.forEach(p => { if(p.tags) p.tags = p.tags.filter(id => ip.has(id)); }); db.pessoas.forEach(p => { if(p.tags) p.tags = p.tags.filter(id => iq.has(id)); });
      db.meta.tagsProc = tp; db.meta.tagsPes = tq; db.meta.coresArea = Object.fromEntries([...mForm.querySelectorAll('[data-area]')].map(i => [i.dataset.area, i.value])); save(); toast('Tags e cores salvas'); }});
}
function formCampos(){
  const cs = db.meta.campos || [];
  openForm({title:'🧩 Campos personalizados', soFechar:true, fields:[{type:'html', html:`<p class="small muted" style="margin-top:0">Crie campos novos direto no cadastro (seção “🧩 Campos personalizados”, fechada por padrão). Aqui você edita ou exclui os existentes.</p>
    ${cs.map(c => `<div class="li"><div class="grow"><b>${esc(c.titulo)}</b> <span class="tag grey">${esc(TIPOS_CAMPO.find(t => t.v === c.tipo)?.t || c.tipo)}</span>${c.obrig ? ' <span class="tag warn">obrigatório</span>' : ''}${c.unico ? ' <span class="tag">único</span>' : ''}
      <div class="sub">Aparece em: ${(c.onde || []).map(o => ONDE_CAMPOS[o]).join(', ')}${c.opcoes?.length ? ' · opções: ' + esc(c.opcoes.join('; ')) : ''}</div></div><button type="button" class="mini" data-cped="${c.id}">editar</button> <button type="button" class="mini" data-cpdel="${c.id}">✕</button></div>`).join('') || '<div class="empty">Nenhum campo ainda — crie pelo próprio cadastro do processo, cliente, compromisso ou lead.</div>'}`}],
    after:f => {
      f.querySelectorAll('[data-cpdel]').forEach(b => b.onclick = () => { const c = cs.find(x => x.id === b.dataset.cpdel); if(!confirm(`Excluir o campo “${c.titulo}”? Os valores já preenchidos deixam de aparecer.`)) return; db.meta.campos = cs.filter(x => x.id !== c.id); save(); formCampos(); });
      f.querySelectorAll('[data-cped]').forEach(b => b.onclick = () => formCampoEditar(cs.find(x => x.id === b.dataset.cped))); }});
}
function formCampoEditar(c){
  openForm({title:'Editar campo', data:{titulo:c.titulo, opcoes:(c.opcoes || []).join('; '), obrig:c.obrig, unico:c.unico, ...Object.fromEntries(Object.keys(ONDE_CAMPOS).map(k => ['o_' + k, (c.onde || []).includes(k)]))}, fields:[
    {k:'titulo', label:'Título', req:true, full:true},
    ...(c.tipo === 'lista' ? [{k:'opcoes', label:'Opções (separe por ponto e vírgula)', full:true}] : []),
    {type:'sect', label:'Aparece em'}, ...Object.entries(ONDE_CAMPOS).map(([k, l]) => ({k:'o_' + k, label:l, type:'check'})),
    {type:'sect', label:'Regras'}, {k:'obrig', label:'Obrigatório', type:'check'}, {k:'unico', label:'Apenas valores únicos', type:'check'}],
    onSave:v => { const onde = Object.keys(ONDE_CAMPOS).filter(k => v['o_' + k]); if(!onde.length){ toast('Escolha ao menos um cadastro'); return false; }
      db.meta.campos = (db.meta.campos || []).map(x => x.id === c.id ? {...x, titulo:v.titulo, obrig:v.obrig, unico:v.unico, onde, opcoes:c.tipo === 'lista' ? String(v.opcoes || '').split(';').map(s => s.trim()).filter(Boolean) : x.opcoes} : x);
      save(); toast('Campo atualizado'); setTimeout(formCampos, 0); }});
}
Object.assign(A, {tagsCores: () => formTagsCores(), camposCfg: () => formCampos()});
