/* ===== Google Agenda: o robô (Apps Script, na sua conta Google) grava os compromissos direto na sua agenda =====
   Cada compromisso enviado guarda gcalId / gcalCal / gcalHash; se ele muda, o evento é atualizado; se é excluído, o evento é apagado. */
const CORES_GCAL = [{v:'', t:'Cor padrão da agenda', h:''}, {v:'11', t:'Tomate', h:'#d50000'}, {v:'4', t:'Flamingo', h:'#e67c73'}, {v:'6', t:'Tangerina', h:'#f4511e'}, {v:'5', t:'Banana', h:'#f6bf26'},
  {v:'2', t:'Sálvia', h:'#33b679'}, {v:'10', t:'Manjericão', h:'#0b8043'}, {v:'7', t:'Pavão', h:'#039be5'}, {v:'9', t:'Mirtilo', h:'#3f51b5'}, {v:'1', t:'Lavanda', h:'#7986cb'}, {v:'3', t:'Uva', h:'#8e24aa'}, {v:'8', t:'Grafite', h:'#616161'}];
const LEMB_HORA = [{m:0, t:'no horário do evento'}, {m:10, t:'10 min antes'}, {m:30, t:'30 min antes'}, {m:60, t:'1 hora antes'}, {m:120, t:'2 horas antes'}, {m:1440, t:'1 dia antes'}, {m:2880, t:'2 dias antes'}, {m:10080, t:'1 semana antes'}];
const LEMB_DIA = [{m:360, t:'na véspera às 18h'}, {m:900, t:'na véspera às 9h'}, {m:2340, t:'2 dias antes às 9h'}, {m:9540, t:'1 semana antes às 9h'}];
const GCAL_PADRAO = {modo:'direto', agenda:'', titulo:'{titulo}', duracao:60, lembPadrao:false, lembH:{60:1, 1440:1}, lembD:{900:1},
  cores:{'Audiência':'11', 'Prazo processual':'6', 'Perícia':'3', 'Reunião':'7', 'Diligência':'5', 'Tarefa':'', 'Retorno ao cliente':'2', lead:'10'},
  auto:{'Prazo processual':1, 'Audiência':1, 'Perícia':1, 'Reunião':1, 'Diligência':1, 'Tarefa':0, 'Retorno ao cliente':0, lead:1},
  desc:{partes:1, obs:1, fatal:1, whats:1}, concluido:'manter'};
function gcalCfg(){ const c = db.meta.gcal || {}, P = GCAL_PADRAO;
  return {...P, ...c, lembH:{...P.lembH, ...(c.lembH || {})}, lembD:{...P.lembD, ...(c.lembD || {})}, cores:{...P.cores, ...(c.cores || {})}, auto:{...P.auto, ...(c.auto || {})}, desc:{...P.desc, ...(c.desc || {})}, lembTipo:{...(c.lembTipo || {})}}; }
const gcalRoboOk = () => { const m = monCfg(); return !!(m.roboUrl && m.roboToken); };
const gcalDireto = () => { const c = gcalCfg(); return c.modo === 'direto' && !!c.ativadoEm && gcalRoboOk(); };
const gcalChave = p => p.leadId ? 'lead' : (p.tipo || 'Tarefa');
const gcalEst = () => { try{ return JSON.parse(localStorage.getItem('gcal_estado') || '{}'); }catch(e){ return {}; } };
const setGcalEst = o => { try{ localStorage.setItem('gcal_estado', JSON.stringify({...gcalEst(), ...o})); }catch(e){} };

