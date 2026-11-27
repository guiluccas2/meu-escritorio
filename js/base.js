// Meu Escritório — Dados (armazenamento no aparelho), utilitários, dias úteis, listas editáveis e formulários
'use strict';
/* ================= DADOS ================= */
const KEY = 'escritorio_db_v1';
const COL = ['pessoas','processos','andamentos','conversas','prazos','leads','financeiro','acordos','monitor','importar','horas','iauso','cadlinks','wflog','transf'];
const MODELOS_PADRAO = [
  {nome:'Trabalhista — 30% do êxito', area:'Trabalhista', itens:[{tipo:'percentual', pct:'30', descricao:'o êxito (valor recebido pelo cliente)'}]},
  {nome:'Previdenciário — 30% dos atrasados + 3 salários de benefício', area:'Previdenciário', itens:[{tipo:'percentual', pct:'30', descricao:'os atrasados'}, {tipo:'beneficios', qtd:'3', descricao:'salários de benefício após a implantação'}]},
  {nome:'Cível — valor inicial + 30% da condenação', area:'Cível', itens:[{tipo:'fixo', descricao:'Honorários iniciais', valor:'', parcelas:'1'}, {tipo:'percentual', pct:'30', descricao:'eventual condenação'}]},
];
const HON_MAP = {'Contratual':'Honorários contratuais','Êxito':'Honorários de êxito','Sucumbência':'Honorários sucumbenciais','Consulta':'Consulta / parecer','Parecer':'Consulta / parecer','Reembolso de despesas':'Reembolso de despesas'};
const POLO_ATIVO = ['Autor','Reclamante','Requerente','Exequente','Agravante','Recorrente','Embargante','Impetrante'], POLO_PASSIVO = ['Réu','Reclamado','Requerido','Executado','Agravado','Recorrido','Embargado','Impetrado'];
// nome de cada polo conforme o processo (posição do cliente, tipo de vínculo ou área): ex. Exequente/Executado no cumprimento de sentença
const PARES_POLO = [['Autor','Réu'],['Reclamante','Reclamado'],['Requerente','Requerido'],['Exequente','Executado'],['Agravante','Agravado'],['Recorrente','Recorrido'],['Embargante','Embargado'],['Impetrante','Impetrado']];
function nomesPolos(p){
  let par = PARES_POLO.find(x => x.includes(p?.posicao));
  if(!par){ const v = norm_s(p?.tipoVinculo || ''), t = norm_s(p?.titulo || '');
    par = /cumprimento|execu/.test(v + ' ' + t) ? PARES_POLO[3] : /agravo/.test(v + ' ' + t) ? PARES_POLO[4] : /recurso/.test(v) ? PARES_POLO[5] : /embargos/.test(v + ' ' + t) ? PARES_POLO[6]
      : /mandado de seguranca/.test(t) ? PARES_POLO[7] : p?.area === 'Trabalhista' ? PARES_POLO[1] : PARES_POLO[0]; }
  return {ativo:par[0], passivo:par[1]};
}
const pluralPolo = n => n === 'Réu' ? 'réus' : /r$/i.test(n) ? n.toLowerCase() + 'es' : n.toLowerCase() + 's'; // autor → autores, réu → réus, reclamante → reclamantes
const PAPEIS = [
  {v:'ativo', t:'Polo ativo (autor, reclamante, requerente, exequente, agravante, recorrente…)', l:'Polo ativo'},
  {v:'passivo', t:'Polo passivo (réu, reclamado, requerido, executado, agravado, recorrido…)', l:'Polo passivo'},
  {v:'representante', t:'Representante legal de uma parte', l:'Representante legal'},
  {v:'assistente', t:'Assistente (simples / litisconsorcial)', l:'Assistente'},
  {v:'terceiro', t:'Terceiro interessado', l:'Terceiro interessado'},
  {v:'denunciado', t:'Denunciado à lide', l:'Denunciado à lide'},
  {v:'chamado', t:'Chamado ao processo', l:'Chamado ao processo'},
  {v:'opoente', t:'Opoente', l:'Opoente'},
  {v:'embargante', t:'Embargante / terceiro embargante', l:'Embargante'},
  {v:'amicus', t:'Amicus curiae', l:'Amicus curiae'},
  {v:'mp', t:'Ministério Público', l:'Ministério Público'},
  {v:'defensoria', t:'Defensoria Pública', l:'Defensoria Pública'},
  {v:'curador', t:'Curador especial', l:'Curador especial'},
  {v:'inventariante', t:'Inventariante', l:'Inventariante'},
  {v:'adminjud', t:'Administrador judicial', l:'Administrador judicial'},
  {v:'perito', t:'Perito', l:'Perito'},
  {v:'assistTec', t:'Assistente técnico', l:'Assistente técnico'},
  {v:'advogado', t:'Advogado da parte contrária', l:'Advogado da parte contrária'},
  {v:'outro', t:'Outro participante', l:'Outro participante'},
];
const POLO_LBL = Object.fromEntries(PAPEIS.map(x => [x.v, x.l]));
const TIPO_POR_PAPEL = {representante:'Representante legal', testemunha:'Testemunha', perito:'Perito', assistTec:'Perito', advogado:'Advogado adverso'};
const poloCliente = p => POLO_ATIVO.includes(p?.posicao) ? 'ativo' : POLO_PASSIVO.includes(p?.posicao) ? 'passivo' : '';
const poloOposto = p => poloCliente(p) === 'passivo' ? 'ativo' : 'passivo';
function norm(d){
  d = d && typeof d === 'object' ? d : {}; COL.forEach(c => { if(!Array.isArray(d[c])) d[c] = []; }); d.meta = d.meta || {};
  d.conversas.forEach(c => { if(c.processoId || c.assunto !== 'Dados do processo enviados ao cliente') return;
    const m = String(c.relato || '').match(/\d{7}-?\d{2}\.?\d{4}\.?\d\.?\d{2}\.?\d{4}/); const n = m && m[0].replace(/\D/g, '');
    const pr = n && d.processos.find(p => String(p.numero || '').replace(/\D/g, '') === n); if(pr) c.processoId = pr.id; });
  if(d.meta && Array.isArray(d.meta.listas?.posicao) && !d.meta.posicaoV2){ const its = d.meta.listas.posicao, novos = ['Agravante','Agravado','Recorrente','Recorrido','Embargante','Embargado','Impetrante','Impetrado'];
    const iEx = its.findIndex(x => x.v === 'Executado'); const add = novos.filter(v => !its.some(x => x.v === v)).map(v => ({v})); its.splice(iEx >= 0 ? iEx + 1 : its.length, 0, ...add); d.meta.posicaoV2 = true; }
  // processos: o antigo “Situação” vira Status + Fase + Situação (o que se aguarda)
  if(!d.meta.statusProcV2){
    const mapa = {'Aguardando julgamento':{status:'Ativo', situacaoProc:'Aguardando sentença / julgamento'}, 'Em recurso':{status:'Ativo', fase:'Recursal'}, 'Execução / Cumprimento':{status:'Ativo', fase:'Cumprimento de sentença'}, 'Arquivado':{status:'Arquivado definitivamente'}};
    d.processos.forEach(p => { const m = mapa[p.status]; if(m) Object.entries(m).forEach(([k, v]) => { if(k === 'status' || !p[k]) p[k] = v; }); });
    const L = d.meta.listas && d.meta.listas.statusProc;
    if(Array.isArray(L)){ const velhos = Object.keys(mapa), novos = ['Ativo','Suspenso','Sobrestado','Arquivado provisoriamente','Arquivado definitivamente','Encerrado','Baixado'];
      d.meta.listas.statusProc = [...L.filter(x => !velhos.includes(x.v)), ...novos.filter(v => !L.some(x => x.v === v)).map(v => ({v}))].sort((a, b) => (novos.indexOf(a.v) + 1 || 99) - (novos.indexOf(b.v) + 1 || 99)); }
    d.meta.statusProcV2 = true; }
  // pastas dos clientes no formato P0000 (152 → P0152)
  if(!d.meta.pastaV2){ d.pessoas.forEach(p => { const v = String(p.pasta || '').trim(), m = v.match(/^[pP]?\s*0*(\d+)$/); if(m) p.pasta = 'P' + String(+m[1]).padStart(4, '0'); }); d.meta.pastaV2 = true; }
  // migração da versão 1 (honorários -> financeiro)
  if(!Array.isArray(d.meta.modelosHon)) d.meta.modelosHon = JSON.parse(JSON.stringify(MODELOS_PADRAO));
  d.meta.modelosHon.forEach(m => { if(m && !m.id) m.id = 'mh' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); });   // modelos de honorários são escolhidos pelo id (a ordem pode mudar)
  if(Array.isArray(d.honorarios)){ d.honorarios.forEach(h => { const {tipo, ...r} = h; d.financeiro.push({...r, natureza:'entrada', categoria:HON_MAP[tipo] || 'Outras receitas'}); }); delete d.honorarios; }
  // partes do processo (versão 4 -> lista de partes por polo)
  d.processos.forEach(p => { if(!Array.isArray(p.partes)) p.partes = [];
    if(p.parteContrariaId){ if(!p.partes.some(x => x.pessoaId === p.parteContrariaId)) p.partes.push({pessoaId:p.parteContrariaId, polo:poloOposto(p)}); delete p.parteContrariaId; } });
  // testemunhas: saem da lista de partes e vão para a aba própria do processo
  d.processos.forEach(p => { if(!Array.isArray(p.testemunhas)) p.testemunhas = [];
    const ts = (p.partes || []).filter(x => x.polo === 'testemunha');
    if(ts.length){ ts.forEach(x => { if(!p.testemunhas.some(t => t.pessoaId === x.pessoaId)) p.testemunhas.push({id:'t' + Math.random().toString(36).slice(2, 10), pessoaId:x.pessoaId, arroladaPor:'Nosso cliente', intimacao:'', situacao:'Arrolada', obs:''}); });
      p.partes = p.partes.filter(x => x.polo !== 'testemunha'); } });
  // situação dos compromissos (versão com situação / quadro)
  d.prazos.forEach(p => { if(!p.situacao) p.situacao = p.concluido ? 'Realizado' : 'Pendente'; p.concluido = p.situacao !== 'Pendente'; });
  // ordem do processo na pasta do cliente
  const ord = [...d.processos].sort((a, b) => (a.criadoEm || '').localeCompare(b.criadoEm || '')), mx = {};
  ord.forEach(p => { const k = p.clienteId || ''; if(p.seq) mx[k] = Math.max(mx[k] || 0, parseInt(p.seq, 10) || 0); });
  ord.forEach(p => { if(!p.seq){ const k = p.clienteId || ''; mx[k] = (mx[k] || 0) + 1; p.seq = String(mx[k]); } });
  return d;
}
/* ----- armazenamento: IndexedDB (sem o limite de ~5 MB) + cópia rápida no localStorage enquanto couber -----
   save() só agenda; a gravação acontece uma vez por “rodada” (várias alterações seguidas = uma gravação) e também ao sair da página. */
