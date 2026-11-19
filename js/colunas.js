/* ===== Opções de exibição das listas: escolher e ordenar colunas, ordenar clicando no título, linhas compactas =====
   Processos e Clientes. A escolha fica em db.meta.colunasVis (vale para todos os aparelhos). */
const cvCfg = tab => { const c = (db.meta.colunasVis || {})[tab] || {}; const todas = TABELAS[tab].cols().map(x => x.k);
  const vis = Array.isArray(c.vis) ? c.vis.filter(k => todas.includes(k)) : TABELAS[tab].padrao; return {vis, compacto:!!c.compacto}; };
const proxPrazoDe = p => memo('prox:proc', () => { const m = new Map(); db.prazos.forEach(x => { if(!x.processoId || x.concluido || !x.data) return; const a = m.get(x.processoId); if(!a || byDateAsc('data')(x, a) < 0) m.set(x.processoId, x); }); return m; }).get(p.id);
const TABELAS = {
  processos:{titulo:'Processos', padrao:['pasta', 'acao', 'cliente', 'contraria', 'juizo', 'status', 'ultAnd', 'prox'],
    cols:() => { const t = today(), vis = k => cvCfg('processos').vis.includes(k);
      return [
        {k:'pasta', t:'Pasta', cls:'nowrap', h:p => `<b>${esc(procCode(p)) || '<span class="muted">—</span>'}</b>`, o:p => procCode(p), cmp:(a, b) => cmpPasta(a, b)},
        {k:'acao', t:'Ação / Número', h:p => `<i class="areaDot" style="background:${corArea(p.area)}" title="${esc(p.area || '')}"></i><b>${esc(p.titulo || '')}</b>${!vis('tags') && tagsDe(p).length ? ' ' + tagsHtml(p) : ''}${p.principalId || db.processos.some(x => x.principalId === p.id) ? ` <span class="tag" title="${esc(p.principalId ? (p.tipoVinculo || 'Vinculado') + ' de ' + procLabel(byId('processos', p.principalId)) : 'Tem processos vinculados')}">🔗 ${esc(p.principalId ? (p.tipoVinculo || 'vinculado') : 'principal')}</span>` : ''}${vis('numero') && vis('area') ? '' : `<div class="small muted">${esc([vis('numero') ? '' : (p.numero || 's/ nº'), vis('area') ? '' : p.area].filter(Boolean).join(' · '))}</div>`}`, o:p => p.titulo},
        {k:'numero', t:'Número', cls:'nowrap small', h:p => esc(p.numero || ''), o:p => p.numero},
        {k:'cliente', t:'Cliente', h:p => `${esc(pessoaNome(p.clienteId))}${p.posicao ? `<div class="small muted">${esc(p.posicao)}</div>` : ''}`, o:p => pessoaNome(p.clienteId)},
        {k:'contraria', t:'Parte contrária', h:p => { const n = nomesContrarios(p); return esc(n.slice(0, 2).join(', ')) + (n.length > 2 ? ` <span class="muted small">+${n.length - 2}</span>` : ''); }, o:p => nomesContrarios(p)[0] || ''},
        {k:'juizo', t:'Juízo', cls:'small', h:p => `${esc([p.vara, p.comarca].filter(Boolean).join(' · '))}${p.tribunal || p.sistema ? `<div class="muted">${esc([p.tribunal, p.sistema].filter(Boolean).join(' · '))}</div>` : ''}`, o:p => [p.tribunal, p.comarca, p.vara].join(' ')},
        {k:'status', t:'Status', h:p => `<button class="tag stTag ${STATUS_COR(p.status)}" data-act="procRapido" data-id="${p.id}" title="Alteração rápida: status, fase, situação e tags">${esc(p.status || '—')} ✎</button>${(p.fase && !vis('fase')) || (p.situacaoProc && !vis('situacao')) ? `<div class="small muted">${esc([vis('fase') ? '' : p.fase, vis('situacao') ? '' : p.situacaoProc].filter(Boolean).join(' · '))}</div>` : ''}`, o:p => p.status},
        {k:'ultAnd', t:'Último andamento', cls:'small nowrap', h:p => { const ua = ultAndamento(p), velho = ua && (parseD(t) - parseD(ua)) / 864e5 > 180; return ua ? `${fmtD(ua)}<div class="${velho ? '' : 'muted'}" style="${velho ? 'color:var(--warn)' : ''}">${fmtTempo(ua)}${velho ? ' sem movimentação' : ''}</div>` : '<span class="muted">—</span>'; }, o:p => ultAndamento(p) || '0'},
        {k:'prox', t:'Próximo prazo', cls:'small', h:p => { const nx = proxPrazoDe(p); return nx ? `<b style="color:${nx.data < t ? 'var(--bad)' : nx.data === t ? 'var(--warn)' : 'inherit'}">${fmtD(nx.data)}</b><div class="muted">${esc(nx.titulo)}</div>` : '<span class="muted">—</span>'; }, o:p => proxPrazoDe(p)?.data || '9'},
        {k:'area', t:'Área', h:p => areaTag(p.area), o:p => p.area},
        {k:'fase', t:'Fase', cls:'small', h:p => esc(p.fase || ''), o:p => p.fase},
        {k:'situacao', t:'Situação', cls:'small', h:p => esc(p.situacaoProc || ''), o:p => p.situacaoProc},
        {k:'tags', t:'Tags', h:p => tagsHtml(p), o:p => tagsDe(p).map(x => x.nome).join()},
        {k:'tribunal', t:'Tribunal / órgão', cls:'small', h:p => esc(p.tribunal || ''), o:p => p.tribunal},
        {k:'comarca', t:'Comarca', cls:'small', h:p => esc(p.comarca || ''), o:p => p.comarca},
        {k:'vara', t:'Vara / órgão julgador', cls:'small', h:p => esc(p.vara || ''), o:p => p.vara},
        {k:'sistema', t:'Sistema', cls:'small', h:p => esc(p.sistema || ''), o:p => p.sistema},
        {k:'rito', t:'Rito', cls:'small', h:p => esc(p.rito || ''), o:p => p.rito},
        {k:'tipo', t:'Tipo', cls:'small', h:p => esc(p.tipoProc || 'Judicial'), o:p => p.tipoProc || 'Judicial'},
        {k:'liminar', t:'Liminar', cls:'small', h:p => { const l = ultimaLiminar(p); return l ? esc(l.resultado || '—') : ''; }, o:p => ultimaLiminar(p)?.resultado || ''},
        {k:'valor', t:'Valor da causa', cls:'nowrap right', h:p => p.valorCausa ? money(p.valorCausa) : '', o:p => Number(p.valorCausa) || 0, num:true},
        {k:'distrib', t:'Distribuição', cls:'small nowrap', h:p => fmtD(p.dataDistribuicao), o:p => p.dataDistribuicao || '0'},
        {k:'inicio', t:'Início da atuação', cls:'small nowrap', h:p => fmtD(p.dataInicio), o:p => p.dataInicio || '0'},
        {k:'advC', t:'Advogado contrário', cls:'small', h:p => esc(p.advContrario || ''), o:p => p.advContrario},
        {k:'resumo', t:'Resumo do caso', cls:'small', h:p => esc(String(p.resumo || '').slice(0, 140)), o:p => p.resumo},
        {k:'horas', t:'Horas dedicadas', cls:'small nowrap', h:p => { const m = sum(agrupar('horas:proc', () => db.horas, h => h.processoId).get(p.id)?.map(h => h.min || 0) || []); return m ? fmtMin(m) : ''; }, o:p => sum(agrupar('horas:proc', () => db.horas, h => h.processoId).get(p.id)?.map(h => h.min || 0) || []), num:true},
        ...camposDe('processo').map(c => ({k:'cp_' + c.id, t:c.titulo, cls:'small', h:p => campoTxt(c, p.extra?.[c.id]), o:p => String(p.extra?.[c.id] ?? '')}))]; }},
  pessoas:{titulo:'Clientes e partes', padrao:['pasta', 'nome', 'tipo', 'contato', 'processos', 'desde', 'ultConv'],
    cols:() => { const vis = k => cvCfg('pessoas').vis.includes(k), uc = p => memo('ultConv', () => { const m = new Map(); db.conversas.forEach(c => { if(!c.pessoaId) return; const a = m.get(c.pessoaId); if(!a || (c.dataHora || '') > (a.dataHora || '')) m.set(c.pessoaId, c); }); return m; }).get(p.id);
      return [
        {k:'pasta', t:'Pasta', h:p => `<b>${esc(p.pasta || '')}</b>`, o:p => p.pasta, cmp:(a, b) => cmpPasta(a, b)},
        {k:'nome', t:'Nome', h:p => `<b>${esc(p.nome)}</b>${!vis('tags') && tagsDe(p, 'pes').length ? ' ' + tagsHtml(p, 'pes') : ''}${p.menor ? ' <span class="tag warn">👶 menor/incapaz</span>' : ''}${p.doc && !vis('doc') ? `<div class="small muted">${esc(p.doc)}</div>` : ''}${p.menor ? `<div class="small muted">${esc(repTxt(p))}</div>` : ''}`, o:p => p.nome},
        {k:'tipo', t:'Tipo', h:p => `<span class="tag ${p.tipo === 'Cliente' ? '' : 'grey'}">${esc(p.tipo)}</span>`, o:p => p.tipo},
        {k:'contato', t:'Contato', cls:'small', h:p => `${esc(telsDe(p)[0]?.numero || '')}${telsDe(p).length > 1 ? ` <span class="muted">+${telsDe(p).length - 1}</span>` : ''}${p.email ? '<br>' + esc(p.email) : ''}`, o:p => p.telefone},
        {k:'processos', t:'Processos', h:p => procsDaPessoa(p.id).length || '', o:p => procsDaPessoa(p.id).length, num:true},
        {k:'desde', t:'Cliente desde', cls:'small nowrap', h:p => fmtD(p.dataContratacao), o:p => p.dataContratacao || '0'},
        {k:'ultConv', t:'Última conversa', cls:'small', h:p => { const c = uc(p); return c ? fmtD(c.dataHora) + ' (' + rel(c.dataHora.slice(0, 10)) + ')' : '<span class="muted">—</span>'; }, o:p => uc(p)?.dataHora || '0'},
        {k:'doc', t:'CPF / CNPJ', cls:'small nowrap', h:p => esc(p.doc || ''), o:p => p.doc},
        {k:'nasc', t:'Nascimento / idade', cls:'small nowrap', h:p => p.nascimento ? `${fmtD(p.nascimento)} <span class="muted">(${idade(p.nascimento)} anos)</span>` : '', o:p => p.nascimento || '9'},
        {k:'profissao', t:'Profissão', cls:'small', h:p => esc(p.profissao || ''), o:p => p.profissao},
        {k:'endereco', t:'Endereço', cls:'small', h:p => esc(enderecoTxt(p)), o:p => enderecoTxt(p)},
        {k:'cidade', t:'Cidade / UF', cls:'small', h:p => esc([p.cidade, p.uf].filter(Boolean).join('/')), o:p => p.cidade},
        {k:'origem', t:'Como chegou', cls:'small', h:p => esc(p.origem || ''), o:p => p.origem},
        {k:'tags', t:'Tags', h:p => tagsHtml(p, 'pes'), o:p => tagsDe(p, 'pes').map(x => x.nome).join()},
        {k:'natureza', t:'Física / jurídica', cls:'small', h:p => p.natureza === 'Jurídica' ? 'Jurídica' : 'Física', o:p => p.natureza || 'Física'},
        {k:'estadoCivil', t:'Estado civil', cls:'small', h:p => esc(p.estadoCivil || ''), o:p => p.estadoCivil},
        {k:'sexo', t:'Sexo', cls:'small', h:p => esc(p.sexo || ''), o:p => p.sexo},
        {k:'nacionalidade', t:'Nacionalidade', cls:'small', h:p => esc(p.nacionalidade || ''), o:p => p.nacionalidade},
        {k:'mae', t:'Nome da mãe', cls:'small', h:p => esc(p.mae || ''), o:p => p.mae},
        {k:'rg', t:'RG', cls:'small nowrap', h:p => esc(p.rg || ''), o:p => p.rg},
        {k:'pix', t:'PIX', cls:'small', h:p => esc((p.contas || []).find(c => c.pix)?.pix || ''), o:p => (p.contas || [])[0]?.pix || ''},
        {k:'indicacao', t:'Indicado por', cls:'small', h:p => esc(p.indicacao || ''), o:p => p.indicacao},
        ...camposDe('pessoa').map(c => ({k:'cp_' + c.id, t:c.titulo, cls:'small', h:p => campoTxt(c, p.extra?.[c.id]), o:p => String(p.extra?.[c.id] ?? '')}))]; }},
};
const campoTxt = (c, v) => v === undefined || v === '' || v === false ? '' : c.tipo === 'sim' ? 'Sim' : c.tipo === 'data' ? fmtD(v) : c.tipo === 'valor' ? money(v) : esc(String(v).slice(0, 120));
// ordenação clicando no título da coluna (F.<g>.cOrd / cDir); sem clique, vale a ordem escolhida na caixa “Ordem”
const CV_ORD = {processos:{k:'', dir:1}, pessoas:{k:'', dir:1}};
function cvOrdenar(tab, l){ const o = CV_ORD[tab]; if(!o.k) return false; const c = TABELAS[tab].cols().find(x => x.k === o.k); if(!c) return false;
  const v = r => c.o(r) ?? ''; l.sort((a, b) => o.dir * (c.cmp ? c.cmp(v(a), v(b)) : c.num ? v(a) - v(b) : String(v(a)).localeCompare(String(v(b)), 'pt-BR', {numeric:true}))); return true; }
