/* ===== 📨 Link de cadastro para clientes =====
   O escritório gera um link de uso único (7 dias); o cliente preenche em cadastro.html; o robô (Apps Script) salva os dados e as fotos
   numa pasta do Google Drive escolhida aqui; o app traz o cadastro para revisão — nada entra sem você conferir.
   Registros em db.cadlinks: {id = código do link, nome, tel, tipo 'PF'|'PJ', leadId, criadoEm, expira, status, recebidoEm, dados, arquivos, pasta, pessoaId} */
const CAD_DIAS = 7;
const cadCfg = () => db.meta.cadCfg || {};
const roboDeploy = () => (monCfg().roboUrl.match(/\/macros\/s\/([^/]+)\/exec/) || [])[1] || '';
const cadBase = () => location.href.split('#')[0].split('?')[0].replace(/[^/]*$/, '') + 'cadastro.html';
const cadUrl = l => `${cadBase()}#s=${roboDeploy()}&cod=${l.id}`;
const cadCodigo = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const cadExpirado = l => l.status === 'aguardando' && l.expira && l.expira < new Date().toISOString();
const cadSituacao = l => cadExpirado(l) ? 'expirado' : l.status;
const cadMsg = (nome, link) => `Olá${nome ? ', ' + nome : ''}! Para darmos andamento ao seu caso, preencha seus dados neste link (leva uns 3 minutos): ${link}\n\nQualquer dúvida, estou à disposição.\n— Guilherme Garcia, advogado`;

