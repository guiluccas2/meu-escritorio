/* ===== 🤖 Assistente IA (Claude Haiku — rápido e barato), com controle de créditos =====
   Usa a mesma chave da Anthropic do “Preencher com IA” (guardada só no aparelho).
   Gasto registrado em db.iauso (um registro por aparelho e dia — soma certa entre aparelhos pelo Dropbox).
   Saldo: a Anthropic não informa o saldo pela chave comum — você informa o saldo atual e o sistema desconta o gasto estimado. */
const AS_MODELO = 'claude-haiku-5-5', AS_NOME = 'Claude Haiku 5.5';
const AS_PRECO = {in:0.10, out:0.50, inLongo:0.50, outLongo:2.50}; // US$ por milhão de tokens (acima de 100 mil tokens de entrada: preço maior)
const asCustoUsd = u => { const inT = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0), longo = inT > 100000;
  return (inT * (longo ? AS_PRECO.inLongo : AS_PRECO.in) + (u.output_tokens || 0) * (longo ? AS_PRECO.outLongo : AS_PRECO.out)) / 1e6; };
const iaDev = () => { try{ let d = localStorage.getItem('escritorio_dev'); if(!d){ d = Math.random().toString(36).slice(2, 8); localStorage.setItem('escritorio_dev', d); } return d; }catch(e){ return 'x'; } };
// registra o gasto de qualquer uso de IA (assistente e “Preencher com IA”)
function iaRegistrarGasto(usd){
  if(!(usd > 0)) return; const id = iaDev() + '_' + today(), r = byId('iauso', id);
  if(r){ r.usd = (r.usd || 0) + usd; r.n = (r.n || 0) + 1; save(); } else upsert('iauso', {id, data:today(), usd, n:1});
}
const iaGastoTotal = () => sum(db.iauso.map(r => r.usd || 0));
const iaGastoMes = (m = today().slice(0, 7)) => sum(db.iauso.filter(r => (r.data || '').startsWith(m)).map(r => r.usd || 0));
function iaSaldo(){ const s = db.meta.iaSaldo; if(!s || s.valor == null) return null; return {valor:s.valor, em:s.em, disp:s.valor - (iaGastoTotal() - (s.base || 0)), cot:s.cotacao || 0}; }
const usd = v => 'US$ ' + (Math.abs(v) < 0.1 && v ? v.toFixed(4) : v.toFixed(2)).replace('.', ',');
const brl = v => { const c = db.meta.iaSaldo?.cotacao; return c ? ' (≈ ' + money(v * c) + ')' : ''; };

