/* ===== 🧰 Serviços (extrajudiciais / extra contrato) =====
   Ficam em db.processos com p.servico = true — assim agenda, atendimentos, horas, Drive, financeiro, workflows, backup e verificação
   valem para eles sem duplicar nada. Numeração ligada ao cliente: P0152.S1 (curto 152.S1), sequência própria (p.seqServ).
   Status próprio (p.statusServ, lista editável); p.status acompanha: “Encerrado” quando Concluído/Cancelado, senão “Ativo”
   (para todo o resto do sistema — pastas Ativos/Encerrados no Drive, avisos de “ao final do processo” etc.). */
const SERV_FIM = ['Concluído', 'Cancelado'];
const ehServ = p => !!p?.servico;
const nextSeqServ = (clienteId, exceptId) => { const n = db.processos.filter(p => p.servico && p.clienteId === clienteId && p.id !== exceptId).map(p => parseInt(p.seqServ, 10)).filter(x => !isNaN(x)); return String(n.length ? Math.max(...n) + 1 : 1); };
const servStatusGeral = st => SERV_FIM.includes(st) ? 'Encerrado' : 'Ativo';
// conta do plano e forma dos honorários sugeridas pelo tipo (sempre dá para trocar)
const servContaDoTipo = t => (/consult|parecer/i.test(t || '') ? pcPorChave('consulta') : /assessoria mensal/i.test(t || '') ? pcById('pc1_1_06') : pcById('pc1_1_05'))?.id || pcPorChave('hon_contr')?.id;
const servFormaDoTipo = t => /assessoria mensal/i.test(t || '') ? 'mensal' : 'unico';
const FORMA_HON = {unico:'Valor único', parcelado:'Parcelado (plano de recebimento)', mensal:'Mensal (recorrente)'};