/* ----- configuração (pasta do Google Drive + WhatsApp do escritório) ----- */
function formCadCfg(){
  const c = cadCfg();
  openForm({title:'📨 Link de cadastro — configuração', data:{pasta:c.pastaUrl || '', whats:c.whats || ''}, fields:[
    {type:'html', html:`<p class="small" style="margin-top:0">Os cadastros enviados pelos clientes (dados + fotos dos documentos) são salvos pelo robô <b>numa pasta do seu Google Drive</b> — uma subpasta para cada cadastro. Abra a pasta no Drive, copie o endereço e cole abaixo.</p>`},
    {k:'pasta', label:'Link da pasta do Google Drive', req:true, full:true, ph:'https://drive.google.com/drive/folders/…'},
    {k:'whats', label:'WhatsApp do escritório (aparece se o link já tiver sido usado ou expirado)', ph:'(19) 99999-9999'},
    {type:'html', html:`<div class="small muted">Precisa do robô atualizado: no Apps Script, cole a versão nova, rode <b>autorizarCadastro</b> uma vez e atualize a implantação (Nova versão).</div><div id="cadCfgSt" class="small" style="margin-top:6px"></div>`}],
    onSave:v => { if(!monCfg().roboUrl){ toast('Configure o robô primeiro (Publicações → ⚙️ Configurar)'); return false; }
      const st = mForm.querySelector('#cadCfgSt'); st.textContent = 'Conferindo a pasta…';
      roboChamar(null, {cadCfg:{pasta:v.pasta, whats:v.whats}}).then(r => { if(!r.pasta) throw new Error('o robô está desatualizado — cole a versão nova e rode “autorizarCadastro”');
        db.meta.cadCfg = {pastaUrl:v.pasta, pastaNome:r.pasta, whats:v.whats}; save(); closeModal(); render(); toast(`✔ Os cadastros vão para a pasta “${r.pasta}”`); })
        .catch(e => { st.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(e.message)}</span>`; });
      return false; }});
}

/* ----- enviar ----- */
function formCadEnviar(pre = {}){
  if(!cadCfg().pastaNome){ toast('Primeiro escolha a pasta do Google Drive para os cadastros'); formCadCfg(); return; }
  const tipo = pre.tipo || 'PF', nome1 = String(pre.nome || '').trim().split(/\s+/)[0];
  openForm({title:'📨 Enviar link de cadastro', data:{tipo, nome:nome1, tel:pre.tel || ''}, fields:[
    {k:'tipo', label:'Cadastro de', type:'radio', full:true, options:[{v:'PF', t:'👤 Pessoa física'}, {v:'PJ', t:'🏢 Pessoa jurídica'}]},
    {k:'nome', label:'Primeiro nome (aparece na saudação — opcional)'},
    {k:'tel', label:'Celular / WhatsApp do cliente', ph:'(00) 00000-0000'},
    {type:'html', html:`<label>Mensagem</label><textarea id="cadMsgTxt" rows="6"></textarea>
      <div class="small muted" style="margin:6px 0 10px">🔒 Link de uso único · vale por <b>${CAD_DIAS} dias</b> · não leva nenhum dado do cliente. Pasta: <b>${esc(cadCfg().pastaNome)}</b></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ok" id="cadWa">🟢 Gerar link e abrir o WhatsApp</button><button type="button" class="btn" id="cadCp">📋 Só copiar o link</button></div><div id="cadSt" class="small" style="margin-top:6px"></div>`}],
    soFechar:true,
    after:f => {
      const link = {id:cadCodigo()}, txt = f.querySelector('#cadMsgTxt'); let editado = false;
      const msg = () => { if(!editado) txt.value = cadMsg(f.elements.nome.value.trim(), cadUrl(link)); };
      txt.addEventListener('input', () => { editado = true; }); f.elements.nome.addEventListener('input', msg); msg();
      f.elements.tel.addEventListener('blur', () => { f.elements.tel.value = fmtTel(f.elements.tel.value); });
      const criar = async () => { const st = f.querySelector('#cadSt'); if(link.criado) return true;
        const tp = f.querySelector('[name=tipo]:checked')?.value || 'PF', agora = new Date(), exp = new Date(agora.getTime() + CAD_DIAS * 864e5).toISOString();
        st.textContent = 'Registrando o link no robô…';
        try{ await roboChamar(null, {cadConvite:{link:link.id, nome:f.elements.nome.value.trim(), tipo:tp, expira:exp}}); }
        catch(e){ st.innerHTML = `<span style="color:var(--bad)">⚠️ ${esc(/robô não configurado/.test(e.message) ? 'configure o robô primeiro' : e.message)}</span>`; return false; }
        upsert('cadlinks', {id:link.id, nome:f.elements.nome.value.trim(), tel:fmtTel(f.elements.tel.value), tipo:tp, leadId:pre.leadId || '', criadoEm:agora.toISOString(), expira:exp, status:'aguardando'});
        link.criado = true; st.innerHTML = '✔ Link criado — aparece em <b>Clientes e partes → 📨 Links de cadastro</b>.'; return true; };
      f.querySelector('#cadWa').onclick = async () => { const tel = f.elements.tel.value; if(digits(tel).length < 10) return toast('Informe o celular do cliente (com DDD)');
        const w = window.open('about:blank', '_blank'); if(!(await criar())){ w?.close(); return; }
        const u = waLink(tel, txt.value); if(w) w.location = u; else location.href = u; closeModal(); render(); };
      f.querySelector('#cadCp').onclick = async () => { if(!(await criar())) return; try{ await navigator.clipboard.writeText(txt.value); toast('📋 Mensagem com o link copiada'); }catch(e){ toast('Copie o link: ' + cadUrl(link)); } render(); };
    }});
}

/* ----- acompanhar e receber ----- */
let cadBusy = false;
async function cadSincronizar(forcar){
  if(cadBusy || !monCfg().roboUrl || !navigator.onLine) return;
  const esperando = db.cadlinks.filter(l => l.status === 'aguardando' && !cadExpirado(l));
  if(!esperando.length && !forcar) return;
  cadBusy = true;
  try{ const r = await roboChamar({acao:'cadRecebidos'}); let novos = 0;
    (r.cadastros || []).forEach(c => { const l = byId('cadlinks', c.link); if(!l || l.status !== 'aguardando') return;
      if(c.status === 'recebido' || c.status === 'importado'){ Object.assign(l, {status:'recebido', recebidoEm:c.recebidoEm, dados:c.dados || {}, arquivos:c.arquivos || [], pasta:c.pasta || ''}); novos++; }
      else if(c.status === 'cancelado') l.status = 'cancelado'; });
    if(novos){ save(); toast(`📥 ${novos} cadastro(s) recebido(s) pelo link — confira em Clientes e partes`);
      if(typeof ntEnviar === 'function' && 'Notification' in window && Notification.permission === 'granted' && ntEst().push !== false) ntEnviar('📥 Cadastro recebido pelo link', `${novos} cadastro(s) para revisar`, '#/pessoas', 'cad');
      renderSeguro(); }
  }catch(e){} finally { cadBusy = false; }
}
setInterval(() => cadSincronizar(), 5 * 60e3); setTimeout(() => cadSincronizar(), 6000);
// aviso no 🔔
{ const ntBase = ntAvisos; ntAvisos = function(){ const av = ntBase(), rec = db.cadlinks.filter(l => l.status === 'recebido');
    if(rec.length) av.unshift({id:'cad', sig:rec.map(l => l.id).join(), ic:'📥', t:`${rec.length} cadastro(s) recebido(s) pelo link`, s:'Revise e cadastre: ' + rec.slice(0, 3).map(l => l.dados?.nome || l.dados?.razaoSocial || l.nome || 'cliente').join(' · '), href:'#/pessoas', nivel:'warn', tipo:'aviso'});
    return av; }; }

/* ----- quadro em Clientes e partes ----- */
let cadQAberto = false;
function cadQuadro(){
  const lim = addDays(today(), -30), ls = db.cadlinks.filter(l => !l.oculto && (l.status === 'recebido' || l.status === 'aguardando' || (l.criadoEm || '').slice(0, 10) >= lim)).sort((a, b) => (b.recebidoEm || b.criadoEm || '').localeCompare(a.recebidoEm || a.criadoEm || ''));
  if(!ls.length) return '';
  const linha = l => { const s = cadSituacao(l), nm = l.dados?.nome || l.dados?.razaoSocial || l.nome || '(sem nome)', dias = Math.ceil((new Date(l.expira) - Date.now()) / 864e5);
    const tag = {recebido:`<span class="tag ok">✅ recebido ${l.recebidoEm ? fmtD(l.recebidoEm.slice(0, 10)) : ''}</span>`, aguardando:`<span class="tag warn">⏳ aguardando · expira em ${dias} dia(s)</span>`, expirado:'<span class="tag grey">⌛ expirado</span>',
      cancelado:'<span class="tag grey">cancelado</span>', importado:'<span class="tag">✔ cadastrado</span>', descartado:'<span class="tag grey">descartado</span>'}[s] || '';
    const acoes = s === 'recebido' ? `<button class="btn primary" data-act="cadRevisar" data-id="${l.id}">Revisar e cadastrar</button>`
      : s === 'aguardando' ? `<button class="mini" data-act="cadReenviar" data-id="${l.id}">🟢 reenviar</button> <button class="mini" data-act="cadCancelar" data-id="${l.id}">cancelar</button>`
      : s === 'expirado' || s === 'cancelado' ? `<button class="mini" data-act="cadNovo" data-id="${l.id}">gerar novo link</button>`
      : s === 'importado' && l.pessoaId && byId('pessoas', l.pessoaId) ? `<a class="mini" href="#/pessoa/${l.pessoaId}">abrir ficha</a>` : '';
    const rm = ['expirado', 'cancelado', 'importado', 'descartado'].includes(s) ? ` <button class="mini" data-act="cadOcultar" data-id="${l.id}" title="Tirar este link da lista">✕ remover da lista</button>` : '';
    return `<div class="li"><div class="grow"><b>${esc(nm)}</b> ${tag}<div class="sub">${l.tipo === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}${l.tel ? ' · ' + esc(l.tel) : ''} · enviado em ${fmtD((l.criadoEm || '').slice(0, 10))}${l.arquivos?.length ? ` · ${l.arquivos.length} documento(s)` : ''}${l.leadId && byId('leads', l.leadId) ? ' · 🎯 lead ' + esc(byId('leads', l.leadId).nome) : ''}</div></div>${acoes}${rm}</div>`; };
  const rec = ls.filter(l => cadSituacao(l) === 'recebido').length, agu = ls.filter(l => cadSituacao(l) === 'aguardando').length, fim = ls.length - rec - agu;
  const resumo = [rec && `<span class="tag ok">✅ ${rec} para revisar</span>`, agu && `<span class="tag warn">⏳ ${agu} aguardando</span>`, fim && `<span class="tag grey">${fim} encerrado(s)</span>`].filter(Boolean).join(' ');
  return `<details class="card cadQ" ${rec || cadQAberto ? 'open' : ''}><summary><b>📨 Links de cadastro</b> ${resumo}<span class="sp"></span><button class="mini" data-act="cadTestar" title="Testa o robô como se fosse o cliente abrindo o link">🔍 testar</button> <button class="mini" data-act="cadAtualizar" title="Ver se chegou algum cadastro agora">↻ atualizar</button>${fim ? ` <button class="mini" data-act="cadLimpar" title="Tirar da lista todos os links cancelados, expirados e já resolvidos">limpar encerrados</button>` : ''}</summary>
    ${ls.slice(0, 15).map(linha).join('')}</details>`;
}

/* ----- revisão ----- */
const CAD_ROT = [['nome', 'Nome'], ['razaoSocial', 'Razão social'], ['cpf', 'CPF'], ['cnpj', 'CNPJ'], ['rg', 'RG'], ['nascimento', 'Nascimento'], ['estadoCivil', 'Estado civil'], ['profissao', 'Profissão'],
  ['respNome', 'Responsável pela empresa'], ['respCpf', 'CPF do responsável'], ['celular', 'Celular / WhatsApp'], ['email', 'E-mail'], ['avisos', 'Prefere avisos por'], ['endereco', 'Endereço']];
const dataBR2iso = s => { const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : ''; };
function cadParaPessoa(l){ const d = l.dados || {}, pj = l.tipo === 'PJ' || !!d.cnpj;
  const end = {cep:fmtCEP(d.cep), logradouro:d.logradouro || '', numero:d.numero || '', complemento:d.complemento || '', bairro:d.bairro || '', cidade:d.cidade || '', uf:d.uf || ''};
  return {natureza:pj ? 'Jurídica' : 'Física', nome:pj ? d.razaoSocial : d.nome, doc:fmtDoc(pj ? d.cnpj : d.cpf), rg:pj ? '' : fmtRG(d.rg), nascimento:pj ? '' : dataBR2iso(d.nascimento), estadoCivil:d.estadoCivil || '', profissao:d.profissao || '',
    repPjNome:pj ? d.respNome || '' : '', repPjCpf:pj ? fmtDoc(d.respCpf) : '', telefone:fmtTel(d.celular), email:d.email || '', ...end, endereco:end.logradouro ? enderecoTxt(end) : '', avisos:d.avisos || ''}; }
function formCadRevisar(id){
  const l = byId('cadlinks', id); if(!l) return;
  const novo = cadParaPessoa(l), lead = l.leadId && byId('leads', l.leadId);
  const existe = (digits(novo.doc).length >= 11 && db.pessoas.find(x => digits(x.doc) === digits(novo.doc))) || (lead?.pessoaId && byId('pessoas', lead.pessoaId)) || null;
  const val = k => k === 'endereco' ? novo.endereco : k === 'celular' ? novo.telefone : k === 'cpf' ? (novo.natureza === 'Física' ? novo.doc : '') : k === 'cnpj' ? (novo.natureza === 'Jurídica' ? novo.doc : '') : k === 'nascimento' ? (novo.nascimento ? fmtD(novo.nascimento) : '') : k === 'respCpf' ? novo.repPjCpf : k === 'respNome' ? novo.repPjNome : k === 'razaoSocial' ? (novo.natureza === 'Jurídica' ? novo.nome : '') : k === 'nome' ? (novo.natureza === 'Física' ? novo.nome : '') : (novo[k] || '');
  const atual = k => !existe ? '' : k === 'endereco' ? enderecoTxt(existe) : k === 'celular' ? existe.telefone : k === 'cpf' || k === 'cnpj' ? existe.doc : k === 'nascimento' ? (existe.nascimento ? fmtD(existe.nascimento) : '') : k === 'respCpf' ? existe.repPjCpf : k === 'respNome' ? existe.repPjNome : k === 'razaoSocial' || k === 'nome' ? existe.nome : k === 'avisos' ? '' : existe[k] || '';
  const linhas = CAD_ROT.filter(([k]) => val(k)).map(([k, r]) => { const a = atual(k), igual = existe && String(a || '').trim() === String(val(k)).trim();
    return `<tr><td style="width:24px"><input type="checkbox" data-ck="${k}" ${igual ? '' : 'checked'} ${igual ? 'disabled' : ''}></td><td class="muted" style="width:150px">${r}</td><td><b>${esc(val(k))}</b>${existe && a && !igual ? `<div class="small muted">hoje: ${esc(a)}</div>` : ''}${igual ? ' <span class="small muted">(igual ao cadastro)</span>' : ''}</td></tr>`; }).join('');
  openForm({title:`📥 Cadastro recebido — ${novo.nome || l.nome || 'cliente'}`, fields:[{type:'html', html:`<div class="small muted" style="margin:-4px 0 10px">Enviado pelo link em ${l.recebidoEm ? new Date(l.recebidoEm).toLocaleString('pt-BR', {dateStyle:'short', timeStyle:'short'}) : '—'} · ${existe
      ? `já existe no sistema: <b>${esc(existe.nome)}</b>${existe.pasta ? ' (' + esc(existe.pasta) + ')' : ''} → o cadastro dele será <b>atualizado</b> com o que estiver marcado.` : `não encontrado no sistema → será criado um <b>cliente novo</b> (pasta <b>${nextPasta()}</b>).`}</div>
    <table style="font-size:13.5px"><tbody>${linhas}</tbody></table>
    ${l.arquivos?.length ? `<div class="sect">📎 Documentos (salvos no Google Drive)</div><div class="small">${l.arquivos.map(a => `<a href="${esc(a.url)}" target="_blank" rel="noopener">${esc(a.nome)}</a>`).join(' · ')}</div>` : ''}
    ${l.pasta ? `<div class="small" style="margin-top:6px">📁 <a href="${esc(l.pasta)}" target="_blank" rel="noopener">abrir a pasta deste cadastro no Drive</a> <span class="muted">(ao cadastrar, ela é renomeada com a pasta e o nome do cliente)</span></div>` : ''}
    <div class="small muted" style="margin-top:10px">Desmarque o que não quiser aproveitar. Depois você pode completar o resto do cadastro (filiação, dados bancários…).</div>`}],
    after:f => { const sb = f.querySelector('.mfoot button[type=submit]'); sb.textContent = existe ? `✔ Atualizar cadastro de ${existe.nome.split(' ')[0]}` : `✔ Criar cliente ${nextPasta()}`;
      f.querySelector('.mfoot').insertAdjacentHTML('afterbegin', '<button type="button" class="btn danger" id="cadDesc">Descartar</button>');
      f.querySelector('#cadDesc').onclick = () => { if(!confirm('Descartar este cadastro? Os arquivos continuam na pasta do Drive.')) return; upsert('cadlinks', {id, status:'descartado'}); closeModal(); render(); toast('Cadastro descartado'); }; },
    onSave:() => {
      const marc = new Set([...mForm.querySelectorAll('[data-ck]:checked')].map(x => x.dataset.ck)), up = {};
      const map = {nome:['nome'], razaoSocial:['nome'], cpf:['doc'], cnpj:['doc'], rg:['rg'], nascimento:['nascimento'], estadoCivil:['estadoCivil'], profissao:['profissao'], respNome:['repPjNome'], respCpf:['repPjCpf'], celular:['telefone'], email:['email'],
        endereco:['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'endereco']};
      marc.forEach(k => (map[k] || []).forEach(c => { up[c] = novo[c]; }));
      if(marc.has('avisos')) up.obs = [existe?.obs, `Prefere receber avisos por: ${novo.avisos}.`].filter(Boolean).join('\n');
      if(l.pasta) up.docsUrl = l.pasta;
      let r;
      if(existe) r = upsert('pessoas', {id:existe.id, ...up});
      else r = upsert('pessoas', {tipo:'Cliente', origemCad:'link', natureza:novo.natureza, ...novoClienteExtra('Cliente'), origem:lead?.origem || '', indicacao:lead?.indicadoPor || '', ...up, nome:up.nome || novo.nome});
      if(lead && !lead.pessoaId){ db.conversas.forEach(c => { if(c.leadId === lead.id && !c.pessoaId) c.pessoaId = r.id; }); upsert('leads', {id:lead.id, pessoaId:r.id, status:'Fechado', fechadoEm:lead.fechadoEm || today()}); if(typeof sincronizarLembreteLead === 'function') sincronizarLembreteLead(byId('leads', lead.id)); }
      upsert('cadlinks', {id, status:'importado', pessoaId:r.id});
      roboChamar(null, {cadImportado:{link:id, renomear:`${r.pasta ? r.pasta + ' - ' : ''}${r.nome}`, cliente:r.pasta || '', nome:r.nome}}).catch(() => {}); // com as pastas Ativos/Encerrados configuradas, os documentos vão para a pasta do cliente
      toast(existe ? 'Cadastro atualizado' : `Cliente ${r.pasta || ''} criado`); setTimeout(() => go('#/pessoa/' + r.id), 50);
    }});
}
// teste: faz o mesmo pedido que a página do cliente faz ao abrir o link, e explica o resultado
async function cadTestar(){
  const url = monCfg().roboUrl; if(!url){ alert('O robô não está configurado (Publicações → ⚙️ Configurar).'); return; }
  toast('Testando o robô…');
  const sep = url.includes('?') ? '&' : '?', urlTeste = url + sep + 'acao=cadInfo&cod=teste-do-escritorio-0000';
  // 1) o pedido que a página do cliente faz (sem senha)  2) um pedido normal do app (com o código de acesso)
  const tenta = async u => { try{ const r = await fetch(u), t = await r.text(); let j = null; try{ j = JSON.parse(t); }catch(e){} return {ok:true, status:r.status, j, t}; }catch(e){ return {ok:false, erro:e.message}; } };
  const a = await tenta(urlTeste), b = await tenta(url + sep + new URLSearchParams({acao:'ping', token:monCfg().roboToken}));
  // variações para isolar o bloqueio: sem código e sem planilha · com outro nome de parâmetro · cadInfo + código
  const v1 = await tenta(url + sep + 'acao=ping'), v2 = await tenta(url + sep + 'acao=cadInfo&cod=teste-do-escritorio-0000'), v3 = await tenta(url + sep + new URLSearchParams({acao:'cadInfo', c:'teste-do-escritorio-0000', token:monCfg().roboToken}));
  const rs = x => x.ok ? (x.j ? 'ok ' + JSON.stringify(x.j).slice(0, 60) : 'HTTP ' + x.status + ' não-JSON') : 'falhou (' + x.erro + ')';
  const variacoes = `A ping sem código: ${rs(v1)}\nB cadInfo com “cod”: ${rs(v2)}\nC cadInfo com “c” + código: ${rs(v3)}`;
  let diag;
  if(b.j?.versao && b.j.versao < 5) diag = '⚠️ O robô no ar ainda é a versão ' + b.j.versao + ': cole a versão nova (5) no Apps Script e atualize a implantação (Gerenciar implantações → ✏️ → Nova versão → Implantar).';
  else if(a.j && a.j.motivo === 'invalido') diag = '✔ Tudo certo: o robô responde ao link de cadastro. Gere um link novo e teste no celular.';
  else if(a.j && (/código de acesso/.test(a.j.erro || '') || (b.j?.versao && b.j.versao < 5))) diag = '⚠️ O robô no ar ainda é uma versão antiga: cole a versão nova e atualize a implantação (Gerenciar implantações → ✏️ → Nova versão → Implantar).';
  else if(!a.ok && !b.ok) diag = '⚠️ Nenhum pedido chega ao robô — nem o do link, nem os pedidos normais do app. O Google está respondendo com uma página dele (de autorização, de login ou de “não encontrado”) em vez do robô.';
  else if(!a.ok && b.ok) diag = '⚠️ Os pedidos normais do app funcionam, mas o pedido sem código de acesso (o do cliente) é bloqueado. Quase sempre é o “Quem pode acessar” diferente de “Qualquer pessoa”.';
  else diag = '⚠️ Resposta inesperada do robô: ' + (a.j?.erro || String(a.t || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200));
  openForm({title:'🔍 Teste do link de cadastro', soFechar:true, fields:[{type:'html', html:`<p><b>${esc(diag)}</b></p>
    <div class="small" style="line-height:1.6">Pedido do cliente (sem código): ${a.ok ? (a.j ? '<span style="color:var(--ok)">respondeu</span>' : 'respondeu algo inesperado (HTTP ' + a.status + ')') : '<span style="color:var(--bad)">bloqueado — ' + esc(a.erro) + '</span>'}<br>
      <details style="margin-top:6px"><summary class="small">diagnóstico detalhado (copie e me envie)</summary><pre id="cadDiag" style="white-space:pre-wrap;font-size:11.5px;background:var(--bg);padding:8px;border-radius:8px">${esc(variacoes)}</pre><button type="button" class="mini" onclick="navigator.clipboard.writeText(document.getElementById('cadDiag').textContent).then(()=>toast('Copiado'))">📋 copiar diagnóstico</button></details>
      Pedido normal do app (com código): ${b.ok ? (b.j?.ok ? `<span style="color:var(--ok)">respondeu (robô versão ${esc(b.j.versao ?? '?')})</span>` : 'respondeu com erro: ' + esc(b.j?.erro || 'HTTP ' + b.status)) : '<span style="color:var(--bad)">bloqueado — ' + esc(b.erro) + '</span>'}</div>
    ${a.j && a.j.motivo === 'invalido' ? '' : `<div class="bn" style="display:block;margin-top:12px"><b>Para ver o que o Google está mostrando:</b> clique no botão abaixo. Vai abrir uma aba com o endereço do robô.
      <ul style="margin:6px 0 0 18px;padding:0"><li>Se aparecer <code>{"ok":false,"motivo":"invalido"…}</code> → o robô está certo (me avise).</li>
      <li>Se aparecer <b>“É necessária autorização”</b> ou um pedido de permissão → no Apps Script rode <b>autorizarCadastro</b>, permita tudo e depois Implantar → Gerenciar implantações → ✏️ → Nova versão.</li>
      <li>Se pedir para <b>entrar na conta Google</b> → em Gerenciar implantações → ✏️, mude “Quem pode acessar” para <b>Qualquer pessoa</b>.</li>
      <li>Se aparecer <b>“Página não encontrada”</b> → o endereço mudou: copie o endereço do app da Web em Gerenciar implantações e cole em Publicações → ⚙️ Configurar.</li></ul>
      <div style="margin-top:8px"><a class="btn primary" href="${esc(urlTeste)}" target="_blank" rel="noopener">Abrir o endereço do robô ↗</a></div></div>`}`}]});
}
document.addEventListener('toggle', e => { if(e.target.classList?.contains('cadQ')) cadQAberto = e.target.open; }, true);
Object.assign(A, {
  cadOcultar: d => { upsert('cadlinks', {id:d.id, oculto:true}); cadQAberto = true; render(); },
  cadLimpar: () => { let n = 0; db.cadlinks.forEach(l => { if(!l.oculto && ['expirado', 'cancelado', 'importado', 'descartado'].includes(cadSituacao(l))){ l.oculto = true; n++; } }); save(); cadQAberto = true; render(); toast(`${n} link(s) tirado(s) da lista`); },
  cadTestar: () => cadTestar(),
  cadEnviar: d => formCadEnviar(d.leadId ? (() => { const ld = byId('leads', d.leadId); return {nome:ld?.nome, tel:ld?.telefone, leadId:d.leadId}; })() : {}),
  cadCfg: () => formCadCfg(),
  cadRevisar: d => formCadRevisar(d.id),
  cadAtualizar: () => { toast('Verificando…'); cadSincronizar(true).then(() => { if(!db.cadlinks.some(l => l.status === 'recebido')) toast('Nenhum cadastro novo'); }); },
  cadReenviar: d => { const l = byId('cadlinks', d.id); if(!l) return; const u = waLink(l.tel || '', cadMsg(l.nome, cadUrl(l))); if(u) window.open(u, '_blank', 'noopener'); else navigator.clipboard?.writeText(cadMsg(l.nome, cadUrl(l))).then(() => toast('📋 Mensagem copiada')); },
  cadCancelar: d => { openForm({title:'Cancelar link de cadastro', soFechar:true, fields:[{type:'html', html:`<p>O cliente não conseguirá mais enviar o cadastro por este link.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn danger" id="ccRm">Cancelar e tirar da lista</button><button type="button" class="btn" id="ccSo">Só cancelar (continua na lista)</button></div>`}],
    after:f => { const vai = rm => { upsert('cadlinks', {id:d.id, status:'cancelado', ...(rm ? {oculto:true} : {})}); roboChamar(null, {cadCancelar:d.id}).catch(() => {}); closeModal(); cadQAberto = true; render(); toast(rm ? 'Link cancelado e tirado da lista' : 'Link cancelado'); };
      f.querySelector('#ccRm').onclick = () => vai(true); f.querySelector('#ccSo').onclick = () => vai(false); }}); },
  cadNovo: d => { const l = byId('cadlinks', d.id); formCadEnviar({nome:l?.nome, tel:l?.tel, tipo:l?.tipo, leadId:l?.leadId}); },
});