const ARM = {carregando:false, t:0, idbT:0, pend:null, falhaLS:false, erro:'', idbOk:null};
function armIdb(){ return ARM._db || (ARM._db = new Promise((res, rej) => { const r = indexedDB.open('escritorio_dados', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => { ARM.conn = r.result; res(r.result); }; r.onerror = () => { ARM._db = null; rej(r.error); }; })); }
async function armGet(k){ const d = await armIdb(); return new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }
async function armSet(k, v){ const d = ARM.conn || await armIdb(); return new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('gravação cancelada')); }); }
function armSetJa(k, v){ return new Promise((res, rej) => { const t = ARM.conn.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); try{ t.commit?.(); }catch(e){} t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('gravação cancelada')); }); }   // síncrono até o put
let db = load(); armIdb().catch(() => {});
function load(){ try{ const s = localStorage.getItem(KEY), d = s && JSON.parse(s); if(d && !d._idb) return norm(d); }catch(e){} ARM.carregando = true; return norm({}); }
// na abertura: se os dados estão só no IndexedDB (grandes demais para o localStorage), carrega antes de mostrar
async function armCarregar(){
  let s = null; try{ s = await armGet('db'); }catch(e){ ARM.erro = 'não foi possível ler o banco de dados do aparelho: ' + e.message; }
  if(ARM.carregando){ if(s){ try{ db = norm(JSON.parse(s)); }catch(e){ ARM.erro = 'dados do aparelho ilegíveis'; } } ARM.carregando = false; }
  else if(s){ try{ const d = JSON.parse(s); if((d.meta?.updated || '') > (db.meta.updated || '')) db = norm(d); }catch(e){} }
  if(!s && COL.some(c => db[c].length)) armGravar(JSON.stringify(db));   // 1ª vez: copia para o IndexedDB
  if(!ARM.ant){ ARM.ant = s || JSON.stringify(db); ARM.cont = Object.fromEntries(COL.map(c => [c, db[c].length])); }
}
function armGravar(str){
  // muitos registros a menos de uma vez (exclusão em massa, sincronização, restauração…): guarda antes uma cópia do estado anterior
  const n = Object.fromEntries(COL.map(c => [c, db[c].length])), tot = o => Object.values(o).reduce((a, b) => a + b, 0);
  if(ARM.ant && ARM.cont && tot(ARM.cont) - tot(n) >= 5 && typeof bkDoTexto === 'function') bkDoTexto(ARM.ant, `antes de remover ${tot(ARM.cont) - tot(n)} registro(s)`, ARM.cont);
  ARM.ant = str; ARM.cont = n;
  try{ localStorage.setItem(KEY, str); ARM.falhaLS = false; }
  catch(e){ ARM.falhaLS = true; try{ localStorage.setItem(KEY, JSON.stringify({_idb:true, updated:db.meta.updated})); }catch(e2){ try{ localStorage.removeItem(KEY); }catch(e3){} } }
  ARM.pend = str; clearTimeout(ARM.idbT); ARM.idbT = setTimeout(armGravarIdb, ARM.falhaLS ? 0 : 500);
}
async function armGravarIdb(){ const s = ARM.pend; if(s == null) return; ARM.pend = null;
  try{ await (ARM.conn ? armSetJa('db', s) : armSet('db', s)); ARM.idbOk = new Date(); if(ARM.erro){ ARM.erro = ''; if(typeof renderBanner === 'function') renderBanner(); } }
  catch(e){ ARM.erro = 'falha ao gravar no aparelho (' + (e?.name || e?.message || e) + ')'; if(ARM.falhaLS && typeof renderBanner === 'function') renderBanner(); } }
function salvarAgora(){ clearTimeout(ARM.t); ARM.t = 0; if(ARM.carregando) return; armGravar(JSON.stringify(db));
  autoFileSave(); updateCounts(); if(typeof driveMarcar === 'function') driveMarcar(); if(typeof gcalAgendar === 'function') gcalAgendar(); if(typeof arqAgendar === 'function') arqAgendar(); }
function save(){ if(ARM.carregando) return; DBV++; db.meta.updated = new Date().toISOString(); if(!ARM.t) ARM.t = setTimeout(salvarAgora, 0); }
// ao fechar/trocar de aba: grava o que estiver pendente
const armFlush = () => { if(ARM.t) salvarAgora(); if(ARM.pend != null){ clearTimeout(ARM.idbT); armGravarIdb(); } };
addEventListener('pagehide', armFlush); document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') armFlush(); });
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
/* índices em memória (refeitos sozinhos a cada gravação): evitam percorrer milhares de registros a cada linha das listas */
let DBV = 0; const MEMO = {v:-1, db:null, m:{}};
function memo(k, fn){ if(MEMO.db !== db || MEMO.v !== DBV){ MEMO.db = db; MEMO.v = DBV; MEMO.m = {}; } return k in MEMO.m ? MEMO.m[k] : (MEMO.m[k] = fn()); }
const byId = (c, id) => { const L = id && db[c]; if(!L) return undefined; let ix = memo('id:' + c, () => ({}));
  if(ix.arr !== L || ix.n !== L.length){ ix.arr = L; ix.n = L.length; ix.m = new Map(L.map(x => [x.id, x])); }   // a lista foi trocada ou cresceu sem gravar: refaz
  const r = ix.m.get(id); return r && r.id === id ? r : undefined; };