/* ----- contexto (dados do processo / cliente) ----- */
function asContextoAuto(){
  const [v, id] = (location.hash || '').slice(2).split('/');
  if(v === 'processo' && byId('processos', id)) return 'proc:' + id;
  if(v === 'pessoa' && byId('pessoas', id)) return 'pes:' + id;
  return '';
}
function asCtxTexto(ref){
  const [k, id] = String(ref || '').split(':'), L = [], cort = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };
  if(k === 'proc'){ const p = byId('processos', id); if(!p) return '';
    const np = nomesPolos(p);
    L.push(`PROCESSO: ${p.titulo || ''} — nº ${p.numero || 's/ nº'}`, [p.tribunal, p.vara, p.comarca].filter(Boolean).join(' · '), `Área: ${p.area || '—'} · Situação: ${p.status || '—'}${p.dataInicio ? ' · início da atuação: ' + fmtD(p.dataInicio) : ''}`,
      `Cliente: ${pessoaNome(p.clienteId) || '—'}${p.posicao ? ' (' + p.posicao + ')' : ''}`);
    const contra = nomesContrarios(p); if(contra.length) L.push(`Parte contrária (${poloCliente(p) === 'passivo' ? np.ativo : np.passivo}): ${contra.join(', ')}`);
    const ands = db.andamentos.filter(a => a.processoId === id).sort(byDateDesc('data')).slice(0, 15);
    if(ands.length) L.push('', 'ÚLTIMOS ANDAMENTOS (mais recentes primeiro):', ...ands.map(a => `- ${fmtD(a.data)} · ${a.tipo || ''}: ${cort(a.descricao, 600)}`));
    const prz = db.prazos.filter(x => x.processoId === id && !x.concluido).sort(byDateAsc('data'));
    if(prz.length) L.push('', 'PRAZOS E COMPROMISSOS PENDENTES:', ...prz.map(x => `- ${fmtD(x.data)}${x.hora ? ' ' + x.hora : ''} · ${x.tipo || ''}: ${x.titulo}`));
    const pubs = db.monitor.filter(m => m.processoId === id && m.texto).sort(byDateDesc('data')).slice(0, 2);
    if(pubs.length) L.push('', 'ÚLTIMAS PUBLICAÇÕES / INTIMAÇÕES (texto):', ...pubs.map(m => `- ${fmtD(m.data)} · ${m.titulo || ''}\n${cort(m.texto, 3000)}`));
    const cv = db.conversas.filter(c => c.processoId === id).sort(byDateDesc('dataHora')).slice(0, 5);
    if(cv.length) L.push('', 'ÚLTIMAS CONVERSAS COM O CLIENTE:', ...cv.map(c => `- ${fmtD(String(c.dataHora || '').slice(0, 10))}: ${cort([c.assunto, c.relato].filter(Boolean).join(' — '), 400)}`));
  }
  if(k === 'pes'){ const p = byId('pessoas', id); if(!p) return '';
    const idd = idade(p.nascimento);
    L.push(`CLIENTE: ${p.nome} (${p.tipo || ''})`, [p.profissao && 'Profissão: ' + p.profissao, p.estadoCivil && 'Estado civil: ' + p.estadoCivil, idd != null && 'Idade: ' + idd + ' anos', p.menor && 'menor / incapaz'].filter(Boolean).join(' · '));
    if(p.obs) L.push('Observações: ' + cort(p.obs, 800));
    const procs = db.processos.filter(x => x.clienteId === id);
    if(procs.length) L.push('', 'PROCESSOS:', ...procs.map(x => `- ${x.titulo || ''} — nº ${x.numero || 's/ nº'} (${x.status || ''})`));
    const cv = db.conversas.filter(c => c.pessoaId === id).sort(byDateDesc('dataHora')).slice(0, 6);
    if(cv.length) L.push('', 'ÚLTIMAS CONVERSAS:', ...cv.map(c => `- ${fmtD(String(c.dataHora || '').slice(0, 10))}: ${cort([c.assunto, c.relato].filter(Boolean).join(' — '), 400)}`));
    L.push('', '(CPF, RG, telefone e endereço não são enviados.)');
  }
  return L.filter(x => x != null).join('\n');
}
const asCtxNome = ref => { const [k, id] = String(ref || '').split(':'); if(k === 'proc'){ const p = byId('processos', id); return p ? '📁 ' + (p.titulo || 'Processo') + (pessoaNome(p.clienteId) ? ' — ' + pessoaNome(p.clienteId) : '') : ''; }
  if(k === 'pes'){ const p = byId('pessoas', id); return p ? '👤 ' + p.nome : ''; } return ''; };