// título conforme o modelo — {titulo} {tipo} {cliente} {processo} {numero}; tira separadores que sobram quando um campo está vazio
function gcalTitulo(p, cfg, fixo){
  const pr = byId('processos', p.processoId), pe = byId('pessoas', p.pessoaId || pr?.clienteId) || (p.leadId ? byId('leads', p.leadId) : null);
  const v = fixo || {titulo:p.titulo || '', tipo:p.leadId ? 'Lead' : (p.tipo || ''), cliente:pe?.nome || '', processo:pr ? (pr.titulo || '') : '', numero:pr?.numero || ''};
  const t = String(cfg.titulo || '{titulo}').replace(/\{(\w+)\}/g, (m, k) => k in v ? v[k] : m)
    .replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s*([-–—·|:])\s*(?=[-–—·|:]|$)/g, '').replace(/^\s*[-–—·|:]\s*/, '').replace(/\s{2,}/g, ' ').trim();
  return t || p.titulo || 'Compromisso';
}
function gcalDesc(p, cfg){
  const pr = byId('processos', p.processoId), pe = byId('pessoas', p.pessoaId || pr?.clienteId), ld = p.leadId && byId('leads', p.leadId), d = cfg.desc, L = [];
  if(d.partes){ if(pe) L.push('Cliente: ' + pe.nome); if(ld) L.push('Lead: ' + ld.nome + (ld.telefone ? ' · ' + ld.telefone : '')); if(pr) L.push('Processo: ' + procLabel(pr)); if(p.subtipo) L.push('Subtipo: ' + p.subtipo); }
  if(d.fatal && p.dataFatal) L.push('⚠️ Prazo fatal: ' + fmtD(p.dataFatal));
  if(d.obs && p.obs) L.push('', p.obs);
  if(d.whats && ld?.telefone){ const w = waLink(ld.telefone, p.obs || ''); if(w) L.push('', '🟢 Enviar mensagem pelo WhatsApp: ' + w); }
  if(Array.isArray(p.checklist) && p.checklist.length) L.push('', ...p.checklist.map(c => (c.ok ? '☑ ' : '☐ ') + c.t));
  return L.join('\n').trim();
}
function gcalEvento(p, cfg = gcalCfg()){
  const timed = !!p.hora && !p.diaInteiro;
  const horaFim = timed ? (p.horaFim || (() => { const [a, b] = p.hora.split(':').map(Number), m = Math.min(a * 60 + b + (Number(cfg.duracao) || 60), 23 * 60 + 59); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); })()) : '';
  // notificações: as do tipo (se personalizadas) ou as gerais; null = padrão da Google Agenda; [] = nenhuma
  const lt = cfg.lembTipo[gcalChave(p)] || {}, modo = lt.modo || 'geral';
  const lemb = modo === 'padrao' || (modo === 'geral' && cfg.lembPadrao) ? null : modo === 'nenhum' ? []
    : Object.entries(modo === 'proprio' ? (timed ? lt.h : lt.d) || {} : (timed ? cfg.lembH : cfg.lembD)).filter(([, v]) => v).map(([k]) => Number(k)).sort((a, b) => a - b).slice(0, 5);
  return {id:p.id, titulo:gcalTitulo(p, cfg), data:p.data, hora:timed ? p.hora : '', dataFim:p.dataFim || '', horaFim, local:p.local || '', desc:gcalDesc(p, cfg),
    cor:cfg.cores[gcalChave(p)] || '', lembretes:lemb, agenda:String(cfg.agenda || '').trim()};
}
// o que deve estar na Google Agenda
function gcalQuer(p, cfg, t){
  if(!p.data || p.gcalNao) return false;
  if(p.concluido && (cfg.concluido === 'apagar' || !p.gcalId)) return false;
  if(p.gcalId || p.gcalPedido) return true;
  // automático: só o que foi criado depois de ligar o envio direto (os antigos, se você confirmar ao ligar)
  return !p.concluido && p.data >= t && !p.agendaEnviada && !!cfg.auto[gcalChave(p)] && (p.criadoEm || '') >= cfg.ativadoEm;
}
let gcalTimer = null, gcalRodando = false;
function gcalAgendar(ms = 4000){ if(!gcalDireto()) return; clearTimeout(gcalTimer); gcalTimer = setTimeout(() => gcalSincronizar(), ms); }
async function gcalSincronizar(forcar){
  if(gcalRodando || !gcalDireto() || !navigator.onLine) return;
  const E = gcalEst(); if(!forcar && E.erro && Date.now() - (E.tent || 0) < 10 * 60e3) return; // espera 10 min depois de um erro
  const cfg = gcalCfg(), t = today(), mapa = {...(db.meta.gcalMapa || {})}, ops = [];
  db.prazos.forEach(p => { if(p.gcalId) mapa[p.id] = [p.gcalId, p.gcalCal || '', p.data]; });
  const vivos = new Map(db.prazos.map(p => [p.id, p]));
  Object.entries(mapa).forEach(([id, [gid, cal, dt]]) => { const p = vivos.get(id); if(!p || (p.gcalId && !gcalQuer(p, cfg, t))) ops.push({acao:'apagar', id, gcalId:gid, gcalCal:cal, dataAnt:dt}); });
  db.prazos.forEach(p => { if(ops.length >= 20 || !gcalQuer(p, cfg, t)) return; const ev = gcalEvento(p, cfg), h = JSON.stringify(ev);
    if(p.gcalId && p.gcalHash === h) return; ops.push({acao:'salvar', ...ev, gcalId:p.gcalId || '', gcalCal:p.gcalCal || '', dataAnt:p.gcalData || '', _h:h}); });
  if(!ops.length){ if(JSON.stringify(mapa) !== JSON.stringify(db.meta.gcalMapa || {})){ db.meta.gcalMapa = mapa; save(); } return; }
  gcalRodando = true; setGcalEst({tent:Date.now()});
  try{
    const r = await roboChamar(null, {gcal:{ops:ops.slice(0, 20).map(({_h, ...o}) => o)}});
    if(!Array.isArray(r.gcal)) throw new Error('o robô ainda não sabe gravar na Google Agenda — cole a versão nova do robô e rode "autorizarAgenda"');
    const porId = Object.fromEntries(r.gcal.map(x => [x.id, x])); let n = 0, falhas = [];
    ops.forEach(op => { const x = porId[op.id]; if(!x) return;
      if(!x.ok){ falhas.push(x.erro); return; }
      if(op.acao === 'apagar'){ delete mapa[op.id]; const p = byId('prazos', op.id); if(p) Object.assign(p, {gcalId:'', gcalCal:'', gcalHash:'', gcalData:''}); n++; return; }
      const p = byId('prazos', op.id); if(!p) return;
      Object.assign(p, {gcalId:x.gcalId, gcalCal:x.gcalCal || '', gcalHash:op._h, gcalData:op.data, gcalPedido:false, agendaEnviada:pzKey(p)}); mapa[op.id] = [x.gcalId, x.gcalCal || '', op.data]; n++; });
    db.meta.gcalMapa = mapa; save();
    setGcalEst({ult:Date.now(), erro:falhas.length ? 'Google Agenda: ' + falhas[0] : '', n:(E.n || 0) + n});
    if(falhas.length) toast('⚠️ Google Agenda: ' + falhas[0]);
    if(ops.length >= 20 && !falhas.length) gcalAgendar(1500);
  }catch(e){ const msg = /fetch|network|load/i.test(e.message) ? 'sem conexão com o robô' : e.message; setGcalEst({erro:msg}); }
  finally{ gcalRodando = false; if(location.hash.startsWith('#/config')) renderSeguro(); }
}
// pedido manual ("salvar na Google Agenda") de um compromisso que não é enviado automaticamente
function gcalEnviarAgora(id){ upsert('prazos', {id, gcalPedido:true, gcalNao:false}); setGcalEst({erro:''}); gcalSincronizar(true).then(() => { const p = byId('prazos', id); const e = gcalEst();
  toast(p?.gcalId ? '📅 Salvo na sua Google Agenda' : '⚠️ Não foi possível salvar na Google Agenda' + (e.erro ? ': ' + e.erro : '')); }); }