/* ----- formulário ----- */
function formServico(s0 = {}){
  const isNew = !s0.id, s = {statusServ:L('statusServ')[0] || 'Em andamento', tipoServico:'', dataInicio:today(), formaHon:'unico', ...s0};
  openForm({title:isNew ? '🧰 Novo serviço' : 'Editar serviço', data:{...s, contaHon:s.contaHon || servContaDoTipo(s.tipoServico)},
    fields:[
      {type:'grupo', label:'Serviço', id:'gsServ'},
      {k:'clienteId', label:'Cliente', type:'select', options:pessoasOpts, req:true, newP:'Cliente'},
      {k:'tipoServico', label:'Tipo de serviço', type:'select', options:() => OPT.tipoServico, lista:'tipoServico', req:true},
      {k:'titulo', label:'Título', ph:'ex.: Contrato de compra e venda do imóvel da Rua X (em branco = o tipo)', full:true},
      {k:'statusServ', label:'Status', type:'select', empty:false, options:() => OPT.statusServ, lista:'statusServ'},
      {k:'situacaoServ', label:'Situação (o que se aguarda)', type:'select', options:() => OPT.situacaoServ, lista:'situacaoServ'},
      {k:'area', label:'Área de atuação', type:'select', options:() => OPT.area, lista:'area'},
      {k:'dataInicio', label:'Início', type:'date'},
      {k:'localArquivo', label:'Local de arquivo', type:'select', options:() => OPT.localArquivo, lista:'localArquivo'},
      {type:'html', html:`<label>Tags</label>${tagsEditorHtml(s.tags || [], "proc")}`},
      {k:'outrasPartes', label:'Outras partes envolvidas', type:'textarea', rows:2, full:true, ph:'ex.: vendedor — José da Silva, CPF…; corretor — Imobiliária Y'},
      {type:'grupo', label:'Cobrança: credor e devedor', id:'gsCob', dica:'só no tipo Cobrança'},
      {type:'html', html:'<div class="small muted">Credor: o cliente (padrão).</div>'},
      {k:'devedorId', label:'Devedor', type:'select', options:pessoasOpts, newP:'Parte contrária'},
      {k:'valorDivida', label:'Valor cobrado (R$)', type:'number'},
      {type:'grupo', label:'Honorários', id:'gsHon'},
      {k:'valorServico', label:'Valor do serviço (R$)', type:'number'},
      {k:'formaHon', label:'Forma', type:'select', empty:false, options:Object.entries(FORMA_HON).map(([v, t]) => ({v, t}))},
      {k:'plano', label:'Plano de recebimento', type:'select', options:() => planosReceb().filter(p => !p.aoFinal).map(p => ({v:p.id, t:p.nome}))},
      {type:'html', html:`<label for="sConta">Conta do plano</label><select id="sConta" name="contaHon">${contaOptsHtml('entrada', 'esc', s.contaHon || servContaDoTipo(s.tipoServico))}</select>`},
      {type:'html', html:'<div class="small muted">O lançamento no financeiro é feito pelo botão “💰 Gerar no financeiro”, na ficha do serviço — assim você pode cadastrar antes de fechar o valor.</div>'},
      {type:'grupo', label:'Descrição e observações', id:'gsDesc', fechado:!s.resumo && !s.obs},
      {k:'resumo', label:'Descrição do serviço', type:'textarea', full:true},
      {k:'obs', label:'Observações', type:'textarea', full:true},
      {type:'grupo', fim:true}],
    after:f => { mForm._extraVals = () => ({tags:tagsLer(f), contaHon:f.querySelector('#sConta').value});
      const tp = f.elements.tipoServico, cob = f.querySelector('#gsCob'), fh = f.elements.formaHon, pl = f.elements.plano;
      const upd = () => { cob.style.display = /cobran/i.test(tp.value) ? '' : 'none'; pl.closest('.fld').style.display = fh.value === 'parcelado' ? '' : 'none'; };
      tp.addEventListener('change', () => { if(isNew || !s0.contaHon){ f.querySelector('#sConta').value = servContaDoTipo(tp.value); fh.value = servFormaDoTipo(tp.value); } upd(); }); fh.addEventListener('change', upd); upd(); },
    onSave:out => {
      if(mForm._extraVals) Object.assign(out, mForm._extraVals());   // tags e conta do plano
      const cliMudou = !isNew && out.clienteId !== s0.clienteId;
      const r = upsert('processos', {...s0, ...out, servico:true, tipoProc:'Serviço', titulo:(out.titulo || '').trim() || out.tipoServico, status:servStatusGeral(out.statusServ),
        seqServ:isNew || cliMudou ? nextSeqServ(out.clienteId, s0.id) : s0.seqServ, partes:/cobran/i.test(out.tipoServico) && out.devedorId ? [{pessoaId:out.devedorId, polo:'passivo'}] : (s0.partes || []), posicao:'Consultivo / Extrajudicial', testemunhas:s0.testemunhas || []});
      if(isNew) setTimeout(() => go('#/processo/' + r.id), 100); else render();
      toast(isNew ? `Serviço ${procCode(r)} criado` : 'Serviço salvo'); },
    onDelete:!isNew ? () => { const n = ['prazos', 'conversas', 'andamentos', 'financeiro', 'horas'].reduce((s2, c) => s2 + db[c].filter(x => x.processoId === s0.id).length, 0);
      if(!confirm(`Excluir o serviço ${procCode(s0)}?${n ? `\n\n${n} registro(s) ligados (compromissos, atendimentos, contas…) continuam no sistema, sem o vínculo.` : ''}`)) return false;
      ['prazos', 'conversas', 'andamentos', 'financeiro', 'horas', 'acordos'].forEach(c => db[c].forEach(x => { if(x.processoId === s0.id) x.processoId = ''; })); removeItem('processos', s0.id); go('#/servicos'); } : null});
}

/* ----- financeiro do serviço ----- */
function servGerarFinanceiro(id){
  const s = byId('processos', id); if(!s) return; const v = Number(s.valorServico) || 0;
  const base = {natureza:'entrada', ambito:'esc', pessoaId:s.clienteId, processoId:s.id, conta:s.contaHon || servContaDoTipo(s.tipoServico), descricao:`Honorários — ${s.titulo || s.tipoServico}`, valor:v || '', vencimento:today()};
  if(s.formaHon === 'mensal') return formFin({...base, recorr:true, rFreq:'m', rA:1, rFim:'indet'});
  if(s.formaHon === 'parcelado') return formFin({...base, plano:s.plano || ''});
  formFin(base);
}

