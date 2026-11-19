/* ===== 🩺 Verificação do sistema =====
   Junta as verificações registradas em VINCULOS.verificar (cada módulo registra a sua) e mostra em Configurações,
   no contador do menu Configurações e nas notificações. Itens com “corrigir” têm conserto automático e seguro
   (só desfazem ligações quebradas — nunca apagam registros). */

/* ----- renomear opção de lista: configurações que guardam o NOME da opção como chave ----- */
VINCULOS.renomear.push((k, de, para) => { let n = 0;
  if(k === 'tipoPrazo'){
    const g = db.meta.gcal; if(g) ['lembH', 'lembD', 'cores', 'auto', 'desc', 'lembTipo'].forEach(f => { n += renomearChave(g[f], de, para); });
    n += renomearChave(db.meta.painel?.reag?.tipos, de, para);
    if(!(db.meta.subtiposPorTipo || {})[de] && SUBTIPOS_PADRAO[de]) db.meta.subtiposPorTipo = {...(db.meta.subtiposPorTipo || {}), [de]:[...SUBTIPOS_PADRAO[de]]};   // leva os subtipos padrão junto
    n += renomearChave(db.meta.subtiposPorTipo, de, para); n += renomearChave(db.meta.lembModelos, de, para);
  }
  if(k === 'subtipo'){
    Object.keys(SUBTIPOS_PADRAO).forEach(t => { if(SUBTIPOS_PADRAO[t].includes(de) && !(db.meta.subtiposPorTipo || {})[t]) db.meta.subtiposPorTipo = {...(db.meta.subtiposPorTipo || {}), [t]:[...SUBTIPOS_PADRAO[t]]}; });
    Object.values(db.meta.subtiposPorTipo || {}).forEach(l => l.forEach((v, i) => { if(v === de){ l[i] = para; n++; } }));
  }
  return n; });

/* ----- verificações dos dados ----- */
const VER_CORRIGIR = {};
VINCULOS.verificar.push(() => {
  const out = [], t = today(), add = (o) => out.push(o);
  const existe = (c, id) => !!byId(c, id);
  // 1. compromissos pendentes sem data: não entram na agenda, nos avisos nem no Google — risco de perder prazo
  const semData = db.prazos.filter(p => !p.concluido && !p.data && ['Prazo processual', 'Audiência', 'Perícia'].includes(p.tipo));
  if(semData.length) add({area:'📅 Agenda', titulo:`${semData.length} prazo(s)/audiência(s) pendente(s) SEM DATA`, txt:semData.slice(0, 4).map(p => p.titulo).join(' · ') + ' — sem data não aparecem nos avisos nem na Google Agenda', href:'#/agenda', grave:true});
  // 2. prazo fatal antes da data do compromisso (provável erro de digitação)
  const fatal = db.prazos.filter(p => !p.concluido && p.data && p.dataFatal && p.dataFatal < p.data && !p.reagendadoDe);   // reagendados de propósito guardam a data original como fatal (e seguem “atrasados”)
  if(fatal.length) add({area:'📅 Agenda', titulo:`${fatal.length} compromisso(s) com prazo fatal ANTES da data`, txt:fatal.slice(0, 4).map(p => `${p.titulo} (${fmtD(p.data)} / fatal ${fmtD(p.dataFatal)})`).join(' · '), href:'#/agenda', grave:true});
  // 3. ligações com registros que não existem mais
  const orf = [['prazos', 'processoId', 'processos'], ['prazos', 'pessoaId', 'pessoas'], ['andamentos', 'processoId', 'processos'], ['conversas', 'pessoaId', 'pessoas'], ['conversas', 'processoId', 'processos'],
    ['financeiro', 'pessoaId', 'pessoas'], ['financeiro', 'processoId', 'processos'], ['horas', 'processoId', 'processos'], ['processos', 'clienteId', 'pessoas'], ['leads', 'pessoaId', 'pessoas']]
    .map(([c, f, alvo]) => ({c, f, ls:db[c].filter(x => x[f] && !existe(alvo, x[f]))})).filter(x => x.ls.length);
  if(orf.length){ VER_CORRIGIR.orfaos = () => { let n = 0; orf.forEach(({c, f, ls}) => ls.forEach(x => { const r = byId(c, x.id); if(r){ r[f] = ''; n++; } })); return n; };
    add({area:'🔗 Ligações', titulo:`${sum(orf.map(x => x.ls.length))} registro(s) ligados a cadastros que não existem mais`, txt:orf.map(x => `${NOMES_COL[x.c] || x.c} → ${NOMES_COL[x.f === 'clienteId' || x.f === 'pessoaId' ? 'pessoas' : 'processos']}: ${x.ls.length}`).join(' · '), corrigir:'orfaos', grave:orf.some(x => x.c === 'prazos' || x.c === 'processos')}); }
  // 4. lembretes e tarefas de preparação desencontrados
  const lembOrf = [], filhosOrf = [];
  db.prazos.forEach(p => (p.lembretes || []).forEach(l => { if(l.tarefaId && !existe('prazos', l.tarefaId)) lembOrf.push([p.id, l.id]); }));
  db.prazos.forEach(p => { if(p.lembDe?.pai && !existe('prazos', p.lembDe.pai)) filhosOrf.push(p.id); });
  if(lembOrf.length || filhosOrf.length){ VER_CORRIGIR.lembretes = () => { lembOrf.forEach(([pid, lid]) => { const l = (byId('prazos', pid)?.lembretes || []).find(x => x.id === lid); if(l) delete l.tarefaId; });
      filhosOrf.forEach(id => { const p = byId('prazos', id); if(p) delete p.lembDe; }); lembOrf.forEach(([pid]) => { const p = byId('prazos', pid); if(p && typeof lembSincronizarTarefas === 'function') lembSincronizarTarefas(p); }); return lembOrf.length + filhosOrf.length; };
    add({area:'⏰ Lembretes', titulo:'Lembretes e tarefas de preparação desencontrados', txt:`${lembOrf.length} lembrete(s) cuja tarefa sumiu · ${filhosOrf.length} tarefa(s) de preparação de compromisso excluído`, corrigir:'lembretes'}); }
  // 5. tags excluídas ainda presas nos registros
  const tagsFora = [['processos', 'proc'], ['pessoas', 'pes'], ['prazos', 'cmp']].map(([c, l]) => { const ids = new Set(tagsLista(l).map(x => x.id)); return {c, ids, ls:db[c].filter(x => (x.tags || []).some(t => !ids.has(t)))}; }).filter(x => x.ls.length);
  if(tagsFora.length){ VER_CORRIGIR.tags = () => { let n = 0; tagsFora.forEach(({c, ids, ls}) => ls.forEach(x => { const r = byId(c, x.id); if(r){ r.tags = (r.tags || []).filter(t => ids.has(t)); n++; } })); return n; };
    add({area:'🏷️ Tags', titulo:`${sum(tagsFora.map(x => x.ls.length))} registro(s) com tags que foram excluídas`, txt:'Não aparecem, mas ocupam espaço e confundem filtros.', corrigir:'tags'}); }
  // 6. valores fora das listas (opção excluída depois de usada)
  const fora = [];
  LISTAS.filter(L => L.usos && !L.sugestao && !/sugest/.test(L.nome)).forEach(L => L.usos.forEach(([c, f]) => { if(!db[c]) return; const vs = new Set(listaItens(L.k).map(x => x.v)), ls = db[c].filter(x => x[f] && typeof x[f] === 'string' && !vs.has(x[f]));
    if(L.k === 'subtipo') return; if(ls.length) fora.push(`${L.nome}: ${[...new Set(ls.map(x => x[f]))].slice(0, 3).map(v => '“' + v + '”').join(', ')} (${ls.length} registro(s))`); }));
  if(fora.length) add({area:'📋 Listas', titulo:'Valores em uso que não estão mais nas listas', txt:fora.join(' · ') + ' — inclua de novo em Configurações › Listas e opções, ou altere os registros.', href:'#/listas'});
  // 7. armazenamento e backup
  if(ARM.erro) add({area:'💾 Armazenamento', titulo:'Falha ao gravar no aparelho', txt:ARM.erro, grave:true});
  const u = typeof bkUltLocal === 'function' && bkUltLocal(), mins = Number(bkCfg?.().intervalo) || 10;
  if(COL.some(c => db[c].length) && u && Date.now() - Date.parse(u.id) > Math.max(3 * mins, 60) * 60e3 && db.meta.updated > (u.updated || '')) add({area:'🛟 Backup', titulo:'A última cópia automática está atrasada', txt:'Última: ' + bkQuando(u.id) + '. Faça uma agora em Configurações › Backups automáticos.'});
  return out;
});

