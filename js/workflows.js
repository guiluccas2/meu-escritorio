/* ===== 🔀 Workflows: “quando acontecer X, faça Y” =====
   db.meta.workflows = [{id, titulo, descricao, ativo, gatilhos:[{ev, ...filtros}], passos:[{acao, titulo, qtd, unid:'dc'|'du'|'h', dir:'depois'|'antes', ref, hora, ...}]}]
   db.wflog = execuções (para não repetir e para “desfazer”): {id, wf, titulo, chave, alvo:{c,id,nome}, quando, criados:[{c,id}], alterados:[{c,id,campo,antes}], lembretes:[{p,l}]}
   Os passos ligados a um compromisso entram na seção “Lembretes e preparação” dele (marcados “⚙️ workflow”). */
const WF_EV = {
  cmp_criado:{t:'Ao criar um compromisso', c:'prazos', f:['tipo', 'subtipo']},
  cmp_alterado:{t:'Ao alterar um compromisso', c:'prazos', f:['tipo', 'subtipo']},
  cmp_situacao:{t:'Quando um compromisso ficar com a situação…', c:'prazos', f:['situacao']},
  proc_criado:{t:'Ao criar um processo', c:'processos', f:['area', 'acao']},
  proc_fase:{t:'Ao alterar a fase do processo', c:'processos', f:['de', 'para']},
  proc_status:{t:'Ao alterar o status do processo', c:'processos', f:['status']},
  serv_criado:{t:'Ao criar um serviço', c:'processos', f:['tipoServ']},
  serv_status:{t:'Ao mudar o status do serviço', c:'processos', f:['statusServ']},
  and_criado:{t:'Ao criar / receber um andamento', c:'andamentos', f:['contem']},
  pub_recebida:{t:'Ao receber uma publicação (DJEN)', c:'monitor', f:['contem']},
  lead_etapa:{t:'Quando um lead entrar na etapa…', c:'leads', f:['etapa']},
  lead_resultado:{t:'Ao marcar o resultado do lead', c:'leads', f:['resultado']},
  pessoa_criada:{t:'Ao cadastrar uma pessoa', c:'pessoas', f:['tipoPessoa']},
  cad_recebido:{t:'Ao aprovar um cadastro recebido pelo link', c:'pessoas', f:[]},
  campo_mudou:{t:'Quando um campo mudar (qualquer cadastro)', c:'*', f:['col', 'campo', 'valor']},
  manual:{t:'Manual — botão “⚙️ Executar workflow” na ficha', c:'*', f:['colM']},
};
const WF_AC = {compromisso:'Criar compromisso / tarefa', whats:'Enviar mensagem no WhatsApp', email:'Enviar e-mail', notif:'Notificação para mim', atendimento:'Criar atendimento (conversa)',
  lancamento:'Criar conta a pagar / receber', tag:'Inserir tag(s)', andamento:'Inserir andamento', campo:'Alterar um campo (fase, situação, status…)', link:'Lembrar de enviar o link de cadastro'};
const WF_COLS = {prazos:'Compromisso', processos:'Processo', pessoas:'Cliente / pessoa', leads:'Lead'};
const WF_ONDE_CP = {prazos:'prazo', processos:'processo', pessoas:'pessoa', leads:'lead'};
const WF_CAMPOS_BASE = {prazos:[['situacao', 'Situação'], ['tipo', 'Tipo'], ['subtipo', 'Subtipo'], ['local', 'Local'], ['modalidade', 'Modalidade (audiência)']], processos:[['status', 'Status'], ['fase', 'Fase'], ['situacaoProc', 'Situação'], ['area', 'Área'], ['rito', 'Rito'], ['tribunal', 'Tribunal'], ['comarca', 'Comarca'], ['vara', 'Vara']],
  pessoas:[['tipo', 'Tipo'], ['origem', 'Como chegou até nós'], ['estadoCivil', 'Estado civil'], ['cidade', 'Cidade']], leads:[['status', 'Etapa'], ['origem', 'Origem'], ['area', 'Área']]};
// campos que um workflow pode observar/alterar: os básicos + TODOS os ligados a listas do sistema (lista nova → aparece aqui sozinha) + os personalizados
const wfCamposDe = c => { const out = [...(WF_CAMPOS_BASE[c] || [])];
  LISTAS.forEach(L => (L.usos || []).forEach(([col, campo]) => { if(col === c && !out.some(x => x[0] === campo)) out.push([campo, L.nome.replace(/ \(sugestões\)$/, '')]); }));
  return [...out, ...camposDe(WF_ONDE_CP[c]).map(x => ['extra.' + x.id, x.titulo + ' (personalizado)'])]; };
const WF_COL_ONDE = {processo:'processos', cliente:'pessoas', compromisso:'prazos', lead:'leads'};
// a que lista pertence o valor de um campo: {k} (lista do sistema) · {ops} (campo personalizado do tipo lista) · null (texto livre)
function wfListaDoCampo(col, campo){
  if(!col || !campo) return null;
  if(campo.startsWith('extra.')){ const c = (db.meta.campos || []).find(x => x.id === campo.slice(6)); return c?.tipo === 'lista' ? {ops:c.opcoes || []} : null; }
  const L = LISTAS.find(l => (l.usos || []).some(([c, f]) => c === col && f === campo)); return L ? {k:L.k} : null; }
const wfOpcoesDe = (col, campo) => { const r = wfListaDoCampo(col, campo); return !r ? null : r.ops ? r.ops : r.k === 'subtipo' ? [...new Set(Object.keys({...SUBTIPOS_PADRAO, ...(db.meta.subtiposPorTipo || {})}).flatMap(subtiposDe))] : L(r.k); };
// onde os workflows guardam valores de listas (pelo nome)
const WF_LISTA_G = {tipoServ:'tipoServico', statusServ:'statusServ', tipo:'tipoPrazo', subtipo:'subtipo', situacao:'situacao', area:'area', de:'faseProc', para:'faseProc', status:'statusProc', etapa:'statusLead', tipoPessoa:'tipoPessoa'};
const WF_LISTA_P = {ctipo:'tipoPrazo', csub:'subtipo', atipo:'tipoAnd', canal:'canal'};
VINCULOS.renomear.push((k, de, para) => { let n = 0; const troca = (o, f) => { if(o[f] === de){ o[f] = para; n++; } };
  wfs().forEach(w => { (w.gatilhos || []).forEach(g => { Object.entries(WF_LISTA_G).forEach(([f, lk]) => { if(lk === k) troca(g, f); }); if(g.ev === 'campo_mudou' && wfListaDoCampo(g.col, g.campo)?.k === k) troca(g, 'valor'); });
    (w.passos || []).forEach(ps => { Object.entries(WF_LISTA_P).forEach(([f, lk]) => { if(lk === k) troca(ps, f); }); if(ps.acao === 'campo' && wfListaDoCampo(WF_COL_ONDE[ps.onde || 'processo'], ps.campo)?.k === k) troca(ps, 'valor'); }); });
  return n; });
