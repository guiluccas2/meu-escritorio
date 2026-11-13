// Meu Escritório — Pessoas, processos, conversas, andamentos, prazos/agenda (inclui reagendamento), WhatsApp e leads
'use strict';
function idade(n){ if(!n) return null; const d = parseD(n), h = new Date(); let a = h.getFullYear() - d.getFullYear(); const m = h.getMonth() - d.getMonth(); if(m < 0 || (m === 0 && h.getDate() < d.getDate())) a--; return a; }
const dataMaioridade = n => n ? `${+n.slice(0, 4) + 18}${n.slice(4, 10)}` : '';
const repsDe = p => (p?.representantes || []).filter(r => byId('pessoas', r.pessoaId));
const representados = id => db.pessoas.filter(x => x.menor && (x.representantes || []).some(r => r.pessoaId === id));
function repTxt(p){
  if(!p?.menor) return ''; const rs = repsDe(p); if(!rs.length) return 'menor/incapaz — representante não informado';
  const a = idade(p.nascimento), verbo = a != null && a >= 16 && a < 18 ? 'assistido(a)' : 'representado(a)';
  return `${verbo} por ` + rs.map(r => `${pessoaNome(r.pessoaId)}${r.relacao ? ` (${r.relacao.toLowerCase()})` : ''}`).join(' e ');
}
const repSub = id => { const t = repTxt(byId('pessoas', id)); return t ? `<div class="small" style="color:var(--warn)">👶 ${esc(t)}</div>` : ''; };
const nomesReps = p => repsDe(p).map(r => pessoaNome(r.pessoaId)).join(' ');
function repEditor(f, p){
  const ck = f.elements.menor, wrap = f.querySelector('#repWrap'), box = f.querySelector('#repBox'), nasc = f.elements.nascimento;
  const row = r => `<div class="rep-row" style="display:flex;gap:6px;margin-bottom:6px"><select class="rp"><option value="">— escolha a pessoa —</option>${opts(pessoasOpts().filter(o => o.v !== p.id), r.pessoaId)}</select>
    <select class="rr" style="max-width:190px">${opts(OPT.relacao, r.relacao || OPT.relacao[0])}</select><button type="button" class="mini rm" title="Remover">✕</button></div>`;
  const add = r => box.insertAdjacentHTML('beforeend', row(r));
  (p.representantes || []).forEach(add);
  const vis = () => { wrap.style.display = ck.checked ? '' : 'none'; if(ck.checked && !box.children.length) add({}); };
  const idInfo = auto => { const a = idade(nasc.value), el = f.querySelector('#idadeInfo');
    el.innerHTML = a == null ? '' : `Idade: <b>${a} ano(s)</b>` + (a < 18 ? ` — completa 18 anos em <b>${fmtD(dataMaioridade(nasc.value))}</b>${a >= 16 ? ' · entre 16 e 18 anos: <b>assistido(a)</b>' : ''}` : '');
    if(auto && a != null && a < 18 && !ck.checked){ ck.checked = true; vis(); toast('Menor de idade: informe o representante legal'); } };
  ck.addEventListener('change', vis);
  nasc.addEventListener('change', () => idInfo(true));
  box.addEventListener('click', e => { if(e.target.classList.contains('rm')) e.target.closest('.rep-row').remove(); });
  f.querySelector('#addRep').onclick = () => add({});
  f.querySelector('#novoRep').onclick = () => { const nome = prompt('Nome do representante legal:'); if(!nome || !nome.trim()) return;
    const tel = prompt('Telefone / WhatsApp do representante (opcional):') || '';
    const np = upsert('pessoas', {nome:nome.trim(), tipo:'Representante legal', telefone:tel.trim()});
    const vazio = [...box.querySelectorAll('.rp')].find(x => !x.value);
    if(vazio){ vazio.insertAdjacentHTML('beforeend', `<option value="${np.id}">${esc(np.nome)}</option>`); vazio.value = np.id; } else add({pessoaId:np.id});
    toast(np.nome + ' cadastrado(a) — complete os dados depois na ficha'); };
  vis(); idInfo(false);
}