/* ----- converter cobrança em processo ----- */
function servConverter(id){
  const s = byId('processos', id); if(!s) return;
  if(!confirm(`Criar um processo a partir do serviço ${procCode(s)}?\n\nO cliente${s.devedorId ? ', o devedor (como parte contrária)' : ''} e a descrição vão para o processo. O serviço fica como “Concluído” e ligado a ele; atendimentos, etapas e arquivos continuam no serviço, com link de um para o outro.`)) return;
  const p = upsert('processos', {clienteId:s.clienteId, titulo:/cobran/i.test(s.tipoServico) ? 'Ação de cobrança' : s.titulo, area:s.area || 'Cível', status:'Ativo', tipoProc:'Judicial', posicao:'Autor', seq:nextSeq(s.clienteId),
    partes:s.devedorId ? [{pessoaId:s.devedorId, polo:'passivo'}] : [], testemunhas:[], resumo:[s.resumo, s.valorDivida ? `Valor cobrado no extrajudicial: ${money(s.valorDivida)}.` : ''].filter(Boolean).join('\n'), tags:[...(s.tags || [])], servicoOrigem:s.id, valorCausa:s.valorDivida || ''});
  upsert('processos', {id:s.id, statusServ:'Concluído', status:'Encerrado', convertidoEm:p.id});
  toast(`Processo ${procCode(p)} criado — complete o número e os dados do juízo`); go('#/processo/' + p.id); setTimeout(() => formProc(byId('processos', p.id)), 300);
}

/* ----- converter processos “Extrajudicial” em serviços (lote) ----- */
function servConverterLote(){
  const ls = db.processos.filter(p => !p.servico && p.tipoProc === 'Extrajudicial');
  openForm({title:'🧰 Converter processos extrajudiciais em serviços', fields:[{type:'html', html:ls.length ? `<div class="small muted">Escolha os que são, na verdade, serviços. Eles ganham o número de serviço do cliente (ex.: 152.S1) e saem da lista de processos; compromissos, atendimentos, arquivos e financeiro continuam ligados.</div>
    <div class="rnL">${ls.map(p => `<label class="chk"><input type="checkbox" data-cv="${p.id}" checked> <b>${esc(procCode(p))}</b> ${esc(p.titulo || '')} — ${esc(pessoaNome(p.clienteId))} <span class="tag grey">${esc(p.status || '')}</span></label>`).join('')}</div>
    <label class="small">Tipo de serviço para todos<select id="cvTipo">${opts(OPT.tipoServico, 'Consultoria')}</select></label>` : '<p>Não há processos cadastrados como “Extrajudicial”. 👍</p>'}],
    onSave:() => { const ids = [...mForm.querySelectorAll('[data-cv]:checked')].map(x => x.dataset.cv), tipo = mForm.querySelector('#cvTipo')?.value || 'Consultoria'; if(!ids.length) return;
      ids.forEach(id => { const p = byId('processos', id); const st = INATIVOS.includes(p.status) ? 'Concluído' : (L('statusServ')[0] || 'Em andamento');
        Object.assign(p, {servico:true, tipoProc:'Serviço', tipoServico:p.tipoServico || tipo, statusServ:st, status:servStatusGeral(st), seqServ:nextSeqServ(p.clienteId, p.id), seqAntigo:p.seq}); });
      save(); render(); toast(`${ids.length} convertido(s) em serviço`); }});
}