function gcalRemover(id){ upsert('prazos', {id, gcalNao:true, gcalPedido:false}); gcalSincronizar(true).then(() => toast('Removido da Google Agenda')); }

/* ----- tela de personalização (Configurações) ----- */
function gcalResumo(){
  const c = gcalCfg(), E = gcalEst(), r = gcalRoboOk();
  const est = c.modo === 'direto' && !c.ativadoEm ? '<b>ainda não ativado</b> — clique em Configurar e salve para ligar o envio direto' : c.modo !== 'direto' ? 'abre a tela do Google para você confirmar cada compromisso'
    : !r ? '<b style="color:var(--bad)">⚠️ o robô não está configurado</b> — enquanto isso, abre a tela do Google'
    : E.erro ? `<b style="color:var(--bad)">⚠️ ${esc(E.erro)}</b>` : `grava direto na agenda <b>${esc(c.agenda || 'principal')}</b>${E.ult ? ' · última gravação ' + new Date(E.ult).toLocaleString('pt-BR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : ''}`;
  const tipos = Object.entries(c.auto).filter(([, v]) => v).map(([k]) => k === 'lead' ? 'lembretes de leads' : k);
  return `${est}<br>${c.modo === 'direto' ? `Envia sozinho: ${tipos.length ? esc(tipos.join(', ')) : 'nenhum tipo (só quando você pedir)'}` : ''}`;
}
// formatos prontos de título e exemplos fictícios para mostrar como fica
const GC_FORMATOS = [{v:'{titulo}', t:'Só o título do compromisso'}, {v:'{titulo} – {cliente}', t:'Título + cliente'}, {v:'{tipo}: {titulo}', t:'Tipo + título'},
  {v:'{tipo}: {titulo} – {cliente}', t:'Tipo + título + cliente'}, {v:'{cliente} – {titulo}', t:'Cliente + título'}, {v:'{titulo} – {cliente} ({numero})', t:'Título + cliente + nº do processo'}];
