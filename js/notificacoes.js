/* ===== 🔔 Notificações: avisos do sistema, novidades de cada versão e dicas — num lugar só =====
   Estado por aparelho (localStorage): o que já foi lido e o que já foi notificado no navegador. */
const NOVIDADES = [
  {v:'2026.11.18-11', t:'Cadastro de processos renovado', txt:'Seções que abrem e fecham · Ação, tribunal, comarca e vara com sugestões · Tipo (judicial/administrativo/extrajudicial) · Status, Fase e Situação · Rito · 📌 Marcos (citação, liminar, sentença, acórdão…) · 🏷️ Tags coloridas e cor por área · 📋 O caso (resumo, fatos, pretensões, fundamentação, estratégia) · 🧩 Campos personalizados criados no próprio cadastro.'},
  {v:'2026.11.18-9', t:'Notificações, Assistente IA, Calculadora e processos antigos', txt:'🔔 Avisos do sistema num lugar só (e no navegador) · 🤖 Assistente IA com controle de créditos · 🧮 Calculadora de prazos · 🏛️ Importar processos antigos colando a lista do site do tribunal · ⏱️ horas faturáveis e cálculo do valor.'},
  {v:'2026.11.18-8', t:'Timesheet: horas trabalhadas', txt:'Cronômetro no topo (⏱️), lançamento manual, relatório por cliente, processo e atividade, e aba “Horas” no processo.'},
  {v:'2026.11.18-7', t:'Google Agenda: notificação na hora', txt:'Opção “no horário do evento” e notificações diferentes por tipo de compromisso.'},
  {v:'2026.11.18-4', t:'Google Agenda direto', txt:'Os compromissos vão sozinhos para a sua Google Agenda, com título, cores e notificações personalizáveis (Configurações → 📅 Google Agenda).'},
  {v:'2026.11.18-3', t:'Feriados no calendário', txt:'Cadastre feriados municipais e suspensões (🏖️ Feriados, embaixo do calendário) — eles contam no cálculo de prazos.'},
];
const DICAS = [
  ['Alt + N registra uma conversa', 'Funciona em qualquer tela — inclusive durante uma ligação.'],
  ['Lançamento rápido', 'No ⚡ Rápido da tela inicial, escreva “contestação 15 dias 152.1” e o prazo é calculado sozinho.'],
  ['Cronômetro por processo', 'Na ficha do processo, o botão ⏱️ já inicia o cronômetro com o processo e o cliente preenchidos.'],
  ['Feriados locais', 'Cadastre os feriados municipais em 🏖️ Feriados (embaixo do calendário) para que entrem no cálculo dos prazos.'],
  ['Mensagem pronta ao cliente', 'Na ficha do processo, “🟢 enviar ao cliente” monta a mensagem com o número e o link de consulta.'],
  ['Personalize a tela inicial', 'Em Início → ⚙️ Personalizar você escolhe e reordena atalhos, indicadores, blocos e o menu.'],
  ['Alt + B busca', 'Busca clientes, processos, CPF e conversas de qualquer tela.'],
  ['Processos vinculados', 'Recurso, cumprimento de sentença e incidentes podem ser vinculados ao principal — a linha do tempo fica unificada.'],
  ['Publicações em lote', 'Em Publicações, “⚡ Lançar todas” cria de uma vez os prazos sugeridos (confira sempre).'],
  ['Exportar horas', 'Em ⏱️ Horas, “Exportar (Excel)” gera a planilha do período — útil para prestar contas ao cliente.'],
];
const NT_KEY = 'escritorio_notif';
const ntEst = () => { try{ return JSON.parse(localStorage.getItem(NT_KEY)) || {}; }catch(e){ return {}; } };
const setNtEst = o => { try{ localStorage.setItem(NT_KEY, JSON.stringify({...ntEst(), ...o})); }catch(e){} };
// versão comparável como número: 2026.11.18-10 → 2026111810 (cada parte com 2 dígitos depois do ano; o “-N” com 3)
const verNum = v => { const [a = '0', m = '0', d = '0', n = '0'] = String(v || '0').split(/[.-]/); return +a * 1e9 + +m * 1e7 + +d * 1e5 + +n; };
// texto de um aviso já mostrado como faixa no topo (backup, Dropbox…), sem os botões
const textoFaixa = el => el ? [...el.childNodes].filter(n => n.nodeName !== 'BUTTON' && !(n.classList && n.classList.contains('sp'))).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim() : '';