// referências quebradas de um workflow (opção excluída/oculta, tag ou campo apagado, passo sem destinatário…)
function wfProblemas(w){
  const P = [], nomeL = k => listaDef(k)?.nome || k;
  const chkLista = (lk, v, onde, tipo) => { if(!v) return; if(lk === 'subtipo'){ const ls = tipo ? subtiposDe(tipo) : wfOpcoesDe('prazos', 'subtipo'); if(!ls.includes(v)) P.push(`${onde}: o subtipo “${v}” não existe mais${tipo ? ' em “' + tipo + '”' : ''}`); return; }
    const it = listaItens(lk).find(x => x.v === v); if(!it) P.push(`${onde}: “${v}” não existe mais em ${nomeL(lk)}`); else if(it.oculto) P.push(`${onde}: “${v}” está oculto em ${nomeL(lk)}`); };
  const chkValor = (col, campo, v, onde) => { const ops = wfOpcoesDe(col, campo); if(v && ops && !ops.some(o => norm_s(o) === norm_s(v))) P.push(`${onde}: o valor “${v}” não existe nas opções do campo`); };
  if(!(w.gatilhos || []).length) P.push('sem gatilho'); if(!(w.passos || []).length) P.push('sem passos');
  (w.gatilhos || []).forEach((g, i) => { const on = `Gatilho ${i + 1}`; if(!WF_EV[g.ev]){ P.push(`${on}: tipo de gatilho desconhecido`); return; }
    Object.entries(WF_LISTA_G).forEach(([f, lk]) => (WF_EV[g.ev].f.includes(f) || f === 'subtipo' && WF_EV[g.ev].f.includes('tipo')) && chkLista(lk, g[f], on, g.tipo));
    if(g.ev === 'campo_mudou'){ if(!g.col || !g.campo) P.push(`${on}: escolha o cadastro e o campo`); else if(!wfCamposDe(g.col).some(x => x[0] === g.campo)) P.push(`${on}: o campo observado não existe mais`); else chkValor(g.col, g.campo, g.valor, on); } });
  (w.passos || []).forEach((ps, i) => { const on = `Passo ${i + 1}`; if(!WF_AC[ps.acao]){ P.push(`${on}: ação desconhecida`); return; }
    if(ps.acao === 'compromisso'){ chkLista('tipoPrazo', ps.ctipo, on); chkLista('subtipo', ps.csub, on, ps.ctipo); }
    if(ps.acao === 'andamento') chkLista('tipoAnd', ps.atipo, on);
    if(ps.acao === 'lancamento' && ps.conta){ const c = pcById(ps.conta); if(!c) P.push(`${on}: a conta do plano foi excluída`); else if(c.ativo === false) P.push(`${on}: a conta “${c.nome}” está desativada`); else if(c.nat !== (ps.natureza || 'entrada')) P.push(`${on}: a conta “${c.nome}” não é de ${ps.natureza === 'saida' ? 'saída' : 'entrada'}`); }
    if(ps.acao === 'atendimento' && ps.canal) chkLista('canal', ps.canal, on);
    if(['whats', 'email'].includes(ps.acao) && !(ps.para || []).length && !(ps.outro?.tel || ps.outro?.email)) P.push(`${on}: sem destinatário`);
    if(ps.acao === 'tag'){ const lst = ps.onde === 'cliente' ? 'pes' : ps.onde === 'compromisso' ? 'cmp' : 'proc', ids = tagsLista(lst).map(t => t.id), fora = (ps.tags || []).filter(t => !ids.includes(t));
      if(fora.length) P.push(`${on}: ${fora.length} tag(s) foram excluídas`); if(!(ps.tags || []).filter(t => ids.includes(t)).length) P.push(`${on}: nenhuma tag escolhida`); }
    if(ps.acao === 'campo'){ const col = WF_COL_ONDE[ps.onde || 'processo']; if(!ps.campo) P.push(`${on}: escolha o campo`); else if(!wfCamposDe(col).some(x => x[0] === ps.campo)) P.push(`${on}: o campo não existe mais`); else chkValor(col, ps.campo, ps.valor, on); } });
  return P;
}
VINCULOS.verificar.push(() => wfs().filter(w => w.ativo !== false).map(w => ({w, pr:wfProblemas(w)})).filter(x => x.pr.length).map(({w, pr}) => ({area:'🔀 Workflows', titulo:`“${w.titulo}” precisa de atenção`, txt:pr.join(' · '), href:'#/workflows', grave:true})));
const wfGet = (o, k) => k.startsWith('extra.') ? o?.extra?.[k.slice(6)] : o?.[k];
const wfSet = (o, k, v) => { if(k.startsWith('extra.')) o.extra = {...(o.extra || {}), [k.slice(6)]:v}; else o[k] = v; };
const wfs = () => Array.isArray(db.meta.workflows) ? db.meta.workflows : [];
const WF = {rodando:false, fila:[]};

/* ----- 1ª vez: os modelos de lembretes por tipo viram workflows ----- */
function wfMigrar(){
  if(db.meta.wfV1) return; const modelos = {...LEMB_MODELOS_PADRAO, ...(db.meta.lembModelos || {})};
  db.meta.workflows = [...wfs(), ...Object.entries(modelos).filter(([tipo, ls]) => ls.length && !wfs().some(w => w.titulo === `Lembretes de ${tipo.toLowerCase()}`)).map(([tipo, ls]) => ({id:uid(), titulo:`Lembretes de ${tipo.toLowerCase()}`, descricao:'Criado a partir dos modelos de lembretes por tipo.', ativo:true,
    gatilhos:[{ev:'cmp_criado', tipo}], passos:ls.map(l => ({id:uid(), acao:l.tipo === 'tarefa' ? 'compromisso' : l.tipo, titulo:l.titulo || '', ctipo:'Tarefa', qtd:l.unid === 'sem' ? l.qtd * 7 : l.qtd, unid:l.unid === 'h' || l.unid === 'min' ? 'h' : 'dc', dir:'antes', ref:'compromisso', hora:l.hora || '09:00', para:l.para || [], msg:l.msg || ''}))}))];
  db.meta.wfV1 = true; save();
}

/* ----- detecção dos eventos (todas as gravações passam pelo upsert) ----- */
{ const orig = upsert; upsert = function(c, obj){ const a = obj.id ? byId(c, obj.id) : null, antes = a ? JSON.parse(JSON.stringify(a)) : null, r = orig(c, obj);
    if(!WF.rodando && ['prazos', 'processos', 'andamentos', 'leads', 'pessoas'].includes(c)) wfFila(c, antes, r); return r; }; }