// listas longas: mostra os primeiros N e um botão “Mostrar mais” (a página abre rápido mesmo com milhares de registros)
const LIM = {};
const limiteDe = (k, n) => LIM[k] || n;
const maisBtn = (k, total, n) => total > limiteDe(k, n) ? `<button type="button" class="btn maisItens" data-act="mostrarMais" data-k="${k}" data-n="${n}">Mostrar mais ${Math.min(n, total - limiteDe(k, n))} (faltam ${total - limiteDe(k, n)})</button>` : '';
const limitar = (k, arr, fn, n = 150) => arr.slice(0, limiteDe(k, n)).map(fn).join('') + maisBtn(k, arr.length, n);
const _idsArr = new WeakMap(); let _idArrN = 0; const idArr = a => _idsArr.get(a) || (_idsArr.set(a, ++_idArrN), _idArrN);   // lista trocada (filter) ou com outro tamanho → índice novo
const agrupar = (k, lista, chave) => memo(k + ':' + lista().length + ':' + idArr(lista()), () => { const m = new Map(); lista().forEach(x => { const c = chave(x); if(c == null || c === '') return; (m.get(c) || m.set(c, []).get(c)).push(x); }); return m; });
const andamentosDe = pid => agrupar('and:proc', () => db.andamentos, a => a.processoId).get(pid) || [];
const prazosDoProc = pid => agrupar('prz:proc', () => db.prazos, x => x.processoId).get(pid) || [];
const conversasDe = pid => agrupar('conv:pes', () => db.conversas, c => c.pessoaId).get(pid) || [];
const procsDaPessoa = pid => memo('proc:env', () => { const m = new Map(); db.processos.forEach(p => !p.servico && new Set([p.clienteId, ...(p.partes || []).map(x => x.pessoaId), ...(p.testemunhas || []).map(x => x.pessoaId)]).forEach(id => { if(id) (m.get(id) || m.set(id, []).get(id)).push(p); })); return m; }).get(pid) || [];
function upsert(c, obj){
  // processo: guarda o dia em que a situação (o que se aguarda) mudou — “concluso desde…” no quadro Aguardando julgamento
  const sitMudou = (a, b) => c === 'processos' && 'situacaoProc' in obj && (a || '') !== (b || '');
  if(obj.id){ const i = db[c].findIndex(x => x.id === obj.id); if(i >= 0){ if(sitMudou(obj.situacaoProc, db[c][i].situacaoProc)) obj = {...obj, situacaoDesde:today()}; db[c][i] = {...db[c][i], ...obj}; save(); return db[c][i]; } }
  if(sitMudou(obj.situacaoProc, '') && !obj.situacaoDesde) obj.situacaoDesde = today();
  obj.id = obj.id || uid(); obj.criadoEm = new Date().toISOString(); db[c].push(obj); save(); return obj;
}
function removeItem(c, id){ db[c] = db[c].filter(x => x.id !== id); save(); }