const GC_CAMPOS = [{k:'titulo', t:'Título'}, {k:'tipo', t:'Tipo'}, {k:'cliente', t:'Cliente'}, {k:'processo', t:'Nome do processo'}, {k:'numero', t:'Nº do processo'}];
const GC_EXEMPLOS = [{titulo:'Audiência de instrução', tipo:'Audiência', cliente:'João Silva', processo:'Reclamação trabalhista', numero:'0010123-45.2026.5.15.0001'},
  {titulo:'Contestação', tipo:'Prazo processual', cliente:'Maria Souza', processo:'Ação de cobrança', numero:'1001234-56.2026.8.26.0100'},
  {titulo:'📞 Contato com o lead: Carlos Lima', tipo:'Lead', cliente:'', processo:'', numero:''}];
function formGoogleAgenda(){
  const c = gcalCfg(), tipos = [...OPT.tipoPrazo, 'lead'], nomeT = k => k === 'lead' ? '🎯 Lembrete de contato com lead' : k;
  const corSel = k => `<select data-cor="${esc(k)}" style="width:auto">${CORES_GCAL.map(o => `<option value="${o.v}" ${String(c.cores[k] || '') === o.v ? 'selected' : ''}>${o.h ? '● ' : ''}${o.t}</option>`).join('')}</select>`;
  const chk = (attr, k, on, txt) => `<label class="chk"><input type="checkbox" ${attr}="${esc(String(k))}" ${on ? 'checked' : ''}> ${txt}</label>`;
  openForm({title:'📅 Google Agenda', fields:[{type:'html', html:`
    <div class="sect" style="margin-top:0">Como enviar</div>
    <label class="chk"><input type="radio" name="gcModo" value="direto" ${c.modo === 'direto' ? 'checked' : ''}> <span><b>Direto na minha Google Agenda</b> <span class="muted">(pelo robô — sem abrir nada; se você mudar a data, o evento muda junto; se excluir, ele é apagado)</span></span></label>
    <label class="chk"><input type="radio" name="gcModo" value="link" ${c.modo !== 'direto' ? 'checked' : ''}> <span>Abrir a tela do Google para eu conferir e salvar cada compromisso</span></label>
    ${gcalRoboOk() ? '' : `<div class="small" style="color:var(--bad);margin:4px 0">⚠️ O envio direto usa o robô, que ainda não está configurado neste aparelho (Publicações → ⚙️ Configurar).</div>`}
    <div class="row" style="gap:8px;align-items:end;margin-top:8px;flex-wrap:wrap"><label style="flex:1;min-width:200px">Agenda (deixe em branco para a principal)<input id="gcAgenda" value="${esc(c.agenda)}" placeholder="ex.: Escritório — é criada se não existir"></label>
      <button type="button" class="btn" id="gcTestar">Testar conexão</button></div>
    <div class="small muted" id="gcTesteRes"></div>

    <div class="sect">Enviar sozinho (sem precisar clicar) — compromissos de hoje em diante</div>
    <div class="pgrid">${tipos.map(k => chk('data-auto', k, c.auto[k], esc(nomeT(k)))).join('')}</div>
    <div class="small muted">Os demais vão para a Google Agenda quando você clicar em <b>📅 Salvar na Google Agenda</b> no compromisso.</div>

    <div class="sect">Título do evento (o nome que aparece na Google Agenda)</div>
    <div class="small muted" style="margin-bottom:6px">Escolha o que deve aparecer no nome de cada compromisso. Os exemplos mostram como fica:</div>
    <div class="gcFmt">${GC_FORMATOS.map(o => `<label class="gcOpt"><input type="radio" name="gcFmt" value="${esc(o.v)}" ${c.titulo === o.v ? 'checked' : ''}> <span><b>${o.t}</b><span class="gcExs" data-fmt="${esc(o.v)}"></span></span></label>`).join('')}
      <label class="gcOpt"><input type="radio" name="gcFmt" value="outro" ${GC_FORMATOS.some(o => o.v === c.titulo) ? '' : 'checked'}> <span><b>Montar do meu jeito</b></span></label></div>
    <div id="gcCustom" style="margin-top:6px">
      <div class="small muted" style="margin-bottom:4px">Clique nos botões para incluir cada informação; entre elas você pode digitar o que quiser (ex.: “ – ”, “: ”, um emoji).</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">${GC_CAMPOS.map(x => `<button type="button" class="mini" data-gcins="${x.k}">+ ${x.t}</button>`).join('')}</div>
      <input id="gcTitulo" value="${esc(c.titulo)}">
      <div class="small muted" style="margin-top:4px">Cada <code>{…}</code> é trocado pela informação do compromisso. Se o compromisso não tiver aquela informação (ex.: sem cliente), ela é simplesmente omitida.</div>
      <div class="gcExs" id="gcExCustom"></div></div>

    <div class="sect">Cor de cada tipo</div>
    <div class="gcCores">${tipos.map(k => `<label><span>${esc(nomeT(k))}</span>${corSel(k)}<i class="gcBola" data-bola="${esc(k)}"></i></label>`).join('')}</div>

    <div class="sect">Notificações gerais (valem para todos os tipos, salvo os personalizados abaixo)</div>
    <label class="chk"><input type="checkbox" id="gcLembPadrao" ${c.lembPadrao ? 'checked' : ''}> Usar as notificações padrão da minha Google Agenda</label>
    <div id="gcLembBox"><div class="small muted" style="margin:6px 0 2px">Compromissos com horário:</div><div class="pgrid">${LEMB_HORA.map(l => chk('data-lh', l.m, c.lembH[l.m], l.t)).join('')}</div>
      <div class="small muted" style="margin:6px 0 2px">Dia inteiro / sem horário:</div><div class="pgrid">${LEMB_DIA.map(l => chk('data-ld', l.m, c.lembD[l.m], l.t)).join('')}</div><div id="gcLembAviso" class="small" style="color:var(--bad)"></div></div>

    <div class="sect">Notificações por tipo de compromisso</div>
    <div class="small muted" style="margin-bottom:6px">Ex.: audiência avisar 1 semana e 1 dia antes; reunião só 30 min antes. A Google Agenda aceita no máximo <b>5 notificações</b> por evento.</div>
    <div class="gcLt">${tipos.map(k => { const lt = c.lembTipo[k] || {}, m = lt.modo || 'geral', h = lt.h || c.lembH, d = lt.d || c.lembD;
      return `<div class="gcLtRow" data-lt="${esc(k)}"><div class="gcLtHead"><span>${esc(nomeT(k))}</span><select class="gcLtModo" style="width:auto">${[['geral', 'Iguais às gerais'], ['proprio', 'Personalizar'], ['padrao', 'Padrão da Google Agenda'], ['nenhum', 'Sem notificação']].map(([v, t]) => `<option value="${v}" ${m === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        <div class="gcLtBox"><div class="small muted" style="margin:4px 0 2px">Com horário:</div><div class="pgrid">${LEMB_HORA.map(l => chk('data-lth', l.m, h[l.m], l.t)).join('')}</div>
          <div class="small muted" style="margin:6px 0 2px">Dia inteiro / sem horário:</div><div class="pgrid">${LEMB_DIA.map(l => chk('data-ltd', l.m, d[l.m], l.t)).join('')}</div><div class="gcLtAviso small" style="color:var(--bad)"></div></div></div>`; }).join('')}</div>

    <div class="sect">Detalhes</div>
    <label>Duração quando não há hora de término <select id="gcDur" style="width:auto;margin-left:6px">${[30, 60, 90, 120, 180].map(m => `<option value="${m}" ${+c.duracao === m ? 'selected' : ''}>${m < 60 ? m + ' min' : m / 60 + ' h'}</option>`).join('')}</select></label>
    <div class="small muted" style="margin:8px 0 2px">Incluir na descrição do evento:</div>
    <div class="pgrid">${chk('data-desc', 'partes', c.desc.partes, 'cliente / lead e processo')}${chk('data-desc', 'fatal', c.desc.fatal, 'prazo fatal')}${chk('data-desc', 'obs', c.desc.obs, 'observações')}${chk('data-desc', 'whats', c.desc.whats, 'link do WhatsApp (leads)')}</div>
    <label style="margin-top:8px">Quando eu concluir um compromisso <select id="gcConc" style="width:auto;margin-left:6px"><option value="manter" ${c.concluido !== 'apagar' ? 'selected' : ''}>manter na Google Agenda</option><option value="apagar" ${c.concluido === 'apagar' ? 'selected' : ''}>apagar da Google Agenda</option></select></label>`}],
    after:f => {
      const ler = () => ({modo:f.querySelector('[name=gcModo]:checked').value, agenda:f.querySelector('#gcAgenda').value.trim(), titulo:(f.querySelector('[name=gcFmt]:checked')?.value !== 'outro' ? f.querySelector('[name=gcFmt]:checked')?.value : f.querySelector('#gcTitulo').value.trim()) || '{titulo}',
        duracao:+f.querySelector('#gcDur').value, lembPadrao:f.querySelector('#gcLembPadrao').checked, concluido:f.querySelector('#gcConc').value,
        auto:Object.fromEntries([...f.querySelectorAll('[data-auto]')].map(x => [x.dataset.auto, x.checked ? 1 : 0])),
        cores:Object.fromEntries([...f.querySelectorAll('[data-cor]')].map(x => [x.dataset.cor, x.value])),
        lembH:Object.fromEntries([...f.querySelectorAll('[data-lh]')].map(x => [x.dataset.lh, x.checked ? 1 : 0])),
        lembD:Object.fromEntries([...f.querySelectorAll('[data-ld]')].map(x => [x.dataset.ld, x.checked ? 1 : 0])),
        desc:Object.fromEntries([...f.querySelectorAll('[data-desc]')].map(x => [x.dataset.desc, x.checked ? 1 : 0])),
        lembTipo:Object.fromEntries([...f.querySelectorAll('.gcLtRow')].map(r => { const modo = r.querySelector('.gcLtModo').value; return [r.dataset.lt, modo !== 'proprio' ? {modo} : {modo,
          h:Object.fromEntries([...r.querySelectorAll('[data-lth]')].map(x => [x.dataset.lth, x.checked ? 1 : 0])), d:Object.fromEntries([...r.querySelectorAll('[data-ltd]')].map(x => [x.dataset.ltd, x.checked ? 1 : 0]))}]; }))});
      const exs = fmt => GC_EXEMPLOS.map(e => `<span>📅 ${esc(gcalTitulo({}, {titulo:fmt}, e))}</span>`).join('');
      f.querySelectorAll('.gcExs[data-fmt]').forEach(x => x.innerHTML = exs(x.dataset.fmt));
      const tit = f.querySelector('#gcTitulo');
      f.querySelectorAll('[data-gcins]').forEach(bt => bt.onclick = () => { const k = '{' + bt.dataset.gcins + '}', i = tit.selectionStart ?? tit.value.length, j = tit.selectionEnd ?? i;
        tit.value = tit.value.slice(0, i) + k + tit.value.slice(j); tit.focus(); tit.setSelectionRange(i + k.length, i + k.length); atualiza(); });
      f.querySelectorAll('[name=gcFmt]').forEach(r => r.addEventListener('change', () => { if(r.checked && r.value !== 'outro') tit.value = r.value; }));
      const atualiza = () => { const v = ler(), outro = f.querySelector('[name=gcFmt]:checked')?.value === 'outro';
        f.querySelector('#gcCustom').style.display = outro ? '' : 'none'; f.querySelector('#gcExCustom').innerHTML = exs(tit.value.trim() || '{titulo}');
        f.querySelectorAll('[data-bola]').forEach(b => { const h = CORES_GCAL.find(o => o.v === v.cores[b.dataset.bola])?.h; b.style.background = h || 'transparent'; b.style.borderColor = h || 'var(--line)'; });
        f.querySelector('#gcLembBox').style.opacity = v.lembPadrao ? .45 : 1;
        const conta = sel => [...f.querySelectorAll(sel)].filter(x => x.checked).length, av = n => n > 5 ? `⚠️ ${n} marcadas — a Google Agenda usa só as 5 primeiras (as mais próximas do compromisso).` : '';
        f.querySelectorAll('.gcLtRow').forEach(r => { const on = r.querySelector('.gcLtModo').value === 'proprio'; r.querySelector('.gcLtBox').style.display = on ? '' : 'none';
          r.querySelector('.gcLtAviso').textContent = on ? av(Math.max(r.querySelectorAll('[data-lth]:checked').length, r.querySelectorAll('[data-ltd]:checked').length)) : ''; });
        f.querySelector('#gcLembAviso').textContent = v.lembPadrao ? '' : av(Math.max(conta('[data-lh]'), conta('[data-ld]'))); };
      f.addEventListener('input', atualiza); f.addEventListener('change', atualiza); atualiza();
      f.querySelector('#gcTestar').onclick = async () => { const out = f.querySelector('#gcTesteRes'); if(!gcalRoboOk()){ out.innerHTML = '<span style="color:var(--bad)">Configure o robô primeiro (Publicações → ⚙️ Configurar).</span>'; return; }
        out.textContent = 'Testando…';
        try{ const r = await roboChamar(null, {gcal:{testar:true, agenda:f.querySelector('#gcAgenda').value.trim()}});
          out.innerHTML = r.gcal?.erro ? `<span style="color:var(--bad)">⚠️ O robô ainda não tem permissão na Google Agenda: no Apps Script, rode “autorizarAgenda” e atualize a implantação (Nova versão). <span class="muted">(${esc(r.gcal.erro)})</span></span>` : r.gcal?.agenda ? `<span style="color:var(--ok)">✔ Conectado — os compromissos vão para a agenda “${esc(r.gcal.agenda)}”.</span>` : '<span style="color:var(--bad)">⚠️ O robô está desatualizado: cole a versão nova, rode “autorizarAgenda” e atualize a implantação (Nova versão).</span>'; }
        catch(e){ out.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(/autoriza|permiss|Calendar/i.test(e.message) ? 'O robô ainda não tem permissão na Google Agenda: no Apps Script, rode “autorizarAgenda” e atualize a implantação.' : e.message)}</span>`; } };
      mForm._gcLer = ler;
    },
    onSave:() => { const v = mForm._gcLer(); v.ativadoEm = v.modo === 'direto' ? (c.ativadoEm || new Date().toISOString()) : '';
      db.meta.gcal = v; const t = today();
      const antigos = v.modo === 'direto' && gcalRoboOk() ? db.prazos.filter(p => !p.concluido && p.data >= t && !p.gcalId && !p.gcalPedido && !p.gcalNao && !p.agendaEnviada && v.auto[gcalChave(p)] && (p.criadoEm || '') < v.ativadoEm) : [];
      if(antigos.length && confirm(`Há ${antigos.length} compromisso(s) futuro(s) já cadastrado(s) desses tipos que ainda não estão na Google Agenda.\n\nEnviar todos agora?`)) antigos.forEach(p => { p.gcalPedido = true; });
      save(); setGcalEst({erro:''}); toast('Google Agenda configurada'); gcalAgendar(500); }});
}