function ntAvisos(){
  const t = today(), av = [], add = (id, sig, ic, tit, sub, href, nivel = 'info') => av.push({id, sig:String(sig), ic, t:tit, s:sub, href, nivel, tipo:'aviso'});
  const pend = db.prazos.filter(p => !p.concluido), atr = pend.filter(atrasado), hoje = pend.filter(p => p.data === t && !atrasado(p));
  if(atr.length) add('atras', t + atr.length, '⚠️', `${atr.length} prazo(s) atrasado(s)`, atr.slice(0, 2).map(p => p.titulo).join(' · '), '#/agenda', 'bad');
  if(hoje.length) add('hoje', t + hoje.length, '📅', `${hoje.length} compromisso(s) para hoje`, hoje.sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')).slice(0, 3).map(p => (p.hora ? p.hora + ' ' : '') + p.titulo).join(' · '), '#/agenda', 'warn');
  const pub = db.monitor.filter(m => m.status === 'nova' && m.tipo === 'publicacao'), mov = db.monitor.filter(m => m.status === 'nova' && m.tipo !== 'publicacao');
  if(pub.length) add('pub', pub.map(m => m.id).sort().join(), '📰', `${pub.length} publicação(ões) nova(s)`, 'Confira e lance os prazos.', '#/publicacoes', 'warn');
  if(mov.length) add('mov', mov.length + '|' + t, '⚖️', `${mov.length} movimentação(ões) a confirmar`, 'Andamentos encontrados pelo robô (DataJud) ou pelo navegador.', '#/publicacoes');
  const ret = db.conversas.filter(c => c.proximaData && !c.retornoFeito && c.proximaData <= t);
  if(ret.length) add('ret', t + ret.length, '💬', `${ret.length} retorno(s) a cliente para hoje ou atrasado(s)`, ret.slice(0, 2).map(c => pessoaNome(c.pessoaId) || byId('leads', c.leadId)?.nome || '').filter(Boolean).join(' · '), '#/conversas');
  const leads = db.leads.filter(l => !['Fechado', 'Perdido'].includes(l.status) && l.proximoContato && l.proximoContato <= t);
  if(leads.length) add('leads', t + leads.length, '🎯', `${leads.length} lead(s) para contatar`, leads.slice(0, 3).map(l => l.nome).join(' · '), '#/leads');
  const cFin = document.getElementById('cFin'); if(cFin && !cFin.hidden && !cFin.classList.contains('calm')) add('fin', t + cFin.textContent, '💰', 'Financeiro: lançamentos vencidos ou próximos', cFin.title || '', '#/financeiro', 'warn');
  const maior = db.pessoas.filter(p => p.menor && p.nascimento && dataMaioridade(p.nascimento) <= addDays(t, 30));
  if(maior.length) add('maior', maior.map(p => p.id).join(), '👶', `${maior.length} cliente(s) atingindo a maioridade`, maior.slice(0, 2).map(p => p.nome + ' — ' + fmtD(dataMaioridade(p.nascimento))).join(' · '), '#/pessoas', 'warn');
  if(typeof monLocal === 'function'){ const L = monLocal();
    if(L.roboErro) add('robo', L.roboErro, '🤖', 'O robô (DataJud) não respondeu', L.roboErro, '#/publicacoes', 'bad');
    if(L.djenErro) add('djen', L.djenErro, '📰', 'Falha ao consultar o DJEN', L.djenErro, '#/publicacoes', 'bad');
    if(L.agendaErro) add('agEmail', L.agendaErro, '📧', 'A agenda do e-mail diário não foi enviada ao robô', L.agendaErro, '#/publicacoes', 'warn'); }
  if(typeof gcalEst === 'function' && gcalEst().erro) add('gcal', gcalEst().erro, '📅', 'Google Agenda com problema', gcalEst().erro, '#/config', 'bad');
  const faixa = textoFaixa(document.querySelector('#banner .bn')); if(faixa) add('faixa', faixa, '☁️', faixa.length > 70 ? faixa.slice(0, 70) + '…' : faixa, 'Veja a faixa amarela no topo da tela.', '', 'warn');
  if(document.getElementById('novaVersao')) add('versao', 'nova', '🔄', 'Há uma versão nova do sistema', 'Clique em “Atualizar agora” na faixa do topo.', '', 'info');
  const tm = typeof tsTimer === 'function' && tsTimer(); if(tm && tsDecorrido(tm) > 4 * 3600e3) add('timer', tm.comecouEm, '⏱️', `Cronômetro ligado há ${fmtMin(tsDecorrido(tm) / 60000)}`, 'Esqueceu ligado? Clique para conferir.', '#tsAbrir', 'warn');
  return av;
}
function ntItens(){
  const E = ntEst(), lidas = E.lidas || {}, vistoNov = verNum(E.nov || '0');
  const avisos = ntAvisos().map(a => ({...a, nova:lidas[a.id] !== a.sig}));
  const nov = NOVIDADES.map(n => ({id:'v' + n.v, ic:'✨', t:'Novidade: ' + n.t, s:n.txt + ` (versão ${n.v})`, tipo:'novidade', nova:verNum(n.v) > vistoNov, href:''}));
  const dia = Math.floor(Date.now() / 864e5), d = DICAS[dia % DICAS.length];
  const dica = {id:'dica', ic:'💡', t:'Dica: ' + d[0], s:d[1], tipo:'dica', nova:E.dica !== today(), href:''};
  return [...avisos, ...nov.filter(n => n.nova).concat(nov.filter(n => !n.nova).slice(0, 3)), dica];
}
function ntBadge(){
  const b = document.getElementById('notifBd'); if(!b) return;
  const n = ntItens().filter(x => x.nova).length; b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
}
let ntAba = 'todas';
function ntAbrir(){
  let pop = document.getElementById('ntPop');
  if(pop){ pop.remove(); document.getElementById('ntBtn')?.classList.remove('on'); return; }
  pop = document.createElement('div'); pop.id = 'ntPop'; pop.className = 'tpop'; document.body.appendChild(pop);
  document.getElementById('ntBtn')?.classList.add('on');
  ntRender();
  // abrir marca novidades e a dica do dia como vistas (os avisos ficam até “marcar como lidos” ou até resolver)
  setNtEst({nov:VERSAO, dica:today()}); setTimeout(ntBadge, 50);
}
function ntRender(){
  const pop = document.getElementById('ntPop'); if(!pop) return;
  const its = ntItens(), f = {todas:() => true, avisos:x => x.tipo === 'aviso', novidades:x => x.tipo === 'novidade', dicas:x => x.tipo === 'dica'}[ntAba];
  const vis = its.filter(f), perm = 'Notification' in window ? Notification.permission : 'indisponivel', E = ntEst();
  pop.innerHTML = `<h3>🔔 Notificações<span class="sp"></span>${its.some(x => x.nova && x.tipo === 'aviso') ? '<button class="mini" id="ntLer">marcar avisos como lidos</button>' : ''}<button class="mini" id="ntFechar" aria-label="Fechar">✕</button></h3>
    <div class="ntTabs">${[['todas', 'Todas'], ['avisos', 'Avisos'], ['novidades', 'Novidades'], ['dicas', 'Dicas']].map(([k, l]) => `<button data-nta="${k}" class="${ntAba === k ? 'on' : ''}">${l}${k === 'avisos' && its.filter(x => x.tipo === 'aviso').length ? ' (' + its.filter(x => x.tipo === 'aviso').length + ')' : ''}</button>`).join('')}</div>
    <div class="ntLista">${vis.map(x => `<div class="nt ${x.nova ? 'new' : ''} ${x.nivel || ''} ${x.href ? 'lk' : ''}" ${x.href ? `data-nthref="${esc(x.href)}"` : ''}><i>${x.ic}</i><div><div class="t">${esc(x.t)}</div>${x.s ? `<div class="s">${esc(x.s)}</div>` : ''}</div></div>`).join('')
      || '<div class="empty">Nada por aqui. ✅</div>'}</div>
    <div class="ntPe">${perm === 'granted' ? (E.push === false ? '🔕 Notificações no navegador pausadas. <button class="mini" id="ntPush1">ligar</button>' : '✅ Avisos também no navegador (prazos do dia, compromissos 15 min antes, publicações e erros). <button class="mini" id="ntPush0">pausar</button>')
      : perm === 'denied' ? '🔕 O navegador bloqueou as notificações deste site — libere nas configurações do navegador (cadeado ao lado do endereço).'
      : perm === 'indisponivel' ? 'Este navegador não mostra notificações.' : '<button class="btn" id="ntPermitir">🔔 Ativar notificações no navegador</button> <span class="small muted">prazos do dia, compromissos 15 min antes, publicações novas e erros.</span>'}</div>`;
  pop.querySelector('#ntFechar').onclick = ntAbrir;
  pop.querySelectorAll('[data-nta]').forEach(b => b.onclick = () => { ntAba = b.dataset.nta; ntRender(); });
  const ler = pop.querySelector('#ntLer'); if(ler) ler.onclick = () => { const lidas = {...(ntEst().lidas || {})}; ntAvisos().forEach(a => { lidas[a.id] = a.sig; }); setNtEst({lidas}); ntRender(); ntBadge(); };
  pop.querySelectorAll('[data-nthref]').forEach(el => el.onclick = () => { const h = el.dataset.nthref; ntAbrir(); if(h === '#tsAbrir') tsAbrir(); else go(h); });
  const pm = pop.querySelector('#ntPermitir'); if(pm) pm.onclick = async () => { try{ await Notification.requestPermission(); }catch(e){} setNtEst({push:true}); ntRender(); if(Notification.permission === 'granted') ntEnviar('🔔 Notificações ativadas', 'Você será avisado dos prazos do dia, de compromissos próximos e de publicações novas.', '#/painel', 'teste'); };
  const p0 = pop.querySelector('#ntPush0'); if(p0) p0.onclick = () => { setNtEst({push:false}); ntRender(); };
  const p1 = pop.querySelector('#ntPush1'); if(p1) p1.onclick = () => { setNtEst({push:true}); ntRender(); };
}
document.addEventListener('click', e => { const pop = document.getElementById('ntPop'); if(pop && e.target.isConnected && !pop.contains(e.target) && !e.target.closest('#ntBtn')) ntAbrir(); });

/* ----- notificações do navegador (com o app aberto ou instalado) ----- */
async function ntEnviar(titulo, corpo, href, tag){
  const opt = {body:corpo, tag:tag || titulo, icon:'icon-192.png', badge:'favicon-64.png', data:{url:'./' + (href || '#/painel')}};
  try{ const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); if(reg && reg.showNotification){ await reg.showNotification(titulo, opt); return; } }catch(e){}
  try{ const n = new Notification(titulo, opt); n.onclick = () => { window.focus(); if(href) location.hash = href; n.close(); }; }catch(e){}
}
function ntVerificar(){
  if(!('Notification' in window) || Notification.permission !== 'granted' || ntEst().push === false || !db) return;
  const E = ntEst(), feitos = E.enviados || {}, t = today(), agora = new Date(), novo = {};
  const ja = k => feitos[k], marca = k => { novo[k] = t; };
  // resumo do dia (a partir das 7h)
  if(agora.getHours() >= 7 && !ja('dia:' + t)){ const pend = db.prazos.filter(p => !p.concluido), h = pend.filter(p => p.data === t), a = pend.filter(atrasado);
    if(h.length || a.length) ntEnviar(`📅 Hoje: ${h.length} compromisso(s)` + (a.length ? ` · ⚠️ ${a.length} atrasado(s)` : ''), h.sort((x, y) => (x.hora || '99').localeCompare(y.hora || '99')).slice(0, 4).map(p => (p.hora ? p.hora + ' ' : '') + p.titulo).join('\n') || 'Confira os prazos atrasados.', '#/agenda', 'dia');
    marca('dia:' + t); }
  // compromissos com horário: 15 min antes
  db.prazos.filter(p => !p.concluido && p.data === t && p.hora && !p.diaInteiro).forEach(p => { const [hh, mm] = p.hora.split(':').map(Number), ev = new Date(); ev.setHours(hh, mm, 0, 0);
    const falta = (ev - agora) / 60000, k = 'ev:' + p.id + ':' + p.data + p.hora;
    if(falta <= 15 && falta > -5 && !ja(k)){ ntEnviar(`⏰ ${p.hora} — ${p.titulo}`, [p.tipo, pessoaNome(p.pessoaId), p.local].filter(Boolean).join(' · ') || 'Em instantes', '#/agenda', k); marca(k); } });
  // publicações novas
  db.monitor.filter(m => m.status === 'nova' && m.tipo === 'publicacao' && !ja('pub:' + m.id)).slice(0, 20).forEach((m, i, arr) => { if(i === 0) ntEnviar(`📰 ${arr.length} publicação(ões) nova(s)`, arr.slice(0, 3).map(x => x.numero + (x.titulo ? ' — ' + x.titulo : '')).join('\n'), '#/publicacoes', 'pub'); marca('pub:' + m.id); });
  // erros do robô / Google Agenda
  ntAvisos().filter(a => a.nivel === 'bad' && ['robo', 'djen', 'gcal'].includes(a.id)).forEach(a => { const k = 'err:' + a.id + ':' + a.sig; if(!ja(k)){ ntEnviar('⚠️ ' + a.t, a.s, a.href, a.id); marca(k); } });
  if(Object.keys(novo).length){ const lim = addDays(t, -7), manter = Object.fromEntries(Object.entries({...feitos, ...novo}).filter(([, d]) => d >= lim)); setNtEst({enviados:manter}); }
}
setInterval(() => { ntBadge(); ntVerificar(); }, 60000);
setTimeout(() => { ntBadge(); ntVerificar();
  // primeira abertura depois de uma atualização: avisa das novidades
  const E = ntEst(); if(E.nov && verNum(E.nov) < verNum(VERSAO) && NOVIDADES.some(n => verNum(n.v) > verNum(E.nov))) toast('✨ Novidades nesta versão — veja no 🔔');
  if(!E.nov) setNtEst({nov:VERSAO}); }, 2500);
// clique na notificação (pelo service worker): abre a tela certa
if(navigator.serviceWorker) navigator.serviceWorker.addEventListener('message', e => { if(e.data?.tipo === 'abrir' && e.data.url){ const h = e.data.url.split('#')[1]; if(h) location.hash = '#' + h; } });
A.notifAbrir = () => ntAbrir();
