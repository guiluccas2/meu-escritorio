/* ===== 🤝 Participações: quem fica com quanto de cada recebimento =====
   • Em qualquer conta a receber (l.participacoes): advogado parceiro, captador, correspondente… Cada participante gera uma conta a pagar
     ligada (l.partDe = id da entrada, l.partId), que fica “aguardando” até a entrada ser recebida (se “só quando eu receber”) e então vence em X dias,
     proporcional ao que foi efetivamente recebido.
   • Em acordos/condenações (a.participantes): calculado parcela a parcela sobre os honorários (ou honorários + sucumbência, ou a parcela inteira),
     e refeito sozinho quando a divisão de uma parcela muda (abrir mão dos honorários numa parcela e compensar em outra).
   O repasse ao cliente continua sendo feito pelo próprio acordo (valor do cliente → repasse). */
const PART_PAPEIS = {parceiro:'Advogado parceiro', captador:'Captador / indicação', correspondente:'Correspondente', outro:'Outro'};
const PART_BASES = {hon:'dos honorários contratuais', honSuc:'dos honorários + sucumbência', parcela:'da parcela inteira'};
const partContaPadrao = papel => (papel === 'captador' ? pcPorChave('captador') : papel === 'correspondente' ? pcById('pc2_2_06') : pcPorChave('parceiro'))?.id || pcPorChave('parceiro')?.id || '';
const partNome = p => byId('pessoas', p.pessoaId)?.nome || p.nome || PART_PAPEIS[p.papel] || 'participante';
const partTxt = (p, base) => `${partNome(p)} — ${PART_PAPEIS[p.papel] || ''} ${String(p.pct).replace('.', ',')}% ${base ? PART_BASES[p.base || 'hon'] : ''}`.trim();

/* ----- editor (usado na conta a receber e no acordo) ----- */
function partEditorHtml(lista, comBase){
  const linha = (p, i) => `<div class="ptRow" data-i="${i}">
    <label>Participante<select data-pt="pessoaId"><option value="">— digitar o nome —</option>${opts(pessoasOpts(), p.pessoaId || '')}</select><input data-pt="nome" value="${esc(p.nome || '')}" placeholder="nome (se não estiver cadastrado)" ${p.pessoaId ? 'style="display:none"' : ''}></label>
    <label>Papel<select data-pt="papel">${opts(Object.entries(PART_PAPEIS).map(([v, t]) => ({v, t})), p.papel || 'parceiro')}</select></label>
    <label>%<input data-pt="pct" type="number" step="0.01" value="${esc(p.pct ?? '')}"></label>
    ${comBase ? `<label>Sobre<select data-pt="base">${opts(Object.entries(PART_BASES).map(([v, t]) => ({v, t})), p.base || 'hon')}</select></label>` : ''}
    <label>Conta do plano<select data-pt="conta">${contaOptsHtml('saida', 'esc', p.conta || partContaPadrao(p.papel))}</select></label>
    <label>Quando pagar<select data-pt="quando">${opts([{v:'receber', t:'só quando eu receber'}, {v:'venc', t:'no vencimento, mesmo sem receber'}], p.quando || 'receber')}</select></label>
    <label>Em até (dias)<input data-pt="dias" type="number" value="${esc(p.dias ?? 0)}"></label>
    <button type="button" class="mini danger" data-ptrm="${i}" title="Remover">✕</button></div>`;
  return `<div class="ptEd" data-base="${comBase ? 1 : ''}">${(lista || []).map(linha).join('')}<button type="button" class="mini" data-ptadd>+ participante</button><div class="small muted" style="margin-top:4px">Ex.: advogado parceiro com 40% dos honorários; captador com 10%. Gera a conta a pagar de cada um, ligada a este recebimento.</div></div>`;
}
const ptLinha = r => { const g = k => r.querySelector(`[data-pt="${k}"]`)?.value ?? '';
  return {id:r.dataset.id || uid(), pessoaId:g('pessoaId'), nome:g('pessoaId') ? '' : g('nome').trim(), papel:g('papel'), pct:Number(String(g('pct')).replace(',', '.')) || 0, base:g('base') || 'hon', conta:g('conta'), quando:g('quando'), dias:parseInt(g('dias'), 10) || 0}; };