/* ----- lista ----- */
const FS = {q:'', st:'abertos', tipo:'', tag:''};
VIEWS.servicos = () => {
  listFn = () => {
    const l = db.processos.filter(p => p.servico && (FS.st === 'todos' || (FS.st === 'abertos' ? !SERV_FIM.includes(p.statusServ) : p.statusServ === FS.st)) && (!FS.tipo || p.tipoServico === FS.tipo) && (!FS.tag || (p.tags || []).includes(FS.tag))
      && has(FS.q, procCode(p), p.titulo, p.tipoServico, pessoaNome(p.clienteId), pessoaNome(p.devedorId), p.resumo, p.outrasPartes, p.situacaoServ, tagsDe(p).map(t => t.nome).join(' ')))
      .sort((a, b) => cmpPasta(byId('pessoas', a.clienteId)?.pasta, byId('pessoas', b.clienteId)?.pasta) || (parseInt(a.seqServ, 10) || 0) - (parseInt(b.seqServ, 10) || 0));
    const finDe = p => { const fs = (agrupar('fin:proc', () => db.financeiro, x => x.processoId).get(p.id) || []).filter(x => x.natureza === 'entrada' && contaDe(x)?.kind === 'rec'); return {rec:sum(fs.filter(x => x.pagoEm).map(realV)), ab:sum(fs.filter(x => !x.pagoEm).map(x => x.valor))}; };
    const linha = p => { const pz = proxPrazoDe(p), f = finDe(p);
      return `<tr data-href="#/processo/${p.id}"><td class="nowrap"><b>${esc(procCode(p).replace(/^P0*/, ''))}</b></td><td><b>${esc(p.titulo || p.tipoServico)}</b>${p.titulo && p.titulo !== p.tipoServico ? `<div class="small muted">${esc(p.tipoServico || '')}</div>` : ''}${tagsDe(p).length ? ' ' + tagsHtml(p) : ''}</td>
        <td>${esc(pessoaNome(p.clienteId))}</td><td><span class="tag ${SERV_FIM.includes(p.statusServ) ? 'grey' : 'ok'}">${esc(p.statusServ || '')}</span>${p.situacaoServ ? `<div class="small" style="color:var(--warn)">⏳ ${esc(p.situacaoServ)}</div>` : ''}</td>
        <td class="small nowrap">${pz ? `${fmtD(pz.data)} — ${esc(pz.titulo)}` : '<span class="muted">—</span>'}</td><td class="right nowrap small">${p.valorServico ? money(p.valorServico) : ''}${f.rec || f.ab ? `<div class="muted">recebido ${money(f.rec)}${f.ab ? ` · aberto ${money(f.ab)}` : ''}</div>` : ''}</td></tr>`; };
    document.getElementById('list').innerHTML = l.length ? `<div class="card tablewrap"><table><thead><tr><th>Pasta</th><th>Serviço</th><th>Cliente</th><th>Status</th><th>Próximo compromisso</th><th class="right">Honorários</th></tr></thead><tbody>${l.slice(0, limiteDe('serv', 200)).map(linha).join('')}</tbody></table>${maisBtn('serv', l.length, 200)}</div>` : '<div class="card empty">Nenhum serviço encontrado. Use “+ Novo serviço”.</div>';
  };
  const ext = db.processos.filter(p => !p.servico && p.tipoProc === 'Extrajudicial').length;
  return `<h1>🧰 Serviços<span class="sp"></span>${ext ? `<button class="btn" data-act="servLote">Converter processos extrajudiciais (${ext})</button>` : ''}<button class="btn primary" data-act="servNovo">+ Novo serviço</button></h1>
    <div class="toolbar filtros"><input type="search" data-fs="q" value="${esc(FS.q)}" placeholder="Buscar por pasta, cliente, tipo, título…">
      <select data-fs="st"><option value="abertos" ${FS.st === 'abertos' ? 'selected' : ''}>Em aberto</option><option value="todos" ${FS.st === 'todos' ? 'selected' : ''}>Todos</option>${opts(OPT.statusServ, FS.st)}</select>
      <select data-fs="tipo"><option value="">Todos os tipos</option>${opts(OPT.tipoServico, FS.tipo)}</select>
      <select data-fs="tag"><option value="">Todas as tags</option>${opts(tagsProc().map(t => ({v:t.id, t:t.nome})), FS.tag)}</select></div><div id="list"></div>`;
};
document.addEventListener('input', e => { const k = e.target.dataset?.fs; if(!k) return; FS[k] = e.target.value; clearTimeout(FS._t); FS._t = setTimeout(() => listFn && listFn(), 150); });
document.addEventListener('change', e => { const k = e.target.dataset?.fs; if(!k || e.target.tagName === 'INPUT') return; FS[k] = e.target.value; LIM.serv = 0; listFn && listFn(); });

