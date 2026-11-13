// Meu Escritório — Dados (armazenamento no aparelho), utilitários, dias úteis, listas editáveis e formulários
'use strict';
/* ================= DADOS ================= */
const KEY = 'escritorio_db_v1';
const COL = ['pessoas','processos','andamentos','conversas','prazos','leads','financeiro','acordos','monitor','importar'];
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
const pluralPolo = n => n === 'Réu' ? 'réus' : n.toLowerCase() + 's';
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
  if(d.meta && Array.isArray(d.meta.listas?.posicao) && !d.meta.posicaoV2){ const its = d.meta.listas.posicao, novos = ['Agravante','Agravado','Recorrente','Recorrido','Embargante','Embargado','Impetrante','Impetrado'];
    const iEx = its.findIndex(x => x.v === 'Executado'); const add = novos.filter(v => !its.some(x => x.v === v)).map(v => ({v})); its.splice(iEx >= 0 ? iEx + 1 : its.length, 0, ...add); d.meta.posicaoV2 = true; }
  // migração da versão 1 (honorários -> financeiro)
  if(!Array.isArray(d.meta.modelosHon)) d.meta.modelosHon = JSON.parse(JSON.stringify(MODELOS_PADRAO));
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
let db = load();
function load(){ try{ const d = JSON.parse(localStorage.getItem(KEY)); if(d) return norm(d); }catch(e){} return norm({}); }
function save(){ db.meta.updated = new Date().toISOString(); localStorage.setItem(KEY, JSON.stringify(db)); autoFileSave(); updateCounts(); if(typeof driveMarcar === 'function') driveMarcar(); }
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const byId = (c, id) => id ? db[c].find(x => x.id === id) : undefined;
function upsert(c, obj){
  if(obj.id){ const i = db[c].findIndex(x => x.id === obj.id); if(i >= 0){ db[c][i] = {...db[c][i], ...obj}; save(); return db[c][i]; } }
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
const procCode = p => { const c = byId('pessoas', p?.clienteId); return c && c.pasta ? `${c.pasta}.${p.seq || '?'}` : ''; };
const procLabel = p => p ? (procCode(p) ? procCode(p) + ' · ' : '') + (p.numero || 's/ nº') + (p.titulo ? ' — ' + p.titulo : '') : '';
function nextPasta(){ const n = db.pessoas.map(p => parseInt(p.pasta, 10)).filter(x => !isNaN(x)); return String(n.length ? Math.max(...n) + 1 : 1); }
function nextSeq(clienteId, exceptId){ const n = db.processos.filter(p => p.clienteId === clienteId && p.id !== exceptId).map(p => parseInt(p.seq, 10)).filter(x => !isNaN(x)); return String(n.length ? Math.max(...n) + 1 : 1); }
function cmpPasta(a, b){ const x = parseInt(a, 10), y = parseInt(b, 10); if(isNaN(x) && isNaN(y)) return 0; if(isNaN(x)) return 1; if(isNaN(y)) return -1; return x - y || String(a).localeCompare(String(b)); }
const novoClienteExtra = tipo => tipo === 'Cliente' ? {pasta:nextPasta(), dataContratacao:today()} : {};
const linkP = id => { const p = byId('pessoas', id); return p ? `<a href="#/pessoa/${p.id}">${esc(p.nome)}</a>` : ''; };
const linkProc = id => { const p = byId('processos', id); return p ? `<a href="#/processo/${p.id}">${esc(procLabel(p))}</a>` : ''; };
const linkLead = id => { const l = byId('leads', id); return l ? `<a href="#/lead/${l.id}">🎯 ${esc(l.nome)}</a>` : ''; };
function wa(tel){ let d = digits(tel); if(d.length < 10) return ''; if(!d.startsWith('55')) d = '55' + d; return `<a href="https://wa.me/${d}" target="_blank" rel="noopener" title="Abrir WhatsApp">🟢 WhatsApp</a>`; }
function toastDesfazer(msg, fn){
  let el = document.getElementById('toastU'); if(!el){ el = document.createElement('div'); el.id = 'toastU'; el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:var(--side);color:#fff;padding:10px 14px;border-radius:10px;z-index:61;display:flex;gap:12px;align-items:center;box-shadow:0 8px 24px rgba(0,0,0,.3)'; document.body.appendChild(el); }
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
function isBusiness(s, recesso, federal){ const d = parseD(s), wd = d.getDay(); if(wd === 0 || wd === 6) return false;
  if(holidays(d.getFullYear()).has(s)) return false;
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
  statusProc:['Ativo','Suspenso','Aguardando julgamento','Em recurso','Execução / Cumprimento','Encerrado','Arquivado'],
  posicao:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado','Terceiro interessado','Consultivo / Extrajudicial'],
  canal:['WhatsApp','Telefone','Presencial','E-mail','Videochamada','Outro'],
  tipoPrazo:['Prazo processual','Audiência','Perícia','Reunião','Diligência','Tarefa','Retorno ao cliente'],
  origemLead:['Indicação','Instagram','Facebook','Google','Site','WhatsApp','Cliente antigo','Outro'],
  statusLead:['Novo','Em contato','Reunião agendada','Proposta enviada','Fechado','Perdido'],
  tipoHon:['Contratual','Êxito','Sucumbência','Consulta','Parecer','Reembolso de despesas','Outro'],
  forma:['PIX','Transferência','Boleto','Dinheiro','Cartão','Cheque','Alvará','Outro'],
};
/* ===== Listas e opções editáveis ===== */
const LISTAS = [
  {k:'catAtend', nome:'Categorias de atendimento', padrao:['Processo','Consulta','Financeiro / honorários','Documentos','Agendamento','Administrativo','Outros'], fixos:['Agendamento','Outros'], usos:[['conversas','categoria']]},
  {k:'canal', nome:'Canais de contato', padrao:['WhatsApp','Telefone','Presencial','E-mail','Videochamada','Outro'], fixos:['WhatsApp'], usos:[['conversas','canal']]},
  {k:'tipoPrazo', nome:'Tipos de compromisso', padrao:['Prazo processual','Audiência','Perícia','Reunião','Diligência','Tarefa','Retorno ao cliente'], fixos:['Prazo processual','Audiência','Perícia','Reunião','Tarefa'], usos:[['prazos','tipo']]},
  {k:'subtipo', nome:'Subtipos de compromisso', padrao:['Conciliação','Instrução','UNA','Instrução e julgamento','Julgamento','Mediação','Justificação','Perícia médica','Perícia contábil'], fixos:[], usos:[['prazos','subtipo']]},
  {k:'situacao', nome:'Situações de compromisso', padrao:['Pendente','Realizado','Redesignado','Cancelado'], fixos:['Pendente','Realizado','Redesignado','Cancelado'], usos:[]},
  {k:'colunas', nome:'Colunas do quadro (Prazos e agenda)', especial:'colunas'},
  {k:'area', nome:'Áreas do direito', padrao:['Cível','Trabalhista','Família e Sucessões','Previdenciário','Consumidor','Tributário','Criminal','Empresarial','Administrativo','Outro'], fixos:[], usos:[['processos','area'], ['leads','area']]},
  {k:'statusProc', nome:'Situações do processo', padrao:['Ativo','Suspenso','Aguardando julgamento','Em recurso','Execução / Cumprimento','Encerrado','Arquivado'], fixos:['Ativo','Encerrado','Arquivado'], usos:[['processos','status']]},
  {k:'posicao', nome:'Posição do cliente no processo', padrao:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado','Agravante','Agravado','Recorrente','Recorrido','Embargante','Embargado','Impetrante','Impetrado','Terceiro interessado','Consultivo / Extrajudicial'], fixos:['Autor','Réu','Reclamante','Reclamado','Requerente','Requerido','Exequente','Executado'], usos:[['processos','posicao']]},
  {k:'sistema', nome:'Sistemas de tramitação', padrao:['PJe','PJe — Justiça do Trabalho','eproc','e-SAJ','Projudi','SEEU','e-STJ','e-STF (Peticionamento)','Creta','Tucujuris','PROCON / Administrativo','SEI','Físico (autos em papel)','Outro'], fixos:[], usos:[['processos','sistema']]},
  {k:'tipoAnd', nome:'Tipos de andamento', padrao:['Publicação / Intimação','Despacho','Decisão','Sentença','Acórdão','Petição protocolada','Audiência','Juntada','Movimentação (tribunal)','Movimentação (PUSH)','Movimentação (DataJud)','Outro'], fixos:[], usos:[['andamentos','tipo']]},
  {k:'origemLead', nome:'Origem dos leads', padrao:['Indicação','Instagram','Facebook','Google','Site','WhatsApp','Cliente antigo','Outro'], fixos:[], usos:[['leads','origem']]},
  {k:'statusLead', nome:'Etapas do funil de leads', padrao:['Novo','Em contato','Reunião agendada','Proposta enviada','Fechado','Perdido'], fixos:['Novo','Fechado','Perdido'], usos:[['leads','status']]},
  {k:'forma', nome:'Formas de pagamento', padrao:['PIX','Transferência','Boleto','Dinheiro','Cartão','Cheque','Alvará','Outro'], fixos:[], usos:[['financeiro','forma']]},
  {k:'tipoPessoa', nome:'Tipos de pessoa', padrao:['Cliente','Representante legal','Parte contrária','Testemunha','Perito','Advogado adverso','Outro'], fixos:['Cliente','Representante legal','Parte contrária','Testemunha','Perito','Advogado adverso','Outro'], usos:[['pessoas','tipo']]},
  {k:'relacao', nome:'Relação do representante legal', padrao:['Mãe','Pai','Avó','Avô','Tia','Tio','Irmã / Irmão','Tutor(a)','Guardião / Guardiã','Curador(a)','Outro'], fixos:[], usos:[['@relacao']]},
  {k:'msgs', nome:'Modelos de mensagem (WhatsApp)', especial:'msgs'},
];
const listaDef = k => LISTAS.find(x => x.k === k);
function listaItens(k){ const d = listaDef(k), m = db.meta.listas?.[k]; return Array.isArray(m) ? m : d.padrao.map(v => ({v})); }
const L = k => listaItens(k).filter(x => !x.oculto).map(x => x.v);
['tipoPessoa','area','statusProc','posicao','canal','tipoPrazo','origemLead','statusLead','forma'].forEach(k => { delete OPT[k]; Object.defineProperty(OPT, k, {get: () => L(k), enumerable:true}); });
['sistema','relacao','tipoAnd','catAtend','subtipo','situacao'].forEach(k => Object.defineProperty(OPT, k, {get: () => L(k), enumerable:true}));
function addOpcao(k, v){ const its = listaItens(k).map(x => ({...x})); if(!its.some(x => x.v === v)) its.push({v}); else its.forEach(x => { if(x.v === v) delete x.oculto; }); db.meta.listas = {...(db.meta.listas || {}), [k]:its}; save(); }
function renomearOpcao(k, de, para){
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
const INATIVOS = ['Encerrado','Arquivado'];
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
    if(fd.lista) inp = `<div class="row">${inp}<button type="button" class="mini" data-addopt="${fd.lista}" data-campo="${fd.k}" title="Adicionar nova opção a esta lista (para editar ou remover: Backup e dados → Listas e opções)">＋</button></div>`;
    if(fd.newP) inp = `<div class="row">${inp}<button type="button" class="mini" data-newp="${fd.k}" data-ptipo="${esc(fd.newP)}" title="Cadastrar rapidamente (só o nome)">+ nova</button><button type="button" class="mini" data-newpc="${fd.k}" data-ptipo="${esc(fd.newP)}" title="Abrir o cadastro completo e depois voltar a este formulário">+ completo</button></div>`;
  }
  else inp = `<input name="${fd.k}" id="${id}" type="${fd.type || 'text'}" ${fd.type === 'number' ? 'step="0.01" min="0"' : ''} value="${esc(v)}" ${fd.ph ? `placeholder="${esc(fd.ph)}"` : ''}>`;
  return `<div class="${cls}"><label for="${id}">${esc(fd.label)}${fd.req ? ' *' : ''}</label>${inp}</div>`;
}
function calcHtml(target){ return `<div class="calc" data-calc="${target}">🧮 Calcular: a partir de <input type="date" class="cBase" value="${today()}"> + <input type="number" class="cN" value="15" min="1" style="width:64px"> dias <select class="cTipo"><option value="u">úteis (CPC)</option><option value="c">corridos</option></select> <button type="button" class="mini cBtn">aplicar</button></div>
  <div class="small muted" style="margin-top:4px">Exclui o dia do início, fins de semana, feriados nacionais e o recesso de 20/12 a 20/01. Confira feriados locais e suspensões do tribunal.</div>`; }
let formCfg = null;
function openForm(cfg){
  formCfg = cfg; mForm._iaExtras = null;
  document.getElementById('mTitle').textContent = cfg.title;
  const data = cfg.data || {};
  mForm.dataset.proc = data.processoId || '';
  mForm.innerHTML = cfg.fields.map(fd => fieldHtml(fd, data[fd.k])).join('') +
    `<div class="mfoot">${cfg.onDelete ? '<button type="button" class="btn danger" id="mDel">Excluir</button>' : ''}<span class="sp"></span>${cfg.soFechar ? '<button type="button" class="btn primary" id="mCancel">Fechar</button>' : '<button type="button" class="btn" id="mCancel">Cancelar</button><button class="btn primary" type="submit">Salvar</button>'}</div>`;
  modal.classList.remove('hidden');
  if(cfg.after) cfg.after(mForm);
  const first = mForm.querySelector(cfg.focus ? `[name="${cfg.focus}"]` : 'input:not([type=checkbox]),textarea,select');
  if(first) setTimeout(() => first.focus(), 30);
}
// ===== cadastro completo de pessoa a partir de outro formulário: guarda o formulário atual, abre o da pessoa e depois volta =====
function valoresDoForm(){
  const v = {}; if(!formCfg) return v;
  for(const fd of formCfg.fields){ if(!fd.k || fd.type === 'html' || fd.type === 'sect') continue; const el = mForm.elements[fd.k]; if(!el) continue;
    v[fd.k] = fd.type === 'check' ? el.checked : fd.type === 'radio' ? (mForm.querySelector(`[name="${fd.k}"]:checked`)?.value || '') : el.value; }
  if(mForm.querySelector('#partesBox')) v.partes = [...mForm.querySelectorAll('.parte-row')].map(r => { const o = {pessoaId:r.querySelector('.pp').value, polo:r.querySelector('.pl').value}; const de = r.querySelector('.pde')?.value; if(de) o.representaId = de; return o; }).filter(x => x.pessoaId);
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
    if(fd.req && !out[fd.k]){ el.focus(); toast('Preencha: ' + fd.label); return; }
  }
  const cfg = formCfg;
  if(cfg.onSave(out) !== false){ closeModal(); render(); }
});
mForm.addEventListener('click', e => {
  if(e.target.id === 'mCancel') closeModal();
  if(e.target.id === 'mDel' && formCfg?.onDelete){ if(formCfg.onDelete() !== false){ closeModal(); render(); } }
  const ao = e.target.closest('[data-addopt]');
  if(ao){ const d = listaDef(ao.dataset.addopt), nv = prompt('Nova opção para “' + d.nome + '”:'); if(nv && nv.trim()){ const v = nv.trim(); addOpcao(d.k, v);
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