const partEditorLer = box => [...box.querySelectorAll('.ptRow')].map(ptLinha).filter(p => p.pct > 0 && (p.pessoaId || p.nome));
function partEditorLigar(box, lista, comBase){
  let L = (lista || []).map(p => ({...p, id:p.id || uid()}));
  const pinta = () => { box.innerHTML = partEditorHtml(L, comBase); box.querySelectorAll('.ptRow').forEach((r, i) => { r.dataset.id = L[i].id; }); };
  const lerTudo = () => { L = [...box.querySelectorAll('.ptRow')].map(ptLinha); };
  box.addEventListener('click', e => {
    if(e.target.closest('[data-ptadd]')){ lerTudo(); L.push({id:uid(), papel:'parceiro', pct:'', base:'hon', quando:'receber', dias:0}); pinta(); }
    const rm = e.target.closest('[data-ptrm]'); if(rm){ lerTudo(); L.splice(+rm.dataset.ptrm, 1); pinta(); } });
  box.addEventListener('change', e => { const r = e.target.closest('.ptRow'); if(!r) return;
    if(e.target.dataset.pt === 'pessoaId') r.querySelector('[data-pt="nome"]').style.display = e.target.value ? 'none' : '';
    if(e.target.dataset.pt === 'papel') r.querySelector('[data-pt="conta"]').innerHTML = contaOptsHtml('saida', 'esc', partContaPadrao(e.target.value)); });
  pinta(); return () => partEditorLer(box);
}

/* ----- cálculo e sincronização ----- */
const centavos = v => Math.round((Number(v) || 0) * 100);
function partAjustar(lancs, alvoCents, p, base, descr){   // cria/atualiza a conta a pagar de um participante; devolve aviso se já pago a menos/mais
  const {l, criar} = lancs, v = Math.round(alvoCents * p.pct / 100);
  if(l && l.pagoEm){ const dif = v - centavos(realV(l)); return Math.abs(dif) > 1 ? `${partNome(p)}: já pago ${money(realV(l))}; o novo cálculo dá ${money(v / 100)}` : ''; }
  if(v <= 0){ if(l) db.financeiro = db.financeiro.filter(x => x.id !== l.id); return ''; }
  const dados = {natureza:'saida', valor:v / 100, conta:p.conta || partContaPadrao(p.papel), categoria:catDaConta(pcById(p.conta || partContaPadrao(p.papel))) || 'Participação', pessoaId:p.pessoaId || '', aguarda:p.quando !== 'venc', partId:p.id, partNome:p.nome || '', ...base};
  if(l) Object.assign(l, dados, {descricao:descr}); else db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), ...dados, descricao:descr, pagoEm:'', valorPago:''});
  return '';
}
// conta a receber comum: uma conta a pagar por participante
function finPartSync(e){
  if(!e || e.natureza !== 'entrada') return [];
  const parts = e.participacoes || [], filhos = db.financeiro.filter(x => x.partDe === e.id), av = [];
  filhos.filter(x => !x.pagoEm && !parts.some(p => p.id === x.partId)).forEach(x => { db.financeiro = db.financeiro.filter(y => y.id !== x.id); });
  const baseC = e.pagoEm ? centavos(realV(e)) : centavos(e.valor);
  parts.forEach(p => { const l = filhos.find(x => x.partId === p.id), venc = p.quando === 'venc' ? addDays(e.vencimento || today(), p.dias || 0) : e.pagoEm ? addDays(e.pagoEm, p.dias || 0) : (e.vencimento ? addDays(e.vencimento, p.dias || 0) : '');
    const a = partAjustar({l}, baseC, p, {partDe:e.id, vencimento:venc, processoId:e.processoId || '', ambito:'esc'}, `${e.descricao} — ${PART_PAPEIS[p.papel] || 'participação'}: ${partNome(p)} (${String(p.pct).replace('.', ',')}%)`); if(a) av.push(a); });
  return av;
}
// acordo: participantes de uma parcela
function acordoPartSync(a, k){
  const g = acordoLanc(a.id, k), parts = a.participantes || [], av = [];
  g.filter(x => x.partId && !x.pagoEm && !parts.some(p => p.id === x.partId)).forEach(x => { db.financeiro = db.financeiro.filter(y => y.id !== x.id); });
  g.filter(l => l.categoria === CAT_HC && !l.conta && a.honConta).forEach(l => { l.conta = a.honConta; });
  if(!parts.length) return av;
  const hon = centavos(sum(g.filter(l => l.categoria === CAT_HC).map(l => l.valor))), suc = centavos(sum(g.filter(l => l.categoria === CAT_HS).map(l => l.valor))), pri = principalParcela(a, k);
  const ents = g.filter(l => l.natureza === 'entrada'), recebida = ents.length > 0 && ents.every(l => l.pagoEm), recEm = recebida ? ents.map(l => l.pagoEm).sort().pop() : '';
  const venc = (ents[0] || g[0])?.vencimento || '';
  parts.forEach(p => { const base = p.base === 'parcela' ? pri + suc : p.base === 'honSuc' ? hon + suc : hon, l = g.find(x => x.partId === p.id);
    const vc = p.quando === 'venc' ? addDays(venc || today(), p.dias || 0) : recebida ? addDays(recEm, p.dias || 0) : (venc ? addDays(venc, p.dias || 0) : '');
    const r = partAjustar({l}, base, p, {acordoId:a.id, parcela:k, vencimento:vc, processoId:a.processoId || '', ambito:'esc'}, `${a.descricao} — ${PART_PAPEIS[p.papel] || 'participação'}: ${partNome(p)} (${String(p.pct).replace('.', ',')}% ${PART_BASES[p.base || 'hon']}) — parc. ${k}/${a.parcelas}`);
    if(r) av.push(`parcela ${k} — ${r}`); });
  return av;
}
const acordoPartSyncTodas = a => [...new Set(acordoLanc(a.id).map(l => l.parcela))].flatMap(k => acordoPartSync(a, k));
const partDoLanc = l => l.partDe ? (byId('financeiro', l.partDe)?.participacoes || []).find(p => p.id === l.partId) : l.acordoId ? (byId('acordos', l.acordoId)?.participantes || []).find(p => p.id === l.partId) : null;

