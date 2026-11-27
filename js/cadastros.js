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
function formPessoa(p = {}, tipoDef, depois){
  const tels0 = [...(p.telefones || []), ...(p.telefone2 ? [{tipo:'Outro', numero:p.telefone2}] : [])];
  openForm({ title: p.id ? 'Editar pessoa' : 'Nova pessoa', data: {tipo: tipoDef || 'Cliente', natureza:'Física', ...(p.id ? {} : novoClienteExtra(tipoDef || 'Cliente')), ...p,
      doc:fmtDoc(p.doc), ...(p.pasta ? {pasta:pastaFmt(p.pasta)} : {}), telefone:fmtTel(p.telefone), _tels:tels0},
    fields: [
      {type:'grupo', label:'👤 Identificação'},
      {k:'natureza', label:'Pessoa', type:'radio', full:true, options:[{v:'Física', t:'Pessoa física'}, {v:'Jurídica', t:'Pessoa jurídica'}]},
      {k:'nome', label:'Nome completo', req:true, full:true},
      {k:'nomeFantasia', label:'Nome fantasia', full:true},
      {k:'tipo', label:'Tipo', type:'select', options:() => OPT.tipoPessoa, empty:false, lista:'tipoPessoa'},
      {k:'souEu', label:'👤 Este cadastro sou eu (recebo os lembretes “eu mesmo” no WhatsApp)', type:'check', full:true},
      {type:'html', html:`<label>🏷️ Tags</label><div id="tagsEdW"></div>`},
      {type:'grupo', label:'🪪 Documentos'},
      {k:'doc', label:'CPF', ph:'digite só os números'},
      {k:'rg', label:'RG', ph:'digite só os números'},
      {k:'rgOrgao', label:'Órgão expedidor', type:'combo', options:() => OPT.orgaoRG, lista:'orgaoRG', ph:'SSP, DETRAN…'},
      {k:'rgUF', label:'UF do RG', type:'select', options:UFS},
      {k:'rgData', label:'Data de expedição do RG', type:'date'},
      {k:'ie', label:'Inscrição estadual'},
      {k:'nascimento', label:'Data de nascimento', type:'date'},
      {type:'html', html:`<div id="docAviso" class="small" style="color:var(--bad)"></div>`},
      {type:'grupo', label:'📋 Dados pessoais', id:'gPessoais'},
      {k:'nacionalidade', label:'Nacionalidade', type:'combo', options:() => OPT.nacionalidade, lista:'nacionalidade'},
      {k:'naturalidade', label:'Naturalidade (cidade/UF)', type:'combo', options:() => [...new Set(db.pessoas.map(x => x.naturalidade).filter(Boolean))], ph:'ex.: Campinas/SP'},
      {k:'estadoCivil', label:'Estado civil', type:'select', options:() => OPT.estadoCivil, lista:'estadoCivil'},
      {k:'sexo', label:'Sexo', type:'select', options:() => OPT.sexo, lista:'sexo'},
      {k:'profissao', label:'Profissão / ocupação', type:'combo', options:() => [...new Set([...OPT.profissao, ...db.pessoas.map(x => x.profissao).filter(Boolean)])], lista:'profissao'},
      {type:'sect', label:'Filiação'},
      {k:'mae', label:'Nome da mãe'},
      {k:'pai', label:'Nome do pai'},
      {type:'grupo', label:'🏢 Representante legal da empresa', id:'gRepPJ'},
      {k:'repPjNome', label:'Nome do representante'},
      {k:'repPjCpf', label:'CPF do representante'},
      {k:'repPjCargo', label:'Cargo', type:'combo', options:['Sócio administrador', 'Administrador', 'Diretor', 'Presidente', 'Procurador']},
      {type:'grupo', label:'🏠 Endereço'},
      {k:'cep', label:'CEP', ph:'00000-000 — preenche o endereço'},
      {type:'html', html:`<div class="cepAux"><button type="button" class="mini" id="cepBtn">🔎 buscar CEP</button> <span id="cepSt" class="small muted"></span></div>`},
      {k:'uf', label:'Estado', type:'select', options:UFS},
      {k:'cidade', label:'Cidade', type:'combo', options:() => [...new Set(db.pessoas.map(x => x.cidade).filter(Boolean))]},
      {k:'logradouro', label:'Logradouro (rua, avenida…)', full:true},
      {k:'numero', label:'Número'},
      {k:'bairro', label:'Bairro'},
      {k:'complemento', label:'Complemento', full:true},
      ...(p.endereco && !p.logradouro ? [{type:'html', html:`<div class="small endLeg">Endereço antigo (texto): <b>${esc(p.endereco)}</b>${(p.endereco.match(/\d{5}-?\d{3}/) || [])[0] ? ` <button type="button" class="mini" id="endLegCep" data-cep="${(p.endereco.match(/\d{5}-?\d{3}/) || [])[0]}">usar o CEP deste texto</button>` : ''}<div class="muted">Separe nos campos acima — ao salvar com o logradouro preenchido, este texto é substituído.</div></div>`}] : []),
      {type:'grupo', label:'📞 Contato'},
      {k:'email', label:'E-mail', type:'email'},
      {k:'site', label:'Site'},
      {k:'telefone', label:'Celular / WhatsApp (+55)', ph:'(00) 00000-0000'},
      {k:'telRes', label:'Residencial (+55)', ph:'(00) 0000-0000'},
      {k:'telCom', label:'Comercial (+55)', ph:'(00) 0000-0000'},
      {type:'html', html:`<div id="telBox"></div><button type="button" class="mini" id="telAdd">+ incluir outros telefones</button>`},
      {type:'grupo', label:'👶 Representação legal', id:'gRep', fechado:!p.menor, dica:'menor de idade ou incapaz'},
      {k:'menor', label:'Menor de idade ou incapaz (representado/assistido por responsável legal)', type:'check', full:true},
      {type:'html', html:`<div id="idadeInfo" class="small muted" style="margin-bottom:6px"></div><div id="repWrap"><div class="small muted" style="margin-bottom:6px">Representante(s) legal(is) — quem detém a guarda, tutela ou curatela:</div><div id="repBox"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="mini" id="addRep">+ escolher pessoa já cadastrada</button><button type="button" class="mini" id="novoRep">+ cadastrar novo representante</button></div></div>`},
      {type:'grupo', label:'📁 Contratação'},
      {k:'pasta', label:'Nº da pasta', ph:'P0000'},
      {k:'dataContratacao', label:'Contratado em', type:'date'},
      {k:'origem', label:'Como chegou até nós', type:'select', options:() => OPT.origemLead, lista:'origemLead'},
      {k:'indicacao', label:'Indicado por'},
      {type:'grupo', label:'🏦 Dados bancários', fechado:!(p.contas || []).length, dica:'conta e PIX'},
      {type:'html', html:`<datalist id="dl_bancos">${BANCOS.map(b => `<option value="${esc(b)}">`).join('')}</datalist><div id="contaBox"></div><button type="button" class="mini" id="contaAdd">+ incluir outra conta</button>`},
      {type:'grupo', label:'📝 Observações', fechado:!p.obs},
      {k:'obs', label:'Observações', type:'textarea', full:true},
      ...camposFields('pessoa', p), {type:'grupo', fim:true},
    ],
    after: f => { repEditor(f, p); pessoaFormLigar(f); if(p.id) return; const tp = f.elements.tipo, pa = f.elements.pasta, dc = f.elements.dataContratacao;
      tp.addEventListener('change', () => { const ex = novoClienteExtra(tp.value); pa.value = ex.pasta || ''; dc.value = ex.dataContratacao || ''; }); },
    onSave: out => {
      delete out._tels; out.pasta = out.tipo === 'Cliente' ? pastaFmt(out.pasta) : (p.pasta || '');
      out.doc = fmtDoc(out.doc); out.rg = fmtRG(out.rg); out.repPjCpf = fmtDoc(out.repPjCpf); out.cep = fmtCEP(out.cep); ['telefone', 'telRes', 'telCom'].forEach(k => out[k] = fmtTel(out[k]));
      out.telefones = telsLer(mForm); out.telefone2 = ''; out.contas = contasLer(mForm); out.tags = tagsLer(mForm);
      if(out.logradouro) out.endereco = enderecoTxt(out);
      if(!/indica/i.test(out.origem || '') && out.origem) out.indicacao = out.indicacao || '';
      const d = digits(out.doc);
      if(d && ((d.length === 11 && !cpfValido(d)) || (d.length === 14 && !cnpjValido(d))) && !confirm(`O ${d.length === 14 ? 'CNPJ' : 'CPF'} ${out.doc} parece inválido. Salvar mesmo assim?`)) return false;
      const dupDoc = d.length >= 11 && db.pessoas.find(x => x.id !== p.id && digits(x.doc) === d);
      if(dupDoc && !confirm(`Este ${d.length === 14 ? 'CNPJ' : 'CPF'} já está cadastrado para ${dupDoc.nome}. Salvar mesmo assim?`)) return false;
      if(out.pasta){ const dup = db.pessoas.find(x => x.id !== p.id && pastaNum(x.pasta) === pastaNum(out.pasta));
        if(dup && !confirm(`A pasta ${out.pasta} já está cadastrada para ${dup.nome}. Salvar mesmo assim?`)) return false; }
      const vistos = new Set([p.id]);
      const representantes = out.menor ? [...mForm.querySelectorAll('.rep-row')].map(r => ({pessoaId:r.querySelector('.rp').value, relacao:r.querySelector('.rr').value})).filter(r => r.pessoaId && !vistos.has(r.pessoaId) && vistos.add(r.pessoaId)) : [];
      if(out.menor && !representantes.length && !confirm('Marcado como menor/incapaz, mas sem representante legal informado. Salvar assim mesmo?')) return false;
      const outroEu = out.souEu && db.pessoas.find(x => x.id !== p.id && x.souEu);   // só um cadastro pode ser “eu”
      if(outroEu){ if(!confirm(`“${outroEu.nome}” está marcado como sendo você. Passar a marcação para este cadastro?`)) return false; upsert('pessoas', {id:outroEu.id, souEu:false}); }
      const r = upsert('pessoas', {...p, ...out, representantes}); toast('Salvo'); if(depois) depois(r); else if(!p.id) go('#/pessoa/' + r.id); },
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
  if(p.servico) return formServico(p);   // serviço tem formulário próprio (servicos.js)
  openForm({ title: p.id ? 'Editar processo' : 'Novo processo', data: {status:'Ativo', tipoProc:'Judicial', ...(p.id ? {} : {dataInicio:today(), seq: p.clienteId ? nextSeq(p.clienteId) : ''}), ...p},
    fields: [
      {type:'grupo', label:'📁 Identificação'},
      {k:'tipoProc', label:'Tipo', type:'radio', full:true, options:[{v:'Judicial', t:'Judicial'}, {v:'Administrativo', t:'Administrativo'}, {v:'Extrajudicial', t:'Extrajudicial'}]},
      {k:'titulo', label:'Ação / Assunto', type:'combo', req:true, options:() => OPT.acao, extras:() => db.processos.map(x => x.titulo), lista:'acao', ph:'Digite ou escolha — ex.: Reclamação trabalhista'},
      {k:'numero', label:'Número do processo', ph:'0000000-00.0000.0.00.0000'},
      {k:'principalId', label:'Vinculado ao processo principal (opcional)', type:'select', emptyLabel:'— nenhum: é um processo principal ou independente —',
        options:() => { const fora = p.id ? procDescendentes(p.id) : new Set(); return db.processos.filter(x => x.id !== p.id && !fora.has(x.id))
          .sort((a, b) => (procCode(a) || '').localeCompare(procCode(b) || '', 'pt-BR', {numeric:true})).map(x => ({v:x.id, t:procLabel(x) + ' · ' + pessoaNome(x.clienteId)})); }},
      {k:'tipoVinculo', label:'Tipo de vínculo', type:'select', options:() => TIPOS_VINCULO, emptyLabel:'—'},
      {k:'clienteId', label:'Cliente', type:'select', options:pessoasOpts, req:true, newP:'Cliente'},
      {k:'seq', label:'Ordem na pasta do cliente', ph:'1, 2, 3…'},
      {k:'dataInicio', label:'Início da minha atuação', type:'date'},
      {k:'area', label:'Área', type:'select', options:() => OPT.area, lista:'area'},
      ...(p.id ? [] : [{k:'modeloHon', label:'Honorários contratados (modelo)', type:'select', options:modeloOpcoes, emptyLabel:'— definir depois —'}]),
      {type:'html', html:`<label>🏷️ Tags</label><div id="tagsEdW"></div>`},
      {type:'grupo', label:'👥 Partes do processo'},
      {k:'posicao', label:'Posição do cliente', type:'select', options:() => OPT.posicao, lista:'posicao'},
      {k:'advContrario', label:'Advogado da parte contrária'},
      {type:'html', html:`<div id="cliLine" class="small" style="margin-bottom:8px"></div>
        <div id="partesBox"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px"><button type="button" class="mini" id="addParte">+ adicionar pessoa já cadastrada</button><button type="button" class="mini" id="novaParte">+ cadastrar nova pessoa como parte</button><button type="button" class="mini" id="novaParteC" title="Abre o cadastro completo da nova parte e depois volta ao processo">+ cadastro completo de nova parte</button></div>
        <div id="legado" style="margin-top:8px"></div>`},
      {k:'outrasPartes', label:'Observações sobre as partes (texto livre)', full:true},
      {type:'grupo', label:'🏛️ Onde tramita'},
      {k:'tribunal', label:'Tribunal / órgão', type:'combo', options:() => sugestoes('tribunal', 'tribunal'), lista:'tribunal', ph:'preenchido pelo número, ou digite'},
      {k:'comarca', label:'Comarca', type:'combo', options:() => sugestoes('comarca', 'comarca'), lista:'comarca'},
      {k:'vara', label:'Vara / Órgão julgador', type:'combo', options:() => sugestoes('vara', 'vara'), lista:'vara'},
      {k:'sistema', label:'Sistema em que tramita', type:'select', options:() => OPT.sistema, lista:'sistema'},
      {k:'rito', label:'Rito / procedimento', type:'select', options:() => OPT.rito, lista:'rito'},
      {k:'dataDistribuicao', label:'Distribuição', type:'date'},
      {k:'valorCausa', label:'Valor da causa (R$)', type:'number'},
      {k:'link', label:'Link de consulta', type:'url', ph:'https://…'},
      {type:'grupo', label:'📊 Andamento'},
      {k:'status', label:'Status', type:'select', options:() => OPT.statusProc, empty:false, lista:'statusProc'},
      {k:'fase', label:'Fase do processo', type:'select', options:() => OPT.faseProc, lista:'faseProc'},
      {k:'situacaoProc', label:'Situação (o que se aguarda)', type:'select', options:() => OPT.situacaoProc, lista:'situacaoProc', full:true},
      {type:'grupo', label:'📌 Marcos do processo', fechado:!(p.marcos || []).length, dica:'citação, liminar, sentença, acórdão, trânsito em julgado…'},
      {type:'html', html:`<div class="small muted" style="margin-bottom:6px">Datas importantes — servem de referência para prazos e, no futuro, para o cálculo de juros e correção.</div><div id="marcosBox"></div><button type="button" class="mini" id="marcoAdd">+ adicionar marco</button>`},
      {type:'grupo', label:'📋 O caso', fechado:true, dica:'resumo, fatos, pretensões, fundamentação, estratégia, observações'},
      {k:'resumo', label:'Resumo do caso (1 a 3 linhas — aparece no topo da ficha)', type:'textarea', rows:2, full:true, ph:'Ex.: Demissão por justa causa a reverter; horas extras e insalubridade'},
      {k:'fatos', label:'Fatos (a história contada pelo cliente)', type:'textarea', rows:4, full:true},
      {k:'pretensoes', label:'Pretensões do cliente (o que ele quer obter / aceita)', type:'textarea', rows:3, full:true},
      {k:'fundamentacao', label:'Fundamentação jurídica (teses, artigos, súmulas, julgados)', type:'textarea', rows:3, full:true},
      {k:'estrategia', label:'Estratégia', type:'textarea', rows:3, full:true, ph:'Ex.: entrar com cautelar de imediato e depois com a reclamação trabalhista'},
      {k:'obs', label:'Observações', type:'textarea', rows:3, full:true},
      ...camposFields('processo', p),
      {type:'grupo', fim:true},
      {type:'html', html:`<div class="full" style="background:var(--priSoft);border-radius:10px;padding:10px 12px"><b class="small">Aviso ao cliente</b>${p.clienteAvisadoProc && p.clienteAvisadoProc === digits(p.numero) ? ' <span class="small muted">· cliente já avisado deste número</span>' : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" id="fpAvisarProc" style="border-color:#25d366;color:#128c3e">🟢 Salvar e avisar o cliente pelo WhatsApp</button></div>
        <div class="small muted" style="margin-top:4px">Salva o processo e abre a mensagem pronta com a ação, o número, a vara e o link de consulta do tribunal. Precisa do número do processo.</div></div>`},
    ],
    after: f => { novasPessoas.clear(); mForm._avisarProc = false;
      // tags, marcos e vínculo (lidos de formCfg.data para não perder nada ao voltar de um cadastro completo de pessoa)
      const dd = formCfg.data || {};
      f.querySelector('#tagsEdW').innerHTML = tagsEditorHtml(dd.tags || []); tagsEditorLigar(f);
      f.querySelector('#marcosBox').innerHTML = (dd.marcos || []).map(marcoRowHtml).join(''); marcosEditorLigar(f);
      mForm._extraVals = () => ({tags:tagsLer(f), marcos:marcosLer(f)});
      const fld = n => f.elements[n]?.closest('.fld'), mostra = (n, on) => { const el = fld(n); if(el) el.style.display = on ? '' : 'none'; };
      const pri = f.elements.principalId, vinc = () => mostra('tipoVinculo', !!pri.value); pri.addEventListener('change', vinc); vinc();
      const tipoUpd = () => { const t = f.querySelector('[name=tipoProc]:checked')?.value || 'Judicial', jud = t === 'Judicial';
        ['rito', 'sistema', 'dataDistribuicao'].forEach(n => mostra(n, jud));
        fld('numero').querySelector('label').textContent = jud ? 'Número do processo' : 'Número / protocolo (opcional)';
        f.elements.numero.placeholder = jud ? '0000000-00.0000.0.00.0000' : t === 'Administrativo' ? 'ex.: protocolo do INSS, NB, nº do procedimento' : 'ex.: nº do contrato, referência interna'; };
      f.querySelectorAll('[name=tipoProc]').forEach(r => r.addEventListener('change', tipoUpd)); tipoUpd();
      const numTrib = () => { const t = tribunalDoNumero(f.elements.numero.value); if(t && !f.elements.tribunal.value) f.elements.tribunal.value = t;
        if(digits(f.elements.numero.value).length === 20 && !f.elements.sistema.value && typeof impInfo === 'function'){ const s = impInfo({numero:f.elements.numero.value}).sistema; if(s) f.elements.sistema.value = s; } };
      f.elements.numero.addEventListener('change', numTrib); f.elements.numero.addEventListener('blur', numTrib);
      f.querySelector('.mfoot button[type=submit]')?.addEventListener('click', () => { mForm._avisarProc = false; });
      f.querySelector('#fpAvisarProc').onclick = () => { if(digits(f.elements.numero.value).length < 15) return toast('Informe o número do processo para avisar o cliente'); if(!f.elements.clienteId.value) return toast('Escolha o cliente'); mForm._avisarProc = true; mForm.requestSubmit(); };
      if(f.elements.modeloHon) f.elements.area.addEventListener('change', () => { const m = modeloDaArea(f.elements.area.value); if(m) f.elements.modeloHon.value = m.id; });
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
        f.querySelector('#cliLine').innerHTML = c.value ? `Cliente: <b>${esc(pessoaNome(c.value))}</b> — ${pc ? POLO_LBL[pc] + ' (' + esc(pos.value.toLowerCase()) + ')' : '<span class="muted">escolha a posição do cliente para definir o polo</span>'}. Inclua abaixo os demais autores, réus, representantes e outros participantes.` : '<span class="muted">Escolha o cliente acima. Inclua abaixo os demais autores, réus, representantes e outros participantes.</span>'; };
      (formCfg?.data?.partes || p.partes || []).forEach(x => addRow(x)); refreshDe();
      c.addEventListener('change', cliLine); pos.addEventListener('change', cliLine); cliLine();
      box.addEventListener('click', e => { if(e.target.classList.contains('rm')){ e.target.closest('.parte-row').remove(); legado(); } });
      box.addEventListener('change', legado);
      f.querySelector('#addParte').onclick = () => addRow({}).querySelector('.pp').focus();
      const criar = nome => { const ex = db.pessoas.find(x => norm_s(x.nome).trim() === norm_s(nome).trim()); if(ex) return ex; const n = upsert('pessoas', {nome:nome.trim(), tipo:'Parte contrária'}); novasPessoas.add(n.id); return n; };
      f.querySelector('#novaParteC').onclick = () => cadastroCompletoPessoa('Parte contrária', (data, ps) => { data.partes = [...(data.partes || []), {pessoaId:ps.id, polo:poloOposto({posicao:data.posicao})}]; });
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
      if('modeloHon' in out){ const m = modeloPorId(out.modeloHon); delete out.modeloHon;
        if(m) out.contrato = {data:today(), obs:'', itens:m.itens.map(it => ({...it, id:uid(), status:'pendente'}))}; }
      const pcN = poloCliente(out);
      partes.forEach(x => { if(novasPessoas.has(x.pessoaId)){ const ps = byId('pessoas', x.pessoaId); if(ps) ps.tipo = TIPO_POR_PAPEL[x.polo] || (x.polo === 'ativo' || x.polo === 'passivo' ? (pcN && x.polo === pcN ? 'Cliente' : 'Parte contrária') : 'Outro'); } });
      if(!out.principalId) out.tipoVinculo = '';
      out.tags = tagsLer(mForm); out.marcos = marcosLer(mForm);
      const r = upsert('processos', {...p, ...out, partes}); toast('Salvo'); if(depois) depois(r); else if(!p.id) go('#/processo/' + r.id);
      // "Salvar e avisar o cliente": abre a mensagem pronta com os dados do processo e o link de consulta
      if(mForm._avisarProc){ mForm._avisarProc = false; setTimeout(() => formWhatsProc(r.id), 250); } },
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
// arquivos do atendimento: pasta do cliente › Atendimentos; atendimento de lead (sem cliente): Leads › nome do lead › Atendimentos
function convArqAlvo(x){ const cli = byId('pessoas', x.pessoaId), lead = byId('leads', x.leadId);
  if(cli) return cli.pasta ? {cliente:cli.pasta, nome:cli.nome, sub:'Atendimentos'} : null;
  return lead ? {lead:lead.nome || 'Lead sem nome', sub:'Atendimentos'} : null; }
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
  fields.push({type:'grupo', label:'📎 Arquivos', id:'gArq', fechado:!(c.arquivos || []).length, dica:lead && !c.pessoaId ? 'no Google Drive › Leads › ' + (lead.nome || '') + ' › Atendimentos' : 'na pasta do cliente no Google Drive › Atendimentos'},
    {type:'html', html:arqEditorHtml(lead && !c.pessoaId ? 'Os arquivos vão para Leads › ' + esc(lead.nome || '') + ' › Atendimentos, no Google Drive.' : 'Escolha o cliente para saber em que pasta os arquivos vão.')}, {type:'grupo', fim:true});
  openForm({ title: isNew ? 'Registrar conversa' : 'Editar conversa', data:c, fields, focus: isNew ? (c.pessoaId || lead ? 'relato' : 'pessoaId') : undefined,
    after: f => { const ps = f.elements.pessoaId, pr = f.elements.processoId;
      arqEditorLigar(f, c, convArqAlvo, 'Escolha o cliente — ele precisa ter número de pasta (ex.: P0152).'); mForm._extraVals = () => ({arquivos:f._arqs});
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
    onSave: out => { upsert('conversas', {...c, ...out, ...(mForm._extraVals ? mForm._extraVals() : {})}); toast('Conversa registrada'); },  // arquivos (📎) vêm de _extraVals
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
// compromisso de vários dias (ex.: sessão virtual de julgamento) só atrasa depois do último dia; prazo processual segue a data (e o prazo fatal)
const atrasado = p => !p.concluido && ((p.data && (p.tipo !== 'Prazo processual' && p.dataFim > p.data ? p.dataFim : p.data) < today()) || (p.dataFatal && p.dataFatal < today()));
function proximoDiaParaReag(){ let d = today(); while(!isBusiness(d, false)) d = addDays(d, 1); return d; }
function reagendarPendentes(){
  const cfg = painelCfg().reag; if(!cfg.ativo) return 0;
  const t = today(), alvo = proximoDiaParaReag(); let n = 0;
  db.prazos.forEach(p => {
    if(p.concluido || !p.data || p.data >= t || !cfg.tipos[p.tipo]) return;
    if(p.dataFim && p.dataFim > p.data) return;   // vários dias (ex.: 27/11 a 04/12): não muda de data — o último dia é o limite; passou dele, fica em “atrasados”
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
// contato (cliente, lead, testemunha…): vai para “📞 Contatos a fazer” no Início, não para “Prazos e compromissos”
// campo p.contatoCom (lista contatoCom); sem o campo (registros antigos): lead → Lead, “Retorno ao cliente” → Cliente, tarefa sobre testemunhas → Testemunha
function contatoDe(p){ if(!p) return ''; if(typeof p.contatoCom === 'string') return p.contatoCom;
  return p.leadId ? 'Lead' : p.tipo === 'Retorno ao cliente' ? 'Cliente' : (p.lembDe || p.tipo === 'Tarefa') && /testemunh/i.test(p.titulo || '') ? 'Testemunha' : ''; }
const CONTATO_IC = {Cliente:'👤', Lead:'🎯', Testemunha:'🧑‍⚖️'};
const contatoTag = p => { const c = contatoDe(p); return c ? `<span class="tag grey" title="Contato a fazer">${CONTATO_IC[c] || '📞'} ${esc(c)}</span>` : ''; };
function colunaDe(p){ const cs = colunas(); if(cs.some(c => c.id === p.coluna)) return p.coluna; const a = colunaAuto(p); return cs.some(c => c.id === a) ? a : cs[0].id; }
const agendaDesatualizada = p => !p.gcalId && !!p.agendaEnviada && p.agendaEnviada !== pzKey(p) && !p.concluido;
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
  if(agendaDesatualizada(p)) a.push(`<button class="mini" style="color:var(--warn);border-color:var(--warn)" data-act="posPrazo" data-id="${p.id}">⚠️ data mudou — atualizar a Google Agenda</button>`);
  if(clienteDesatualizado(p)) a.push(`<button class="mini" style="color:var(--warn);border-color:var(--warn)" data-act="avisarWhats" data-id="${p.id}" data-mod="nova">⚠️ avisar o cliente da nova data</button>`);
  return a.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${a.join('')}</div>` : '';
}
function formPrazo(p = {}, depois){
  const isNew = !p.id;
  const dados = {tipo:'Prazo processual', situacao:'Pendente', ...p}; dados.contatoCom = contatoDe(dados);
  dados.lembrete = p.lembrete !== false; // “Criar lembrete” vem sempre marcado (desmarcado só se você desmarcou neste compromisso)
  openForm({ title: isNew ? 'Novo compromisso' : 'Editar compromisso', data:dados,
    fields: [
      ...(isNew ? [{type:'html', html:iaBoxHtml()}] : []),
      {type:'grupo', label:'📅 Compromisso'},
      {k:'tipo', label:'Tipo', type:'select', options:() => OPT.tipoPrazo, empty:false, lista:'tipoPrazo'},
      {k:'subtipo', label:'Subtipo', type:'select', options:() => subtiposDe(dados.tipo), lista:'subtipo', emptyLabel:'—'},
      {k:'contatoCom', label:'É um contato com…', type:'select', options:() => OPT.contatoCom, lista:'contatoCom', emptyLabel:'— não (prazo / compromisso) —'},
      {k:'titulo', label:'Título', req:true, full:true, ph:'Ex.: Contestação, Audiência de conciliação, Reunião com cliente'},
      {k:'situacao', label:'Situação', type:'select', options:() => OPT.situacao, empty:false, lista:'situacao'},
      {k:'coluna', label:'Coluna no quadro', type:'select', options:() => colunas().filter(c => !c.oculto).map(c => ({v:c.id, t:c.v})), emptyLabel:'— automática (pelo tipo / data) —'},
      {k:'novaData', label:'Nova data (redesignação) *', type:'date'},
      {k:'novaHora', label:'Novo horário', type:'time'},
      {k:'data', label:'Data de início (em branco = sem data)', type:'date'},
      {k:'hora', label:'Hora de início', type:'time'},
      {k:'dataFatal', label:'Prazo fatal (limite para protocolo / distribuição — opcional)', type:'date'},
      {k:'dataFim', label:'Data de término', type:'date'},
      {k:'horaFim', label:'Hora de término', type:'time'},
      {k:'diaInteiro', label:'Dia inteiro (sem horário)', type:'check'},
      {type:'html', html:calcHtml('data')},
      {k:'lembrete', label:'📅🟢 Criar lembrete na Google Agenda e no WhatsApp (na tela seguinte, em “Salvar e continuar →”)', type:'check', full:true},
      {k:'modalidade', label:'Audiência presencial ou online?', type:'select', options:['Presencial', 'Online'], emptyLabel:'— escolha —'},
      {k:'plataforma', label:'Plataforma', type:'select', options:() => L('plataformaAud'), lista:'plataformaAud', emptyLabel:'—'},
      {k:'local', label:'Local / link', type:'combo', options:() => [...new Set(db.prazos.map(x => x.local).filter(Boolean))].slice(-60), full:true},
      {k:'sala', label:'Sala / andar', ph:'Ex.: Sala 3 — 2º andar'},
      {k:'audLink', label:'Link da audiência', full:true, ph:'https://…'},
      {k:'audId', label:'ID da reunião / sala virtual'},
      {k:'audSenha', label:'Senha'},
      {type:'html', html:`<label>🏷️ Tags</label><div id="tagsEdW"></div>`},
      {type:'grupo', label:'🔗 Vínculos'},
      {k:'processoId', label:'Processo', type:'select', options:() => procOpts()},
      {k:'pessoaId', label:'Cliente / pessoa', type:'select', options:pessoasOpts},
      {type:'html', html:vincHtml()},
      {type:'grupo', label:'⏰ Lembretes e preparação', id:'gLemb', dica:'avisos e tarefas antes do compromisso'},
      {type:'html', html:lembEditorHtml()},
      {type:'grupo', label:'🔁 Recorrência', id:'gRec', fechado:!p.recorr, dica:'compromisso que se repete'},
      {type:'html', html:recEditorHtml()},
      {type:'grupo', label:'📎 Arquivos', id:'gArq', fechado:!(p.arquivos || []).length, dica:'na pasta do cliente no Google Drive'},
      {type:'html', html:arqEditorHtml()},
      {type:'grupo', label:'☑ Checklist', fechado:!(p.checklist || []).length},
      {type:'html', html:`<div id="ckBox"></div>
        <div style="display:flex;gap:6px;margin-top:4px"><input id="ckNovo" placeholder="Novo item — ex.: arrolar testemunhas (Enter para incluir)"><button type="button" class="mini" id="ckAdd">+ incluir</button></div>`},
      {type:'grupo', label:'📝 Observações', fechado:!p.obs},
      {k:'obs', label:'Observações', type:'textarea', full:true},
      ...camposFields('prazo', p), {type:'grupo', fim:true},
      ...(isNew ? [] : [{type:'html', html:`<div style="background:var(--priSoft);border-radius:10px;padding:10px 12px"><b class="small">Google Agenda e aviso ao cliente</b>${p.gcalId ? ` <span class="small muted">· ✔ na Google Agenda (atualiza sozinho)</span>` : p.agendaEnviada ? ` <span class="small muted">· enviado à agenda</span>` : ''}${p.clienteAvisado ? ` <span class="small muted">· cliente avisado</span>` : ''}
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px"><button type="button" class="btn" id="fpAgenda">📅 Google Agenda</button><button type="button" class="btn" id="fpWhats" style="border-color:#25d366;color:#128c3e">🟢 Avisar o cliente pelo WhatsApp</button></div>
        <div class="small muted" style="margin-top:4px">Usam os dados já salvos. Se alterar a data agora, salve primeiro — o sistema vai lembrar de atualizar.</div></div>`}]),
    ],
    after: f => {
      const pr = f.elements.processoId, ps = f.elements.pessoaId, di = f.elements.diaInteiro, sit = f.elements.situacao;
      pr.addEventListener('change', () => { const proc = byId('processos', pr.value); if(proc && !ps.value) ps.value = proc.clienteId; });
      const showFld = (n, on) => { const el = f.elements[n]; if(el) el.closest('.fld').style.display = on ? '' : 'none'; };
      const lbLocal = f.querySelector('label[for=f_local]');
      const upd = () => { ['hora','horaFim'].forEach(n => showFld(n, !di.checked));
        const aud = ehAud({tipo:f.elements.tipo.value}), onl = aud && f.elements.modalidade.value === 'Online';   // audiência: campos de presencial × online
        showFld('modalidade', aud); ['plataforma', 'audLink', 'audId', 'audSenha'].forEach(n => showFld(n, onl)); showFld('sala', aud && !onl); showFld('local', !onl);
        if(lbLocal) lbLocal.textContent = aud ? 'Endereço do local (fórum / vara)' : 'Local / link'; showFld('dataFatal', !aud); const r = sit.value === 'Redesignado' && p.situacao !== 'Redesignado'; showFld('novaData', r); showFld('novaHora', r && !di.checked); };
      di.addEventListener('change', upd); sit.addEventListener('change', upd); f.elements.modalidade.addEventListener('change', upd); f.elements.tipo.addEventListener('change', upd); upd();
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
      // subtipo conforme o tipo
      const st = f.elements.subtipo, stOpts = () => { const cur = st.value, l = subtiposDe(f.elements.tipo.value); st.innerHTML = '<option value="">—</option>' + opts(l.includes(cur) || !cur ? l : [...l, cur], cur); };
      f.elements.tipo.addEventListener('change', () => { st.value = ''; stOpts(); }); stOpts();
      f.elements.tipo.addEventListener('change', () => { const cc = f.elements.contatoCom; if(cc && !cc.value && f.elements.tipo.value === 'Retorno ao cliente') cc.value = 'Cliente'; });
      st.closest('.row')?.insertAdjacentHTML('beforeend', '<button type="button" class="mini" id="stEd" title="Editar os subtipos deste tipo">✎</button>');
      const prev = formCfg; f.querySelector('#stEd')?.addEventListener('click', () => { const t = f.elements.tipo.value, d = {...(prev.data || {}), ...valoresDoForm()}; formSubtipos(t, () => openForm({...prev, data:d})); });
      // tags, vínculos, lembretes, recorrência, arquivos
      f.querySelector('#tagsEdW').innerHTML = tagsEditorHtml(formCfg.data.tags || [], 'cmp'); tagsEditorLigar(f);
      vincLigar(f, p); lembEditorLigar(f, p); recEditorLigar(f, p); arqEditorLigar(f, p);
      mForm._extraVals = () => ({tags:tagsLer(f), relacionados:f._rel, conversas:f._conv, lembretes:f._lembs, recorr:recLer(f), arquivos:f._arqs});
      // rodapé: Cancelar · Salvar e criar novo · Salvar e fechar · Salvar e continuar →
      mForm._modo = 'continuar';
      const foot = f.querySelector('.mfoot'), sb = foot.querySelector('button[type=submit]'); sb.textContent = 'Salvar e continuar →';
      sb.insertAdjacentHTML('beforebegin', '<button type="button" class="btn" id="fpNovo">Salvar e criar novo</button><button type="button" class="btn" id="fpFechar">Salvar e fechar</button>');
      sb.addEventListener('click', () => { mForm._modo = 'continuar'; });
      f.querySelector('#fpNovo').onclick = () => { mForm._modo = 'novo'; mForm.requestSubmit(); };
      f.querySelector('#fpFechar').onclick = () => { mForm._modo = 'fechar'; mForm.requestSubmit(); };
    },
    onSave: out => {
      const {novaData, novaHora, ...rest} = out;
      const checklist = [...mForm.querySelectorAll('.ckRow')].map(r => ({t:r.querySelector('.ckT').value.trim(), ok:r.querySelector('.ckOk').checked})).filter(c => c.t);
      const pend = mForm.querySelector('#ckNovo')?.value.trim(); if(pend) checklist.push({t:pend, ok:false});
      const rec = {...p, ...rest, checklist, tags:tagsLer(mForm), relacionados:mForm._extraVals ? mForm._extraVals().relacionados : (p.relacionados || []), conversas:mForm._extraVals ? mForm._extraVals().conversas : (p.conversas || []),
        lembretes:mForm._extraVals ? mForm._extraVals().lembretes : (p.lembretes || []), recorr:recLer(mForm), arquivos:mForm._extraVals ? mForm._extraVals().arquivos : (p.arquivos || [])};
      const modo = mForm._modo || 'continuar', lembAntes = p.lembretes || [], relAntes = p.relacionados || [];
      if(p.serieId && p.id && JSON.stringify(SERIE_CAMPOS.map(k => p[k] ?? '')) !== JSON.stringify(SERIE_CAMPOS.map(k => rec[k] ?? ''))) rec._serieProximas = confirm('Este compromisso faz parte de uma série.\n\nOK = aplicar as alterações também às próximas ocorrências\nCancelar = alterar só este');
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
          obs:(p.obs || ''), gcalId:'', gcalCal:'', gcalHash:'', gcalData:'', gcalFId:'', gcalFCal:'', gcalFHash:'', gcalFData:'', gcalPedido:!!rec.gcalId, agendaEnviada: rec.agendaEnviada && !rec.gcalId ? 'redesignado' : '', clienteAvisado: rec.clienteAvisado ? 'redesignado' : ''};
      }
      const prox = rec._serieProximas; delete rec._serieProximas;
      const salvo = upsert('prazos', rec); if(depois) depois(salvo);
      lembSincronizarTarefas(salvo, lembAntes); vincEspelhar(salvo, relAntes);
      if(prox) db.prazos.filter(x => x.serieId === salvo.serieId && x.id !== salvo.id && x.data > salvo.data && !x.concluido).forEach(x => { SERIE_CAMPOS.forEach(k => { x[k] = JSON.parse(JSON.stringify(salvo[k] ?? '')); }); });
      if(salvo.recorr){ if(prox || (p.recorr && JSON.stringify(p.recorr) !== JSON.stringify(salvo.recorr))){ db.prazos = db.prazos.filter(x => !(x.serieId === (salvo.serieId || salvo.id) && x.id !== salvo.id && x.data > salvo.data && !x.concluido)); }
        const n = serieGerar(byId('prazos', salvo.id)); if(n) setTimeout(() => toast(`🔁 ${n} ocorrência(s) criada(s) na agenda`), 400); }
      save();
      const pedido = null; mForm._depoisSalvar = null;
      const depoisModo = () => { if(modo === 'continuar') setTimeout(() => proximosPassos(salvo.id), 350); else if(modo === 'novo') setTimeout(() => formPrazo({processoId:salvo.processoId || '', pessoaId:salvo.pessoaId || '', tipo:salvo.tipo}), 350); };
      if(pedido === 'agenda' && gcalDireto()){ gcalEnviarAgora(salvo.id); return; }
      if(pedido){ setTimeout(() => { if(pedido === 'agenda') posPrazo(salvo.id, 'agenda'); else formWhats(salvo.id); }, 150); toast('Salvo'); return; }
      const extras = (mForm._iaExtras || []).filter((x, i) => mForm.querySelector(`.iaExtra[data-i="${i}"]`)?.checked);
      extras.forEach(x => upsert('prazos', {...x, processoId:x.processoId || rec.processoId || '', pessoaId:x.pessoaId || rec.pessoaId || ''}));
      if(extras.length) setTimeout(() => toast(`${extras.length + 1} compromissos criados a partir do conteúdo`), 300);
      // audiência marcada como realizada no formulário: abre “Concluir audiência” (ata, resumo, processo, próximos compromissos)
      if(!novo && ehAud(salvo) && salvo.situacao === 'Realizado' && p.situacao !== 'Realizado'){ toast('Salvo'); setTimeout(() => formAudConcluir(salvo.id), 350); return; }
      // tarefa de retorno ao lead cumprida: oferece registrar como foi e marcar o próximo contato
      if(!novo && salvo.leadId && salvo.situacao === 'Realizado' && p.situacao !== 'Realizado' && typeof formLeadCumprido === 'function'){ toast('Salvo'); setTimeout(() => formLeadCumprido(salvo.id), 350); return; }
      if(novo){ const n = upsert('prazos', novo); toast('Redesignado — novo compromisso criado para ' + fmtD(novaData)); if(TIPOS_CLIENTE.includes(n.tipo) || n.agendaEnviada || n.clienteAvisado) setTimeout(() => posPrazo(n.id, 'nova'), 150); return; }
      toast('Salvo');
      if(modo !== 'fechar'){ depoisModo(); return; }
      const mudou = !isNew && pzKey(p) !== pzKey(salvo) && !salvo.concluido && salvo.data;
      if(mudou && ((salvo.agendaEnviada && !salvo.gcalId) || salvo.clienteAvisado || TIPOS_CLIENTE.includes(salvo.tipo))) setTimeout(() => posPrazo(salvo.id, 'mudou'), 150);
    },
    onDelete: !isNew ? () => { if(!confirm('Excluir este compromisso?')) return false;
      const serie = p.serieId && db.prazos.some(x => x.serieId === p.serieId && x.id !== p.id && x.data > p.data && !x.concluido) && confirm('Excluir também as próximas ocorrências desta série?\n\nOK = esta e as próximas · Cancelar = só esta');
      (p.lembretes || []).forEach(l => { const t = l.tarefaId && byId('prazos', l.tarefaId); if(t && !t.concluido) db.prazos = db.prazos.filter(x => x.id !== t.id); });
      if(serie) db.prazos = db.prazos.filter(x => !(x.serieId === p.serieId && x.data > p.data && !x.concluido));
      db.prazos.forEach(x => { if((x.relacionados || []).includes(p.id)) x.relacionados = x.relacionados.filter(y => y !== p.id); });
      removeItem('prazos', p.id); } : null });
}
/* ----- Google Agenda (envio direto pelo robô: js/google-agenda.js; ou pela tela do Google) ----- */
const somaHora = h => { const [a, b] = h.split(':').map(Number), m = Math.min(a * 60 + b + 60, 23 * 60 + 59); return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
function googleUrl(p){
  const f = (d, h) => d.replace(/-/g, '') + (h ? 'T' + h.replace(':', '') + '00' : ''), fim = p.dataFim || p.data;
  const dates = p.diaInteiro || !p.hora ? f(p.data) + '/' + f(addDays(fim, 1)) : f(p.data, p.hora) + '/' + f(fim, p.horaFim || somaHora(p.hora));
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({action:'TEMPLATE', text:(p.gcalOver?.titulo) || gcalTitulo(p, gcalCfg()), dates, ctz:'America/Sao_Paulo', details:gcalDesc(p, gcalCfg()), location:compLocal(p)});
}
// modo “abrir a tela do Google”: o dia do prazo fatal vai como um segundo evento, de dia inteiro
function googleUrlFatal(p){ const e = gcalEventoFatal(p), f = d => d.replace(/-/g, '');
  return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({action:'TEMPLATE', text:e.titulo, dates:f(p.dataFatal) + '/' + f(addDays(p.dataFatal, 1)), ctz:'America/Sao_Paulo', details:e.desc, location:e.local || ''}); }
function posPrazo(id, modo){
  const p = byId('prazos', id); if(!p) return;
  if(!p.data){ toast('Defina a data do compromisso primeiro'); return; }
  const titulo = {mudou:'⚠️ A data mudou', nova:'🔁 Compromisso redesignado', novo:'✔ Compromisso salvo', agenda:'📅 Google Agenda'}[modo] || '📅 Agenda e aviso';
  const txt = modo === 'mudou' || modo === 'nova' ? `<p><b>${esc(p.titulo)}</b> agora é em <b>${fmtD(p.data)}${horaTxt(p) ? ' · ' + horaTxt(p) : ''}</b>.</p>
      ${p.gcalId ? '<p>✔ Já está na sua <b>Google Agenda</b> e foi atualizado automaticamente.</p>' : p.agendaEnviada ? '<p>⚠️ Este compromisso já tinha sido enviado à Google Agenda — <b>envie novamente</b> para atualizar (e apague o antigo, se ficar duplicado).</p>' : ''}
      ${p.clienteAvisado ? '<p>⚠️ O cliente tinha sido avisado da data anterior — <b>avise da nova data</b>.</p>' : ''}`
    : `<p><b>${esc(p.titulo)}</b> — ${fmtD(p.data)}${horaTxt(p) ? ' · ' + horaTxt(p) : ''}${compLocal(p) ? ' · ' + esc(compLocal(p)) : ''}</p>${p.gcalId ? '<p class="small">✔ Está na sua <b>Google Agenda</b> — se você mudar a data, o evento muda junto.</p>' : ''}`;
  const direto = gcalDireto();
  openForm({ title:titulo, soFechar:true, fields:[{type:'html', html:`${txt}
    <div style="display:flex;gap:8px;flex-wrap:wrap">${p.gcalId ? `<button type="button" class="btn" id="ppGcalDel">Remover da Google Agenda</button>` : `<button type="button" class="btn" id="ppGoogle">📅 ${direto ? 'Salvar na Google Agenda' : 'Google Agenda'}</button>`}${!direto && gcalTemFatal(p) && !p.concluido ? `<button type="button" class="btn" id="ppGoogleF">⚠️ Prazo fatal (${fmtD(p.dataFatal).slice(0, 5)}) na Google Agenda</button>` : ''}
    ${p.pessoaId || byId('processos', p.processoId)?.clienteId ? `<button type="button" class="btn" id="ppWhats" style="border-color:#25d366;color:#128c3e">🟢 Avisar o cliente pelo WhatsApp</button>` : ''}</div>
    ${gcalTemFatal(p) && !p.concluido ? `<p class="small" style="margin-top:8px">⚠️ O dia do <b>prazo fatal (${fmtD(p.dataFatal)})</b> ${direto ? 'vai como um segundo evento, em vermelho, junto com este.' : 'pode ir como um segundo evento: use o botão “⚠️ Prazo fatal”.'}</p>` : ''}
    <p class="small muted" style="margin-top:8px">${direto ? 'Grava direto na sua Google Agenda, com as cores e notificações definidas em Configurações → Google Agenda.' : 'Abre a tela do Google Agenda com tudo preenchido — confira e salve. Para gravar direto, sem abrir nada: Configurações → 📅 Google Agenda.'}</p>`}],
    after: f => {
      const g = f.querySelector('#ppGoogle');
      if(g) g.onclick = () => { if(direto){ closeModal(); gcalEnviarAgora(id); return; } window.open(googleUrl(p), '_blank', 'noopener'); upsert('prazos', {id, agendaEnviada:pzKey(byId('prazos', id))}); toast('Marcado como enviado à agenda'); };
      const gf = f.querySelector('#ppGoogleF'); if(gf) gf.onclick = () => window.open(googleUrlFatal(byId('prazos', id) || p), '_blank', 'noopener');
      const gd = f.querySelector('#ppGcalDel'); if(gd) gd.onclick = () => { if(!confirm('Remover este compromisso da sua Google Agenda? (ele continua no sistema)')) return; closeModal(); gcalRemover(id); };
      const w = f.querySelector('#ppWhats'); if(w) w.onclick = () => { closeModal(); formWhats(id, modo === 'mudou' || modo === 'nova' ? 'nova' : 'aviso'); };
    } });
}
/* ----- aviso ao cliente com os dados do processo (WhatsApp) ----- */
// link de consulta PÚBLICA (o cliente não tem certificado): o informado no processo ou o do sistema do tribunal
function linkConsultaPublica(p){
  if(p.link) return p.link;
  const d = digits(p.numero); if(d.length !== 20) return '';
  const j = d[13], tr = d.slice(14, 16), org = d.slice(16), mask = mascaraCnj(d);
  if(j === '8' && tr === '26') return typeof navTribunal === 'function' ? navTribunal(p).link : 'https://esaj.tjsp.jus.br/cpopg/open.do';
  if(j === '5' && tr !== '00') return `https://pje.trt${+tr}.jus.br/consultaprocessual/detalhe-processo/${mask}`;
  if(j === '4' && +tr === 3) return org === '0000' ? 'https://pje2g.trf3.jus.br/pje/ConsultaPublica/listView.seam' : 'https://pje1g.trf3.jus.br/pje/ConsultaPublica/listView.seam';
  return '';
}
function msgProcesso(pr, d){
  const prim = n => String(n || '').trim().split(/\s+/)[0] || '', np = nomesPolos(pr), pc = poloCliente(pr);
  const contra = (pr.partes || []).filter(x => x.polo === (pc === 'passivo' ? 'ativo' : 'passivo')).map(x => pessoaNome(x.pessoaId)).filter(Boolean);
  const link = linkConsultaPublica(pr), onde = [pr.vara, pr.comarca, pr.tribunal].filter(Boolean).join(' · ');
  return [`Olá, ${prim(d.dest.nome)}! Tudo bem?`, '',
    d.via ? `Informamos que o processo de ${d.cli.nome} já está em andamento na Justiça:` : 'Informamos que o seu processo já está em andamento na Justiça:',
    `📁 ${pr.titulo || 'Processo'}`, `Nº ${pr.numero}`, onde ? `📍 ${onde}` : '', contra.length ? `${pc === 'passivo' ? np.ativo : np.passivo}: ${contra.join(', ')}` : '', '',
    link ? `Você pode acompanhar pelo site do tribunal:
${link}
(se a página pedir, informe o número do processo acima)` : 'Você pode acompanhar pelo site do tribunal, informando o número do processo acima.', '',
    'Sempre que houver novidade importante, avisaremos você. Qualquer dúvida, estamos à disposição.'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n').trim();
}
function formWhatsProc(id, aoCadastrar){
  const pr = byId('processos', id); if(!pr) return;
  const d = destinatarioWhats({processoId:id}); if(!d) return toast('O processo não tem cliente cadastrado');
  const tel = digits(d.dest.telefone); let registrado = false;
  openForm({ title:aoCadastrar ? '🟢 Avisar o cliente sobre o processo?' : '🟢 Enviar os dados do processo ao cliente', soFechar:true, fields:[{type:'html', html:`
    ${aoCadastrar ? '<p class="small" style="margin-top:0">O processo tem número. Quer enviar ao cliente os dados e o link para acompanhar? Se não quiser agora, é só fechar — o botão “🟢 enviar ao cliente” fica na ficha do processo.</p>' : ''}
    <div class="small muted">Para</div><div><b>${esc(d.cli.nome)}</b>${d.via ? ' — ' + d.via : ''} · ${tel ? esc(d.dest.telefone) : '<span style="color:var(--bad)">sem telefone cadastrado</span>'}</div>
    <div class="fld" style="margin-top:10px"><label>Mensagem (pode ajustar antes de enviar)</label><textarea id="wTxt" rows="13">${esc(msgProcesso(pr, d))}</textarea></div>
    <label class="chk" style="margin-top:8px"><input type="checkbox" id="wReg" checked> Registrar este aviso no histórico de atendimentos do cliente</label>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">${tel ? `<a class="btn" id="wAbrir" target="_blank" rel="noopener" style="background:#25d366;border-color:#25d366;color:#fff;text-decoration:none">Abrir no WhatsApp</a>` : ''}<button type="button" class="btn" id="wCopiar">📋 Copiar mensagem</button></div>
    <div class="small muted" style="margin-top:6px">${linkConsultaPublica(pr) ? 'O link é o da consulta pública do tribunal (sem certificado).' : 'Este tribunal não tem link automático: informe o “Link de consulta” no cadastro do processo, se quiser enviá-lo.'}</div>`}],
    after: f => {
      const txt = f.querySelector('#wTxt'), a = f.querySelector('#wAbrir');
      const link = () => { if(a){ let n = tel; if(!n.startsWith('55')) n = '55' + n; a.href = `https://wa.me/${n}?text=${encodeURIComponent(txt.value)}`; } };
      link(); txt.addEventListener('input', link);
      const registrar = () => { if(registrado) return; registrado = true;
        if(f.querySelector('#wReg').checked) upsert('conversas', {pessoaId:d.cli.id, processoId:id, dataHora:nowLocal(), canal:'WhatsApp', iniciadoPor:'escritorio', categoria:OPT.catAtend.includes('Processo') ? 'Processo' : '', assunto:'Dados do processo enviados ao cliente', relato:txt.value});
        upsert('processos', {id, clienteAvisadoProc:digits(pr.numero)}); renderSeguro(); toast(`Aviso registrado nas conversas do processo ${procCode(pr) || pr.numero}`); };
      if(a) a.addEventListener('click', registrar);
      f.querySelector('#wCopiar').onclick = () => { (navigator.clipboard ? navigator.clipboard.writeText(txt.value) : Promise.reject()).then(() => toast('Mensagem copiada'), () => { txt.select(); document.execCommand('copy'); toast('Mensagem copiada'); }); registrar(); };
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
// mensagem padrão para o próximo contato com o lead
const msgLeadPadrao = l => `Olá, ${String(l.nome || '').trim().split(/\s+/)[0] || ''}! Tudo bem? Aqui é Guilherme Garcia, advogado. Estou retornando o nosso contato sobre o seu caso${l.area ? ' na área ' + l.area.toLowerCase() : ''}. Podemos conversar?`;
const waLink = (tel, txt) => { let d = digits(tel); if(d.length < 10) return ''; if(!d.startsWith('55')) d = '55' + d; return `https://wa.me/${d}${txt ? '?text=' + encodeURIComponent(txt) : ''}`; };
// lembrete do próximo contato na agenda (uma tarefa ligada ao lead, mantida em sincronia com ele)
function sincronizarLembreteLead(l){
  let pz = l.prazoId && byId('prazos', l.prazoId), aberto = !['Fechado', 'Perdido'].includes(l.status);
  // tarefa já cumprida não é reaberta: o próximo contato vira uma tarefa nova (a cumprida fica no histórico)
  // (data igual ou anterior à da tarefa cumprida: nada muda — editar o lead não reabre o que já foi feito)
  if(pz && pz.concluido){ if(!l.proximoContato || l.proximoContato <= pz.data || l.proximoContato < (pz.concluidoEm || '')) return; pz = null; }
  if(l.lembrete !== false && l.proximoContato && aberto){
    const rec = {titulo:`📞 Contato com o lead: ${l.nome}`, tipo:'Tarefa', contatoCom:'Lead', data:l.proximoContato, leadId:l.id, pessoaId:l.pessoaId || '', obs:l.msgContato || '', situacao:'Pendente', concluido:false};
    // a caixa do lead promete “(e na Google Agenda)”: pede o envio, salvo se esse lembrete foi tirado da Google Agenda à mão
    // já aberto à mão na tela do Google para esta mesma data: não pede o envio direto (não duplica o evento)
    if(GCAL_AUTO && !(pz && pz.gcalNao) && !(pz && pz.gcalId) && !(pz && pz.agendaEnviada && pz.agendaEnviada === pzKey({...pz, data:rec.data}))) rec.gcalPedido = true;
    rec.coluna = colunaAuto(rec);
    if(pz){ if(pz.data !== rec.data){ rec.reagendadoDe = ''; rec.reagendamentos = 0; } upsert('prazos', {...rec, id:pz.id}); }
    else { const n = upsert('prazos', rec); db.leads.find(x => x.id === l.id).prazoId = n.id; save(); }
    if(typeof gcalAgendar === 'function') gcalAgendar(1500, true);
  } else if(pz && !pz.concluido){
    if(!aberto) upsert('prazos', {id:pz.id, situacao:'Realizado', concluido:true, concluidoEm:today()});
    else removeItem('prazos', pz.id);
  }
}
// lembretes de lead futuros que ficaram fora da Google Agenda (antes desta correção): pede o envio uma vez
function leadLembretesGcal(){ if(!GCAL_AUTO) return 0; if(ARM.carregando) return setTimeout(leadLembretesGcal, 2000); if(db.meta.leadGcalMig) return; let n = 0;
  db.prazos.forEach(p => { const l = p.leadId && byId('leads', p.leadId); if(!l || l.lembrete === false || p.concluido || p.gcalId || p.gcalNao || p.gcalPedido || (p.data || '') < today()) return; p.gcalPedido = true; n++; });
  db.meta.leadGcalMig = true; save(); if(n && typeof gcalAgendar === 'function') gcalAgendar(3000); return n; }
setTimeout(leadLembretesGcal, 4000);
function formLead(l = {}){
  const isNew = !l.id;
  const clientes = () => db.pessoas.filter(p => p.tipo === 'Cliente').sort((a, b) => (a.nome || '').localeCompare(b.nome || '')).map(p => ({v:p.id, t:p.nome + (p.pasta ? ' · pasta ' + p.pasta : '')}));
  const etapasAbertas = () => OPT.statusLead.filter(x => x !== 'Perdido');
  openForm({ title: isNew ? 'Novo lead' : 'Editar lead', data:{status:'Novo', lembrete:true, regConv:true, ...l, perdido:l.status === 'Perdido', msgContato:l.msgContato || ''},
    fields: [
      {k:'nome', label:'Nome', req:true},
      {k:'telefone', label:'Telefone / WhatsApp'},
      {k:'email', label:'E-mail', type:'email'},
      {k:'origem', label:'Origem', type:'select', options:() => OPT.origemLead, lista:'origemLead'},
      {k:'indicadoPor', label:'Indicado por'},
      {k:'area', label:'Área', type:'select', options:() => OPT.area, lista:'area'},
      {type:'sect', label:'💬 Contato inicial'},
      {k:'primeiroContato', label:'Data e hora do contato inicial', type:'datetime-local', ...(isNew ? {def:nowLocal()} : {})},
      ...(isNew ? [{k:'convCanal', label:'Canal', type:'select', options:() => OPT.canal, empty:false},
        {k:'convIniciou', label:'Quem iniciou o contato?', type:'radio', options:[{v:'cliente', t:'O lead'}, {v:'escritorio', t:'O escritório'}], def:'cliente'}] : []),
      {k:'descricao', label:'Resumo do caso (o que foi conversado)', type:'textarea', rows:4, full:true},
      ...(isNew ? [{k:'regConv', label:'Registrar também como conversa no histórico de contatos do lead', type:'check', full:true}] : []),
      {type:'sect', label:'📈 Andamento do lead'},
      {k:'status', label:'Etapa', type:'select', options:() => (l.status === 'Perdido' ? OPT.statusLead : etapasAbertas()), empty:false},
      {k:'pessoaId', label:'Já é cliente cadastrado? (opcional)', type:'select', options:clientes, emptyLabel:'— não / ainda não —'},
      {k:'valorEstimado', label:'Honorários estimados (R$)', type:'number'},
      {k:'perdido', label:'Lead perdido / contato encerrado', type:'check'},
      {k:'fechadoEm', label:'Data do encerramento', type:'date'},
      {k:'motivoPerda', label:'Motivo da perda'},
      {type:'sect', label:'📞 Próximo contato'},
      {k:'proximoContato', label:'Data do próximo contato', type:'date'},
      {k:'lembrete', label:'Criar lembrete na agenda, na Google Agenda e no WhatsApp, com a mensagem (na tela seguinte, em “Salvar e continuar →”)', type:'check'},
      {k:'msgContato', label:'Mensagem para enviar no próximo contato', type:'textarea', rows:3, full:true},
      ...camposFields('lead', l), {type:'grupo', fim:true},
    ],
    after: f => {
      const box = n => (f.elements[n] instanceof RadioNodeList ? f.elements[n][0] : f.elements[n])?.closest('.fld');
      const mostra = (n, v) => { const b = box(n); if(b) b.style.display = v ? '' : 'none'; };
      // "Indicado por" só quando a origem é uma indicação
      const org = f.elements.origem, ind = () => mostra('indicadoPor', /indica/i.test(org.value) || !!f.elements.indicadoPor.value.trim() && !org.value);
      org.addEventListener('change', ind); ind();
      // mensagem do próximo contato
      const msg = f.elements.msgContato, auto = () => { if(!msg.value.trim() || msg.dataset.auto === '1'){ msg.value = msgLeadPadrao({nome:f.elements.nome.value, area:f.elements.area.value}); msg.dataset.auto = '1'; } };
      if(!msg.value.trim()) auto();
      msg.addEventListener('input', () => { msg.dataset.auto = '0'; });
      f.elements.nome.addEventListener('input', auto); f.elements.area.addEventListener('change', auto);
      // lead perdido: só então data do encerramento e motivo; "Fechado": só a data do fechamento
      const st = f.elements.status, pd = f.elements.perdido, fe = f.elements.fechadoEm, lblFe = box('fechadoEm')?.querySelector('label');
      const atualiza = () => {
        const perd = pd.checked, fech = st.value === 'Fechado';
        mostra('fechadoEm', perd || fech); mostra('motivoPerda', perd);
        if(lblFe) lblFe.textContent = perd ? 'Data do encerramento' : 'Data do fechamento do contrato';
        if((perd || fech) && !fe.value) fe.value = today();
        st.disabled = perd; if(perd){ if(![...st.options].some(o => o.value === 'Perdido')) st.insertAdjacentHTML('beforeend', '<option value="Perdido">Perdido</option>'); st.value = 'Perdido'; }
        else if(st.value === 'Perdido') st.value = etapasAbertas()[0];
        ['proximoContato', 'lembrete', 'msgContato'].forEach(n => mostra(n, !perd && !fech));
      };
      pd.addEventListener('change', atualiza); st.addEventListener('change', atualiza); atualiza();
      // “Salvar e continuar →”: salva e abre a tela seguinte (Google Agenda e WhatsApp do próximo contato)
      mForm._leadCont = false;
      const sb = f.querySelector('.mfoot button[type=submit]');
      if(sb){ sb.insertAdjacentHTML('afterend', '<button type="button" class="btn" id="ldCont">Salvar e continuar →</button>');
        f.querySelector('#ldCont').onclick = () => { mForm._leadCont = true; mForm.requestSubmit(); setTimeout(() => { mForm._leadCont = false; }, 0); }; }
    },
    onSave: out => {
      const cont = !!mForm._leadCont; mForm._leadCont = false;
      const {regConv, convCanal, convIniciou, perdido, ...dados} = out;
      if(perdido) dados.status = 'Perdido'; else if(dados.status === 'Perdido') dados.status = etapasAbertas()[0];
      if(!['Fechado', 'Perdido'].includes(dados.status)) dados.fechadoEm = '';
      else if(!dados.fechadoEm) dados.fechadoEm = today();
      if(dados.status !== 'Perdido') dados.motivoPerda = '';
      if(!/indica/i.test(dados.origem || '')) dados.indicadoPor = dados.origem ? '' : dados.indicadoPor;
      const r = upsert('leads', {...l, ...dados});
      if(dados.pessoaId) db.conversas.forEach(c => { if(c.leadId === r.id && !c.pessoaId) c.pessoaId = dados.pessoaId; });
      if(isNew && regConv && (dados.descricao || '').trim())
        upsert('conversas', {leadId:r.id, pessoaId:dados.pessoaId || '', dataHora:dados.primeiroContato || nowLocal(), canal:convCanal || 'WhatsApp', iniciadoPor:convIniciou || 'cliente', categoria:OPT.catAtend.includes('Consulta') ? 'Consulta' : '', assunto:'Contato inicial', relato:dados.descricao.trim()});
      sincronizarLembreteLead(byId('leads', r.id)); save();
      const lemb = dados.proximoContato && dados.lembrete !== false && !['Fechado', 'Perdido'].includes(dados.status);
      const gDir = typeof gcalDireto === 'function' && gcalDireto(), pzL = lemb && byId('prazos', byId('leads', r.id)?.prazoId);
      const vaiG = gDir && pzL && !pzL.gcalNao && !pzL.concluido && (pzL.gcalId || pzL.gcalPedido);
      toast(lemb ? `Salvo — lembrete na agenda para ${fmtD(dados.proximoContato)}${vaiG ? (pzL.gcalId ? ' e na Google Agenda' : ' · enviando à Google Agenda…') : cont ? '' : ' · para a Google Agenda, use “Salvar e continuar →”'}` : 'Salvo');
      // confirma de verdade: avisa quando gravou na Google Agenda, ou o motivo de não ter gravado (fica pendente e é tentado de novo)
      if(vaiG && !pzL.gcalId){ const pid = pzL.id; setGcalEst({erro:''}); gcalSincronizar(true).then(() => { const q = byId('prazos', pid), e = gcalEst();
        toast(q?.gcalId ? '📅 Lembrete do lead salvo na Google Agenda' : !navigator.onLine ? '⚠️ Sem internet: o lembrete vai para a Google Agenda quando a conexão voltar' : '⚠️ Lembrete não foi para a Google Agenda' + (e.erro ? ': ' + e.erro : '') + ' — fica pendente e será tentado de novo (ou use “enviar à Google Agenda” no lead)'); }); }
      if(isNew) go('#/lead/' + r.id);
      if(cont) setTimeout(() => leadPassos(r.id), 150); },
    onDelete: !isNew ? () => { if(!confirm('Excluir este lead e suas anotações de contato?')) return false;
      if(l.prazoId && byId('prazos', l.prazoId) && !byId('prazos', l.prazoId).concluido) removeItem('prazos', l.prazoId);
      db.conversas = db.conversas.filter(c => !(c.leadId === l.id && !c.pessoaId)); removeItem('leads', l.id); go('#/leads'); } : null });
}
// tela seguinte ao “Salvar e continuar →” do lead: situação na Google Agenda, abrir a Google Agenda (tela do Google com tudo preenchido) e WhatsApp
const gcalDiaUrl = d => 'https://calendar.google.com/calendar/r/day/' + String(d || today()).replace(/-/g, '/');
function leadGcalAbrir(pid){ const p = byId('prazos', pid); if(!p) return;
  if(p.gcalId){ window.open(gcalDiaUrl(p.data), '_blank', 'noopener'); return; }
  window.open(googleUrl(p), '_blank', 'noopener');
  // marcado como enviado à mão: o envio direto deixa de pedir este lembrete (não fica duplicado na Google Agenda)
  upsert('prazos', {id:pid, agendaEnviada:pzKey(p), gcalPedido:false}); toast('📅 Google Agenda aberta com o lembrete preenchido — confira e clique em Salvar lá'); }
function leadPassos(id){
  const l = byId('leads', id); if(!l) return;
  const aberto = !['Fechado', 'Perdido'].includes(l.status), pz = l.prazoId && byId('prazos', l.prazoId), vivo = pz && !pz.concluido;
  const direto = typeof gcalDireto === 'function' && gcalDireto();
  const estado = () => { const p = byId('prazos', pz.id); if(!p) return '';
    if(p.gcalId) return '<span class="tag ok">✔ já está na sua Google Agenda</span>';
    if(p.agendaEnviada && p.agendaEnviada === pzKey(p)) return '<span class="tag">📅 aberto na tela do Google — confira se salvou lá</span>';
    if(!direto) return '<span class="tag grey">ainda não está na Google Agenda — abra a tela do Google abaixo</span>';
    if(!p.gcalPedido && !gcalRodando) return '<span class="tag grey">ainda não está na Google Agenda</span>';
    const e = gcalEst().erro; return `<span class="tag" style="background:#fff4e5;color:#b45309">⏳ ${gcalRodando ? 'enviando à Google Agenda…' : 'ainda não foi para a Google Agenda' + (e ? ' — ' + esc(String(e).slice(0, 80)) : '')}</span>`; };
  const wl = l.telefone && l.msgContato && aberto ? waLink(l.telefone, l.msgContato) : '';
  openForm({title:'➡️ Próximos passos do lead', soFechar:true, fields:[{type:'html', html:`<div class="small muted" style="margin:-4px 0 12px">✔ Lead salvo: <b>${esc(l.nome)}</b>${l.proximoContato && aberto ? ' — próximo contato em ' + fmtD(l.proximoContato) + ' (' + rel(l.proximoContato) + ')' : ''}.</div>
    <div class="pp"><h4>📅 Google Agenda</h4>${vivo ? `<div class="small">${esc(pz.titulo)} — ${fmtD(pz.data)}</div><div id="lpEst" style="margin:6px 0">${estado()}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn${direto ? '' : ' primary'}" id="lpAbrir">📅 Abrir a Google Agenda</button>${direto ? '<button type="button" class="btn primary" id="lpEnviar">📅 Enviar à Google Agenda</button>' : ''}</div>
      <div class="small muted" style="margin-top:6px" id="lpDica"></div>`
      : `<div class="small muted">${!aberto ? 'Lead encerrado — sem lembrete de próximo contato.' : !l.proximoContato ? 'Sem data de próximo contato — informe a data no lead para criar o lembrete.' : 'O lembrete na agenda está desmarcado neste lead.'}</div>`}</div>
    ${wl ? `<div class="pp"><h4>🟢 Mensagem do próximo contato</h4><div class="small">${esc(l.msgContato)}</div><div style="text-align:right;margin-top:8px"><a class="btn ok" href="${esc(wl)}" target="_blank" rel="noopener">🟢 Abrir no WhatsApp</a></div></div>` : ''}`}],
    after:f => { f.querySelector('.mfoot').innerHTML = `<span class="sp"></span><button type="button" class="btn" id="lpFicha">Ver o lead</button><button type="button" class="btn" id="mCancel">Fechar</button><button type="button" class="btn primary" id="lpVolta">← Voltar ao lead</button>`;
      f.querySelector('#lpFicha').onclick = () => { closeModal(); go('#/lead/' + id); };
      f.querySelector('#lpVolta').onclick = () => formLead(byId('leads', id));
      if(!vivo) return;
      const atualiza = () => { const p = byId('prazos', pz.id), est = f.querySelector('#lpEst'), ab = f.querySelector('#lpAbrir'), dica = f.querySelector('#lpDica'), env = f.querySelector('#lpEnviar'); if(!p || !est) return;
        est.innerHTML = estado(); if(env){ env.style.display = p.gcalId ? 'none' : ''; env.textContent = p.gcalPedido && gcalEst().erro ? '🔄 Tentar enviar de novo' : '📅 Enviar à Google Agenda'; }
        ab.textContent = p.gcalId ? '📅 Abrir a Google Agenda neste dia' : direto ? 'Abrir a tela do Google (preenchida)' : '📅 Abrir a Google Agenda (com o lembrete preenchido)';
        dica.textContent = p.gcalId ? 'Abre o dia do lembrete na sua Google Agenda.' : (direto ? '“Enviar à Google Agenda” grava direto, com as cores e notificações configuradas. Se preferir, ' : '') + (direto ? 'a' : 'A') + 'bra a tela do Google com título, data, mensagem e link do WhatsApp preenchidos — confira e clique em Salvar lá.'; };
      atualiza();
      f.querySelector('#lpAbrir').onclick = () => { leadGcalAbrir(pz.id); atualiza(); };
      const env = f.querySelector('#lpEnviar'); if(env) env.onclick = () => { upsert('prazos', {id:pz.id, gcalPedido:true, gcalNao:false, agendaEnviada:''}); setGcalEst({erro:''}); env.disabled = true; atualiza();
        gcalSincronizar(true).then(() => { env.disabled = false; if(formCfg && f.querySelector('#lpEst')) atualiza(); }); };
      // envio direto em andamento logo depois de salvar: atualiza a situação quando terminar
      if(direto && gcalPromessa) gcalPromessa.then(() => setTimeout(() => { if(f.querySelector('#lpEst')) atualiza(); }, 50));
    } });
}
// ao cumprir a tarefa de retorno ao lead: registrar como foi e marcar o próximo contato (mesmos campos do lead)
function formLeadCumprido(pid){
  const pz = byId('prazos', pid), l = pz && pz.leadId && byId('leads', pz.leadId);
  if(!l || ['Fechado', 'Perdido'].includes(l.status)) return false;
  openForm({title:'📞 Contato com o lead cumprido', data:{status:l.status || 'Novo', lembrete:l.lembrete !== false, canal:'WhatsApp', proximoContato:'', msgContato:''},
    fields:[{type:'html', html:`<div class="small muted" style="margin:-4px 0 8px">✔ Tarefa cumprida: <b>${esc(l.nome)}</b>. Registre como foi e, se for o caso, marque o próximo contato.</div>`},
      {k:'relato', label:'Como foi o contato? (opcional — vai para o histórico do lead)', type:'textarea', rows:3, full:true},
      {k:'canal', label:'Canal', type:'select', options:() => OPT.canal, empty:false},
      {k:'status', label:'Etapa', type:'select', options:() => OPT.statusLead, empty:false},
      {type:'sect', label:'📞 Próximo contato'},
      {k:'proximoContato', label:'Data do próximo contato', type:'date'},
      {k:'lembrete', label:'Criar lembrete na agenda, na Google Agenda e no WhatsApp, com a mensagem (na tela seguinte, em “Salvar e continuar →”)', type:'check'},
      {k:'msgContato', label:'Mensagem para enviar no próximo contato', type:'textarea', rows:3, full:true}],
    after: f => {
      const box = n => f.elements[n]?.closest('.fld'), msg = f.elements.msgContato, st = f.elements.status;
      msg.value = msgLeadPadrao(l);
      const atualiza = () => { const fim = ['Fechado', 'Perdido'].includes(st.value); ['proximoContato', 'lembrete', 'msgContato'].forEach(n => { const b = box(n); if(b) b.style.display = fim ? 'none' : ''; }); };
      st.addEventListener('change', atualiza); atualiza();
      const c = f.querySelector('#mCancel'); if(c) c.textContent = 'Agora não';
      mForm._leadCont = false;
      const sb = f.querySelector('.mfoot button[type=submit]');
      if(sb){ sb.insertAdjacentHTML('afterend', '<button type="button" class="btn" id="lcCont">Salvar e continuar →</button>');
        f.querySelector('#lcCont').onclick = () => { mForm._leadCont = true; mForm.requestSubmit(); setTimeout(() => { mForm._leadCont = false; }, 0); }; }
    },
    onSave: out => {
      const cont = !!mForm._leadCont; mForm._leadCont = false;
      const fim = ['Fechado', 'Perdido'].includes(out.status), dados = {id:l.id, status:out.status};
      if(fim){ dados.fechadoEm = l.fechadoEm || today(); }
      else { dados.proximoContato = out.proximoContato || ''; dados.lembrete = out.lembrete !== false; dados.msgContato = out.msgContato || ''; }
      upsert('leads', dados);
      if((out.relato || '').trim()) upsert('conversas', {leadId:l.id, pessoaId:l.pessoaId || '', dataHora:nowLocal(), canal:out.canal || 'WhatsApp', iniciadoPor:'escritorio', assunto:'Retorno ao lead', relato:out.relato.trim()});
      sincronizarLembreteLead(byId('leads', l.id)); save(); render();
      const lemb = !fim && dados.proximoContato && dados.lembrete;
      toast(lemb ? `Salvo — próximo contato em ${fmtD(dados.proximoContato)} na agenda` : 'Salvo');
      if(cont) setTimeout(() => leadPassos(l.id), 150); } });
  return true;
}
function convertLead(id){
  const l = byId('leads', id); if(!l) return;
  if(l.pessoaId && byId('pessoas', l.pessoaId)) return go('#/pessoa/' + l.pessoaId);
  if(!confirm(`Converter "${l.nome}" em cliente?\n\nSerá criada a ficha do cliente e todo o histórico de contatos será levado para ela.`)) return;
  const p = upsert('pessoas', {nome:l.nome, tipo:'Cliente', natureza:'Física', ...novoClienteExtra('Cliente'), telefone:fmtTel(l.telefone || ''), email:l.email || '', origem:l.origem || '', indicacao:l.indicadoPor || '', obs:l.descricao || ''});
  db.conversas.forEach(c => { if(c.leadId === l.id) c.pessoaId = p.id; });
  upsert('leads', {id:l.id, status:'Fechado', pessoaId:p.id, fechadoEm:l.fechadoEm || today()}); sincronizarLembreteLead(byId('leads', l.id));
  toast('Cliente criado'); go('#/pessoa/' + p.id);
}
/* ----- Financeiro ----- */