/* ----- Pessoa ----- */
function formPessoa(p = {}, tipoDef){
  openForm({ title: p.id ? 'Editar pessoa' : 'Nova pessoa', data: {tipo: tipoDef || 'Cliente', ...(p.id ? {} : novoClienteExtra(tipoDef || 'Cliente')), ...p},
    fields: [
      {k:'nome', label:'Nome completo / Razão social', req:true, full:true},
      {k:'tipo', label:'Tipo', type:'select', options:() => OPT.tipoPessoa, empty:false},
      {k:'pasta', label:'Nº da pasta', ph:'Ex.: 152'},
      {k:'dataContratacao', label:'Contratado em', type:'date'},
      {k:'doc', label:'CPF / CNPJ'},
      {k:'telefone', label:'Telefone / WhatsApp'},
      {k:'telefone2', label:'Outro telefone'},
      {k:'email', label:'E-mail', type:'email'},
      {k:'nascimento', label:'Nascimento', type:'date'},
      {k:'rg', label:'RG'},
      {k:'profissao', label:'Profissão'},
      {k:'estadoCivil', label:'Estado civil'},
      {k:'indicacao', label:'Indicado por'},
      {k:'endereco', label:'Endereço completo', full:true},
      {type:'sect', label:'👶 Representação legal'},
      {k:'menor', label:'Menor de idade ou incapaz (representado/assistido por responsável legal)', type:'check', full:true},
      {type:'html', html:`<div id="idadeInfo" class="small muted" style="margin-bottom:6px"></div><div id="repWrap"><div class="small muted" style="margin-bottom:6px">Representante(s) legal(is) — quem detém a guarda, tutela ou curatela:</div><div id="repBox"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mini" id="addRep">+ escolher pessoa já cadastrada</button><button type="button" class="mini" id="novoRep">+ cadastrar novo representante</button></div></div>`},
      {k:'obs', label:'Observações', type:'textarea', full:true},
    ],
    after: f => { repEditor(f, p); if(p.id) return; const tp = f.elements.tipo, pa = f.elements.pasta, dc = f.elements.dataContratacao;
      tp.addEventListener('change', () => { const ex = novoClienteExtra(tp.value); pa.value = ex.pasta || ''; dc.value = ex.dataContratacao || ''; }); },
    onSave: out => {
      if(out.pasta){ const dup = db.pessoas.find(x => x.id !== p.id && String(x.pasta || '').trim() === out.pasta);
        if(dup && !confirm(`A pasta ${out.pasta} já está cadastrada para ${dup.nome}. Salvar mesmo assim?`)) return false; }
      const vistos = new Set([p.id]);
      const representantes = out.menor ? [...mForm.querySelectorAll('.rep-row')].map(r => ({pessoaId:r.querySelector('.rp').value, relacao:r.querySelector('.rr').value})).filter(r => r.pessoaId && !vistos.has(r.pessoaId) && vistos.add(r.pessoaId)) : [];
      if(out.menor && !representantes.length && !confirm('Marcado como menor/incapaz, mas sem representante legal informado. Salvar assim mesmo?')) return false;
      const r = upsert('pessoas', {...p, ...out, representantes}); toast('Salvo'); if(!p.id) go('#/pessoa/' + r.id); },
    onDelete: p.id ? () => {
      const procs = db.processos.filter(x => envolve(x, p.id)).length;
      if(procs){ alert(`Esta pessoa está vinculada a ${procs} processo(s). Altere ou exclua os processos antes.`); return false; }
      const nc = db.conversas.filter(c => c.pessoaId === p.id).length, nh = db.financeiro.filter(h => h.pessoaId === p.id).length;
      if(!confirm(`Excluir ${p.nome}?` + (nc || nh ? `\n\nTambém serão excluídos: ${nc} conversa(s) e ${nh} lançamento(s) financeiros (inclusive acordos).` : ''))) return false;
      db.conversas = db.conversas.filter(c => c.pessoaId !== p.id); db.financeiro = db.financeiro.filter(h => h.pessoaId !== p.id); db.acordos = db.acordos.filter(a => a.pessoaId !== p.id);
      db.prazos.forEach(x => { if(x.pessoaId === p.id) x.pessoaId = ''; });
      db.pessoas.forEach(x => { if(x.representantes) x.representantes = x.representantes.filter(r => r.pessoaId !== p.id); });
      removeItem('pessoas', p.id); go('#/pessoas');
    } : null });
}
/* ----- Processo ----- */
const novasPessoas = new Set();
/* ===== Processos vinculados (cumprimento de sentença, agravo de instrumento, recursos, incidentes…) ===== */
const TIPOS_VINCULO = ['Cumprimento de sentença', 'Agravo de instrumento', 'Recurso', 'Embargos', 'Execução', 'Execução de honorários', 'Incidente', 'Apenso', 'Outro'];
const procVinculados = id => db.processos.filter(x => x.principalId === id).sort((a, b) => (procCode(a) || '').localeCompare(procCode(b) || '', 'pt-BR', {numeric:true}));
function procDescendentes(id){ const out = new Set(), fila = [id]; while(fila.length){ const k = fila.shift(); procVinculados(k).forEach(x => { if(!out.has(x.id)){ out.add(x.id); fila.push(x.id); } }); } return out; }
function procFamilia(p){ // processo principal (raiz) + todos os vinculados a ele, em qualquer nível
  let raiz = p, n = 0; while(raiz.principalId && byId('processos', raiz.principalId) && n++ < 10) raiz = byId('processos', raiz.principalId);
  return [raiz, ...[...procDescendentes(raiz.id)].map(id => byId('processos', id)).filter(Boolean)];
}
const rotuloVinculo = x => x.principalId ? (x.tipoVinculo || 'Vinculado') : 'Processo principal';
function formProc(p = {}, depois){
  openForm({ title: p.id ? 'Editar processo' : 'Novo processo', data: {status:'Ativo', ...(p.id ? {} : {dataInicio:today(), seq: p.clienteId ? nextSeq(p.clienteId) : ''}), ...p},
    fields: [
      {k:'titulo', label:'Ação / Assunto', req:true, ph:'Ex.: Ação de indenização por danos morais'},
      {k:'numero', label:'Número do processo', ph:'0000000-00.0000.0.00.0000'},
      {k:'principalId', label:'Vinculado ao processo principal (opcional)', type:'select', emptyLabel:'— nenhum: é um processo principal ou independente —',
        options:() => { const fora = p.id ? procDescendentes(p.id) : new Set(); return db.processos.filter(x => x.id !== p.id && !fora.has(x.id))
          .sort((a, b) => (procCode(a) || '').localeCompare(procCode(b) || '', 'pt-BR', {numeric:true})).map(x => ({v:x.id, t:procLabel(x) + ' · ' + pessoaNome(x.clienteId)})); }},
      {k:'tipoVinculo', label:'Tipo de vínculo', type:'select', options:() => TIPOS_VINCULO, emptyLabel:'—'},
      {k:'clienteId', label:'Cliente', type:'select', options:pessoasOpts, req:true, newP:'Cliente'},
      {k:'seq', label:'Ordem na pasta do cliente', ph:'1, 2, 3…'},
      {k:'dataInicio', label:'Início da minha atuação', type:'date'},
      {k:'posicao', label:'Posição do cliente', type:'select', options:() => OPT.posicao, lista:'posicao'},
      {k:'advContrario', label:'Advogado da parte contrária'},
      {type:'html', html:`<div class="sect" style="margin:0 0 6px">👥 Partes do processo</div>
        <div id="cliLine" class="small" style="margin-bottom:8px"></div>
        <div id="partesBox"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button type="button" class="mini" id="addParte">+ adicionar pessoa já cadastrada</button><button type="button" class="mini" id="novaParte">+ cadastrar nova pessoa como parte</button></div>
        <div id="legado" style="margin-top:8px"></div>`},
      {k:'outrasPartes', label:'Observações sobre as partes (texto livre)', full:true},
      {k:'area', label:'Área', type:'select', options:() => OPT.area, lista:'area'},
      ...(p.id ? [] : [{k:'modeloHon', label:'Honorários contratados (modelo)', type:'select', options:() => modelos().map((m, i) => ({v:String(i), t:m.nome})), emptyLabel:'— definir depois —'}]),
      {k:'status', label:'Situação', type:'select', options:() => OPT.statusProc, empty:false, lista:'statusProc'},
      {k:'tribunal', label:'Tribunal', ph:'TJSP, TRT-2, TRF-3…'},
      {k:'sistema', label:'Sistema em que tramita', type:'select', options:() => OPT.sistema, lista:'sistema'},
      {k:'vara', label:'Vara / Órgão'},
      {k:'comarca', label:'Comarca'},
      {k:'dataDistribuicao', label:'Distribuição', type:'date'},
      {k:'valorCausa', label:'Valor da causa (R$)', type:'number'},
      {k:'link', label:'Link de consulta', type:'url', ph:'https://…'},
      {k:'obs', label:'Observações / estratégia', type:'textarea', full:true},
    ],
    after: f => { novasPessoas.clear();
      if(f.elements.modeloHon) f.elements.area.addEventListener('change', () => { const i = modelos().findIndex(m => m.area && m.area === f.elements.area.value); if(i >= 0) f.elements.modeloHon.value = String(i); });
      const c = f.elements.clienteId, sq = f.elements.seq, pos = f.elements.posicao, box = f.querySelector('#partesBox'), op = f.elements.outrasPartes;
      c.addEventListener('change', () => { if(!p.id || c.value !== p.clienteId) sq.value = c.value ? nextSeq(c.value, p.id) : ''; else sq.value = p.seq || ''; });
      const rowHtml = x => `<div class="parte-row" style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap"><select class="pp" style="flex:2;min-width:200px"><option value="">— escolha a pessoa —</option>${opts(pessoasOpts(), x.pessoaId)}</select>
        <select class="pl" style="flex:1;min-width:190px">${opts(PAPEIS.map(({v, t}) => ({v, t})), x.polo)}</select>
        <select class="pde" data-cur="${esc(x.representaId || '')}" style="flex:1;min-width:170px;display:none" title="Representa quem?"></select><button type="button" class="mini rm" title="Remover esta parte">✕</button></div>`;
      const refreshDe = () => { const quem = [{v:c.value, t:pessoaNome(c.value) + ' (cliente)'}, ...[...box.querySelectorAll('.parte-row')].map(r => ({v:r.querySelector('.pp').value, t:pessoaNome(r.querySelector('.pp').value)}))].filter(o => o.v);
        box.querySelectorAll('.parte-row').forEach(r => { const pl = r.querySelector('.pl').value, de = r.querySelector('.pde'), me = r.querySelector('.pp').value;
          de.style.display = pl === 'representante' ? '' : 'none';
          const cur = de.value || de.dataset.cur; de.innerHTML = '<option value="">— representa quem? —</option>' + opts(quem.filter(o => o.v !== me), cur); }); };
      box.addEventListener('change', refreshDe); c.addEventListener('change', refreshDe);
      const addRow = x => { box.insertAdjacentHTML('beforeend', rowHtml({polo:poloOposto({posicao:pos.value}), ...x})); return box.lastElementChild; };
      const cliLine = () => { const pc = poloCliente({posicao:pos.value});
        f.querySelector('#cliLine').innerHTML = c.value ? `Cliente: <b>${esc(pessoaNome(c.value))}</b> — ${pc ? POLO_LBL[pc] : '<span class="muted">escolha a posição do cliente para definir o polo</span>'}. Inclua abaixo os demais autores, réus, representantes e outros participantes.` : '<span class="muted">Escolha o cliente acima. Inclua abaixo os demais autores, réus, representantes e outros participantes.</span>'; };
      (p.partes || []).forEach(x => addRow(x)); refreshDe();
      c.addEventListener('change', cliLine); pos.addEventListener('change', cliLine); cliLine();
      box.addEventListener('click', e => { if(e.target.classList.contains('rm')){ e.target.closest('.parte-row').remove(); legado(); } });
      box.addEventListener('change', legado);
      f.querySelector('#addParte').onclick = () => addRow({}).querySelector('.pp').focus();
      const criar = nome => { const ex = db.pessoas.find(x => norm_s(x.nome).trim() === norm_s(nome).trim()); if(ex) return ex; const n = upsert('pessoas', {nome:nome.trim(), tipo:'Parte contrária'}); novasPessoas.add(n.id); return n; };
      f.querySelector('#novaParte').onclick = () => { const nome = prompt('Nome da nova parte:'); if(!nome || !nome.trim()) return; const ps = criar(nome); addRow({pessoaId:ps.id}); toast(ps.nome + ' incluída como parte'); legado(); };
      // nomes digitados no campo antigo "outras partes" -> transformar em partes cadastradas
      function legado(){
        const tokens = (op.value || '').split(/[\n;]+|,(?![^(]*\))/).map(t => t.trim()).filter(t => t.length > 1);
        const inc = new Set([...box.querySelectorAll('.pp')].map(x => pessoaNome(x.value)).map(n => norm_s(n).trim()));
        const pend = tokens.filter(t => !inc.has(norm_s(t).trim()));
        f.querySelector('#legado').innerHTML = pend.length ? `<div class="calc" style="display:block">Nomes digitados em “observações / outras partes” que ainda não são partes cadastradas — clique para incluir:<br>${pend.map(t => `<button type="button" class="mini legTok" data-t="${esc(t)}" style="margin:4px 4px 0 0">+ ${esc(t)}</button>`).join('')}</div>` : '';
        f.querySelectorAll('.legTok').forEach(b => b.onclick = () => { const t = b.dataset.t, ps = criar(t); addRow({pessoaId:ps.id});
          op.value = (op.value || '').split(/[\n;]+|,(?![^(]*\))/).map(x => x.trim()).filter(x => x && x !== t).join('; ');
          toast(ps.nome + ' incluída — confira o polo'); legado(); });
      }
      op.addEventListener('input', legado); legado();
    },
    onSave: out => {
      const seen = new Set([out.clienteId]);
      const partes = [...mForm.querySelectorAll('.parte-row')].map(r => { const o = {pessoaId:r.querySelector('.pp').value, polo:r.querySelector('.pl').value}; if(o.polo === 'representante' && r.querySelector('.pde').value) o.representaId = r.querySelector('.pde').value; return o; })
        .filter(x => x.pessoaId && !seen.has(x.pessoaId) && seen.add(x.pessoaId));
      if('modeloHon' in out){ const m = modelos()[parseInt(out.modeloHon, 10)]; delete out.modeloHon;
        if(m) out.contrato = {data:today(), obs:'', itens:m.itens.map(it => ({...it, id:uid(), status:'pendente'}))}; }
      const pcN = poloCliente(out);
      partes.forEach(x => { if(novasPessoas.has(x.pessoaId)){ const ps = byId('pessoas', x.pessoaId); if(ps) ps.tipo = TIPO_POR_PAPEL[x.polo] || (x.polo === 'ativo' || x.polo === 'passivo' ? (pcN && x.polo === pcN ? 'Cliente' : 'Parte contrária') : 'Outro'); } });
      if(!out.principalId) out.tipoVinculo = '';
      const r = upsert('processos', {...p, ...out, partes}); toast('Salvo'); if(depois) depois(r); else if(!p.id) go('#/processo/' + r.id); },
    onDelete: p.id ? () => {
      const na = db.andamentos.filter(a => a.processoId === p.id).length;
      if(!confirm(`Excluir o processo "${procLabel(p)}"?\n\n${na} andamento(s) serão excluídos. Conversas, prazos e lançamentos financeiros serão mantidos, mas desvinculados do processo.`)) return false;
      db.andamentos = db.andamentos.filter(a => a.processoId !== p.id);
      ['conversas','prazos','financeiro','acordos'].forEach(c => db[c].forEach(x => { if(x.processoId === p.id) x.processoId = ''; }));
      db.processos.forEach(x => { if(x.principalId === p.id){ x.principalId = p.principalId || ''; if(!x.principalId) x.tipoVinculo = ''; } });
      removeItem('processos', p.id); go('#/processos');
    } : null });
}
/* ----- Conversa ----- */
function formConv(c = {}){
  const lead = byId('leads', c.leadId);
  const isNew = !c.id;
  const fields = [
    ...(isNew ? [{type:'html', html:iaBoxHtml()}] : []),
    {k:'dataHora', label:'Data e hora', type:'datetime-local', def:nowLocal(), req:true},
    {k:'canal', label:'Canal', type:'select', options:() => OPT.canal, def:'WhatsApp', empty:false, lista:'canal'},
    {k:'iniciadoPor', label:'Quem iniciou o contato?', type:'radio', options:[{v:'cliente', t:'O cliente'}, {v:'escritorio', t:'O escritório'}], def:'cliente'},
    {k:'categoria', label:'Categoria', type:'select', options:() => OPT.catAtend, lista:'catAtend', def:OPT.catAtend[0]},
  ];
  if(lead && !c.pessoaId) fields.push({type:'html', html:`<div class="small muted">Lead</div><b>🎯 ${esc(lead.nome)}</b>`});
  else fields.push({k:'pessoaId', label:'Cliente', type:'select', options:pessoasOpts, req:true, newP:'Cliente'},
                   {k:'processoId', label:'Processo (opcional)', type:'select', options:() => procOpts(c.pessoaId), emptyLabel:'— assunto geral —'});
  fields.push(
    {k:'assunto', label:'Assunto', full:true, ph:'Ex.: Cliente perguntou sobre a audiência'},
    {k:'relato', label:'O que foi conversado', type:'textarea', rows:6, req:true, full:true, ph:'Resumo da conversa, pedidos do cliente, orientações dadas, documentos solicitados…'},
    {type:'sect', label:'Retorno / próxima ação'},
    {k:'proximaAcao', label:'O que ficou combinado', ph:'Ex.: Enviar cópia da sentença; ligar após a perícia'},
    {k:'proximaData', label:'Até quando', type:'date'},
  );
  if(!isNew) fields.push({k:'retornoFeito', label:'Retorno já realizado', type:'check'});
  openForm({ title: isNew ? 'Registrar conversa' : 'Editar conversa', data:c, fields, focus: isNew ? (c.pessoaId || lead ? 'relato' : 'pessoaId') : undefined,
    after: f => { const ps = f.elements.pessoaId, pr = f.elements.processoId;
      if(ps && pr) ps.addEventListener('change', () => { const cur = pr.value; pr.innerHTML = '<option value="">— assunto geral —</option>' + opts(procOpts(ps.value), cur); });
      if(isNew) iaMontar(f, 'conversa', (f, r, txt) => {
        const dh = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(r.data_hora || '') ? r.data_hora : '';
        iaSet(f, 'dataHora', dh); iaSet(f, 'canal', r.canal); iaSet(f, 'categoria', r.categoria); iaSet(f, 'assunto', r.assunto); iaSet(f, 'relato', r.relato);
        iaSet(f, 'proximaAcao', r.proxima_acao); iaSet(f, 'proximaData', iaData(r.proxima_data));
        if(r.iniciado_por){ const rd = f.querySelector(`[name="iniciadoPor"][value="${r.iniciado_por}"]`); if(rd){ rd.checked = true; rd.closest('.fld').classList.add('iaFill'); } }
        let aviso = '';
        if(ps){ const proc = iaAcharProcesso(r.numero_processo, txt), pes = proc ? byId('pessoas', proc.clienteId) : iaAcharPessoa(r.nome_cliente);
          if(pes && !ps.value){ iaSet(f, 'pessoaId', pes.id); }
          if(proc && pr){ pr.innerHTML = '<option value="">— assunto geral —</option>' + opts(procOpts(ps.value), proc.id); iaSet(f, 'processoId', proc.id); }
          if(!ps.value) aviso = r.nome_cliente ? `<div class="small" style="margin-top:8px;color:var(--warn)">⚠️ Não encontrei “${esc(r.nome_cliente)}” entre os clientes — escolha o cliente (ou use “+ nova”).</div>` : '<div class="small" style="margin-top:8px;color:var(--warn)">⚠️ Escolha o cliente no formulário.</div>'; }
        return aviso;
      }); },
    onSave: out => { upsert('conversas', {...c, ...out}); toast('Conversa registrada'); },
    onDelete: !isNew ? () => { if(!confirm('Excluir este registro de conversa?')) return false; removeItem('conversas', c.id); } : null });
}
/* ----- Andamento ----- */
function formAnd(a = {}, depois){
  const isNew = !a.id;
  const fields = [
    ...(isNew ? [{type:'html', html:iaBoxHtml()}] : []),
    ...(isNew && !a.processoId ? [{k:'processoId', label:'Processo', type:'select', options:() => procOpts(), req:true, full:true}] : []),
    {k:'data', label:'Data', type:'date', def:today(), req:true},
    {k:'tipo', label:'Tipo', type:'select', options:() => OPT.tipoAnd, lista:'tipoAnd'},
    {k:'descricao', label:'Descrição do andamento', type:'textarea', rows:5, req:true, full:true},
  ];
  if(isNew) fields.push({type:'sect', label:'Este andamento gera prazo? (opcional)'},
    {k:'prazoTitulo', label:'Prazo para', ph:'Ex.: Contestação, Réplica, Recurso…'},
    {k:'prazoData', label:'Vencimento', type:'date'},
    {type:'html', html:calcHtml('prazoData')});
  openForm({ title: isNew ? 'Novo andamento' : 'Editar andamento', data:a, fields,
    after: f => { if(isNew) iaMontar(f, 'andamento', (f, r, txt) => {
      iaSet(f, 'data', iaData(r.data)); iaSet(f, 'tipo', r.tipo); iaSet(f, 'descricao', r.descricao);
      let nota = '';
      if(r.gera_prazo){ const c = iaCalcPrazo({data:r.prazo_data, data_referencia_prazo:r.data_referencia_prazo, prazo_dias:r.prazo_dias, contagem:r.contagem});
        iaSet(f, 'prazoTitulo', r.prazo_titulo || 'Prazo'); iaSet(f, 'prazoData', c.data); nota = c.nota; }
      const proc = iaAcharProcesso(r.numero_processo, txt), atual = byId('processos', a.processoId);
      if(!a.processoId && proc) iaSet(f, 'processoId', proc.id);
      return `${nota ? `<div class="small" style="margin-top:8px">🧮 ${esc(nota)}</div>` : ''}${r.gera_prazo ? '' : '<div class="small muted" style="margin-top:6px">A IA não identificou prazo aberto por este andamento.</div>'}
        ${proc && atual && proc.id !== atual.id ? `<div class="small" style="margin-top:8px;color:var(--bad)">⚠️ Atenção: o texto parece ser do processo <b>${esc(procLabel(proc))}</b>, não deste.</div>` : ''}`;
    }); },
    onSave: out => { const {prazoTitulo, prazoData, ...rest} = out; const salvoAnd = upsert('andamentos', {...a, ...rest}); if(depois) depois(salvoAnd);
      const pidA = rest.processoId || a.processoId;
      if(prazoData){ const proc = byId('processos', pidA);
        upsert('prazos', {situacao:'Pendente', coluna:'tarefas', dataFatal:prazoData, titulo: prazoTitulo || 'Prazo', tipo:'Prazo processual', data: prazoData, processoId: pidA, pessoaId: proc?.clienteId || '', obs: rest.descricao.slice(0, 300), concluido:false});
        toast('Andamento e prazo salvos'); } else toast('Andamento salvo'); },
    onDelete: !isNew ? () => { if(!confirm('Excluir este andamento?')) return false; removeItem('andamentos', a.id); } : null });
}
/* ----- Prazo ----- */
const atrasado = p => !p.concluido && ((p.data && p.data < today()) || (p.dataFatal && p.dataFatal < today()));
function proximoDiaParaReag(){ let d = today(); while(!isBusiness(d, false)) d = addDays(d, 1); return d; }
function reagendarPendentes(){
  const cfg = painelCfg().reag; if(!cfg.ativo) return 0;
  const t = today(), alvo = proximoDiaParaReag(); let n = 0;
  db.prazos.forEach(p => {
    if(p.concluido || !p.data || p.data >= t || !cfg.tipos[p.tipo]) return;
    const ag = p.agendaEnviada && p.agendaEnviada === pzKey(p), cl = p.clienteAvisado && p.clienteAvisado === pzKey(p);
    const dur = p.dataFim && p.dataFim > p.data ? Math.round((parseD(p.dataFim) - parseD(p.data)) / 86400000) : 0;
    if(!p.reagendadoDe) p.reagendadoDe = p.data;
    if(p.tipo === 'Prazo processual' && !p.dataFatal) p.dataFatal = p.data;
    p.data = alvo; p.dataFim = dur ? addDays(alvo, dur) : (p.dataFim ? alvo : '');
    p.reagendamentos = (p.reagendamentos || 0) + 1;
    if(ag) p.agendaEnviada = pzKey(p); if(cl) p.clienteAvisado = pzKey(p);
    n++;
  });
  if(n){ save(); try{ if(localStorage.getItem('escritorio_reag_aviso') !== t){ localStorage.setItem('escritorio_reag_aviso', t); setTimeout(() => toast(`🔁 ${n} item(ns) não concluído(s) foram reagendados para ${alvo === t ? 'hoje' : fmtD(alvo)}`), 600); } }catch(e){} }
  return n;
}
const pzKey = p => [p.data || '', p.diaInteiro ? '' : (p.hora || ''), p.dataFim || '', p.diaInteiro ? '' : (p.horaFim || '')].join('|');
const TIPOS_CLIENTE = ['Audiência','Perícia','Reunião'];
function colunaAuto(p){ if(!p.data) return 'analise'; if(['Audiência','Perícia'].includes(p.tipo)) return 'audiencias'; if(['Prazo processual','Tarefa'].includes(p.tipo)) return 'tarefas'; return 'analise'; }
function colunaDe(p){ const cs = colunas(); if(cs.some(c => c.id === p.coluna)) return p.coluna; const a = colunaAuto(p); return cs.some(c => c.id === a) ? a : cs[0].id; }
const agendaDesatualizada = p => !!p.agendaEnviada && p.agendaEnviada !== pzKey(p) && !p.concluido;
const clienteDesatualizado = p => !!p.clienteAvisado && p.clienteAvisado !== pzKey(p) && !p.concluido;
const horaTxt = p => p.diaInteiro ? 'dia inteiro' : p.hora ? p.hora + (p.horaFim ? '–' + p.horaFim : '') : '';
function reagSelo(p){
  const a = [];
  if(p.dataFatal && !p.concluido) a.push(`<span class="tag ${p.dataFatal < today() ? 'bad' : p.dataFatal === today() ? 'warn' : 'grey'}" title="Data legal do prazo">⚠️ prazo fatal: ${fmtD(p.dataFatal)}${p.dataFatal < today() ? ' (vencido)' : p.dataFatal === today() ? ' (hoje)' : ''}</span>`);
  if(p.reagendadoDe && !p.concluido && p.reagendadoDe !== p.data) a.push(`<span class="tag grey" title="Reagendado automaticamente por não ter sido concluído">🔁 reagendado de ${fmtD(p.reagendadoDe)}${p.reagendamentos > 1 ? ` (${p.reagendamentos}×)` : ''}</span>`);
  return a.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${a.join('')}</div>` : '';
}
function avisosPrazo(p){
  const a = [];
  if(agendaDesatualizada(p)) a.push(`<button class="mini" style="color:var(--warn);border-color:var(--warn)" data-act="posPrazo" data-id="${p.id}">⚠️ data mudou — atualizar agenda do celular</button>`);
  if(clienteDesatualizado(p)) a.push(`<button class="mini" style="color:var(--warn);border-color:var(--warn)" data-act="avisarWhats" data-id="${p.id}" data-mod="nova">⚠️ avisar o cliente da nova data</button>`);
  return a.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${a.join('')}</div>` : '';
}
function formPrazo(p = {}, depois){
  const isNew = !p.id;
  const dados = {tipo:'Prazo processual', situacao:'Pendente', ...p};
  openForm({ title: isNew ? 'Novo compromisso / tarefa' : 'Editar compromisso / tarefa', data:dados,
    fields: [
      ...(isNew ? [{type:'html', html:iaBoxHtml()}] : []),
      {k:'titulo', label:'Descrição', req:true, full:true, ph:'Ex.: Contestação, Audiência de conciliação, Reunião com cliente'},
      {k:'tipo', label:'Tipo', type:'select', options:() => OPT.tipoPrazo, empty:false, lista:'tipoPrazo'},
      {k:'subtipo', label:'Subtipo', type:'select', options:() => OPT.subtipo, lista:'subtipo', emptyLabel:'—'},
      {k:'situacao', label:'Situação', type:'select', options:() => OPT.situacao, empty:false},
      {k:'coluna', label:'Coluna no quadro', type:'select', options:() => colunas().filter(c => !c.oculto).map(c => ({v:c.id, t:c.v})), emptyLabel:'— automática (pelo tipo / data) —'},
      {k:'novaData', label:'Nova data (redesignação) *', type:'date'},
      {k:'novaHora', label:'Novo horário', type:'time'},
      {k:'data', label:'Data de início (em branco = tarefa sem data)', type:'date'},
      {k:'hora', label:'Hora de início', type:'time'},
      {k:'dataFatal', label:'Prazo fatal (data legal — prazos processuais)', type:'date'},
      {k:'dataFim', label:'Data de término', type:'date'},
      {k:'horaFim', label:'Hora de término', type:'time'},
      {k:'diaInteiro', label:'Dia inteiro (sem horário)', type:'check'},
      {type:'html', html:calcHtml('data')},
      {k:'local', label:'Local / link'},
      {k:'processoId', label:'Processo', type:'select', options:() => procOpts()},
      {k:'pessoaId', label:'Cliente / pessoa', type:'select', options:pessoasOpts},
      {k:'obs', label:'Observações', type:'textarea', full:true},
      {type:'html', html:`<div class="sect" style="margin:0 0 6px">☑ Lista de verificação (checklist)</div><div id="ckBox"></div>
        <div style="display:flex;gap:6px;margin-top:4px"><input id="ckNovo" placeholder="Novo item — ex.: arrolar testemunhas (Enter para incluir)"><button type="button" class="mini" id="ckAdd">+ incluir</button></div>`},
      ...(isNew ? [] : [{type:'html', html:`<div style="background:var(--priSoft);border-radius:10px;padding:10px 12px"><b class="small">Agenda do celular e aviso ao cliente</b>${p.agendaEnviada ? ` <span class="small muted">· enviado à agenda</span>` : ''}${p.clienteAvisado ? ` <span class="small muted">· cliente avisado</span>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" id="fpAgenda">📅 Adicionar à agenda</button><button type="button" class="btn" id="fpWhats" style="border-color:#25d366;color:#128c3e">🟢 Avisar o cliente pelo WhatsApp</button></div>
        <div class="small muted" style="margin-top:4px">Usam os dados já salvos. Se alterar a data agora, salve primeiro — o sistema vai lembrar de atualizar.</div></div>`}]),
    ],
    after: f => {
      const pr = f.elements.processoId, ps = f.elements.pessoaId, di = f.elements.diaInteiro, sit = f.elements.situacao;
      pr.addEventListener('change', () => { const proc = byId('processos', pr.value); if(proc && !ps.value) ps.value = proc.clienteId; });
      const showFld = (n, on) => { const el = f.elements[n]; if(el) el.closest('.fld').style.display = on ? '' : 'none'; };
      const upd = () => { ['hora','horaFim'].forEach(n => showFld(n, !di.checked)); showFld('dataFatal', f.elements.tipo.value === 'Prazo processual'); const r = sit.value === 'Redesignado' && p.situacao !== 'Redesignado'; showFld('novaData', r); showFld('novaHora', r && !di.checked); };
      di.addEventListener('change', upd); sit.addEventListener('change', upd); f.elements.tipo.addEventListener('change', upd); upd();
      f.elements.data.addEventListener('change', () => { const df = f.elements.dataFim; if(!df.value || df.value < f.elements.data.value) df.value = f.elements.data.value; });
      // checklist
      const box = f.querySelector('#ckBox'), row = c => `<div class="ckRow" style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="ckOk" ${c.ok ? 'checked' : ''}><input class="ckT" value="${esc(c.t)}" style="flex:1"><button type="button" class="mini ckUp" title="Subir">▲</button><button type="button" class="mini ckDel" title="Remover">✕</button></div>`;
      box.innerHTML = (p.checklist || []).map(row).join('');
      const add = () => { const v = f.querySelector('#ckNovo').value.trim(); if(!v) return; box.insertAdjacentHTML('beforeend', row({t:v, ok:false})); f.querySelector('#ckNovo').value = ''; f.querySelector('#ckNovo').focus(); };
      f._ckSet = itens => { box.innerHTML = itens.map(t => row({t, ok:false})).join(''); };
      if(isNew) iaMontar(f, 'prazo', (f, r, txt) => {
        const itens = (r.itens || []).filter(it => it.titulo || it.data || it.prazo_dias); if(!itens.length) throw new Error('a IA não encontrou prazo ou compromisso neste conteúdo' + (r.observacao_geral ? ' — ' + r.observacao_geral : ''));
        const p0 = iaItemParaPrazo(itens[0], txt);
        ['titulo','tipo','subtipo','data','hora','dataFim','horaFim','local','processoId','pessoaId','obs'].forEach(k => iaSet(f, k, p0[k]));
        if(p0.diaInteiro) iaSet(f, 'diaInteiro', true);
        iaSet(f, 'coluna', p0.coluna);
        if(p0.checklist.length) f._ckSet(p0.checklist.map(c => c.t));
        f._iaExtras = itens.slice(1).map(it => iaItemParaPrazo(it, txt));
        const proc = byId('processos', p0.processoId), nota0 = iaCalcPrazo(itens[0]).nota;
        return `${nota0 ? `<div class="small" style="margin-top:8px">🧮 ${esc(nota0)}</div>` : ''}${proc ? `<div class="small" style="margin-top:8px">📁 Processo encontrado: <b>${esc(procLabel(proc))}</b></div>` : (itens[0].numero_processo ? `<div class="small" style="margin-top:8px;color:var(--warn)">⚠️ Processo ${esc(itens[0].numero_processo)} não está cadastrado — escolha o processo no formulário.</div>` : '')}
          ${f._iaExtras.length ? `<div class="small" style="margin-top:8px"><b>A IA também encontrou:</b>${f._iaExtras.map((x, i) => `<label class="chk small" style="margin-top:4px"><input type="checkbox" class="iaExtra" data-i="${i}" checked> ${esc(x.titulo)} — ${x.data ? fmtD(x.data) : 'sem data'}${x.hora ? ' às ' + x.hora : ''} <span class="muted">(${esc(x.tipo)})</span></label>`).join('')}<div class="muted">Os marcados serão criados junto quando você salvar.</div></div>` : ''}
          ${r.observacao_geral ? `<div class="small muted" style="margin-top:6px">${esc(r.observacao_geral)}</div>` : ''}`;
      });
      f.querySelector('#ckAdd').onclick = add;
      f.querySelector('#ckNovo').addEventListener('keydown', e => { if(e.key === 'Enter'){ e.preventDefault(); add(); } });
      box.addEventListener('click', e => { const r = e.target.closest('.ckRow'); if(e.target.classList.contains('ckDel')) r.remove(); if(e.target.classList.contains('ckUp') && r.previousElementSibling) box.insertBefore(r, r.previousElementSibling); });
      if(!isNew){ f.querySelector('#fpAgenda').onclick = () => { closeModal(); posPrazo(p.id, 'agenda'); }; f.querySelector('#fpWhats').onclick = () => { closeModal(); formWhats(p.id); }; }
    },
    onSave: out => {
      const {novaData, novaHora, ...rest} = out;
      const checklist = [...mForm.querySelectorAll('.ckRow')].map(r => ({t:r.querySelector('.ckT').value.trim(), ok:r.querySelector('.ckOk').checked})).filter(c => c.t);
      const pend = mForm.querySelector('#ckNovo')?.value.trim(); if(pend) checklist.push({t:pend, ok:false});
      const rec = {...p, ...rest, checklist};
      if(rec.diaInteiro){ rec.hora = ''; rec.horaFim = ''; }
      if(rec.dataFim && rec.data && rec.dataFim < rec.data) rec.dataFim = rec.data;
      if(!rec.data) rec.dataFim = '';
      const redesignar = rec.situacao === 'Redesignado' && p.situacao !== 'Redesignado';
      if(redesignar && !novaData){ toast('Informe a nova data da redesignação'); return false; }
      if(rec.situacao === 'Pendente' && checklist.length && checklist.every(c => c.ok) && (p.checklist || []).some(c => !c.ok) && confirm('Todos os itens da lista de verificação foram marcados. Deseja marcar o compromisso como realizado?')) rec.situacao = 'Realizado';
      rec.concluido = rec.situacao !== 'Pendente'; rec.concluidoEm = rec.concluido ? (p.concluidoEm || today()) : '';
      if(!rec.coluna) rec.coluna = colunaAuto(rec);
      if(rec.tipo === 'Prazo processual' && !rec.dataFatal && rec.data) rec.dataFatal = rec.data;
      if(rec.tipo !== 'Prazo processual') rec.dataFatal = '';
      if(p.data !== rec.data){ rec.reagendadoDe = ''; rec.reagendamentos = 0; }
      let novo = null;
      if(redesignar){
        rec.obs = [rec.obs, `Redesignado para ${fmtD(novaData)}${novaHora ? ' às ' + novaHora : ''}.`].filter(Boolean).join('\n');
        const dur = rec.data && rec.dataFim ? Math.round((parseD(rec.dataFim) - parseD(rec.data)) / 86400000) : 0;
        const {id, criadoEm, concluidoEm, ...base} = rec;
        novo = {...base, situacao:'Pendente', concluido:false, concluidoEm:'', data:novaData, dataFim: dur ? addDays(novaData, dur) : '', hora: novaHora || rec.hora, redesignadoDe:p.id || '',
          obs:(p.obs || ''), agendaEnviada: rec.agendaEnviada ? 'redesignado' : '', clienteAvisado: rec.clienteAvisado ? 'redesignado' : ''};
      }
      const salvo = upsert('prazos', rec); if(depois) depois(salvo);
      const extras = (mForm._iaExtras || []).filter((x, i) => mForm.querySelector(`.iaExtra[data-i="${i}"]`)?.checked);
      extras.forEach(x => upsert('prazos', {...x, processoId:x.processoId || rec.processoId || '', pessoaId:x.pessoaId || rec.pessoaId || ''}));
      if(extras.length) setTimeout(() => toast(`${extras.length + 1} compromissos criados a partir do conteúdo`), 300);
      if(novo){ const n = upsert('prazos', novo); toast('Redesignado — novo compromisso criado para ' + fmtD(novaData)); if(TIPOS_CLIENTE.includes(n.tipo) || n.agendaEnviada || n.clienteAvisado) setTimeout(() => posPrazo(n.id, 'nova'), 150); return; }
      toast('Salvo');
      const mudou = !isNew && pzKey(p) !== pzKey(salvo) && !salvo.concluido && salvo.data;
      if(mudou && (salvo.agendaEnviada || salvo.clienteAvisado || TIPOS_CLIENTE.includes(salvo.tipo))) setTimeout(() => posPrazo(salvo.id, 'mudou'), 150);
      else if(isNew && salvo.data && TIPOS_CLIENTE.includes(salvo.tipo)) setTimeout(() => posPrazo(salvo.id, 'novo'), 150);
    },
    onDelete: !isNew ? () => { if(!confirm('Excluir este compromisso?')) return false; removeItem('prazos', p.id); } : null });
}
/* ----- agenda do celular (Google / Outlook / iPhone) ----- */
const somaHora = h => { const [a, b] = h.split(':').map(Number), m = Math.min(a * 60 + b + 60, 23 * 60 + 59); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
function descAgenda(p){ const pes = byId('pessoas', p.pessoaId), proc = byId('processos', p.processoId);
  return [pes ? 'Cliente: ' + pes.nome : '', proc ? 'Processo: ' + procLabel(proc) : '', p.subtipo ? 'Subtipo: ' + p.subtipo : '', p.obs || ''].filter(Boolean).join('\n'); }
function googleUrl(p){
  const f = (d, h) => d.replace(/-/g, '') + (h ? 'T' + h.replace(':', '') + '00' : ''), fim = p.dataFim || p.data;
  const dates = p.diaInteiro || !p.hora ? f(p.data) + '/' + f(addDays(fim, 1)) : f(p.data, p.hora) + '/' + f(fim, p.horaFim || somaHora(p.hora));
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({action:'TEMPLATE', text:p.titulo, dates, ctz:'America/Sao_Paulo', details:descAgenda(p), location:p.local || ''});
}
function baixarIcs(p){
  const f = (d, h) => d.replace(/-/g, '') + (h ? 'T' + h.replace(':', '') + '00' : ''), fim = p.dataFim || p.data, e = x => String(x || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const timed = !(p.diaInteiro || !p.hora), agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const seq = (p.agendaSeq || 0) + 1;
  const L2 = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Escritorio GG//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT', 'UID:' + p.id + '@escritorio-gg', 'SEQUENCE:' + seq, 'DTSTAMP:' + agora,
    timed ? 'DTSTART:' + f(p.data, p.hora) : 'DTSTART;VALUE=DATE:' + f(p.data), timed ? 'DTEND:' + f(fim, p.horaFim || somaHora(p.hora)) : 'DTEND;VALUE=DATE:' + f(addDays(fim, 1)),
    'SUMMARY:' + e(p.titulo), 'LOCATION:' + e(p.local), 'DESCRIPTION:' + e(descAgenda(p)),
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(p.titulo), 'TRIGGER:-P1D', 'END:VALARM'];
  if(timed) L2.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + e(p.titulo), 'TRIGGER:-PT2H', 'END:VALARM');
  L2.push('END:VEVENT', 'END:VCALENDAR');
  download(`compromisso-${p.data}.ics`, L2.join('\r\n'), 'text/calendar;charset=utf-8');
  return seq;
}
function posPrazo(id, modo){
  const p = byId('prazos', id); if(!p) return;
  if(!p.data){ toast('Defina a data do compromisso primeiro'); return; }
  const titulo = {mudou:'⚠️ A data mudou', nova:'🔁 Compromisso redesignado', novo:'✔ Compromisso salvo', agenda:'📅 Adicionar à agenda'}[modo] || '📅 Agenda e aviso';
  const txt = modo === 'mudou' || modo === 'nova' ? `<p><b>${esc(p.titulo)}</b> agora é em <b>${fmtD(p.data)}${horaTxt(p) ? ' · ' + horaTxt(p) : ''}</b>.</p>
      ${p.agendaEnviada ? '<p>⚠️ Este compromisso já tinha sido enviado à agenda do celular — <b>envie novamente</b> para atualizar (e apague o antigo, se ficar duplicado).</p>' : ''}
      ${p.clienteAvisado ? '<p>⚠️ O cliente tinha sido avisado da data anterior — <b>avise da nova data</b>.</p>' : ''}`
    : `<p><b>${esc(p.titulo)}</b> — ${fmtD(p.data)}${horaTxt(p) ? ' · ' + horaTxt(p) : ''}${p.local ? ' · ' + esc(p.local) : ''}</p>`;
  openForm({ title:titulo, soFechar:true, fields:[{type:'html', html:`${txt}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="ppGoogle">📅 Google Agenda</button><button type="button" class="btn" id="ppIcs">📅 Outlook / iPhone (arquivo .ics)</button>
    ${p.pessoaId || byId('processos', p.processoId)?.clienteId ? `<button type="button" class="btn" id="ppWhats" style="border-color:#25d366;color:#128c3e">🟢 Avisar o cliente pelo WhatsApp</button>` : ''}</div>
    <p class="small muted" style="margin-top:8px">O arquivo .ics abre no Outlook (Windows) ou no Calendário (iPhone), com alertas 1 dia e 2 horas antes. Se a data mudar depois, o sistema lembra de enviar de novo.</p>`}],
    after: f => {
      const marca = extra => { upsert('prazos', {id, agendaEnviada:pzKey(byId('prazos', id)), ...extra}); toast('Marcado como enviado à agenda'); };
      f.querySelector('#ppGoogle').onclick = () => { window.open(googleUrl(p), '_blank', 'noopener'); marca({}); };
      f.querySelector('#ppIcs').onclick = () => { const seq = baixarIcs(p); marca({agendaSeq:seq}); };
      const w = f.querySelector('#ppWhats'); if(w) w.onclick = () => { closeModal(); formWhats(id, modo === 'mudou' || modo === 'nova' ? 'nova' : 'aviso'); };
    } });
}
/* ----- aviso ao cliente pelo WhatsApp (mensagem pronta) ----- */
function destinatarioWhats(p){
  const proc = byId('processos', p.processoId), cli = byId('pessoas', p.pessoaId || proc?.clienteId); if(!cli) return null;
  if(cli.menor){ const r = repsDe(cli).map(x => ({...x, pes:byId('pessoas', x.pessoaId)})).find(x => digits(x.pes?.telefone).length >= 10);
    if(r) return {cli, dest:r.pes, via:`via representante <b>${esc(r.pes.nome)}</b>${r.relacao ? ' (' + esc(r.relacao.toLowerCase()) + ')' : ''}`}; }
  return {cli, dest:cli, via:''};
}
function preencherMsg(tpl, p, d){
  const proc = byId('processos', p.processoId), dt = p.data ? parseD(p.data) : null, prim = n => String(n || '').trim().split(/\s+/)[0] || '';
  const map = {nome:prim(d.dest.nome), cliente:d.cli.nome, compromisso:p.titulo + (p.subtipo && !norm_s(p.titulo).includes(norm_s(p.subtipo)) ? ' (' + p.subtipo + ')' : ''),
    processo: proc ? ` — processo ${proc.titulo || ''}${proc.numero ? ' nº ' + proc.numero : ''}` : '',
    data:fmtD(p.data), dia_semana: dt ? dt.toLocaleDateString('pt-BR', {weekday:'long'}) : '', hora: p.diaInteiro || !p.hora ? '' : ', às ' + p.hora.replace(':', 'h'),
    local:p.local || 'local a confirmar', observacoes:p.obs || ''};
  return tpl.replace(/\{(\w+)\}/g, (m, k) => k in map ? map[k] : m).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function formWhats(id, modId){
  const p = byId('prazos', id); if(!p) return;
  const d = destinatarioWhats(p); if(!d) return alert('Este compromisso não tem cliente vinculado. Edite-o e informe o cliente ou o processo.');
  const ms = modelosMsg(), m0 = ms.find(x => x.id === modId) || ms[0], tel = digits(d.dest.telefone);
  let registrado = false;
  openForm({ title:'🟢 Avisar o cliente pelo WhatsApp', soFechar:true, fields:[{type:'html', html:`
    <div class="small muted">Para</div><div><b>${esc(d.cli.nome)}</b>${d.via ? ' — ' + d.via : ''} · ${tel ? esc(d.dest.telefone) : '<span style="color:var(--bad)">sem telefone cadastrado</span>'}</div>
    <div class="fld" style="margin-top:10px"><label>Modelo de mensagem</label><div class="row"><select id="wMod">${opts(ms.map(x => ({v:x.id, t:x.v})), m0.id)}</select><a class="mini" href="#/listas/msgs" id="wEdit" style="white-space:nowrap">✏️ editar modelos</a></div></div>
    <div class="fld" style="margin-top:10px"><label>Mensagem (pode ajustar antes de enviar)</label><textarea id="wTxt" rows="11">${esc(preencherMsg(m0.texto, p, d))}</textarea></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="wReg" checked> Registrar este aviso no histórico de atendimentos do cliente</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${tel ? `<a class="btn" id="wAbrir" target="_blank" rel="noopener" style="background:#25d366;border-color:#25d366;color:#fff;text-decoration:none">Abrir no WhatsApp</a>` : ''}<button type="button" class="btn" id="wCopiar">📋 Copiar mensagem</button></div>
    <div class="small muted" style="margin-top:6px">O WhatsApp abre (no computador ou no celular) já na conversa, com o texto pronto — é só tocar em enviar.</div>`}],
    after: f => {
      const txt = f.querySelector('#wTxt'), a = f.querySelector('#wAbrir');
      const link = () => { if(a){ let n = tel; if(!n.startsWith('55')) n = '55' + n; a.href = `https://wa.me/${n}?text=${encodeURIComponent(txt.value)}`; } };
      link(); txt.addEventListener('input', link);
      f.querySelector('#wMod').addEventListener('change', e => { const m = ms.find(x => x.id === e.target.value); txt.value = preencherMsg(m.texto, p, d); link(); });
      f.querySelector('#wEdit').onclick = () => closeModal();
      const registrar = () => { if(registrado) return; registrado = true;
        const extra = {clienteAvisado:pzKey(byId('prazos', id))};
        if(f.querySelector('#wReg').checked){ const proc = byId('processos', p.processoId);
          upsert('conversas', {pessoaId:d.cli.id, processoId:p.processoId || '', dataHora:nowLocal(), canal:'WhatsApp', iniciadoPor:'escritorio', categoria:OPT.catAtend.includes('Agendamento') ? 'Agendamento' : '', assunto:'Aviso: ' + p.titulo, relato:txt.value}); }
        upsert('prazos', {id, ...extra}); toast('Aviso registrado'); };
      if(a) a.addEventListener('click', registrar);
      f.querySelector('#wCopiar').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(txt.value) : Promise.reject()).then(() => toast('Mensagem copiada'), () => { txt.select(); document.execCommand('copy'); toast('Mensagem copiada'); }); registrar(); };
    } });
}
/* ----- Lead ----- */
function formLead(l = {}){
  const isNew = !l.id;
  openForm({ title: isNew ? 'Novo lead' : 'Editar lead', data:{status:'Novo', ...l},
    fields: [
      {k:'nome', label:'Nome', req:true},
      {k:'telefone', label:'Telefone / WhatsApp'},
      {k:'email', label:'E-mail', type:'email'},
      {k:'origem', label:'Origem', type:'select', options:() => OPT.origemLead, lista:'origemLead'},
      {k:'indicadoPor', label:'Indicado por'},
      {k:'area', label:'Área', type:'select', options:() => OPT.area, lista:'area'},
      {k:'status', label:'Etapa', type:'select', options:() => OPT.statusLead, empty:false},
      {k:'proximoContato', label:'Próximo contato', type:'date'},
      {k:'valorEstimado', label:'Honorários estimados (R$)', type:'number'},
      {k:'motivoPerda', label:'Motivo da perda (se perdido)'},
      {k:'descricao', label:'Resumo do caso', type:'textarea', rows:4, full:true},
    ],
    onSave: out => { const r = upsert('leads', {...l, ...out}); toast('Salvo'); if(isNew) go('#/lead/' + r.id); },
    onDelete: !isNew ? () => { if(!confirm('Excluir este lead e suas anotações de contato?')) return false;
      db.conversas = db.conversas.filter(c => !(c.leadId === l.id && !c.pessoaId)); removeItem('leads', l.id); go('#/leads'); } : null });
}
function convertLead(id){
  const l = byId('leads', id); if(!l) return;
  if(l.pessoaId && byId('pessoas', l.pessoaId)) return go('#/pessoa/' + l.pessoaId);
  if(!confirm(`Converter "${l.nome}" em cliente?\n\nSerá criada a ficha do cliente e todo o histórico de contatos será levado para ela.`)) return;
  const p = upsert('pessoas', {nome:l.nome, tipo:'Cliente', ...novoClienteExtra('Cliente'), telefone:l.telefone || '', email:l.email || '', indicacao:l.indicadoPor || l.origem || '', obs:l.descricao || ''});
  db.conversas.forEach(c => { if(c.leadId === l.id) c.pessoaId = p.id; });
  upsert('leads', {id:l.id, status:'Fechado', pessoaId:p.id, fechadoEm:today()});
  toast('Cliente criado'); go('#/pessoa/' + p.id);
}
/* ----- Financeiro ----- */