/* ----- tela ----- */
function verCardHtml(){
  const ps = vincProblemas(), g = ps.filter(p => p.grave);
  return `<div class="card" id="verCard" style="border:2px solid ${g.length ? 'var(--bad)' : ps.length ? 'var(--warn)' : 'var(--ok)'}"><h2>🩺 Verificação do sistema ${g.length ? `<span class="tag bad">${g.length} importante(s)</span>` : ps.length ? `<span class="tag warn">${ps.length} aviso(s)</span>` : '<span class="tag ok">tudo certo</span>'}</h2>
    <p class="small muted" style="margin-top:0">Confere sozinho se as partes do sistema continuam ligadas: workflows × listas, tags e campos; compromissos sem data; ligações com cadastros excluídos; lembretes; armazenamento e backup.</p>
    ${ps.map((p, i) => `<div class="li"><div class="grow"><b>${p.grave ? '🔴' : '🟡'} ${esc(p.area)} — ${esc(p.titulo)}</b><div class="sub">${esc(p.txt || '')}</div></div>${p.corrigir ? `<button class="btn" data-act="verCorrigir" data-k="${p.corrigir}">Corrigir</button>` : ''}${p.href ? `<a class="btn" href="${p.href}">Abrir</a>` : ''}</div>`).join('') || '<div class="empty">✔ Nenhum problema encontrado.</div>'}</div>`;
}
function verBadge(){ const el = document.querySelector('#nav a[data-v=config] .count') || (() => { const a = document.querySelector('#nav a[data-v=config]'); if(!a) return null; a.insertAdjacentHTML('beforeend', '<span class="count" hidden></span>'); return a.querySelector('.count'); })();
  if(!el) return; const n = vincProblemas().filter(p => p.grave && !/Workflows/.test(p.area)).length; el.hidden = !n; el.textContent = n; el.title = n + ' problema(s) importante(s) na verificação do sistema'; }
{ const o = updateCounts; let t; updateCounts = function(){ o(); clearTimeout(t); t = setTimeout(() => { try{ verBadge(); }catch(e){} }, 400); }; }
{ const o = ntAvisos; ntAvisos = function(){ const av = o(); vincProblemas().filter(p => p.grave && !/Workflows/.test(p.area)).forEach((p, i) => av.push({id:'ver_' + p.titulo.replace(/\d+/g, '#'), sig:p.titulo + p.txt, ic:'🩺', t:p.titulo, s:p.txt, href:p.href || '#/config', nivel:'bad', tipo:'aviso'})); return av; }; }
A.verCorrigir = d => { const f = VER_CORRIGIR[d.k]; if(!f) return; const n = f(); save(); render(); toast(`🩺 ${n} item(ns) corrigido(s)`); };
