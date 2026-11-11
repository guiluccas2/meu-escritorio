// Meu Escritório — Preenchimento com IA (Claude, da Anthropic): chave, chamadas e caixa “Preencher com IA”
'use strict';
/* ================= PREENCHIMENTO COM IA (Claude, da Anthropic) ================= */
const IA_MODELO = 'claude-opus-5-5';
const IA_SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.136.0/+esm';
const IA_PRECO = {in:4, out:20};   // US$ por milhão de tokens (Claude Opus 5.5)
const iaKey = () => { try{ return localStorage.getItem('escritorio_ia_key') || ''; }catch(e){ return ''; } };
function iaUso(){ try{ const u = JSON.parse(localStorage.getItem('escritorio_ia_uso')) || {}; return u.mes === today().slice(0, 7) ? u : {mes:today().slice(0, 7), in:0, out:0, n:0}; }catch(e){ return {mes:today().slice(0, 7), in:0, out:0, n:0}; } }
function iaSomarUso(u){ const a = iaUso(); a.in += u.input_tokens || 0; a.out += u.output_tokens || 0; a.n++; try{ localStorage.setItem('escritorio_ia_uso', JSON.stringify(a)); }catch(e){} }
const iaCustoUsd = u => (u.in * IA_PRECO.in + u.out * IA_PRECO.out) / 1e6;
let iaModP = null;
async function iaClient(){
  if(!iaKey()) throw new Error('a chave da IA não está configurada (Backup e dados → Inteligência artificial)');
  if(!iaModP) iaModP = import(IA_SDK);
  let mod; try{ mod = await iaModP; }catch(e){ iaModP = null; throw new Error('não foi possível carregar o módulo da IA (verifique a internet)'); }
  const Anthropic = mod.default || mod.Anthropic;
  return {Anthropic, client:new Anthropic({apiKey:iaKey(), dangerouslyAllowBrowser:true, maxRetries:2})};
}
async function iaChamar(system, partes, schema){
  const {Anthropic, client} = await iaClient();
  let resp;
  try{
    resp = await client.beta.messages.create({
      model:IA_MODELO, max_tokens:16000,
      betas:['server-side-fallback-2026-07-01'], fallbacks:'default',
      output_config:{effort:'medium', format:{type:'json_schema', schema}},
      system, messages:[{role:'user', content:partes}],
    });
  }catch(e){
    if(e instanceof Anthropic.AuthenticationError) throw new Error('a chave da IA foi recusada pela Anthropic — confira em Backup e dados');
    if(e instanceof Anthropic.PermissionDeniedError) throw new Error('a conta da Anthropic não tem permissão para este uso (verifique créditos e permissões)');
    if(e instanceof Anthropic.RateLimitError) throw new Error('muitas solicitações seguidas — aguarde um minuto e tente de novo');
    if(e instanceof Anthropic.BadRequestError) throw new Error('a IA não aceitou o pedido: ' + e.message);
    if(e instanceof Anthropic.APIConnectionError) throw new Error('sem conexão com a IA (verifique a internet)');
    if(e instanceof Anthropic.APIError) throw new Error(`a IA respondeu com erro ${e.status}: ${e.message}`);
    throw e;
  }
  if(resp.usage) iaSomarUso(resp.usage);
  if(resp.stop_reason === 'refusal') throw new Error('a IA não processou este conteúdo (recusa de segurança)');
  if(resp.stop_reason === 'max_tokens') throw new Error('o conteúdo é grande demais — envie menos páginas ou imagens');
  const txt = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
  try{ return JSON.parse(txt); }catch(e){ throw new Error('a resposta da IA veio em formato inesperado — tente de novo'); }
}
// ----- arquivos (imagens reduzidas no próprio aparelho; PDF enviado como documento) -----
function lerBase64(file){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(file); }); }
async function prepararArquivo(file){
  if(file.type === 'application/pdf'){ if(file.size > 25 * 1024 * 1024) throw new Error('PDF maior que 25 MB'); return {tipo:'pdf', nome:file.name, data:await lerBase64(file)}; }
  if(!file.type.startsWith('image/')) throw new Error('tipo de arquivo não suportado: ' + (file.name || file.type));
  const url = URL.createObjectURL(file);
  try{
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('não foi possível ler a imagem')); i.src = url; });
    const max = 1600, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    const durl = c.toDataURL('image/jpeg', 0.9);
    return {tipo:'img', nome:file.name || 'imagem colada', data:durl.split(',')[1], thumb:durl};
  } finally { URL.revokeObjectURL(url); }
}
// ----- caixa "Preencher com IA" -----
function iaBoxHtml(){
  if(!iaKey()) return `<div class="iaBox iaOff small">✨ <b>Preencher com IA</b> — <a href="#/config" onclick="closeModal()">configure sua chave da Anthropic em Backup e dados</a> para preencher este formulário a partir de textos, prints ou PDFs.</div>`;
  return `<div class="iaBox"><div style="margin-bottom:6px">✨ <b>Preencher com IA</b> <span class="small muted">— cole o texto e/ou envie prints ou PDF; a IA preenche o formulário para você conferir.</span></div>
    <textarea id="iaTxt" rows="3" placeholder="Cole aqui a intimação, publicação, despacho ou a mensagem do cliente… (também dá para colar uma imagem com Ctrl+V)"></textarea>
    <div id="iaFiles" class="iaFiles"></div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px"><label class="btn" style="cursor:pointer">📷 Imagens / PDF<input type="file" id="iaFile" accept="image/*,application/pdf" multiple hidden></label>
      <button type="button" class="btn primary" id="iaGo">✨ Preencher</button><span id="iaSt" class="small muted"></span></div>
    <div id="iaRes"></div></div>`;
}
function iaMontar(f, tipo, aplicar){
  const box = f.querySelector('.iaBox:not(.iaOff)'); if(!box) return;
  const arqs = [], lista = box.querySelector('#iaFiles'), st = box.querySelector('#iaSt');
  const desenhar = () => { lista.innerHTML = arqs.map((a, i) => `<span class="iaChip">${a.thumb ? `<img src="${a.thumb}" alt="">` : '📄'} ${esc(a.nome.slice(0, 28))} <button type="button" data-i="${i}" title="Remover">✕</button></span>`).join(''); };
  const incluir = async files => { for(const fl of files){ try{ arqs.push(await prepararArquivo(fl)); }catch(e){ toast(e.message); } } desenhar(); };
  box.querySelector('#iaFile').addEventListener('change', e => { incluir([...e.target.files]); e.target.value = ''; });
  lista.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if(b){ arqs.splice(+b.dataset.i, 1); desenhar(); } });
  box.querySelector('#iaTxt').addEventListener('paste', e => { const im = [...(e.clipboardData?.items || [])].filter(x => x.type.startsWith('image/')).map(x => x.getAsFile()).filter(Boolean); if(im.length){ e.preventDefault(); incluir(im); } });
  box.querySelector('#iaGo').addEventListener('click', async () => {
    const txt = box.querySelector('#iaTxt').value.trim();
    if(!txt && !arqs.length) return toast('Cole um texto ou envie uma imagem / PDF');
    const btn = box.querySelector('#iaGo'); btn.disabled = true; st.textContent = '⏳ A IA está lendo… (pode levar alguns segundos)'; box.querySelector('#iaRes').innerHTML = '';
    try{
      const partes = [];
      arqs.forEach(a => partes.push(a.tipo === 'pdf' ? {type:'document', source:{type:'base64', media_type:'application/pdf', data:a.data}} : {type:'image', source:{type:'base64', media_type:'image/jpeg', data:a.data}}));
      partes.push({type:'text', text:`Data de hoje: ${today()} (${parseD(today()).toLocaleDateString('pt-BR', {weekday:'long'})}).\n\n${txt ? 'Texto fornecido:\n<<<\n' + txt + '\n>>>' : 'Use o conteúdo das imagens / documentos acima.'}`});
      const r = await iaChamar(IA_SISTEMA[tipo](), partes, IA_SCHEMA[tipo]());
      f.querySelectorAll('.iaFill').forEach(x => x.classList.remove('iaFill'));
      const resumo = aplicar(f, r, txt);
      st.textContent = '✅ Preenchido — confira os campos destacados em amarelo antes de salvar.';
      if(resumo) box.querySelector('#iaRes').innerHTML = resumo;
    }catch(e){ st.textContent = '⚠️ ' + e.message; }
    finally{ btn.disabled = false; }
  });
}
function iaSet(f, nome, v){
  const el = f.elements[nome]; if(!el || v === undefined || v === null || v === '') return false;
  if(el.type === 'checkbox'){ el.checked = !!v; }
  else if(el.tagName === 'SELECT'){ if(![...el.options].some(o => o.value === String(v))) el.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`); el.value = v; }
  else el.value = v;
  el.dispatchEvent(new Event('change', {bubbles:true})); el.dispatchEvent(new Event('input', {bubbles:true}));
  (el.closest('.fld') || el).classList.add('iaFill'); return true;
}
const iaData = v => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
const iaHora = v => /^\d{2}:\d{2}$/.test(v || '') ? v : '';
function iaAcharProcesso(...textos){
  const re = /\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/g, nums = [];
  textos.forEach(t => { (String(t || '').match(re) || []).forEach(n => nums.push(digits(n))); const d = digits(t); if(d.length === 20) nums.push(d); });
  for(const n of nums){ const p = db.processos.find(x => digits(x.numero) === n); if(p) return p; }
  return null;
}
function iaAcharPessoa(nome){
  const n = norm_s(nome).trim(); if(n.length < 3) return null;
  return db.pessoas.find(p => norm_s(p.nome) === n) || db.pessoas.find(p => norm_s(p.nome).includes(n) || n.includes(norm_s(p.nome))) || null;
}
function iaCalcPrazo(it){
  const ref = iaData(it.data_referencia_prazo), n = parseInt(it.prazo_dias, 10);
  if(ref && n > 0){ const tipo = it.contagem === 'corridos' ? 'c' : 'u'; return {data:calcPrazo(ref, n, tipo), nota:`Prazo de ${n} dia(s) ${tipo === 'u' ? 'úteis' : 'corridos'} contado a partir de ${fmtD(ref)} — data final calculada pelo sistema (confira feriados locais).`}; }
  return {data:iaData(it.data), nota:''};
}
const IA_BASE = `Você é assistente de um escritório de advocacia brasileiro e extrai informações de publicações, intimações, despachos, atas, e-mails e conversas (inclusive prints de WhatsApp) para preencher um sistema de controle de processos.
Regras:
- Use somente o que está no conteúdo. Não invente. Campo sem informação: texto vazio "", número 0, lista vazia.
- Datas no formato AAAA-MM-DD e horas no formato HH:MM (24h). Se o texto disser "amanhã", "próxima segunda" etc., converta usando a data de hoje informada.
- Escreva em português do Brasil, de forma objetiva.`;
const IA_SISTEMA = {
  prazo: () => IA_BASE + `
Tarefa: identificar cada providência com data — prazo processual, audiência, perícia, reunião, diligência ou tarefa — e devolver um item para cada uma.
- Para PRAZOS contados em dias (ex.: "manifeste-se em 15 dias"), NÃO calcule a data final: informe prazo_dias, contagem ("uteis" para prazos do CPC/CLT em dias úteis; "corridos" quando o texto ou a lei indicar dias corridos) e data_referencia_prazo = a data a partir da qual o prazo começa a contar (normalmente a data da publicação ou da intimação/ciência informada no texto). Nesses casos deixe "data" vazio.
- Para AUDIÊNCIAS e eventos com data marcada, preencha data, hora, data_fim/hora_fim (se houver) e local (endereço, sala ou link da sala virtual).
- "tipo" deve ser exatamente uma das opções permitidas. "subtipo": para audiências, a modalidade (Conciliação, Instrução, UNA, Instrução e julgamento, Julgamento, Mediação…); caso contrário "".
- "titulo": curto e claro (ex.: "Réplica", "Audiência de conciliação", "Manifestação sobre o laudo pericial").
- "checklist": até 5 providências práticas que o advogado costuma fazer para cumprir aquele item (ex.: arrolar testemunhas, orientar o cliente, juntar documentos). Lista vazia se não fizer sentido.
- "numero_processo": o número CNJ, se aparecer.`,
  conversa: () => IA_BASE + `
Tarefa: registrar uma conversa com cliente (normalmente prints de WhatsApp, e-mail ou anotação de telefonema).
- "relato": resumo fiel e objetivo do que foi conversado — pedidos do cliente, informações passadas, orientações dadas, documentos pedidos. Não copie a conversa inteira.
- "assunto": título curto.
- "iniciado_por": "cliente" se a primeira mensagem do trecho foi do cliente; "escritorio" se foi do advogado/escritório; "" se não der para saber. Em prints de WhatsApp, as mensagens do dono do aparelho (o advogado) costumam ficar à direita.
- "proxima_acao" / "proxima_data": o que ficou combinado de ser feito e até quando (se houver).
- "data_hora": data e hora da conversa (se visíveis), no formato AAAA-MM-DDTHH:MM.
- "nome_cliente": nome do cliente/contato, se aparecer.
- "canal" e "categoria" devem ser exatamente uma das opções permitidas, ou "".`,
  andamento: () => IA_BASE + `
Tarefa: registrar um andamento processual (publicação, intimação, despacho, decisão, sentença, juntada…).
- "descricao": resumo objetivo do andamento, mantendo o essencial do dispositivo (o que foi decidido/determinado).
- "data": data do andamento (disponibilização/publicação ou assinatura).
- "tipo": exatamente uma das opções permitidas, ou "".
- Se o andamento abrir prazo para a parte (ex.: "intime-se para réplica em 15 dias"), gera_prazo = true, prazo_titulo curto (ex.: "Réplica"), prazo_dias, contagem ("uteis" ou "corridos") e data_referencia_prazo (data da publicação/intimação). NÃO calcule a data final. Se houver data certa já fixada (ex.: audiência), use prazo_data.`,
};
const iaObj = (props) => ({type:'object', additionalProperties:false, required:Object.keys(props), properties:props});
const S = {str:{type:'string'}, int:{type:'integer'}, bool:{type:'boolean'}, lista:{type:'array', items:{type:'string'}}};
const iaEnum = arr => ({type:'string', enum:[...new Set([...arr, ''])]});
const IA_SCHEMA = {
  prazo: () => iaObj({itens:{type:'array', items:iaObj({tipo:iaEnum(OPT.tipoPrazo), subtipo:S.str, titulo:S.str, data:S.str, hora:S.str, data_fim:S.str, hora_fim:S.str, dia_inteiro:S.bool,
    data_referencia_prazo:S.str, prazo_dias:S.int, contagem:iaEnum(['uteis','corridos']), local:S.str, numero_processo:S.str, nome_cliente:S.str, observacoes:S.str, checklist:S.lista})}, observacao_geral:S.str}),
  conversa: () => iaObj({data_hora:S.str, canal:iaEnum(OPT.canal), iniciado_por:iaEnum(['cliente','escritorio']), categoria:iaEnum(OPT.catAtend), nome_cliente:S.str, numero_processo:S.str, assunto:S.str, relato:S.str, proxima_acao:S.str, proxima_data:S.str}),
  andamento: () => iaObj({data:S.str, tipo:iaEnum(OPT.tipoAnd), descricao:S.str, numero_processo:S.str, gera_prazo:S.bool, prazo_titulo:S.str, data_referencia_prazo:S.str, prazo_dias:S.int, contagem:iaEnum(['uteis','corridos']), prazo_data:S.str}),
};
// converte um item da IA em compromisso
function iaItemParaPrazo(it, txt){
  const c = iaCalcPrazo(it), proc = iaAcharProcesso(it.numero_processo, txt), pes = proc ? byId('pessoas', proc.clienteId) : iaAcharPessoa(it.nome_cliente);
  const r = {titulo:it.titulo || it.tipo || 'Compromisso', tipo:OPT.tipoPrazo.includes(it.tipo) ? it.tipo : 'Prazo processual', subtipo:it.subtipo || '', situacao:'Pendente', concluido:false,
    data:c.data, dataFim:iaData(it.data_fim) || c.data, hora:iaHora(it.hora), horaFim:iaHora(it.hora_fim), diaInteiro:!!it.dia_inteiro && !iaHora(it.hora), local:it.local || '',
    dataFatal: (OPT.tipoPrazo.includes(it.tipo) ? it.tipo : 'Prazo processual') === 'Prazo processual' ? c.data : '',
    processoId:proc?.id || '', pessoaId:pes?.id || '', obs:[it.observacoes, c.nota].filter(Boolean).join('\n'), checklist:(it.checklist || []).filter(Boolean).map(t => ({t, ok:false}))};
  r.coluna = colunaAuto(r); return r;
}

/* ----- Representação legal (menores / incapazes) ----- */