/* ================= UTILITÁRIOS ================= */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nl2br = s => esc(s).replace(/\n/g, '<br>');
const pad = n => String(n).padStart(2, '0');
const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => isoDate(new Date());
const nowLocal = () => { const d = new Date(); return isoDate(d) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const parseD = s => { const [y,m,d] = s.slice(0,10).split('-').map(Number); return new Date(y, m-1, d); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return isoDate(d); };
const addMonths = (s, n) => { const [y,m,d] = s.split('-').map(Number); const last = new Date(y, m-1+n+1, 0).getDate(); return isoDate(new Date(y, m-1+n, Math.min(d, last))); };
const fmtD = s => s ? `${s.slice(8,10)}/${s.slice(5,7)}/${s.slice(0,4)}` : '';
const fmtDT = s => s ? fmtD(s) + (s.length > 10 ? ' ' + s.slice(11,16) : '') : '';
const money = v => (Number(v) || 0).toLocaleString('pt-BR', {style:'currency', currency:'BRL'});
const sum = arr => arr.reduce((a, b) => a + (Number(b) || 0), 0);
const diffDays = s => Math.round((parseD(s) - parseD(today())) / 86400000);
function rel(s){ if(!s) return ''; const n = diffDays(s);
  if(n === 0) return 'hoje'; if(n === 1) return 'amanhã'; if(n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`; }
const norm_s = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const has = (q, ...vals) => { if(!q) return true; const n = norm_s(q); return vals.some(v => norm_s(v).includes(n)); };
const digits = s => String(s || '').replace(/\D/g, '');
const pessoaNome = id => byId('pessoas', id)?.nome || '';
const procCode = p => { const c = byId('pessoas', p?.clienteId); return c && c.pasta ? (p.servico ? `${c.pasta}.S${p.seqServ || '?'}` : `${c.pasta}.${p.seq || '?'}`) : ''; };   // serviço: P0152.S1
const procLabel = p => p ? (procCode(p) ? procCode(p) + ' · ' : '') + (p.servico ? '🧰 ' + (p.titulo || p.tipoServico || 'serviço') : (p.numero || 's/ nº') + (p.titulo ? ' — ' + p.titulo : '')) : '';
// pasta dos clientes: “P” + 4 dígitos; a sugestão segue a maior pasta existente
function nextPasta(){ const n = db.pessoas.map(p => { const m = String(p.pasta || '').match(/(\d+)/); return m ? +m[1] : NaN; }).filter(x => !isNaN(x)); return 'P' + String(n.length ? Math.max(...n) + 1 : 1).padStart(4, '0'); }
function nextSeq(clienteId, exceptId){ const n = db.processos.filter(p => !p.servico && p.clienteId === clienteId && p.id !== exceptId).map(p => parseInt(p.seq, 10)).filter(x => !isNaN(x)); return String(n.length ? Math.max(...n) + 1 : 1); }
function cmpPasta(a, b){ const num = v => { const m = String(v ?? '').match(/(\d+)/); return m ? +m[1] : NaN; }, x = num(a), y = num(b); if(isNaN(x) && isNaN(y)) return 0; if(isNaN(x)) return 1; if(isNaN(y)) return -1; return x - y || String(a).localeCompare(String(b)); }
const novoClienteExtra = tipo => tipo === 'Cliente' ? {pasta:nextPasta(), dataContratacao:today()} : {};
const linkP = id => { const p = byId('pessoas', id); return p ? `<a href="#/pessoa/${p.id}">${esc(p.nome)}</a>` : ''; };
const linkProc = id => { const p = byId('processos', id); return p ? `<a href="#/processo/${p.id}">${esc(procLabel(p))}</a>` : ''; };
const linkLead = id => { const l = byId('leads', id); return l ? `<a href="#/lead/${l.id}">🎯 ${esc(l.nome)}</a>` : ''; };
function wa(tel){ let d = digits(tel); if(d.length < 10) return ''; if(!d.startsWith('55')) d = '55' + d; return `<a href="https://wa.me/${d}" target="_blank" rel="noopener" title="Abrir WhatsApp">🟢 WhatsApp</a>`; }
function toastDesfazer(msg, fn){
  let el = document.getElementById('toastU'); if(!el){ el = document.createElement('div'); el.id = 'toastU'; el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--side);color:var(--onSide);padding:10px 14px;border-radius:10px;z-index:61;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3)'; document.body.appendChild(el); }
  el.innerHTML = `<span>${esc(msg)}</span><button class="btn" style="padding:4px 10px">↩ desfazer</button>`; el.style.display = 'flex';
  clearTimeout(el._t); el._t = setTimeout(() => el.style.display = 'none', 7000);
  el.querySelector('button').onclick = () => { el.style.display = 'none'; fn(); toast('Desfeito'); };
}
function toast(msg){ const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2200); }
const byDateAsc = k => (a, b) => (a[k] || '9999').localeCompare(b[k] || '9999');
const byDateDesc = k => (a, b) => (b[k] || '').localeCompare(a[k] || '');

/* ===== Dias úteis (feriados nacionais + recesso forense 20/12 a 20/01, art. 220 CPC) ===== */
function easter(y){ const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return new Date(y,mo-1,da); }
const _hol = {};
function holidays(y){ if(_hol[y]) return _hol[y];
  const s = new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25'].map(x => y + '-' + x));
  const e = easter(y); [-48,-47,-2,60].forEach(n => { const d = new Date(e); d.setDate(d.getDate() + n); s.add(isoDate(d)); });
  return _hol[y] = s; }
// Justiça Federal (Lei 5.010/66, art. 62): quarta e quinta-feira santas, 11/08, 01/11 e 08/12, além dos nacionais
const _holJF = {};
function holidaysJF(y){ if(_holJF[y]) return _holJF[y];
  const s = new Set(['08-11','11-01','12-08'].map(x => y + '-' + x));
  const e = easter(y); [-4,-3].forEach(n => { const d = new Date(e); d.setDate(d.getDate() + n); s.add(isoDate(d)); });
  return _holJF[y] = s; }
// processo da Justiça Federal: segmento "4" no número CNJ (ex.: 5001017-61.2024.4.03.6325)
const ehFederal = x => { const d = digits(typeof x === 'string' ? x : x?.numero); return d.length === 20 && d[13] === '4'; };
// nomes dos feriados nacionais (para o calendário)
const NOMES_FER = {'01-01':'Confraternização Universal','04-21':'Tiradentes','05-01':'Dia do Trabalho','09-07':'Independência do Brasil','10-12':'Nossa Senhora Aparecida','11-02':'Finados','11-15':'Proclamação da República','11-20':'Dia da Consciência Negra','12-25':'Natal'};
function nomeFeriadoNac(s){ const y = +s.slice(0, 4); if(!holidays(y).has(s)) return ''; if(NOMES_FER[s.slice(5)]) return NOMES_FER[s.slice(5)];
  const e = isoDate(easter(y)), dif = Math.round((parseD(s) - parseD(e)) / 864e5); return {'-48':'Carnaval', '-47':'Carnaval', '-2':'Sexta-feira Santa', '60':'Corpus Christi'}[dif] || 'Feriado nacional'; }
// feriados cadastrados pelo usuário (municipais, estaduais, suspensões do tribunal…) — db.meta.feriados
const feriadosUsuario = () => Array.isArray(db?.meta?.feriados) ? db.meta.feriados : [];
function ferUsuarioDia(s, soPrazos){
  return feriadosUsuario().find(f => { if(!f.ini || (soPrazos && f.prazos === false)) return false; const fim = f.fim && f.fim >= f.ini ? f.fim : f.ini;
    if(!f.anual) return s >= f.ini && s <= fim;
    const md = s.slice(5), a = f.ini.slice(5), b = fim.slice(5); return a <= b ? md >= a && md <= b : md >= a || md <= b; }); }
const nomeFeriado = s => nomeFeriadoNac(s) || ferUsuarioDia(s)?.desc || '';
function isBusiness(s, recesso, federal){ const d = parseD(s), wd = d.getDay(); if(wd === 0 || wd === 6) return false;
  if(holidays(d.getFullYear()).has(s)) return false;
  if(ferUsuarioDia(s, true)) return false;
  if(federal && holidaysJF(d.getFullYear()).has(s)) return false;
  if(recesso){ const md = s.slice(5); if(md >= '12-20' || md <= '01-20') return false; }
  return true; }
function calcPrazo(base, n, tipo, federal){
  let d = base;
  if(tipo === 'u'){ let c = 0; while(c < n){ d = addDays(d, 1); if(isBusiness(d, true, federal)) c++; } }
  else { d = addDays(d, n); while(!isBusiness(d, false, federal)) d = addDays(d, 1); }
  return d; }

/* ================= LISTAS ================= */
const OPT = {
  tipoPessoa:['Cliente','Representante legal','Parte contrária','Testemunha','Perito','Advogado adverso','Outro'],
  area:['Cível','Trabalhista','Família e Sucessões','Previdenciário','Consumidor','Tributário','Criminal','Empresarial','Administrativo','Outro'],
  statusProc:['Ativo','Suspenso','Sobrestado','Arquivado provisoriamente','Arquivado definitivamente','Encerrado','Baixado'],
  posicao:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado','Terceiro interessado','Consultivo / Extrajudicial'],
  canal:['WhatsApp','Telefone','Presencial','E-mail','Videochamada','Outro'],
  tipoPrazo:['Prazo processual','Audiência','Perícia','Reunião','Diligência','Tarefa','Retorno ao cliente'],
  origemLead:['Indicação','Instagram','Facebook','Google','Site','WhatsApp','Cliente antigo','Outro'],
  statusLead:['Novo','Em contato','Reunião agendada','Proposta enviada','Fechado','Perdido'],
  tipoHon:['Contratual','Êxito','Sucumbência','Consulta','Parecer','Reembolso de despesas','Outro'],
  forma:['PIX','Transferência','Boleto','Dinheiro','Cartão','Cartão de débito','Cheque','Alvará','Depósito judicial','Débito automático','Outro'],
};
/* ===== Listas e opções editáveis ===== */
const LISTAS = [
  {k:'catAtend', nome:'Categorias de atendimento', padrao:['Processo','Consulta','Financeiro / honorários','Documentos','Agendamento','Administrativo','Outros'], fixos:['Agendamento','Outros'], usos:[['conversas','categoria']]},
  {k:'canal', nome:'Canais de contato', padrao:['WhatsApp','Telefone','Presencial','E-mail','Videochamada','Outro'], fixos:['WhatsApp'], usos:[['conversas','canal']]},
  {k:'tipoPrazo', nome:'Tipos de compromisso', padrao:['Prazo processual','Audiência','Perícia','Reunião','Diligência','Tarefa','Retorno ao cliente'], fixos:['Prazo processual','Audiência','Perícia','Reunião','Tarefa'], usos:[['prazos','tipo']]},
  {k:'subtipo', nome:'Subtipos de compromisso', padrao:['Conciliação','Instrução','UNA','Instrução e julgamento','Julgamento','Mediação','Justificação','Sessão de julgamento','Perícia médica','Perícia contábil'], fixos:[], usos:[['prazos','subtipo']]},
  {k:'plataformaAud', nome:'Plataformas de audiência online', padrao:['Zoom','Microsoft Teams','Google Meet','Cisco Webex','Balcão Virtual','Outra'], fixos:[], usos:[['prazos','plataforma']]},
  {k:'contatoCom', nome:'Contatos: com quem (compromissos)', padrao:['Cliente','Lead','Testemunha','Perito','Parte contrária / advogado'], fixos:['Cliente','Lead','Testemunha'], usos:[['prazos','contatoCom']]},
  {k:'situacao', nome:'Situações de compromisso', padrao:['Pendente','Realizado','Redesignado','Cancelado'], fixos:['Pendente','Realizado','Redesignado','Cancelado'], usos:[['prazos','situacao']]},
  {k:'colunas', nome:'Colunas do quadro (Agenda)', especial:'colunas'},
  {k:'area', nome:'Áreas do direito', padrao:['Cível','Trabalhista','Família e Sucessões','Previdenciário','Consumidor','Tributário','Criminal','Empresarial','Administrativo','Outro'], fixos:[], usos:[['processos','area'], ['leads','area']]},
  {k:'statusProc', nome:'Status do processo', padrao:['Ativo','Suspenso','Sobrestado','Arquivado provisoriamente','Arquivado definitivamente','Encerrado','Baixado'], fixos:['Ativo','Encerrado','Arquivado definitivamente'], usos:[['processos','status']]},
  {k:'faseProc', nome:'Fases do processo', padrao:['Pré-processual / administrativa','Conhecimento','Conciliação / mediação','Instrução','Recursal','Liquidação','Cumprimento de sentença','Execução'], fixos:[], usos:[['processos','fase']]},
  {k:'situacaoProc', nome:'Situações do processo (o que se aguarda)', padrao:['Aguardando citação','Aguardando defesa / contestação','Aguardando audiência','Aguardando perícia','Aguardando manifestação','Aguardando sentença / julgamento','Aguardando julgamento de recurso','Aguardando trânsito em julgado','Aguardando cálculos','Aguardando penhora','Aguardando pagamento / alvará','Aguardando cumprimento de acordo'], fixos:[], usos:[['processos','situacaoProc']]},
  {k:'rito', nome:'Ritos / procedimentos', padrao:['Comum / Ordinário','Sumário (trabalhista)','Sumaríssimo (trabalhista)','Juizado Especial Cível','Juizado Especial Federal','Juizado da Fazenda Pública','Especial (procedimentos especiais)','Execução de título extrajudicial','Tutela cautelar antecedente','Mandado de segurança','Outro'], fixos:[], usos:[['processos','rito']]},
  {k:'acao', nome:'Ações / assuntos (sugestões)', padrao:['Reclamação trabalhista','Ação trabalhista','Ação de cobrança','Ação de alimentos','Revisional de alimentos','Execução de alimentos','Divórcio consensual','Divórcio litigioso','Guarda','Regulamentação de visitas','Inventário','Alvará judicial','Ação de indenização por danos morais','Ação de indenização por danos materiais e morais','Ação de obrigação de fazer','Ação declaratória','Ação revisional','Ação de despejo','Usucapião','Execução de título extrajudicial','Cumprimento de sentença','Embargos à execução','Mandado de segurança','Aposentadoria por idade','Aposentadoria por tempo de contribuição','Aposentadoria especial','Benefício por incapacidade','BPC / LOAS','Pensão por morte','Revisão de benefício','Requerimento administrativo (INSS)','Recurso administrativo (INSS)','Notificação extrajudicial','Acordo extrajudicial'], fixos:[], usos:[], sugestao:true},
  {k:'tribunal', nome:'Tribunais / órgãos (sugestões)', padrao:['TJSP','TRT-15','TRT-2','TRF-3','TST','STJ','STF','INSS','PROCON'], fixos:[], usos:[['processos','tribunal']], sugestao:true},
  {k:'comarca', nome:'Comarcas (sugestões)', padrao:[], fixos:[], usos:[['processos','comarca']], sugestao:true},
  {k:'vara', nome:'Varas / órgãos julgadores (sugestões)', padrao:[], fixos:[], usos:[['processos','vara']], sugestao:true},
  {k:'posicao', nome:'Posição do cliente no processo', padrao:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado','Agravante','Agravado','Recorrente','Recorrido','Embargante','Embargado','Impetrante','Impetrado','Terceiro interessado','Consultivo / Extrajudicial'], fixos:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado'], usos:[['processos','posicao']]},
  {k:'sistema', nome:'Sistemas de tramitação', padrao:['PJe','PJe — Justiça do Trabalho','eproc','e-SAJ','Projudi','SEEU','e-STJ','e-STF (Peticionamento)','Creta','Tucujuris','PROCON / Administrativo','SEI','Físico (autos em papel)','Outro'], fixos:[], usos:[['processos','sistema']]},
  {k:'tipoAnd', nome:'Tipos de andamento', padrao:['Publicação / Intimação','Despacho','Decisão','Sentença','Acórdão','Petição protocolada','Audiência','Juntada','Movimentação (tribunal)','Movimentação (PUSH)','Movimentação (DataJud)','Outro'], fixos:[], usos:[['andamentos','tipo']]},
  {k:'origemLead', nome:'Origem dos leads', padrao:['Indicação','Instagram','Facebook','Google','Site','WhatsApp','Cliente antigo','Outro'], fixos:[], usos:[['leads','origem']]},
  {k:'statusLead', nome:'Etapas do funil de leads', padrao:['Novo','Em contato','Reunião agendada','Proposta enviada','Fechado','Perdido'], fixos:['Novo','Fechado','Perdido'], usos:[['leads','status']]},
  {k:'forma', nome:'Formas de pagamento', padrao:['PIX','Transferência','Boleto','Dinheiro','Cartão','Cartão de débito','Cheque','Alvará','Depósito judicial','Débito automático','Outro'], fixos:[], usos:[['financeiro','forma']]},
  {k:'tipoServico', nome:'Tipos de serviço', padrao:['Acompanhamento em reunião','Análise de contrato','Elaboração de contrato','Cobrança extrajudicial','Consultoria','Parecer','Palestra','Notificação extrajudicial','Inventário extrajudicial','Divórcio extrajudicial','Testamento','Assessoria mensal','Regularização de imóvel'], fixos:[], usos:[['processos','tipoServico']]},
  {k:'statusServ', nome:'Status dos serviços', padrao:['Em andamento','Aguardando cliente','Concluído','Cancelado'], fixos:['Concluído','Cancelado'], usos:[['processos','statusServ']]},
  {k:'situacaoServ', nome:'Situações dos serviços (o que se aguarda)', padrao:['Aguardando documentos do cliente','Minuta em elaboração','Minuta enviada para revisão','Aguardando assinatura','Aguardando cartório / órgão','Aguardando pagamento'], fixos:[], usos:[['processos','situacaoServ']]},
  {k:'localArquivo', nome:'Locais de arquivo', padrao:['Google Drive','Arquivo físico — escritório','Com o cliente'], fixos:[], usos:[['processos','localArquivo']]},
  {k:'origemReceb', nome:'Origem dos recebimentos com valor do cliente', padrao:['Acordo','Acordo na fase de conhecimento','Acordo na execução','Condenação / cumprimento de sentença','Penhora / bloqueio (Sisbajud)','Alvará / levantamento judicial','Pagamento voluntário','RPV','Precatório','Outro'], fixos:[], usos:[['acordos','origem']]},
  {k:'tipoDoc', nome:'Tipos de documento (financeiro)', padrao:['Recibo','Nota fiscal','Boleto','Fatura','Guia judicial (custas, GRU, DARE)','Contrato','Termo de acordo','Alvará','Nota promissória','Outro'], fixos:[], usos:[['financeiro','tipoDoc']]},
  {k:'tipoPessoa', nome:'Tipos de pessoa', padrao:['Cliente','Representante legal','Parte contrária','Testemunha','Perito','Advogado adverso','Outro'], fixos:['Cliente','Representante legal','Parte contrária','Testemunha','Perito','Advogado adverso','Outro'], usos:[['pessoas','tipo']]},
  {k:'relacao', nome:'Relação do representante legal', padrao:['Mãe','Pai','Avó','Avô','Tia','Tio','Irmã / Irmão','Tutor(a)','Guardião / Guardiã','Curador(a)','Outro'], fixos:[], usos:[['@relacao']]},
  {k:'atividade', nome:'Atividades (horas trabalhadas)', padrao:['Petição','Audiência','Reunião / atendimento','Estudo / pesquisa','Análise de publicação','Diligência','Ligação / WhatsApp','Administrativo','Outro'], fixos:['Outro'], usos:[['horas','atividade']]},
  {k:'nacionalidade', nome:'Nacionalidades', padrao:['Brasileira','Portuguesa','Italiana','Espanhola','Argentina','Boliviana','Paraguaia','Venezuelana','Haitiana','Japonesa','Outra'], fixos:[], usos:[['pessoas','nacionalidade']], sugestao:true},
  {k:'estadoCivil', nome:'Estados civis', padrao:['Solteiro(a)','Casado(a)','União estável','Divorciado(a)','Separado(a) judicialmente','Viúvo(a)'], fixos:[], usos:[['pessoas','estadoCivil']]},
  {k:'sexo', nome:'Sexo', padrao:['Feminino','Masculino','Prefere não informar'], fixos:[], usos:[['pessoas','sexo']]},
  {k:'profissao', nome:'Profissões / ocupações (sugestões)', padrao:['Auxiliar de produção','Operador(a) de máquinas','Motorista','Vendedor(a)','Auxiliar administrativo','Técnico(a) de enfermagem','Professor(a)','Pedreiro','Empregada doméstica','Do lar','Estudante','Autônomo(a)','Empresário(a)','Servidor(a) público(a)','Aposentado(a)','Desempregado(a)'], fixos:[], usos:[['pessoas','profissao']], sugestao:true},
  {k:'orgaoRG', nome:'Órgãos expedidores do RG', padrao:['SSP','DETRAN','PC','IIRGD','SDS','IFP','SESP','PM','Outro'], fixos:[], usos:[['pessoas','rgOrgao']], sugestao:true},
  {k:'msgs', nome:'Modelos de mensagem (WhatsApp)', especial:'msgs'},
];
const listaDef = k => LISTAS.find(x => x.k === k);
function listaItens(k){ const d = listaDef(k), m = db.meta.listas?.[k]; return Array.isArray(m) ? m : d.padrao.map(v => ({v})); }
const L = k => listaItens(k).filter(x => !x.oculto).map(x => x.v);
['tipoPessoa','area','statusProc','posicao','canal','tipoPrazo','origemLead','statusLead','forma'].forEach(k => { delete OPT[k]; Object.defineProperty(OPT, k, {get: () => L(k), enumerable:true}); });
['contatoCom','tipoServico','statusServ','situacaoServ','localArquivo','origemReceb','tipoDoc','sistema','relacao','tipoAnd','catAtend','subtipo','situacao','atividade','faseProc','situacaoProc','rito','acao','tribunal','comarca','vara','nacionalidade','estadoCivil','sexo','profissao','orgaoRG'].forEach(k => Object.defineProperty(OPT, k, {get: () => L(k), enumerable:true}));
function addOpcao(k, v){ const its = listaItens(k).map(x => ({...x})); if(!its.some(x => x.v === v)) its.push({v}); else its.forEach(x => { if(x.v === v) delete x.oculto; }); db.meta.listas = {...(db.meta.listas || {}), [k]:its}; save(); }
/* ===== VÍNCULOS entre módulos =====
   Tudo o que guarda valores de uma lista PELO NOME (workflows, cores/lembretes por tipo na Google Agenda, reagendamento, subtipos…)
   se registra aqui, para acompanhar quando uma opção é renomeada. E cada módulo registra uma verificação que aponta
   referências quebradas (opção excluída/oculta, tag ou campo apagado, registro órfão) — aparece em Configurações › Verificação do sistema
   e nas notificações. AO CRIAR UM MÓDULO NOVO QUE GUARDE VALORES DE LISTAS, REGISTRE-O AQUI (ver CLAUDE.md). */
const VINCULOS = {renomear:[], verificar:[]};
function vincRenomear(k, de, para){ let n = 0; VINCULOS.renomear.forEach(f => { try{ n += Number(f(k, de, para)) || 0; }catch(e){ console.warn('vínculo', e); } }); return n; }
function vincProblemas(){ const out = []; VINCULOS.verificar.forEach(f => { try{ out.push(...(f() || [])); }catch(e){ console.warn('verificação', e); } }); return out; }
const renomearChave = (o, de, para) => { if(o && typeof o === 'object' && de in o && !(para in o)){ o[para] = o[de]; delete o[de]; return 1; } return 0; };
function renomearOpcao(k, de, para){
  vincRenomear(k, de, para);
  (listaDef(k).usos || []).forEach(([col, campo]) => {
    if(col === '@relacao'){ db.pessoas.forEach(p => (p.representantes || []).forEach(r => { if(r.relacao === de) r.relacao = para; })); return; }
    db[col].forEach(x => { if(x[campo] === de) x[campo] = para; });
  });
  if(k === 'area') (db.meta.modelosHon || []).forEach(m => { if(m.area === de) m.area = para; });
}
const COLUNAS_PADRAO = [{id:'analise', v:'Em análise'}, {id:'distribuir', v:'A distribuir'}, {id:'tarefas', v:'Tarefas / prazos'}, {id:'aguardando', v:'Aguardando providências'}, {id:'audiencias', v:'Audiências'}];
const COLUNAS_FIXAS = ['analise','tarefas','audiencias'];
function colunas(){ const m = db.meta.listas?.colunas; return Array.isArray(m) ? m : COLUNAS_PADRAO; }
const MSGS_PADRAO = [
  {id:'aviso', v:'Aviso de compromisso', texto:'Olá, {nome}! Tudo bem?\n\nInformamos que foi agendado(a) *{compromisso}*{processo}:\n\n📅 *{data} ({dia_semana}){hora}*\n📍 {local}\n\n{observacoes}\n\nQualquer dúvida, estou à disposição.\n\nGuilherme Garcia — Advogado'},
  {id:'nova', v:'Nova data (redesignação)', texto:'Olá, {nome}! Tudo bem?\n\nInformamos que *{compromisso}*{processo} foi remarcado(a) para:\n\n📅 *{data} ({dia_semana}){hora}*\n📍 {local}\n\n{observacoes}\n\nQualquer dúvida, estou à disposição.\n\nGuilherme Garcia — Advogado'},
  {id:'vespera', v:'Lembrete (véspera)', texto:'Olá, {nome}! Passando para lembrar: *amanhã* temos *{compromisso}*{processo}.\n\n📅 *{data}{hora}*\n📍 {local}\n\n{observacoes}\n\nGuilherme Garcia — Advogado'},
];
function modelosMsg(){ const m = db.meta.listas?.msgs; return Array.isArray(m) ? m : MSGS_PADRAO; }
const INATIVOS = ['Encerrado','Arquivado','Arquivado definitivamente','Baixado'];   // serviços: p.status vira “Encerrado” quando Concluído/Cancelado (servicos.js)
const TEST_ARROLADA = ['Nosso cliente', 'Parte contrária', 'Juízo (de ofício)', 'Ministério Público', 'Outro'];
const TEST_INTIMACAO = ['Pelo advogado (carta / AR)', 'Pelo juízo', 'Comparece independentemente de intimação'];
const TEST_SITUACAO = ['A confirmar', 'Arrolada', 'Intimada', 'Confirmou presença', 'Ouvida', 'Dispensada', 'Substituída'];
function formTestemunha(pid, t = {}){
  const proc = byId('processos', pid); if(!proc) return;
  const isNew = !t.id, pes = byId('pessoas', t.pessoaId);
  openForm({ title: isNew ? 'Nova testemunha' : 'Editar testemunha', data:{arroladaPor:'Nosso cliente', situacao:'A confirmar', ...t, telefone:pes?.telefone || '', endereco:pes?.endereco || ''},
    fields:[
      {k:'pessoaId', label:'Testemunha', type:'select', options:pessoasOpts, req:true, newP:'Testemunha', full:true},
      {k:'telefone', label:'Telefone / WhatsApp'},
      {k:'arroladaPor', label:'Arrolada por', type:'select', options:TEST_ARROLADA, empty:false},
      {k:'intimacao', label:'Intimação', type:'select', options:TEST_INTIMACAO, emptyLabel:'—'},
      {k:'situacao', label:'Situação', type:'select', options:TEST_SITUACAO, empty:false},
      {k:'endereco', label:'Endereço (para intimação)', full:true},
      {k:'obs', label:'Observações (o que vai provar, disponibilidade…)', type:'textarea', full:true},
    ],
    after: f => { const ps = f.elements.pessoaId; ps.addEventListener('change', () => { const x = byId('pessoas', ps.value); if(x){ if(!f.elements.telefone.value) f.elements.telefone.value = x.telefone || ''; if(!f.elements.endereco.value) f.elements.endereco.value = x.endereco || ''; } }); },
    onSave: out => {
      const {telefone, endereco, ...rest} = out, x = byId('pessoas', rest.pessoaId);
      if(x){ const up = {}; if(telefone !== (x.telefone || '')) up.telefone = telefone; if(endereco !== (x.endereco || '')) up.endereco = endereco; if(Object.keys(up).length) Object.assign(x, up); if(!x.tipo) x.tipo = 'Testemunha'; }
      if((proc.partes || []).some(y => y.pessoaId === rest.pessoaId) && !confirm('Esta pessoa já está nas partes do processo. Incluir também como testemunha?')) return false;
      const lista = [...(proc.testemunhas || [])];
      if(isNew){ if(lista.some(y => y.pessoaId === rest.pessoaId)) return alert('Esta testemunha já está cadastrada neste processo.'), false; lista.push({id:uid(), ...rest}); }
      else { const i = lista.findIndex(y => y.id === t.id); lista[i] = {...lista[i], ...rest}; }
      upsert('processos', {id:proc.id, testemunhas:lista}); toast('Testemunha salva');
    },
    onDelete: !isNew ? () => { if(!confirm('Remover esta testemunha do processo? (o cadastro da pessoa é mantido)')) return false; upsert('processos', {id:proc.id, testemunhas:(proc.testemunhas || []).filter(y => y.id !== t.id)}); } : null });
}
function abaTestemunhas(p){
  const ts = p.testemunhas || [], porLado = {};
  ts.forEach(t => (porLado[t.arroladaPor || 'Outro'] = porLado[t.arroladaPor || 'Outro'] || []).push(t));
  const cor = s => ({'Ouvida':'ok', 'Confirmou presença':'ok', 'Intimada':'', 'Dispensada':'grey', 'Substituída':'grey', 'A confirmar':'warn'}[s] ?? 'grey');
  const item = t => { const x = byId('pessoas', t.pessoaId);
    return `<div class="li"><div class="grow"><b>${x ? linkP(x.id) : '(pessoa removida)'}</b> <span class="tag ${cor(t.situacao)}">${esc(t.situacao || '')}</span>${t.intimacao ? ` <span class="tag grey">${esc(t.intimacao)}</span>` : ''}
      <div class="sub">${x?.telefone ? esc(x.telefone) + ' ' + wa(x.telefone) : '<span class="muted">sem telefone</span>'}${x?.endereco ? ' · ' + esc(x.endereco) : ''}</div>${t.obs ? `<div class="sub">${nl2br(t.obs)}</div>` : ''}</div>
      <button class="mini" data-act="editTest" data-p="${p.id}" data-id="${t.id}">editar</button></div>`; };
  return `<div class="toolbar"><button class="btn primary" data-act="newTest" data-p="${p.id}">🧑‍⚖️ Nova testemunha</button><span class="small muted">As testemunhas não aparecem como partes do processo.</span></div>
    ${ts.length ? Object.keys(porLado).sort((a, b) => TEST_ARROLADA.indexOf(a) - TEST_ARROLADA.indexOf(b)).map(k => `<h2 style="font-size:14.5px;margin:12px 0 4px">Arroladas por: ${esc(k)} <span class="tag grey">${porLado[k].length}</span></h2>${porLado[k].map(item).join('')}`).join('') : '<div class="empty">Nenhuma testemunha cadastrada neste processo.</div>'}`;
}
const SISTEMAS = ['PJe','PJe — Justiça do Trabalho','eproc','e-SAJ','Projudi','SEEU','e-STJ','e-STF (Peticionamento)','Creta','Tucujuris','PROCON / Administrativo','SEI','Físico (autos em papel)','Outro'];
const pessoasOpts = () => [...db.pessoas].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(p => ({v:p.id, t:p.nome + (p.pasta ? ` — pasta ${p.pasta}` : '') + (p.tipo && p.tipo !== 'Cliente' ? ` (${p.tipo})` : '')}));
const envolve = (p, pid) => !!pid && (p.clienteId === pid || (p.partes || []).some(x => x.pessoaId === pid) || (p.testemunhas || []).some(x => x.pessoaId === pid));
const contrarias = p => { const pc = poloCliente(p); return (p.partes || []).filter(x => (x.polo === 'ativo' || x.polo === 'passivo') && (!pc || x.polo !== pc)); };
const nomesContrarios = p => contrarias(p).map(x => pessoaNome(x.pessoaId)).filter(Boolean);
const nomesPartes = p => [...(p.partes || []), ...(p.testemunhas || [])].map(x => pessoaNome(x.pessoaId)).join(' | ');
function papelNoProcesso(p, pid){
  if(p.clienteId === pid) return 'cliente';
  const x = (p.partes || []).find(y => y.pessoaId === pid); if(!x) return (p.testemunhas || []).some(y => y.pessoaId === pid) ? 'testemunha' : '';
  if(x.polo !== 'ativo' && x.polo !== 'passivo') return x.polo || 'outro';
  const pc = poloCliente(p); return pc && x.polo === pc ? 'litisconsorte' : 'contraria';
}
const procOpts = pid => db.processos.filter(p => !pid || envolve(p, pid))
  .sort((a,b) => (INATIVOS.includes(a.status) - INATIVOS.includes(b.status)) || (a.titulo||'').localeCompare(b.titulo||''))
  .map(p => ({v:p.id, t:procLabel(p) + (pid ? '' : ' · ' + pessoaNome(p.clienteId))}));

/* ================= FORMULÁRIOS ================= */
const mForm = document.getElementById('mForm'), modal = document.getElementById('modal');
function opts(list, v){ return list.map(o => { const val = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o;
  return `<option value="${esc(val)}" ${String(val) === String(v ?? '') ? 'selected' : ''}>${esc(t)}</option>`; }).join(''); }
function fieldHtml(fd, v){
  if(fd.type === 'html') return `<div class="fld full">${fd.html}</div>`;
  if(fd.type === 'sect') return `<div class="sect">${esc(fd.label)}</div>`;
  if(fd.type === 'grupo') return ''; // seções que abrem e fecham: montadas em openForm
  if(fd.type === 'combo'){ // lista de sugestões + digitação livre
    const id = 'f_' + fd.k, val = v ?? fd.def ?? '', list = [...new Set([...(typeof fd.options === 'function' ? fd.options() : fd.options || []), ...(fd.extras ? fd.extras() : [])].filter(Boolean))];
    let inp = `<input name="${fd.k}" id="${id}" list="dl_${fd.k}" value="${esc(val)}" autocomplete="off" ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}><datalist id="dl_${fd.k}">${list.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    if(fd.lista) inp = `<div class="row">${inp}<button type="button" class="mini" data-addcombo="${fd.lista}" data-campo="${fd.k}" title="Guardar o texto digitado como opção da lista (para editar ou remover: Configurações → Listas e opções)">＋</button></div>`;
    return `<div class="fld${fd.full ? ' full' : ''}"><label for="${id}">${esc(fd.label)}${fd.req ? ' *' : ''}</label>${inp}</div>`; }
  const id = 'f_' + fd.k; v = v ?? fd.def ?? '';
  const cls = 'fld' + (fd.full ? ' full' : '');
  if(fd.type === 'check') return `<div class="${cls}"><label class="chk"><input type="checkbox" name="${fd.k}" ${v ? 'checked' : ''}> ${esc(fd.label)}</label></div>`;
  let inp;
  if(fd.type === 'radio') return `<div class="${cls}"><label>${esc(fd.label)}</label><div style="display:flex;gap:18px;flex-wrap:wrap;padding:8px 0">${fd.options.map(o => `<label class="chk" style="white-space:nowrap;display:inline-flex!important"><input type="radio" name="${fd.k}" value="${esc(o.v)}" ${String(v) === String(o.v) ? 'checked' : ''}> ${esc(o.t)}</label>`).join('')}</div></div>`;
  if(fd.type === 'textarea') inp = `<textarea name="${fd.k}" id="${id}" rows="${fd.rows || 3}" ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}>${esc(v)}</textarea>`;
  else if(fd.type === 'select'){
    let list = typeof fd.options === 'function' ? fd.options() : fd.options;
    if(v !== '' && v != null && !list.some(o => String(typeof o === 'object' ? o.v : o) === String(v))) list = [...list, typeof list[0] === 'object' ? {v, t:String(v)} : v];
    inp = `<select name="${fd.k}" id="${id}">${fd.empty === false ? '' : `<option value="">${esc(fd.emptyLabel || '')}</option>`}${opts(list, v)}</select>`;
    if(fd.lista) inp = `<div class="row">${inp}<button type="button" class="mini" data-addopt="${fd.lista}" data-campo="${fd.k}" title="Adicionar nova opção a esta lista (para editar ou remover: Configurações → Listas e opções)">＋</button></div>`;
    if(fd.newP) inp = `<div class="row">${inp}<button type="button" class="mini" data-newp="${fd.k}" data-ptipo="${esc(fd.newP)}" title="Cadastrar rapidamente (só o nome)">+ nova</button><button type="button" class="mini" data-newpc="${fd.k}" data-ptipo="${esc(fd.newP)}" title="Abrir o cadastro completo e depois voltar a este formulário">+ completo</button></div>`;
  }
  else inp = `<input name="${fd.k}" id="${id}" type="${fd.type || 'text'}" ${fd.type === 'number' ? 'step="0.01" min="0"' : ''} value="${esc(v)}" ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}>`;
  return `<div class="${cls}"><label for="${id}">${esc(fd.label)}${fd.req ? ' *' : ''}</label>${inp}</div>`;
}
function calcHtml(target){ return `<div class="calc" data-calc="${target}">🧮 Calcular: a partir de <input type="date" class="cBase" value="${today()}"> + <input type="number" class="cN" value="15" min="1" style="width:64px"> dias <select class="cTipo"><option value="u">úteis (CPC)</option><option value="c">corridos</option></select> <button type="button" class="mini cBtn">aplicar</button></div>
  <div class="small muted" style="margin-top:4px">Exclui o dia do início, fins de semana, feriados nacionais, os feriados cadastrados no calendário da tela inicial e o recesso de 20/12 a 20/01. Confira feriados locais e suspensões do tribunal.</div>`; }
let formCfg = null;
// ouvinte no formulário que vale só enquanto ESTE formulário estiver aberto (o mForm é reaproveitado entre janelas)
function onForm(f, ev, fn){ const g = f._gen; f.addEventListener(ev, e => { if(f._gen === g) fn(e); }); }
function openForm(cfg){
  formCfg = cfg; mForm._iaExtras = null; mForm._extraVals = null; mForm._gen = (mForm._gen || 0) + 1;
  document.getElementById('mTitle').textContent = cfg.title;
  const data = cfg.data || {};
  mForm.dataset.proc = data.processoId || '';
  let html = '', aberto = false;
  cfg.fields.forEach(fd => { if(fd.type === 'grupo'){ if(aberto) html += '</div></details>'; aberto = false; if(fd.fim) return;
      html += `<details class="fgrupo" ${fd.fechado ? '' : 'open'} ${fd.id ? `id="${fd.id}"` : ''}><summary>${esc(fd.label)}${fd.dica ? ` <span class="small muted">${esc(fd.dica)}</span>` : ''}</summary><div class="fgr">`; aberto = true; return; }
    html += fieldHtml(fd, data[fd.k]); });
  if(aberto) html += '</div></details>';
  mForm.innerHTML = html +
    `<div class="mfoot">${cfg.onDelete ? '<button type="button" class="btn danger" id="mDel">Excluir</button>' : ''}<span class="sp"></span>${cfg.soFechar ? '<button type="button" class="btn primary" id="mCancel">Fechar</button>' : '<button type="button" class="btn" id="mCancel">Cancelar</button><button class="btn primary" type="submit">Salvar</button>'}</div>`;
  modal.classList.remove('hidden');
  if(cfg.after) cfg.after(mForm);
  if(typeof camposLigar === 'function') camposLigar(mForm);
  const first = mForm.querySelector(cfg.focus ? `[name="${cfg.focus}"]` : 'input:not([type=checkbox]),textarea,select');
  if(first) setTimeout(() => first.focus(), 30);
}
// ===== cadastro completo de pessoa a partir de outro formulário: guarda o formulário atual, abre o da pessoa e depois volta =====
function valoresDoForm(){
  const v = {}; if(!formCfg) return v;
  for(const fd of formCfg.fields){ if(!fd.k || fd.type === 'html' || fd.type === 'sect') continue; const el = mForm.elements[fd.k]; if(!el) continue;
    v[fd.k] = fd.type === 'check' ? el.checked : fd.type === 'radio' ? (mForm.querySelector(`[name="${fd.k}"]:checked`)?.value || '') : el.value; }
  if(mForm.querySelector('#partesBox')) v.partes = [...mForm.querySelectorAll('.parte-row')].map(r => { const o = {pessoaId:r.querySelector('.pp').value, polo:r.querySelector('.pl').value}; const de = r.querySelector('.pde')?.value; if(de) o.representaId = de; return o; }).filter(x => x.pessoaId);
  if(mForm._extraVals) Object.assign(v, mForm._extraVals());
  if(typeof camposColetar === 'function' && mForm.querySelector('.cpBox')) v.extra = camposColetar(mForm, true);
  return v;
}
function cadastroCompletoPessoa(tipo, aplicar){
  const prev = formCfg; if(!prev) return;
  const vals = valoresDoForm(); let salvo = null;
  formPessoa({}, tipo, r => { salvo = r; });
  const w = setInterval(() => {
    if(!modal.classList.contains('hidden')) return;
    clearInterval(w);
    const data = {...(prev.data || {}), ...vals}; if(salvo) aplicar(data, salvo);
    setTimeout(() => { openForm({...prev, data}); toast(salvo ? `${salvo.nome} cadastrado(a) — continue o formulário` : 'Cadastro cancelado — formulário anterior restaurado'); }, 0);
  }, 200);
}
let renderPendente = false;
function closeModal(){ modal.classList.add('hidden'); mForm.innerHTML = ''; formCfg = null; if(renderPendente){ renderPendente = false; setTimeout(render, 0); } }
function renderSeguro(){ if(!modal.classList.contains('hidden')) renderPendente = true; else render(); }
mForm.addEventListener('submit', e => {
  e.preventDefault(); if(!formCfg) return;
  const out = {};
  for(const fd of formCfg.fields){
    if(!fd.k || fd.type === 'html' || fd.type === 'sect') continue;
    const el = mForm.elements[fd.k]; if(!el) continue;
    out[fd.k] = fd.type === 'check' ? el.checked : fd.type === 'radio' ? (mForm.querySelector(`[name="${fd.k}"]:checked`)?.value || '') : (typeof el.value === 'string' ? el.value.trim() : el.value);
    if(fd.req && !out[fd.k]){ el.closest('details')?.setAttribute('open', ''); el.focus(); toast('Preencha: ' + fd.label); return; }
  }
  if(typeof camposColetar === 'function' && mForm.querySelector('.cpBox')){ const ex = camposColetar(mForm); if(ex === false) return; out.extra = ex; }
  const cfg = formCfg;
  if(cfg.onSave(out) !== false){ closeModal(); render(); }
});
mForm.addEventListener('click', e => {
  if(e.target.id === 'mCancel') closeModal();
  if(e.target.id === 'mDel' && formCfg?.onDelete){ if(formCfg.onDelete() !== false){ closeModal(); render(); } }
  const ac = e.target.closest('[data-addcombo]');
  if(ac){ const inp = mForm.elements[ac.dataset.campo], v = (inp.value || '').trim() || (prompt('Nova opção para “' + listaDef(ac.dataset.addcombo).nome + '”:') || '').trim(); if(!v) return;
    addOpcao(ac.dataset.addcombo, v); inp.value = v; const dl = mForm.querySelector('#dl_' + ac.dataset.campo); if(dl && ![...dl.options].some(o => o.value === v)) dl.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">`); toast('“' + v + '” guardado na lista'); }
  const ao = e.target.closest('[data-addopt]');
  if(ao){ const d = listaDef(ao.dataset.addopt), tp = d.k === 'subtipo' ? mForm.elements.tipo?.value : '', nv = prompt(tp ? `Novo subtipo para “${tp}”:` : 'Nova opção para “' + d.nome + '”:'); if(nv && nv.trim()){ const v = nv.trim(); if(tp && typeof subtipoAdd === 'function') subtipoAdd(tp, v); else addOpcao(d.k, v);
    const sel = mForm.elements[ao.dataset.campo]; if(![...sel.options].some(o => o.value === v)) sel.insertAdjacentHTML('beforeend', `<option value="${esc(v)}">${esc(v)}</option>`); sel.value = v; sel.dispatchEvent(new Event('change')); toast('Opção incluída'); } }
  const npc = e.target.closest('[data-newpc]');
  if(npc){ const campo = npc.dataset.newpc; cadastroCompletoPessoa(npc.dataset.ptipo, (data, s) => { data[campo] = s.id; if(campo === 'clienteId' && 'seq' in data) data.seq = nextSeq(s.id); }); return; }
  const np = e.target.closest('[data-newp]');
  if(np){ const nome = prompt('Nome da nova pessoa (' + np.dataset.ptipo + '):'); if(nome && nome.trim()){
    const p = upsert('pessoas', {nome:nome.trim(), tipo:np.dataset.ptipo, ...novoClienteExtra(np.dataset.ptipo)});
    const sel = mForm.elements[np.dataset.newp]; sel.insertAdjacentHTML('beforeend', `<option value="${p.id}">${esc(p.nome)}</option>`); sel.value = p.id; sel.dispatchEvent(new Event('change'));
    toast('Pessoa cadastrada. Complete os dados depois na ficha dela.'); } }
  if(e.target.classList.contains('cBtn')){
    const box = e.target.closest('.calc'); const base = box.querySelector('.cBase').value, n = parseInt(box.querySelector('.cN').value, 10);
    if(!base || !n) return toast('Informe a data inicial e o número de dias');
    const pf = byId('processos', mForm.elements.processoId?.value || mForm.dataset.proc || ''), fed = ehFederal(pf);
    const r = calcPrazo(base, n, box.querySelector('.cTipo').value, fed);
    mForm.elements[box.dataset.calc].value = r; toast('Prazo final: ' + fmtD(r) + (fed ? ' (com feriados da Justiça Federal)' : ''));
  }
});
document.getElementById('mClose').onclick = closeModal;
modal.addEventListener('mousedown', e => { if(e.target === modal && confirm('Fechar sem salvar?')) closeModal(); });