/* ----- verificação ----- */
VINCULOS.verificar.push(() => {
  const out = [], orf = db.financeiro.filter(l => l.partDe && !byId('financeiro', l.partDe) && !l.pagoEm);
  if(orf.length){ VER_CORRIGIR.partOrf = () => { db.financeiro = db.financeiro.filter(l => !orf.includes(l)); return orf.length; };
    out.push({area:'💰 Financeiro', titulo:`${orf.length} participação(ões) a pagar de recebimento que foi excluído`, txt:'Ainda em aberto. Corrigir exclui essas contas a pagar.', corrigir:'partOrf'}); }
  const demais = db.financeiro.filter(l => l.natureza === 'entrada' && (l.participacoes || []).reduce((s, p) => s + p.pct, 0) > 100);
  if(demais.length) out.push({area:'💰 Financeiro', titulo:`${demais.length} recebimento(s) com participações somando mais de 100%`, txt:demais.slice(0, 3).map(l => l.descricao).join(' · '), href:'#/financeiro/receber', grave:true});
  return out;
});

/* ----- acordo: ajustar valores parcela a parcela (abrir mão dos honorários numa e compensar em outra) ----- */
function acordoAjustarParcelas(id){
  const a = byId('acordos', id); if(!a) return; const ks = [...new Set(acordoLanc(id).map(l => l.parcela))].sort((x, y) => x - y), conta = a.modo !== 'cliente';
  const dados = ks.map(k => { const g = acordoLanc(id, k), ents = g.filter(l => l.natureza === 'entrada'), rec = ents.length > 0 && ents.every(l => l.pagoEm);
    return {k, rec, venc:(ents[0] || g[0])?.vencimento || '', pri:principalParcela(a, k), hon:centavos(sum(g.filter(l => l.categoria === CAT_HC).map(l => l.valor))), suc:centavos(sum(g.filter(l => l.categoria === CAT_HS).map(l => l.valor)))}; });
  const prev = Math.round(sum(dados.map(d => d.pri)) * (Number(a.pctContratual) || 0) / 100);
  const parts = a.participantes || [], pv = (d, hon, suc) => parts.map(p => Math.round((p.base === 'parcela' ? d.pri + suc : p.base === 'honSuc' ? hon + suc : hon) * p.pct / 100));
  openForm({title:'✏️ Ajustar parcela a parcela', fields:[{type:'html', html:`<div class="small muted">Digite os <b>honorários</b> (e a sucumbência) de cada parcela. ${conta ? 'O valor do cliente e o repasse' : 'O que fica com o cliente'}${parts.length ? ', e a parte dos participantes,' : ''} são recalculados sozinhos. A linha de total compara com o contrato (${a.pctContratual || 0}% do principal).</div>
    <div class="tablewrap"><table class="ajT"><thead><tr><th>#</th><th>Vencimento</th><th class="right">Principal</th><th class="right">Honorários</th><th class="right">${conta ? 'Cliente' : 'Fica c/ cliente'}</th><th class="right">Sucumbência</th>${parts.length ? '<th class="right">Participantes</th>' : ''}<th></th></tr></thead><tbody>
    ${dados.map(d => `<tr data-k="${d.k}"><td>${d.k}</td><td><input type="date" data-aj="venc" value="${d.venc}" ${d.rec ? 'disabled' : ''}></td><td class="right">${money(d.pri / 100)}</td>
      <td class="right"><input data-aj="hon" type="number" step="0.01" value="${(d.hon / 100).toFixed(2)}"></td><td class="right" data-o="cli">${money((d.pri - d.hon) / 100)}</td>
      <td class="right"><input data-aj="suc" type="number" step="0.01" value="${(d.suc / 100).toFixed(2)}"></td>${parts.length ? `<td class="right small" data-o="pt">${pv(d, d.hon, d.suc).map(v => money(v / 100)).join(' + ')}</td>` : ''}<td>${d.rec ? '<span class="tag ok">recebida</span>' : ''}</td></tr>`).join('')}
    </tbody><tfoot><tr><td></td><td><b>Total</b></td><td class="right"><b>${money(sum(dados.map(d => d.pri)) / 100)}</b></td><td class="right"><b id="ajTH"></b></td><td class="right"><b id="ajTC"></b></td><td class="right"><b id="ajTS"></b></td>${parts.length ? '<td></td>' : ''}<td id="ajOk" class="small"></td></tr></tfoot></table></div>`}],
    after:f => { const upd = () => { let th = 0, tc = 0, ts = 0; f.querySelectorAll('.ajT tbody tr').forEach(r => { const d = dados.find(x => x.k === +r.dataset.k), h = centavos(r.querySelector('[data-aj=hon]').value), s2 = centavos(r.querySelector('[data-aj=suc]').value);
        th += h; tc += d.pri - h; ts += s2; r.querySelector('[data-o=cli]').textContent = money((d.pri - h) / 100); r.querySelector('[data-o=cli]').style.color = d.pri - h < 0 ? 'var(--bad)' : '';
        const ptc = r.querySelector('[data-o=pt]'); if(ptc) ptc.textContent = pv(d, h, s2).map(v => money(v / 100)).join(' + '); r.classList.toggle('mud', h !== d.hon || s2 !== d.suc); });
      f.querySelector('#ajTH').textContent = money(th / 100); f.querySelector('#ajTC').textContent = money(tc / 100); f.querySelector('#ajTS').textContent = money(ts / 100);
      const dif = th - prev; f.querySelector('#ajOk').innerHTML = Math.abs(dif) <= 1 ? '<span style="color:var(--ok)">✔ fecha com o contrato</span>' : `<span style="color:var(--warn)">${dif > 0 ? '+' : '−'}${money(Math.abs(dif) / 100)} ${dif > 0 ? 'acima' : 'abaixo'} do contrato</span>`; };
      onForm(f, 'input', upd); upd(); },
    onSave:() => { const avisos = [];
      mForm.querySelectorAll('.ajT tbody tr').forEach(r => { const k = +r.dataset.k, d = dados.find(x => x.k === k), h = centavos(r.querySelector('[data-aj=hon]').value), s2 = centavos(r.querySelector('[data-aj=suc]').value), vc = r.querySelector('[data-aj=venc]').value;
        if(h < 0 || h > d.pri){ avisos.push(`parcela ${k}: honorários fora do principal — ignorado`); return; }
        if(vc && vc !== d.venc && !d.rec){ acordoLanc(a.id, k).filter(l => !l.pagoEm).forEach(l => { l.vencimento = l.categoria === CAT_REP || l.partId ? addDays(vc, l.categoria === CAT_REP ? parseInt(a.diasRepasse, 10) || 0 : (parts.find(p => p.id === l.partId)?.dias || 0)) : vc; }); }
        if(s2 !== d.suc){ const g = acordoLanc(a.id, k), hs = g.find(l => l.categoria === CAT_HS), ents = g.filter(l => l.natureza === 'entrada'), recRef = ents.find(l => l.pagoEm);
          if(hs){ if(s2 > 0){ hs.valor = s2 / 100; if(hs.pagoEm) hs.valorPago = s2 / 100; } else db.financeiro = db.financeiro.filter(x => x.id !== hs.id); }
          else if(s2 > 0) db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), pessoaId:a.pessoaId, processoId:a.processoId || '', acordoId:a.id, parcela:k, natureza:'entrada', categoria:CAT_HS, conta:pcPorChave('hon_sucumb')?.id, valor:s2 / 100,
            descricao:`${a.descricao} — honorários sucumbenciais — parc. ${k}/${a.parcelas}`, vencimento:vc || d.venc, pagoEm:d.rec ? recRef?.pagoEm || '' : '', valorPago:d.rec ? s2 / 100 : '', forma:''}); }
        if(h !== d.hon || s2 !== d.suc){ const r2 = aplicarDivisao(a, k, d.pri ? h / d.pri * 100 : 0); if(r2) avisos.push(r2); } });
      save(); toast('Parcelas ajustadas'); if(avisos.length) setTimeout(() => alert('Atenção:\n\n' + avisos.join('\n')), 100); }});
}
A.ajParcAcordo = d => acordoAjustarParcelas(d.id);