function wfFila(c, antes, depois){ if(!wfs().some(w => w.ativo !== false)) return; WF.fila.push({c, antes, depois:JSON.parse(JSON.stringify(depois))}); clearTimeout(WF.t); WF.t = setTimeout(wfProcessar, 120); }
function wfPublicacoes(itens){ (itens || []).forEach(i => wfFila('monitor', null, i)); }
const contem = (txt, q) => !q || norm_s(txt || '').includes(norm_s(q));
function wfCasa(g, c, antes, d){ const ev = WF_EV[g.ev]; if(!ev || (ev.c !== '*' && ev.c !== c)) return null; const novo = !antes;
  switch(g.ev){
    case 'cmp_criado': return novo && (!g.tipo || d.tipo === g.tipo) && (!g.subtipo || d.subtipo === g.subtipo) ? '' : null;
    case 'cmp_alterado': return !novo && (!g.tipo || d.tipo === g.tipo) && (!g.subtipo || d.subtipo === g.subtipo) ? '' : null;
    case 'cmp_situacao': return d.situacao === g.situacao && antes?.situacao !== d.situacao ? d.situacao : null;
    case 'serv_criado': return novo && d.servico && (!g.tipoServ || d.tipoServico === g.tipoServ) ? '' : null;
    case 'serv_status': return d.servico && antes && antes.statusServ !== d.statusServ && (!g.statusServ || d.statusServ === g.statusServ) ? d.statusServ : null;
    case 'proc_criado': return !d.servico && novo && (!g.area || d.area === g.area) && contem(d.titulo, g.acao) ? '' : null;
    case 'proc_fase': return !d.servico && antes && antes.fase !== d.fase && (!g.de || antes.fase === g.de) && (!g.para || d.fase === g.para) ? d.fase : null;
    case 'proc_status': return !d.servico && antes && antes.status !== d.status && (!g.status || d.status === g.status) ? d.status : null;
    case 'and_criado': return novo && contem((d.tipo || '') + ' ' + (d.descricao || ''), g.contem) ? '' : null;
    case 'pub_recebida': return novo && d.tipo === 'publicacao' && contem((d.titulo || '') + ' ' + (d.texto || ''), g.contem) ? '' : null;
    case 'lead_etapa': return (novo || antes.status !== d.status) && d.status === g.etapa ? d.status : null;
    case 'lead_resultado': return (novo || antes.status !== d.status) && ['Fechado', 'Perdido'].includes(d.status) && (!g.resultado || d.status === g.resultado) ? d.status : null;
    case 'pessoa_criada': return novo && (!g.tipoPessoa || d.tipo === g.tipoPessoa) ? '' : null;
    case 'cad_recebido': return novo && d.origemCad === 'link' ? '' : null;
    case 'campo_mudou': if(g.col !== c || !g.campo) return null; { const v = wfGet(d, g.campo), v0 = antes ? wfGet(antes, g.campo) : undefined;
      return String(v ?? '') !== String(v0 ?? '') && (!g.valor || norm_s(String(v ?? '')) === norm_s(g.valor)) ? String(v ?? '') : null; }
  } return null; }
function wfProcessar(){
  const fila = WF.fila.splice(0); let feitos = [];
  fila.forEach(({c, antes, depois}) => wfs().filter(w => w.ativo !== false).forEach(w => (w.gatilhos || []).forEach((g, gi) => {
    if(g.ev === 'manual' || depois.lembDe || depois.wfDe) return; const v = wfCasa(g, c, antes, depois); if(v === null) return;
    const chave = `${w.id}|${gi}|${c}:${depois.id}|${v}`; if(db.wflog.some(x => x.chave === chave)) return;
    const atual = c === 'monitor' ? depois : byId(c, depois.id); if(!atual) return;
    const lg = wfExecutar(w, c, atual, chave); if(lg) feitos.push(lg); })));
  if(feitos.length){ save(); render();
    const nomes = {}; feitos.forEach(f => { nomes[f.titulo] = (nomes[f.titulo] || 0) + 1; });
    const ns = Object.entries(nomes);
    toastDesfazer(`⚙️ ${ns.length > 2 ? `${feitos.length} execuções de workflows` : ns.map(([t, q]) => `“${t}”${q > 1 ? ' ×' + q : ''}`).join(', ')}: ${sum(feitos.map(f => f.criados.length + f.alterados.length + f.lembretes.length))} ação(ões)`, () => { feitos.forEach(f => wfDesfazer(f.id, true)); save(); render(); }); }
}

/* ----- execução ----- */
function wfCtx(c, alvo){
  const ctx = {c, alvo};
  if(c === 'prazos'){ ctx.proc = byId('processos', alvo.processoId); ctx.pessoa = byId('pessoas', alvo.pessoaId || ctx.proc?.clienteId); ctx.lead = alvo.leadId && byId('leads', alvo.leadId); }
  if(c === 'processos'){ ctx.proc = alvo; ctx.pessoa = byId('pessoas', alvo.clienteId); }
  if(c === 'andamentos' || c === 'monitor'){ ctx.proc = byId('processos', alvo.processoId) || (alvo.numero && typeof procPorNumero === 'function' ? procPorNumero(alvo.numero) : null); ctx.pessoa = byId('pessoas', ctx.proc?.clienteId); if(c === 'monitor') ctx.pub = alvo; }
  if(c === 'leads'){ ctx.lead = alvo; ctx.pessoa = byId('pessoas', alvo.pessoaId); }
  if(c === 'pessoas') ctx.pessoa = alvo;
  return ctx;
}
const wfNomeAlvo = (c, a) => c === 'processos' ? procLabel(a) : c === 'monitor' ? 'publicação ' + (a.numero || '') : c === 'andamentos' ? 'andamento ' + fmtD(a.data) : a.nome || a.titulo || '';
function wfTxt(s, ctx){ const p = ctx.c === 'prazos' ? ctx.alvo : {};
  return String(s || '').replace(/\{(cliente|nome)\}/g, (ctx.pessoa?.nome || ctx.lead?.nome || '').split(' ')[0]).replace(/\{clienteCompleto\}/g, ctx.pessoa?.nome || ctx.lead?.nome || '').replace(/\{processo\}/g, ctx.proc ? (ctx.proc.titulo || '') : '')
    .replace(/\{numero\}/g, ctx.proc?.numero || '').replace(/\{pasta\}/g, ctx.proc ? procCode(ctx.proc) : (ctx.pessoa?.pasta || '')).replace(/\{titulo\}/g, p.titulo || '').replace(/\{data\}/g, p.data ? fmtD(p.data) : '').replace(/\{hora\}/g, p.hora ? ' às ' + p.hora : '').replace(/\{local\}/g, p.local ? ', em ' + p.local : ''); }