/* ----- ficha ----- */
function servicoFicha(p){
  const id = p.id, tab = ['conv', 'and', 'prz', 'fin', 'horas', 'tudo'].includes(tabs.serv) ? tabs.serv : 'prz', code = procCode(p);
  const convs = db.conversas.filter(c => c.processoId === id).sort(byDateDesc('dataHora')), ands = db.andamentos.filter(a => a.processoId === id).sort(byDateDesc('data'));
  const prz = db.prazos.filter(x => x.processoId === id).sort((a, b) => (a.concluido - b.concluido) || (a.data || '').localeCompare(b.data || ''));
  const fin = db.financeiro.filter(l => l.processoId === id).sort(byDateAsc('vencimento')), acs = db.acordos.filter(a => a.processoId === id), honRec = sum(fin.filter(l => l.natureza === 'entrada' && contaDe(l)?.kind === 'rec' && l.pagoEm).map(realV)), honAb = sum(fin.filter(l => l.natureza === 'entrada' && contaDe(l)?.kind === 'rec' && !l.pagoEm).map(l => l.valor));
  const T = (k, l, n) => `<button data-act="tab" data-g="serv" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${n != null ? ` (${n})` : ''}</button>`;
  const proc = byId('processos', p.convertidoEm), orig = byId('processos', p.servicoOrigem);
  let body = '';
  if(tab === 'conv') body = `<div class="toolbar"><button class="btn primary" data-act="newConv" data-pessoa="${p.clienteId}" data-proc="${id}">💬 Registrar atendimento</button></div>` + (convs.map(c => convItem(c, {noProc:true})).join('') || '<div class="empty">Nenhum atendimento registrado.</div>');
  if(tab === 'and') body = `<div class="toolbar"><button class="btn primary" data-act="newAnd" data-proc="${id}">📄 Nova etapa</button><span class="small muted">ex.: minuta enviada, cliente aprovou, assinado em cartório</span></div>` + (ands.map(a => andItem(a)).join('') || '<div class="empty">Nenhuma etapa registrada.</div>');
  if(tab === 'prz') body = `<div class="toolbar"><button class="btn primary" data-act="newPrazo" data-proc="${id}" data-pessoa="${p.clienteId}">📅 Novo compromisso / prazo de entrega</button></div>` + (prz.map(x => prazoItem(x, {noProc:true, obs:true})).join('') || '<div class="empty">Nenhum compromisso.</div>');
  if(tab === 'fin') body = `<div class="toolbar"><button class="btn primary" data-act="servFin" data-id="${id}">💰 Gerar no financeiro</button><button class="btn" data-act="newFin" data-pessoa="${p.clienteId}" data-proc="${id}" data-nat="saida">⬇ Despesa do serviço</button></div>`
    + (fin.length ? finResumo(fin) : '') + (acs.length ? '<div class="card"><h2>⬆ Recebimentos com valor do cliente</h2>' + acs.map(acordoItem).join('') + '</div>' : '') + finTable(fin.filter(l => !l.acordoId), {noPessoa:true, noProc:true});
  if(tab === 'horas') body = tsAbaProcesso(p);
  if(tab === 'tudo') body = [...convs.map(c => ({d:c.dataHora, h:convItem(c, {noProc:true})})), ...ands.map(a => ({d:a.data, h:andItem(a)}))].sort((a, b) => String(b.d).localeCompare(String(a.d))).map(x => x.h).join('') || '<div class="empty">Nada registrado ainda.</div>';
  const cob = /cobran/i.test(p.tipoServico || '');
  return `<h1>${code ? `<span class="tag warn">🧰 ${esc(code.replace(/^P0*/, ''))}</span> ` : ''}${esc(p.titulo || p.tipoServico || 'Serviço')} <span class="tag ${SERV_FIM.includes(p.statusServ) ? 'grey' : 'ok'}">${esc(p.statusServ || '')}</span><span class="sp"></span>
    <button class="btn" data-act="wfManual" data-col="processos" data-id="${id}" title="Executar um workflow neste serviço">⚙️</button><button class="btn" data-act="tsIniciarAqui" data-proc="${id}" title="Cronômetro de horas para este serviço">⏱️</button><button class="btn" data-act="print">🖨️ Imprimir</button>${cob && !proc ? `<button class="btn" data-act="servConv" data-id="${id}">⚖️ Converter em processo</button>` : ''}<button class="btn" data-act="servEditar" data-id="${id}">Editar dados</button></h1>
  ${tagsDe(p).length || p.situacaoServ || p.area ? `<div class="procChips">${areaTag(p.area)}${p.situacaoServ ? ` <span class="tag warn">⏳ ${esc(p.situacaoServ)}</span>` : ''} ${tagsHtml(p)}</div>` : ''}
  ${p.resumo ? `<div class="card procResumo">📝 ${nl2br(p.resumo)}</div>` : ''}
  ${proc ? `<div class="card" style="border:2px solid var(--pri2)">⚖️ Convertido no processo <a href="#/processo/${proc.id}"><b>${esc(procLabel(proc))}</b></a></div>` : ''}${orig ? `<div class="card">🧰 Originado do serviço <a href="#/processo/${orig.id}">${esc(procLabel(orig))}</a></div>` : ''}
  <div class="card"><div class="info">
    ${info('Pasta', `<b>${esc(code)}</b> <span class="muted small">(pasta ${esc(code.split('.')[0])}, ${esc(p.seqServ)}º serviço)</span>`)}${info('Tipo de serviço', esc(p.tipoServico))}${info('Cliente', linkP(p.clienteId) + repSub(p.clienteId))}
    ${cob ? info('Credor', linkP(p.clienteId)) + info('Devedor', linkP(p.devedorId)) + info('Valor cobrado', p.valorDivida ? money(p.valorDivida) : '') : ''}
    ${info('Outras partes envolvidas', nl2br(p.outrasPartes))}${info('Início', fmtD(p.dataInicio))}${info('Local de arquivo', esc(p.localArquivo))}
    ${info('Honorários', p.valorServico ? `${money(p.valorServico)} · ${esc(FORMA_HON[p.formaHon] || '')}${p.formaHon === 'parcelado' && prById(p.plano) ? ' — ' + esc(prById(p.plano).nome) : ''} · <span class="small">${esc(pcRotulo(pcById(p.contaHon)))}</span>` : '<span class="muted">a definir</span>')}
    ${info('Recebido', honRec || honAb ? `<b style="color:var(--ok)">${money(honRec)}</b>${honAb ? ` · em aberto ${money(honAb)}` : ''}` : '')}
    ${info('Observações', nl2br(p.obs), true)}${camposVerHtml('processo', p.extra)}
  </div></div>
  <div class="card"><div class="tabs">${T('prz', '📅 Compromissos', prz.filter(x => !x.concluido).length)}${T('conv', '💬 Atendimentos', convs.length)}${T('and', '📄 Etapas', ands.length)}${T('fin', '💰 Financeiro', fin.length)}${T('horas', '⏱️ Horas')}${T('tudo', '🕑 Linha do tempo')}</div>${body}</div>`;
}
Object.assign(A, {
  servNovo: d => formServico(d.pessoa ? {clienteId:d.pessoa} : {}), servEditar: d => formServico(byId('processos', d.id)),
  servFin: d => servGerarFinanceiro(d.id), servConv: d => servConverter(d.id), servLote: () => servConverterLote(),
});

/* ----- verificação ----- */
VINCULOS.verificar.push(() => {
  const out = [], semSeq = db.processos.filter(p => p.servico && !p.seqServ);
  if(semSeq.length){ VER_CORRIGIR.servSeq = () => { semSeq.forEach(p => { p.seqServ = nextSeqServ(p.clienteId, p.id); }); return semSeq.length; };
    out.push({area:'🧰 Serviços', titulo:`${semSeq.length} serviço(s) sem número`, txt:'Corrigir dá o próximo número de serviço do cliente.', corrigir:'servSeq'}); }
  const dup = new Map(); db.processos.filter(p => p.servico && p.seqServ).forEach(p => { const k = p.clienteId + '|' + p.seqServ; dup.set(k, (dup.get(k) || 0) + 1); });
  const d = [...dup.values()].filter(n => n > 1).length; if(d) out.push({area:'🧰 Serviços', titulo:`${d} número(s) de serviço repetidos no mesmo cliente`, txt:'Edite um deles e troque de cliente e volte, ou corrija pela pasta.', href:'#/servicos'});
  return out;
});