function cvTabela(tab, lista){
  const cfg = cvCfg(tab), todas = TABELAS[tab].cols(), cols = cfg.vis.map(k => todas.find(c => c.k === k)).filter(Boolean), o = CV_ORD[tab], rota = tab === 'processos' ? '#/processo/' : '#/pessoa/';
  return `<div class="card tablewrap"><table class="${cfg.compacto ? 'compacta' : ''}"><thead><tr><th class="sel"><input type="checkbox" data-xselall="${tab}" title="Selecionar todos"></th>
    ${cols.map(c => `<th class="cvTh ${c.cls && c.cls.includes('right') ? 'right' : ''}" data-act="cvOrd" data-tab="${tab}" data-k="${c.k}" title="Ordenar por ${esc(c.t)}">${esc(c.t)}${o.k === c.k ? (o.dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead><tbody>
    ${lista.slice(0, limiteDe('tab:' + tab, 200)).map(r => `<tr data-href="${rota}${r.id}"><td class="sel"><input type="checkbox" data-xsel="${tab}:${r.id}" ${xMarc(tab, r.id)}></td>${cols.map(c => `<td class="${c.cls || ''}">${c.h(r) ?? ''}</td>`).join('')}</tr>`).join('')}
    </tbody></table>${maisBtn('tab:' + tab, lista.length, 200)}</div>`;
}
function formColunas(tab){
  const T = TABELAS[tab], cfg = cvCfg(tab), todas = T.cols(), ordem = [...cfg.vis, ...todas.map(c => c.k).filter(k => !cfg.vis.includes(k))];
  openForm({title:`👁️ Opções de exibição — ${T.titulo}`, fields:[{type:'html', html:`<p class="small muted" style="margin-top:0">Marque as colunas que aparecem e use ▲ ▼ para mudar a ordem. Também dá para ordenar a lista clicando no título de qualquer coluna (clique de novo para inverter).</p>
    <div class="pList" id="cvList">${ordem.map(k => { const c = todas.find(x => x.k === k); return `<div class="pRow" data-k="${k}"><label class="chk"><input type="checkbox" ${cfg.vis.includes(k) ? 'checked' : ''}> ${esc(c.t)}${k.startsWith('cp_') ? ' <span class="tag grey">personalizado</span>' : ''}</label><span class="sp"></span><button type="button" class="mini pUp" title="Subir">▲</button><button type="button" class="mini pDn" title="Descer">▼</button></div>`; }).join('')}</div>
    <label class="chk" style="margin-top:10px"><input type="checkbox" id="cvCompacto" ${cfg.compacto ? 'checked' : ''}> Linhas compactas (cabem mais processos na tela)</label>
    <div style="margin-top:8px"><a href="#" id="cvPadrao" class="small">voltar ao padrão</a></div>`}],
    after:f => {
      onForm(f, 'click', e => { const b = e.target.closest('.pUp, .pDn'); if(!b) return; const row = b.closest('.pRow');
        if(b.classList.contains('pUp') && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
        if(b.classList.contains('pDn') && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row); });
      f.querySelector('#cvPadrao').onclick = e => { e.preventDefault(); db.meta.colunasVis = {...(db.meta.colunasVis || {}), [tab]:{}}; save(); closeModal(); render(); toast('Colunas no padrão'); }; },
    onSave:() => { const vis = [...mForm.querySelectorAll('#cvList .pRow')].filter(r => r.querySelector('input').checked).map(r => r.dataset.k);
      if(!vis.length){ toast('Escolha ao menos uma coluna'); return false; }
      db.meta.colunasVis = {...(db.meta.colunasVis || {}), [tab]:{vis, compacto:mForm.querySelector('#cvCompacto').checked}}; save(); toast('Exibição salva'); }});
}
Object.assign(A, {
  cvConfig: d => formColunas(d.tab),
  cvOrd: d => { const o = CV_ORD[d.tab]; if(o.k === d.k) o.dir = -o.dir; else { o.k = d.k; o.dir = 1; } if(listFn){ listFn(); updateBulk(); } },
});
// escolher uma ordem na caixa “Ordem” desfaz a ordenação pelo título da coluna (antes de a lista ser redesenhada)
document.addEventListener('change', e => { const f = e.target.dataset?.f; if(f === 'proc.ord') CV_ORD.processos.k = ''; if(f === 'pes.ord') CV_ORD.pessoas.k = ''; }, true);