function wfData(ctx, ps){
  const a = ctx.alvo, base = ps.ref === 'compromisso' && ctx.c === 'prazos' && a.data ? a.data : ps.ref === 'prazoFatal' && ctx.c === 'prazos' ? (a.dataFatal || a.data || today()) : ps.ref === 'publicacao' && ctx.pub ? (ctx.pub.data || today()) : today();
  const n = Math.max(0, Number(ps.qtd) || 0), fed = ehFederal(ctx.proc); if(!n || ps.unid === 'h') return base;
  if(ps.unid === 'du'){ if(ps.dir !== 'antes') return calcPrazo(base, n, 'u', fed); let d = base, k = 0; while(k < n){ d = addDays(d, -1); if(isBusiness(d, true, fed)) k++; } return d; }
  return addDays(base, ps.dir === 'antes' ? -n : n);
}
function wfExecutar(w, c, alvo, chave){
  const ctx = wfCtx(c, alvo), lg = {id:uid(), wf:w.id, titulo:w.titulo, chave, alvo:{c, id:alvo.id, nome:wfNomeAlvo(c, alvo)}, quando:new Date().toISOString(), criados:[], alterados:[], lembretes:[]};
  WF.rodando = true;
  try{ (w.passos || []).forEach(ps => { try{ wfPasso(w, ps, ctx, lg); }catch(e){ console.warn('workflow', w.titulo, e); } }); }
  finally{ WF.rodando = false; }
  if(!lg.criados.length && !lg.alterados.length && !lg.lembretes.length) return null;
  db.wflog.push(lg); if(db.wflog.length > 600) db.wflog.splice(0, db.wflog.length - 600);
  return lg;
}
function wfPasso(w, ps, ctx, lg){
  const novo = (col, o) => { const r = upsert(col, {...o, wfDe:{wf:w.id, log:lg.id}}); lg.criados.push({c:col, id:r.id}); return r; };
  const alt = (col, o, campo, v) => { lg.alterados.push({c:col, id:o.id, campo, antes:wfGet(o, campo) ?? ''}); wfSet(o, campo, v); };
  const data = wfData(ctx, ps), cmp = ctx.c === 'prazos' ? ctx.alvo : null, rotulo = WF_AC[ps.acao];
  // passos do tipo lembrete num compromisso: entram em “Lembretes e preparação” dele
  if(cmp && ['whats', 'email', 'notif', 'compromisso'].includes(ps.acao) && (ps.ref === 'compromisso' || ps.ref === 'prazoFatal') && cmp.data){
    const unid = ps.unid === 'h' ? 'h' : 'd', qtd = unid === 'h' ? (ps.dir === 'antes' ? 1 : -1) * (Number(ps.qtd) || 0) : Math.round((parseD(cmp.data) - parseD(data)) / 864e5);
    const l = {id:uid(), tipo:ps.acao === 'compromisso' ? 'tarefa' : ps.acao, qtd, unid, hora:ps.hora || '09:00', para:ps.para || [], outros:ps.outro?.nome || ps.outro?.tel || ps.outro?.email ? [ps.outro] : [], msg:ps.msg || '', titulo:wfTxt(ps.titulo, ctx) || rotulo, wf:w.id};
    cmp.lembretes = [...(cmp.lembretes || []), l]; lg.lembretes.push({p:cmp.id, l:l.id}); lembSincronizarTarefas(cmp); return; }
  if(ps.acao === 'compromisso' || ps.acao === 'link') novo('prazos', {titulo:wfTxt(ps.titulo, ctx) || (ps.acao === 'link' ? '📨 Enviar link de cadastro — ' + (ctx.lead?.nome || ctx.pessoa?.nome || '') : rotulo), tipo:ps.ctipo || 'Tarefa', subtipo:ps.csub || '', data,
    processoId:ctx.proc?.id || '', pessoaId:ctx.pessoa?.id || '', leadId:ctx.lead?.id || '', relacionados:cmp ? [cmp.id] : [], obs:wfTxt(ps.desc, ctx), situacao:'Pendente', concluido:false, coluna:'tarefas'});
  else if(['whats', 'email', 'notif'].includes(ps.acao)){ // fora de um compromisso: vira uma tarefa no dia, com o lembrete pronto
    const outros = [...(ps.outro?.nome || ps.outro?.tel || ps.outro?.email ? [ps.outro] : []), ...(ctx.lead && !ctx.pessoa && (ps.para || []).includes('cliente') ? [{nome:ctx.lead.nome, tel:ctx.lead.telefone, email:ctx.lead.email}] : [])];
    novo('prazos', {titulo:wfTxt(ps.titulo, ctx) || `${LEMB_T[ps.acao].ic} ${rotulo}${ctx.pessoa || ctx.lead ? ' — ' + (ctx.pessoa?.nome || ctx.lead?.nome) : ''}`, tipo:'Tarefa', data, processoId:ctx.proc?.id || '', pessoaId:ctx.pessoa?.id || '', leadId:ctx.lead?.id || '',
      situacao:'Pendente', concluido:false, coluna:'tarefas', obs:wfTxt(ps.desc, ctx), lembretes:[{id:uid(), tipo:ps.acao, qtd:0, unid:'d', hora:ps.hora || '09:00', para:ps.para || [], outros, msg:wfTxt(ps.msg, ctx), wf:w.id}]}); }
  else if(ps.acao === 'atendimento' && (ctx.pessoa || ctx.lead)) novo('conversas', {pessoaId:ctx.pessoa?.id || '', leadId:ctx.lead?.id || '', processoId:ctx.proc?.id || '', dataHora:nowLocal(), canal:ps.canal || 'Outro', iniciadoPor:'escritorio', assunto:wfTxt(ps.titulo, ctx) || 'Registro automático', relato:wfTxt(ps.desc, ctx) || wfTxt(ps.titulo, ctx) || '—'});
  else if(ps.acao === 'lancamento') novo('financeiro', {natureza:ps.natureza || 'entrada', conta:pcById(ps.conta)?.id || contaPadrao(ps.natureza || 'entrada'), categoria:catDaConta(pcById(ps.conta) || pcById(contaPadrao(ps.natureza || 'entrada'))), descricao:wfTxt(ps.titulo, ctx) || 'Lançamento do workflow', valor:Number(ps.valor) || 0, vencimento:data, pessoaId:ctx.pessoa?.id || '', processoId:ctx.proc?.id || ''});
  else if(ps.acao === 'andamento' && ctx.proc) novo('andamentos', {processoId:ctx.proc.id, data, tipo:ps.atipo || 'Outro', descricao:wfTxt(ps.desc || ps.titulo, ctx)});
  else if(ps.acao === 'tag' || ps.acao === 'campo'){ const o = {processo:ctx.proc, cliente:ctx.pessoa, compromisso:cmp, lead:ctx.lead}[ps.onde], col = {processo:'processos', cliente:'pessoas', compromisso:'prazos', lead:'leads'}[ps.onde]; if(!o) return;
    if(ps.acao === 'tag'){ const add = (ps.tags || []).filter(t => !(o.tags || []).includes(t)); if(add.length) alt(col, o, 'tags', [...(o.tags || []), ...add]); }
    else if(ps.campo) alt(col, o, ps.campo, ps.valor ?? ''); }
}
function wfDesfazer(id, silencioso){
  const lg = db.wflog.find(x => x.id === id); if(!lg) return;
  lg.criados.forEach(x => { db[x.c] = db[x.c].filter(r => r.id !== x.id); });
  lg.alterados.slice().reverse().forEach(x => { const o = byId(x.c, x.id); if(o) wfSet(o, x.campo, x.antes); });
  lg.lembretes.forEach(x => { const p = byId('prazos', x.p); if(!p) return; const l = (p.lembretes || []).find(y => y.id === x.l); if(l?.tarefaId){ const t = byId('prazos', l.tarefaId); if(t && !t.concluido) db.prazos = db.prazos.filter(r => r.id !== t.id); }
    p.lembretes = (p.lembretes || []).filter(y => y.id !== x.l); p.relacionados = (p.relacionados || []).filter(r => byId('prazos', r)); });
  lg.desfeito = new Date().toISOString(); if(!silencioso){ save(); render(); toast('Workflow desfeito'); }
}
// execução manual (botão na ficha)
function wfManual(c, id){
  const alvo = byId(c, id), ls = wfs().filter(w => w.ativo !== false && (w.gatilhos || []).some(g => g.ev === 'manual' && (!g.colM || g.colM === c)));
  openForm({title:'⚙️ Executar workflow', soFechar:true, fields:[{type:'html', html:ls.length ? `<p class="small muted" style="margin-top:0">Em: <b>${esc(wfNomeAlvo(c, alvo))}</b></p>${ls.map(w => `<div class="li"><div class="grow"><b>${esc(w.titulo)}</b><div class="sub">${esc(w.descricao || '')} · ${(w.passos || []).length} passo(s)</div></div><button type="button" class="btn primary" data-wfrun="${w.id}">▶ Executar</button></div>`).join('')}`
    : `<p>Nenhum workflow com gatilho <b>Manual</b> para ${esc((WF_COLS[c] || '').toLowerCase())}. Crie em <a href="#/workflows" onclick="closeModal()">🔀 Workflows</a> escolhendo o gatilho “Manual”.</p>`}],
    after:f => f.querySelectorAll('[data-wfrun]').forEach(b => b.onclick = () => { const w = wfs().find(x => x.id === b.dataset.wfrun), lg = wfExecutar(w, c, byId(c, id), `${w.id}|manual|${c}:${id}|${Date.now()}`); closeModal();
      if(lg){ save(); render(); toastDesfazer(`⚙️ “${w.titulo}”: ${lg.criados.length + lg.alterados.length + lg.lembretes.length} ação(ões)`, () => wfDesfazer(lg.id)); } else toast('Nada a fazer neste cadastro'); })});
}