/* ----- conversa (fica só neste aparelho) ----- */
const AS_KEY = 'escritorio_ia_chat';
let AS = (() => { try{ return JSON.parse(localStorage.getItem(AS_KEY)) || null; }catch(e){ return null; } })() || {msgs:[], custo:0, ctx:'', enviarCtx:true};
const asSalvar = () => { try{ localStorage.setItem(AS_KEY, JSON.stringify({...AS, msgs:AS.msgs.slice(-40)})); }catch(e){} };
let asOcupado = false;
const asSistema = () => `Você é o assistente jurídico de um escritório de advocacia brasileiro, de um advogado que trabalha sozinho e atua principalmente no TJSP, no TRT da 15ª Região e no TRF da 3ª Região. Hoje é ${fmtD(today())}.
Responda sempre em português do Brasil, de forma direta e prática, sem rodeios. Use a legislação e a jurisprudência brasileiras.
Não invente números de leis, artigos, súmulas ou julgados: se não tiver certeza, diga que é preciso conferir. Datas no formato dd/mm/aaaa.
Ao calcular prazos, lembre que o sistema do escritório tem uma calculadora própria — indique o raciocínio e recomende conferir.
Ao redigir mensagens para clientes (WhatsApp), use linguagem simples, cordial e curta, sem juridiquês.
Se receber dados de um processo ou cliente, use-os; não peça informações que já estão neles.`;
function asMd(s){ // markdown simples → HTML seguro
  let h = esc(s).replace(/^### (.*)$/gm, '<b>$1</b>').replace(/^## (.*)$/gm, '<b>$1</b>').replace(/^# (.*)$/gm, '<b>$1</b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[\s(])\*(?!\s)(.+?)\*(?=[\s).,;:!?]|$)/gm, '$1<i>$2</i>').replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/^(\s*)[-•] (.*)$/gm, '$1• $2');
  return h.replace(/\n/g, '<br>');
}

function asAbrir(){
  let dr = document.getElementById('asDr');
  if(dr){ dr.remove(); document.getElementById('asBtn')?.classList.remove('on'); return; }
  const auto = asContextoAuto(); if(auto && auto !== AS.ctx && !AS.msgs.length) AS.ctx = auto; else if(auto && !AS.ctx) AS.ctx = auto;
  dr = document.createElement('div'); dr.id = 'asDr'; dr.className = 'tpop asDr'; document.body.appendChild(dr);
  document.getElementById('asBtn')?.classList.add('on');
  asRender(); setTimeout(() => dr.querySelector('#asIn')?.focus(), 50);
}
function asCreditoHtml(){
  const s = iaSaldo(), mes = iaGastoMes();
  return `💰 Esta conversa: <b>${usd(AS.custo || 0)}</b> · no mês: <b>${usd(mes)}</b>${brl(mes)} · ${s ? `saldo estimado: <b style="color:${s.disp < 1 ? 'var(--bad)' : 'var(--ok)'}">${usd(s.disp)}</b>${brl(s.disp)}` : '<span>saldo: não informado</span>'} <a href="#" id="asSaldo">${s ? 'atualizar' : 'informar saldo'}</a>`;
}
function asRender(){
  const dr = document.getElementById('asDr'); if(!dr) return;
  const auto = asContextoAuto(), opcoes = [...new Set([AS.ctx, auto].filter(Boolean))];
  const sem = !iaKey();
  const sugs = AS.ctx.startsWith('proc:') ? ['Resuma o andamento do processo e diga qual é o próximo passo', 'Explique a última publicação em linguagem simples', 'Escreva uma mensagem ao cliente contando como está o processo', 'Quais riscos e prazos devo observar agora?']
    : AS.ctx.startsWith('pes:') ? ['Resuma a situação deste cliente e dos processos dele', 'Escreva uma mensagem de retorno ao cliente', 'Quais documentos devo pedir a este cliente?']
    : ['Sugira um modelo de petição de…', 'Explique para um leigo o que é…', 'Quais os requisitos para…', 'Revise este texto:'];
  dr.innerHTML = `<h3>🤖 Assistente IA <span class="small muted" style="font-weight:400">${AS_NOME}</span><span class="sp"></span><button class="mini" id="asNova" title="Começar outra conversa">🆕 nova</button><button class="mini" id="asFechar" aria-label="Fechar">✕</button></h3>
    <div class="asCred">${asCreditoHtml()}</div>
    <div class="asCtx"><label class="chk"><input type="checkbox" id="asCtxOn" ${AS.enviarCtx ? 'checked' : ''}> 📎 Enviar dados de</label>
      <select id="asCtxSel"><option value="">— nenhum —</option>${opcoes.map(r => `<option value="${esc(r)}" ${r === AS.ctx ? 'selected' : ''}>${esc(asCtxNome(r))}</option>`).join('')}<option value="__proc">Escolher processo…</option><option value="__pes">Escolher cliente…</option></select>
      ${AS.ctx ? `<details class="asVer"><summary>ver o que será enviado</summary><pre>${esc(asCtxTexto(AS.ctx))}</pre></details>` : ''}</div>
    <div class="asMsgs" id="asMsgs">${sem ? `<div class="bn" style="margin:0;display:block">Para usar o assistente, cadastre a chave da Anthropic em <a href="#/config" id="asCfg">Configurações → Inteligência artificial</a>. Ou use o botão “Abrir no Claude” abaixo, que não gasta créditos.</div>` : ''}
      ${AS.msgs.length ? AS.msgs.map((m, i) => m.role === 'user' ? `<div class="mU">${esc(m.content).replace(/\n/g, '<br>')}</div>`
        : `<div class="mA">${asMd(m.content)}<div class="acts"><button data-asa="copiar" data-i="${i}">📋 Copiar</button><button data-asa="conv" data-i="${i}">💬 Registrar como conversa</button>${AS.ctx.startsWith('proc:') ? `<button data-asa="and" data-i="${i}">📄 Salvar como andamento</button>` : ''}<button data-asa="prazo" data-i="${i}">📅 Criar prazo</button>${asTelefone() ? `<button data-asa="whats" data-i="${i}" class="wa">🟢 WhatsApp ao cliente</button>` : ''}</div></div>`).join('')
        : `<div class="asVazio">Pergunte qualquer coisa. ${AS.ctx && AS.enviarCtx ? 'Os dados de <b>' + esc(asCtxNome(AS.ctx)) + '</b> vão junto.' : ''}<div class="small muted" style="margin-top:6px">Cada pergunta custa frações de centavo (modelo rápido). Abrir esta janela não gasta nada.</div></div>`}
      <div id="asDigitando"></div></div>
    ${AS.msgs.length ? '' : `<div class="asSugs">${sugs.map(s => `<button data-assug="${esc(s)}">${esc(s)}</button>`).join('')}</div>`}
    <div class="asIn"><textarea id="asIn" rows="2" placeholder="Pergunte qualquer coisa… (Enter envia · Shift+Enter quebra linha)" ${sem ? 'disabled' : ''}></textarea><button class="btn primary" id="asEnviar" ${sem ? 'disabled' : ''} title="Enviar">➤</button></div>
    <div class="asPe"><button class="btn" id="asClaude" title="Copia a pergunta (e os dados, se marcados) e abre o Claude — usa a sua assinatura, sem gastar créditos da API">↗ Abrir no Claude <span class="small">(sem gastar créditos)</span></button></div>`;
  const $ = s => dr.querySelector(s);
  $('#asFechar').onclick = asAbrir;
  $('#asNova').onclick = () => { if(AS.msgs.length && !confirm('Começar uma conversa nova? A atual será apagada deste aparelho.')) return; AS = {msgs:[], custo:0, ctx:asContextoAuto(), enviarCtx:AS.enviarCtx}; asSalvar(); asRender(); };
  $('#asCtxOn').onchange = e => { AS.enviarCtx = e.target.checked; asSalvar(); asRender(); };
  $('#asCtxSel').onchange = e => { const v = e.target.value;
    if(v === '__proc' || v === '__pes'){ const lista = v === '__proc' ? procOpts() : pessoasOpts(); asEscolher(v === '__proc' ? 'processo' : 'cliente', lista, id => { AS.ctx = (v === '__proc' ? 'proc:' : 'pes:') + id; AS.enviarCtx = true; asSalvar(); asRender(); }); e.target.value = AS.ctx; return; }
    AS.ctx = v; asSalvar(); asRender(); };
  const sl = $('#asSaldo'); if(sl) sl.onclick = e => { e.preventDefault(); asInformarSaldo(); };
  const cf = $('#asCfg'); if(cf) cf.onclick = () => asAbrir();
  dr.querySelectorAll('[data-assug]').forEach(b => b.onclick = () => { const t = $('#asIn'); t.value = b.dataset.assug.replace(/…$/, ' '); t.focus(); });
  const inp = $('#asIn'); inp.onkeydown = e => { if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); asEnviar(); } };
  $('#asEnviar').onclick = asEnviar;
  $('#asClaude').onclick = asAbrirClaude;
  dr.querySelectorAll('[data-asa]').forEach(b => b.onclick = () => asAcao(b.dataset.asa, AS.msgs[+b.dataset.i]?.content || ''));
  const box = $('#asMsgs'); box.scrollTop = box.scrollHeight;
}
function asEscolher(tipo, lista, cb){
  const dr = document.getElementById('asDr'), box = document.createElement('div'); box.className = 'asEsc';
  box.innerHTML = `<input placeholder="Digite para procurar o ${tipo}…"><div class="asEscL"></div>`; dr.querySelector('.asCtx').appendChild(box);
  const inp = box.querySelector('input'), l = box.querySelector('.asEscL');
  const pinta = () => { const q = norm_s(inp.value); l.innerHTML = lista.filter(o => norm_s(o.t).includes(q)).slice(0, 30).map(o => `<button data-v="${esc(o.v)}">${esc(o.t)}</button>`).join('') || '<div class="small muted">Nada encontrado.</div>';
    l.querySelectorAll('button').forEach(b => b.onclick = () => cb(b.dataset.v)); };
  inp.oninput = pinta; pinta(); inp.focus();
}
function asTelefone(){ const [k, id] = AS.ctx.split(':'); const pe = k === 'pes' ? byId('pessoas', id) : k === 'proc' ? byId('pessoas', byId('processos', id)?.clienteId) : null; return pe?.telefone || ''; }
function asMensagensApi(){
  const ms = AS.msgs.map(m => ({role:m.role, content:m.content}));
  const ctx = AS.enviarCtx && AS.ctx ? asCtxTexto(AS.ctx) : '';
  if(ctx && ms.length){ ms[0] = {role:'user', content:`DADOS DO SISTEMA DO ESCRITÓRIO (para contexto):\n${ctx}\n\n---\nPERGUNTA:\n${ms[0].content}`}; }
  return ms;
}
async function asEnviar(){
  const dr = document.getElementById('asDr'), inp = dr?.querySelector('#asIn'); if(!inp || asOcupado) return;
  const txt = inp.value.trim(); if(!txt) return;
  if(AS.msgs.length && AS.enviarCtx && AS.ctx && AS.ctxEnviado && AS.ctxEnviado !== AS.ctx){ AS.msgs = []; AS.custo = 0; toast('Os dados mudaram — comecei uma conversa nova'); }
  AS.msgs.push({role:'user', content:txt}); AS.ctxEnviado = AS.enviarCtx ? AS.ctx : ''; asSalvar(); asRender();
  asOcupado = true; const dig = document.getElementById('asDigitando'); if(dig) dig.innerHTML = '<div class="mA asPens">pensando…</div>';
  let parcial = '';
  try{
    const {Anthropic, client} = await iaClient();
    const st = client.messages.stream({model:AS_MODELO, max_tokens:8000, output_config:{effort:'low'}, system:asSistema(), messages:asMensagensApi()});
    st.on('text', d => { parcial += d; const el = document.getElementById('asDigitando'); if(el){ el.innerHTML = `<div class="mA">${asMd(parcial)}</div>`; const b = document.getElementById('asMsgs'); b.scrollTop = b.scrollHeight; } });
    let resp;
    try{ resp = await st.finalMessage(); }
    catch(e){
      if(e instanceof Anthropic.AuthenticationError) throw new Error('a chave da IA foi recusada — confira em Configurações');
      if(e instanceof Anthropic.PermissionDeniedError) throw new Error('a conta da Anthropic não tem permissão (verifique se há créditos)');
      if(e instanceof Anthropic.RateLimitError) throw new Error('muitas solicitações seguidas — aguarde um minuto');
      if(e instanceof Anthropic.BadRequestError) throw new Error(/credit|balance/i.test(e.message) ? 'sem créditos na conta da Anthropic — recarregue em console.anthropic.com' : 'a IA não aceitou o pedido: ' + e.message);
      if(e instanceof Anthropic.APIConnectionError) throw new Error('sem conexão com a IA (verifique a internet)');
      if(e instanceof Anthropic.APIError) throw new Error(`a IA respondeu com erro ${e.status}: ${e.message}`);
      throw e;
    }
    const custo = resp.usage ? asCustoUsd(resp.usage) : 0;
    AS.custo = (AS.custo || 0) + custo; iaRegistrarGasto(custo);
    if(typeof iaSomarUso === 'function' && resp.usage) iaSomarUso(resp.usage, custo);
    let out = resp.content.filter(b => b.type === 'text').map(b => b.text).join('');
    if(resp.stop_reason === 'refusal') out = (out ? out + '\n\n' : '') + '⚠️ A IA não respondeu a este pedido (recusa de segurança). Reformule a pergunta.';
    if(resp.stop_reason === 'max_tokens') out += '\n\n(resposta cortada por ser longa demais — peça para continuar)';
    AS.msgs.push({role:'assistant', content:out || '(sem resposta)'});
  }catch(e){
    AS.msgs.pop(); toast('⚠️ ' + e.message); if(document.getElementById('asIn')) setTimeout(() => { const i = document.getElementById('asIn'); if(i) i.value = txt; }, 0);
  }
  asOcupado = false; asSalvar(); asRender();
}
function asInformarSaldo(){
  const s = db.meta.iaSaldo || {};
  openForm({title:'💰 Créditos da Anthropic', data:{valor:s.valor != null ? iaSaldo().disp.toFixed(2) : '', cotacao:s.cotacao || ''}, fields:[
    {type:'html', html:`<p class="small" style="margin-top:0">A Anthropic não informa o saldo para o sistema. Veja o saldo atual em <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener">console.anthropic.com → Billing</a> e digite aqui: o sistema desconta o gasto estimado de cada pergunta (de todos os aparelhos).</p>`},
    {k:'valor', label:'Saldo atual de créditos (US$)', type:'number', req:true},
    {k:'cotacao', label:'Cotação do dólar (opcional — para mostrar também em reais)', type:'number'},
    {type:'html', html:`<div class="small muted">Gasto total registrado: ${usd(iaGastoTotal())} · neste mês: ${usd(iaGastoMes())}. Os valores são estimativas pelo preço público do modelo; confira o extrato da Anthropic.</div>`}],
    onSave:v => { db.meta.iaSaldo = {valor:parseFloat(String(v.valor).replace(',', '.')) || 0, base:iaGastoTotal(), em:new Date().toISOString(), cotacao:parseFloat(String(v.cotacao).replace(',', '.')) || 0}; save(); toast('Saldo atualizado'); setTimeout(asRender, 50); }});
}
// “Abrir no Claude”: leva a pergunta (e os dados, se marcados) para o claude.ai — usa a assinatura, sem créditos da API
async function asAbrirClaude(){
  const inp = document.getElementById('asIn'), rascunho = inp?.value.trim() || '';
  const ctx = AS.enviarCtx && AS.ctx ? asCtxTexto(AS.ctx) : '';
  const hist = AS.msgs.map(m => (m.role === 'user' ? 'EU: ' : 'ASSISTENTE: ') + m.content).join('\n\n');
  const txt = [ctx && 'Dados do processo/cliente (do sistema do meu escritório):\n' + ctx, hist && 'Conversa até agora:\n' + hist, rascunho || (!hist ? '' : 'Continue a partir daqui.')].filter(Boolean).join('\n\n---\n\n');
  let copiou = false; try{ if(txt){ await navigator.clipboard.writeText(txt); copiou = true; } }catch(e){}
  const url = txt && txt.length < 6000 ? 'https://claude.ai/new?q=' + encodeURIComponent(txt) : 'https://claude.ai/new';
  window.open(url, '_blank', 'noopener');
  toast(copiou ? (txt.length < 6000 ? '↗ Abrindo o Claude com a pergunta (também copiada — se não aparecer, é só colar)' : '↗ Texto copiado — cole no Claude (Ctrl+V)') : '↗ Abrindo o Claude');
}
const asPlano = s => String(s || '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,3} /gm, '').replace(/`([^`]+)`/g, '$1');
// ao trocar de tela com o assistente aberto e sem conversa, ele passa a usar os dados da tela nova
window.addEventListener('hashchange', () => { if(!document.getElementById('asDr') || AS.msgs.length) return; const a = asContextoAuto(); if(a && a !== AS.ctx){ AS.ctx = a; asSalvar(); asRender(); } });
function asAcao(tipo, txt){
  txt = asPlano(txt);
  const [k, id] = AS.ctx.split(':'), proc = k === 'proc' ? byId('processos', id) : null, pesId = k === 'pes' ? id : proc?.clienteId || '';
  if(tipo === 'copiar'){ navigator.clipboard?.writeText(txt).then(() => toast('Copiado'), () => toast('Não foi possível copiar')); return; }
  if(tipo === 'whats'){ const w = waLink(asTelefone(), txt); if(w) window.open(w, '_blank', 'noopener'); return; }
  asAbrir();
  if(tipo === 'conv') formConv({pessoaId:pesId, processoId:proc?.id || '', relato:txt});
  if(tipo === 'and') formAnd({processoId:proc.id, data:today(), descricao:txt});
  if(tipo === 'prazo') formPrazo({processoId:proc?.id || '', pessoaId:pesId, obs:txt});
}
A.iaAbrir = () => asAbrir();
A.iaSaldoInf = () => asInformarSaldo();