/* ----- tela ----- */
const wfResumoG = g => { const ev = WF_EV[g.ev]; if(!ev) return '?'; const ex = {tipo:g.tipo, subtipo:g.subtipo, situacao:g.situacao, area:g.area, acao:g.acao && `ação contém “${g.acao}”`, de:g.de && 'de ' + g.de, para:g.para && 'para ' + g.para, status:g.status, contem:g.contem && `contém “${g.contem}”`, etapa:g.etapa, resultado:g.resultado, tipoPessoa:g.tipoPessoa,
  col:WF_COLS[g.col], campo:g.campo && (wfCamposDe(g.col).find(x => x[0] === g.campo)?.[1] || g.campo), valor:g.valor && `= “${g.valor}”`, colM:WF_COLS[g.colM]};
  return ev.t.replace(/…$/, '') + (ev.f.map(k => ex[k]).filter(Boolean).length ? ': ' + ev.f.map(k => ex[k]).filter(Boolean).join(' · ') : ''); };
const UNID_WF = {dc:'dia(s) corrido(s)', du:'dia(s) útil(eis)', h:'hora(s)'};
const REF_WF = {gatilho:'do dia em que disparar', compromisso:'da data do compromisso', prazoFatal:'do prazo fatal', publicacao:'da data da publicação'};
const wfResumoP = ps => `${WF_AC[ps.acao] || ps.acao}${ps.titulo ? ': ' + ps.titulo : ''} — ${Number(ps.qtd) ? `${ps.qtd} ${UNID_WF[ps.unid] || ''} ${ps.dir === 'antes' ? 'antes' : 'depois'} ` : 'no dia '}${REF_WF[ps.ref] || ''}`;
VIEWS.workflows = () => {
  const ls = wfs(), log = [...db.wflog].sort((a, b) => b.quando.localeCompare(a.quando)).slice(0, 25);
  return `<h1>🔀 Workflows<span class="sp"></span><button class="btn primary" data-act="wfNovo">+ Novo workflow</button></h1>
  <p class="small muted" style="margin-top:-6px">Automatizações: <b>quando</b> algo acontecer no sistema (o gatilho), o sistema <b>faz</b> os passos sozinho. Tudo o que for criado fica marcado “⚙️ workflow” e pode ser desfeito.</p>
  ${ls.map(w => `<div class="card wfCard ${w.ativo === false ? 'off' : ''}"><h2>${esc(w.titulo)} ${w.ativo === false ? '<span class="tag grey">pausado</span>' : '<span class="tag ok">ativo</span>'}<span class="sp"></span>
      <button class="mini" data-act="wfAtivar" data-id="${w.id}">${w.ativo === false ? '▶ ativar' : '⏸ pausar'}</button> <button class="mini" data-act="wfDuplicar" data-id="${w.id}">duplicar</button> <button class="btn" data-act="wfEditar" data-id="${w.id}">Editar</button></h2>
    ${w.descricao ? `<div class="small muted" style="margin:-6px 0 8px">${esc(w.descricao)}</div>` : ''}${(pr => pr.length ? `<div class="wfProb">⚠️ <b>Precisa de atenção${w.ativo === false ? '' : ' — enquanto isso, pode deixar de disparar'}:</b><ul>${pr.map(x => `<li>${esc(x)}</li>`).join('')}</ul><button class="mini" data-act="wfEditar" data-id="${w.id}">corrigir</button></div>` : '')(wfProblemas(w))}
    <div class="wfFlow"><div><b class="small">QUANDO</b>${(w.gatilhos || []).map(g => `<div class="wfG">⚡ ${esc(wfResumoG(g))}</div>`).join('') || '<div class="small muted">sem gatilho</div>'}</div>
      <div><b class="small">FAZ</b>${(w.passos || []).map((ps, i) => `<div class="wfP">${i + 1}. ${esc(wfResumoP(ps))}</div>`).join('') || '<div class="small muted">sem passos</div>'}</div></div>
    <div class="small muted" style="margin-top:6px">Executado ${db.wflog.filter(x => x.wf === w.id && !x.desfeito).length} vez(es)</div></div>`).join('') || '<div class="card empty">Nenhum workflow ainda. Clique em “+ Novo workflow”.</div>'}
  <div class="card"><h2>🕑 Histórico <span class="tag grey">${db.wflog.length}</span></h2>${log.map(x => `<div class="li"><div class="grow"><b>${esc(x.titulo)}</b> em ${esc(x.alvo?.nome || '')}${x.desfeito ? ' <span class="tag grey">desfeito</span>' : ''}
      <div class="sub">${new Date(x.quando).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'})} · ${x.criados.length} criado(s) · ${x.alterados.length} alteração(ões) · ${x.lembretes.length} lembrete(s)</div></div>${x.desfeito ? '' : `<button class="mini" data-act="wfDesfazer" data-id="${x.id}">↩ desfazer</button>`}</div>`).join('') || '<div class="empty">Nada executado ainda.</div>'}</div>`;
};

/* ----- editor ----- */
// mantém visível um valor salvo que não existe mais na lista (marcado ⚠️), para não sumir sem o usuário perceber
const wfComAtual = (ops, v) => v && !ops.some(o => (typeof o === 'object' ? o.v : o) === v) ? [...ops, {v, t:`⚠️ ${v} (não existe mais)`}] : ops;
function wfFiltroHtml(g, i){
  const sel = (k, l, ops, vazio = 'qualquer') => `<label>${l}<select data-gk="${k}" data-gi="${i}"><option value="">${vazio}</option>${opts(wfComAtual(ops, g[k]), g[k] || '')}</select></label>`, txt = (k, l, ph) => `<label>${l}<input data-gk="${k}" data-gi="${i}" value="${esc(g[k] || '')}" placeholder="${esc(ph || '')}"></label>`;
  return (WF_EV[g.ev]?.f || []).map(k => ({tipo:() => sel('tipo', 'Tipo', OPT.tipoPrazo), subtipo:() => sel('subtipo', 'Subtipo', g.tipo ? subtiposDe(g.tipo) : []), situacao:() => sel('situacao', 'Situação', OPT.situacao, '—'),
    area:() => sel('area', 'Área', OPT.area), acao:() => txt('acao', 'Ação / assunto contém', 'ex.: trabalhista'), de:() => sel('de', 'De', OPT.faseProc), para:() => sel('para', 'Para', OPT.faseProc), status:() => sel('status', 'Para o status', OPT.statusProc),
    tipoServ:() => sel('tipoServ', 'Tipo de serviço', OPT.tipoServico), statusServ:() => sel('statusServ', 'Para o status', OPT.statusServ), contem:() => txt('contem', 'Texto contém (opcional)', 'ex.: sentença, citação, audiência designada'), etapa:() => sel('etapa', 'Etapa', OPT.statusLead, '—'), resultado:() => sel('resultado', 'Resultado', ['Fechado', 'Perdido']), tipoPessoa:() => sel('tipoPessoa', 'Tipo de pessoa', OPT.tipoPessoa),
    col:() => `<label>Cadastro<select data-gk="col" data-gi="${i}"><option value="">—</option>${opts(Object.entries(WF_COLS).map(([v, t]) => ({v, t})), g.col || '')}</select></label>`,
    campo:() => g.col ? `<label>Campo<select data-gk="campo" data-gi="${i}"><option value="">—</option>${opts(wfCamposDe(g.col).map(([v, t]) => ({v, t})), g.campo || '')}</select></label>` : '',
    valor:() => g.campo && wfOpcoesDe(g.col, g.campo) ? sel('valor', 'Mudar para', wfOpcoesDe(g.col, g.campo), 'qualquer mudança') : txt('valor', 'Mudar para (em branco = qualquer mudança)', ''), colM:() => `<label>Aparece na ficha de<select data-gk="colM" data-gi="${i}"><option value="">qualquer cadastro</option>${opts(Object.entries(WF_COLS).map(([v, t]) => ({v, t})), g.colM || '')}</select></label>`}[k]?.() || '')).join('');
}
function wfPassoHtml(ps, i){
  const s = (k, l, ops, cls = '') => `<label class="${cls}">${l}<select data-pk="${k}" data-pi="${i}">${opts(wfComAtual(ops, ps[k]), ps[k] ?? '')}</select></label>`, t = (k, l, ph, cls = '') => `<label class="${cls}">${l}<input data-pk="${k}" data-pi="${i}" value="${esc(ps[k] ?? '')}" placeholder="${esc(ph || '')}"></label>`;
  const lst = ps.onde === 'cliente' ? 'pes' : ps.onde === 'compromisso' ? 'cmp' : 'proc', colOnde = {processo:'processos', cliente:'pessoas', compromisso:'prazos', lead:'leads'}[ps.onde || 'processo'];
  const extra = {
    compromisso:() => s('ctipo', 'Tipo do compromisso', OPT.tipoPrazo) + t('titulo', 'Título', 'ex.: Estudar o processo e preparar as perguntas', 'wfFull') + `<label class="wfFull">Descrição<textarea data-pk="desc" data-pi="${i}" rows="2">${esc(ps.desc || '')}</textarea></label>`,
    whats:() => wfParaHtml(ps, i, true) + `<label class="wfFull">Mensagem <span class="small muted">— {cliente}, {titulo}, {data}, {hora}, {local}, {processo}, {numero}</span><textarea data-pk="msg" data-pi="${i}" rows="3" placeholder="${esc(MSG_LEMB)}">${esc(ps.msg || '')}</textarea></label>`,
    email:() => wfParaHtml(ps, i) + `<label class="wfFull">Mensagem do e-mail<textarea data-pk="msg" data-pi="${i}" rows="3" placeholder="${esc(MSG_LEMB)}">${esc(ps.msg || '')}</textarea></label>`,
    notif:() => t('titulo', 'Texto da notificação (opcional)', '', 'wfFull'),
    atendimento:() => t('titulo', 'Assunto', 'ex.: Boas-vindas enviadas', 'wfFull') + `<label class="wfFull">O que registrar<textarea data-pk="desc" data-pi="${i}" rows="2">${esc(ps.desc || '')}</textarea></label>`,
    lancamento:() => s('natureza', 'Tipo', [{v:'entrada', t:'⬆ A receber'}, {v:'saida', t:'⬇ A pagar'}]) + `<label class="wfFull">Conta do plano<select data-pk="conta" data-pi="${i}"><option value="">(padrão)</option>${contaOptsHtml(ps.natureza || 'entrada', '', ps.conta)}</select></label>` + t('valor', 'Valor (R$)', '0,00') + t('titulo', 'Descrição', 'ex.: Honorários iniciais — {cliente}', 'wfFull'),
    andamento:() => s('atipo', 'Tipo do andamento', OPT.tipoAnd) + `<label class="wfFull">Descrição<textarea data-pk="desc" data-pi="${i}" rows="2">${esc(ps.desc || '')}</textarea></label>`,
    tag:() => s('onde', 'Em', [{v:'processo', t:'Processo'}, {v:'cliente', t:'Cliente'}, {v:'compromisso', t:'Compromisso'}]) + `<div class="wfFull"><span class="small muted">Tags:</span> <span class="tagsEd">${tagsLista(lst).map(tg => `<button type="button" class="tagC ${(ps.tags || []).includes(tg.id) ? 'on' : ''}" style="--c:${tg.cor}" data-ptag="${tg.id}" data-pi="${i}">${esc(tg.nome)}</button>`).join('')}</span></div>`,
    campo:() => s('onde', 'Em', [{v:'processo', t:'Processo'}, {v:'cliente', t:'Cliente'}, {v:'compromisso', t:'Compromisso'}, {v:'lead', t:'Lead'}]) + s('campo', 'Campo', [{v:'', t:'—'}, ...wfCamposDe(colOnde).map(([v, tt]) => ({v, t:tt}))]) + (ps.campo && wfOpcoesDe(colOnde, ps.campo) ? s('valor', 'Novo valor', [{v:'', t:'(apagar o valor)'}, ...wfOpcoesDe(colOnde, ps.campo)]) : t('valor', 'Novo valor', 'ex.: Recursal')),
    link:() => t('titulo', 'Título da tarefa (opcional)', '📨 Enviar link de cadastro — {cliente}', 'wfFull'),
  }[ps.acao]?.() || '';
  return `<div class="wfPasso"><div class="wfPh"><b>${i + 1}.</b> <input data-pk="nome" data-pi="${i}" value="${esc(ps.nome || '')}" placeholder="Nome do passo (opcional)"><span class="sp"></span><button type="button" class="mini" data-pup="${i}" title="Subir">▲</button> <button type="button" class="mini danger" data-prm="${i}">Remover</button></div>
    <div class="wfPg">${s('acao', 'Ação', Object.entries(WF_AC).map(([v, tt]) => ({v, t:tt})), 'wfFull')}
      ${t('qtd', 'Prazo', '0')}${s('unid', 'em', Object.entries(UNID_WF).map(([v, tt]) => ({v, t:tt})))}${s('dir', 'Antes / depois', [{v:'depois', t:'depois'}, {v:'antes', t:'antes'}])}${s('ref', 'Da data de referência', Object.entries(REF_WF).map(([v, tt]) => ({v, t:tt})))}
      ${['whats', 'email', 'notif', 'compromisso'].includes(ps.acao) ? `<label>Horário<input type="time" data-pk="hora" data-pi="${i}" value="${esc(ps.hora || '09:00')}"></label>` : ''}${extra}</div></div>`;
}
const wfParaHtml = (ps, i, eu) => `<div class="wfFull wfPara"><span class="small muted">Para:</span>${eu ? `<label class="chk"><input type="checkbox" data-ppara="eu" data-pi="${i}" ${(ps.para || []).includes('eu') ? 'checked' : ''}> eu mesmo</label>` : ''}<label class="chk"><input type="checkbox" data-ppara="cliente" data-pi="${i}" ${(ps.para || []).includes('cliente') ? 'checked' : ''}> cliente</label><label class="chk"><input type="checkbox" data-ppara="testemunhas" data-pi="${i}" ${(ps.para || []).includes('testemunhas') ? 'checked' : ''}> testemunhas do processo</label>
  <input data-pout="nome" data-pi="${i}" value="${esc(ps.outro?.nome || '')}" placeholder="outro contato: nome"><input data-pout="${ps.acao === 'email' ? 'email' : 'tel'}" data-pi="${i}" value="${esc((ps.acao === 'email' ? ps.outro?.email : ps.outro?.tel) || '')}" placeholder="${ps.acao === 'email' ? 'e-mail' : 'celular'}"></div>`;
function formWorkflow(w0, novo){
  const W = JSON.parse(JSON.stringify(w0 || {id:uid(), titulo:'', descricao:'', ativo:true, gatilhos:[{ev:'cmp_criado'}], passos:[]})), isNew = !w0 || !!novo;
  openForm({title:isNew ? '🔀 Novo workflow' : '🔀 Editar workflow', data:{}, fields:[{type:'html', html:`<div class="wfEd">
      <label>Título<input id="wfTit" value="${esc(W.titulo)}" placeholder="ex.: Sentença recebida"></label><label>Descrição<textarea id="wfDesc" rows="2">${esc(W.descricao || '')}</textarea></label>
      <label class="chk"><input type="checkbox" id="wfAtivo" ${W.ativo !== false ? 'checked' : ''}> Ativo</label>
      <div class="sect">⚡ Gatilhos <span class="small muted" style="font-weight:400">— basta um deles acontecer</span><span class="sp" style="flex:1"></span><button type="button" class="mini" id="wfGAdd">+ Gatilho</button></div><div id="wfGs"></div>
      <div class="sect">👣 Passos<span class="sp" style="flex:1"></span><button type="button" class="mini" id="wfPAdd">+ Passo</button></div><div id="wfPs"></div></div>`}],
    after:f => {
      const pintaG = () => { f.querySelector('#wfGs').innerHTML = W.gatilhos.map((g, i) => `<div class="wfGat"><div class="wfPg"><label class="wfFull">Gatilho ${i + 1}<select data-gev="${i}">${opts(Object.entries(WF_EV).map(([v, e]) => ({v, t:e.t})), g.ev)}</select></label>${wfFiltroHtml(g, i)}</div><div style="text-align:right"><button type="button" class="mini danger" data-grm="${i}">Remover</button></div></div>`).join('') || '<div class="small muted">Inclua um gatilho.</div>'; };
      const pintaP = () => { f.querySelector('#wfPs').innerHTML = W.passos.map(wfPassoHtml).join('') || '<div class="small muted">Inclua os passos que o sistema deve fazer.</div>'; };
      pintaG(); pintaP();
      f.querySelector('#wfGAdd').onclick = () => { W.gatilhos.push({ev:'cmp_criado'}); pintaG(); };
      f.querySelector('#wfPAdd').onclick = () => { W.passos.push({id:uid(), acao:'compromisso', ctipo:'Tarefa', qtd:0, unid:'dc', dir:'depois', ref:'gatilho', hora:'09:00', para:['cliente'], onde:'processo'}); pintaP(); };
      onForm(f, 'change', e => { const el = e.target;
        if(el.dataset.gev != null){ W.gatilhos[+el.dataset.gev] = {ev:el.value}; pintaG(); }
        else if(el.dataset.gk){ const g = W.gatilhos[+el.dataset.gi]; g[el.dataset.gk] = el.value; if(['tipo', 'col', 'campo'].includes(el.dataset.gk)) pintaG(); }
        else if(el.dataset.pk){ const ps = W.passos[+el.dataset.pi]; ps[el.dataset.pk] = el.value; if(['acao', 'onde', 'campo', 'natureza'].includes(el.dataset.pk)){ if(el.dataset.pk === 'onde') ps.tags = []; pintaP(); } }
        else if(el.dataset.ppara){ const ps = W.passos[+el.dataset.pi], st = new Set(ps.para || []); el.checked ? st.add(el.dataset.ppara) : st.delete(el.dataset.ppara); ps.para = [...st]; }
        else if(el.dataset.pout){ const ps = W.passos[+el.dataset.pi]; ps.outro = {...(ps.outro || {}), [el.dataset.pout]:el.value.trim()}; } });
      onForm(f, 'input', e => { const el = e.target; if(el.dataset.pk && el.tagName !== 'SELECT') W.passos[+el.dataset.pi][el.dataset.pk] = el.value; if(el.dataset.gk && el.tagName === 'INPUT') W.gatilhos[+el.dataset.gi][el.dataset.gk] = el.value; });
      onForm(f, 'click', e => { const b = e.target.closest('button'); if(!b) return;
        if(b.dataset.grm != null){ W.gatilhos.splice(+b.dataset.grm, 1); pintaG(); }
        if(b.dataset.prm != null){ W.passos.splice(+b.dataset.prm, 1); pintaP(); }
        if(b.dataset.pup != null){ const i = +b.dataset.pup; if(i > 0){ [W.passos[i - 1], W.passos[i]] = [W.passos[i], W.passos[i - 1]]; pintaP(); } }
        if(b.dataset.ptag){ const ps = W.passos[+b.dataset.pi], st = new Set(ps.tags || []); st.has(b.dataset.ptag) ? st.delete(b.dataset.ptag) : st.add(b.dataset.ptag); ps.tags = [...st]; b.classList.toggle('on'); } });
      if(!isNew) f.querySelector('.mfoot').insertAdjacentHTML('afterbegin', '<button type="button" class="btn danger" id="wfDel">Excluir</button>');
      f.querySelector('#wfDel')?.addEventListener('click', () => { if(!confirm(`Excluir o workflow “${W.titulo}”? O que ele já criou continua no sistema.`)) return; db.meta.workflows = wfs().filter(x => x.id !== W.id); save(); closeModal(); render(); toast('Workflow excluído'); });
    },
    onSave:() => { W.titulo = mForm.querySelector('#wfTit').value.trim(); W.descricao = mForm.querySelector('#wfDesc').value.trim(); W.ativo = mForm.querySelector('#wfAtivo').checked;
      if(!W.titulo){ toast('Dê um título ao workflow'); return false; } if(!W.gatilhos.length || !W.passos.length){ toast('Inclua ao menos um gatilho e um passo'); return false; }
      db.meta.workflows = wfs().some(x => x.id === W.id) ? wfs().map(x => x.id === W.id ? W : x) : [...wfs(), W]; save(); render(); toast('Workflow salvo'); }});
}
// a partir dos lembretes de um compromisso (botão na seção “Lembretes e preparação”)
function wfDeLembretes(tipo, lembs){
  const W = {id:uid(), titulo:`Lembretes de ${String(tipo || '').toLowerCase()}`, descricao:'Criado a partir dos lembretes de um compromisso.', ativo:true, gatilhos:[{ev:'cmp_criado', tipo}],
    passos:lembs.map(l => ({id:uid(), acao:l.tipo === 'tarefa' ? 'compromisso' : l.tipo, titulo:l.titulo || '', ctipo:'Tarefa', qtd:Math.abs(l.unid === 'sem' ? l.qtd * 7 : l.qtd), unid:l.unid === 'h' || l.unid === 'min' ? 'h' : 'dc', dir:l.qtd < 0 ? 'depois' : 'antes', ref:'compromisso', hora:l.hora || '09:00', para:l.para || [], msg:l.msg || '', outro:l.outros?.[0]}))};
  formWorkflow(W, true);
}
Object.assign(A, {
  wfNovo: () => formWorkflow(null), wfEditar: d => formWorkflow(wfs().find(w => w.id === d.id)),
  wfDuplicar: d => { const w = JSON.parse(JSON.stringify(wfs().find(x => x.id === d.id))); w.id = uid(); w.titulo += ' (cópia)'; w.ativo = false; db.meta.workflows = [...wfs(), w]; save(); render(); toast('Cópia criada (pausada)'); },
  wfAtivar: d => { const w = wfs().find(x => x.id === d.id); w.ativo = w.ativo === false; save(); render(); },
  wfDesfazer: d => { if(confirm('Desfazer esta execução? O que ela criou é apagado e o que ela alterou volta ao que era.')) wfDesfazer(d.id); },
  wfManual: d => wfManual(d.col, d.id),
});
// wfMigrar() roda no início (inicio.js), depois de os dados serem carregados

/* ----- avisos: workflows com referência quebrada (contador no menu + notificação) ----- */
function wfBadge(){ const el = document.getElementById('bWf'); if(!el) return; const n = wfs().filter(w => w.ativo !== false && wfProblemas(w).length).length; el.hidden = !n; el.textContent = n; el.title = n + ' workflow(s) precisam de atenção'; }
{ const o = updateCounts; updateCounts = function(){ o(); try{ wfBadge(); }catch(e){} }; }
{ const o = ntAvisos; ntAvisos = function(){ const av = o(); wfs().filter(w => w.ativo !== false).forEach(w => { const pr = wfProblemas(w); if(pr.length) av.push({id:'wf_' + w.id, sig:pr.join('|'), ic:'⚠️', t:`Workflow “${w.titulo}” precisa de atenção`, s:pr[0] + (pr.length > 1 ? ` (+${pr.length - 1})` : ''), href:'#/workflows', nivel:'bad', tipo:'aviso'}); }); return av; }; }
