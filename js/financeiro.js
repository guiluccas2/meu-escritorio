// Meu Escritório — Financeiro: lançamentos, pagamentos, honorários contratados, acordos e divisão de parcelas
'use strict';
const CAT = {
  entrada: [['Honorários contratuais','rec'],['Honorários de êxito','rec'],['Honorários sucumbenciais','rec'],['Consulta / parecer','rec'],['Valor do cliente (a repassar)','terc'],['Reembolso de despesas','reemb'],['Outras receitas','rec']],
  saida: [['Custas / despesas do processo','reemb'],['Despesa do escritório','desp'],['Impostos','desp'],['Repasse ao cliente','terc'],['Outras despesas','desp']],
};
const CAT_CLI = 'Valor do cliente (a repassar)', CAT_REP = 'Repasse ao cliente', CAT_HC = 'Honorários contratuais', CAT_HS = 'Honorários sucumbenciais';
const catKind = c => ([...CAT.entrada, ...CAT.saida].find(x => x[0] === c) || [])[1] || '';
const catOpts = nat => CAT[nat === 'saida' ? 'saida' : 'entrada'].map(x => x[0]);
const isRec = l => l.natureza === 'entrada' && catKind(l.categoria) === 'rec';
const isDesp = l => l.natureza === 'saida' && catKind(l.categoria) === 'desp';
const realV = l => Number(l.valorPago !== '' && l.valorPago != null ? l.valorPago : l.valor) || 0;
const acordoLanc = (id, k) => db.financeiro.filter(l => l.acordoId === id && (k == null || l.parcela === k));
const parcRecebida = (id, k) => { const e = acordoLanc(id, k).filter(l => l.natureza === 'entrada'); return e.length > 0 && e.every(l => l.pagoEm); };
function finStatus(l){
  if(l.pagoEm) return 'ok';
  if(l.categoria === CAT_REP && l.acordoId && !parcRecebida(l.acordoId, l.parcela)) return 'aguardando';
  return l.vencimento < today() ? 'vencido' : 'aberto';
}
function finTag(l){ const s = finStatus(l), e = l.natureza === 'entrada';
  return {ok:`<span class="tag ok">${e ? 'recebido' : 'pago'}</span>`, vencido:`<span class="tag bad">${e ? 'vencido' : 'atrasado'}</span>`,
    aberto:`<span class="tag">${e ? 'a receber' : 'a pagar'}</span>`, aguardando:'<span class="tag grey">aguarda recebimento</span>'}[s]; }
const saldoClientes = (list = db.financeiro) => sum(list.filter(l => l.natureza === 'entrada' && l.categoria === CAT_CLI && l.pagoEm).map(realV)) - sum(list.filter(l => l.natureza === 'saida' && l.categoria === CAT_REP && l.pagoEm).map(realV));

function formFin(l = {}){
  const isNew = !l.id, nat = l.natureza || 'entrada';
  const fields = [];
  if(l.acordoId) fields.push({type:'html', html:`<div class="small muted">Este lançamento faz parte de <a href="#/acordo/${l.acordoId}">${esc(byId('acordos', l.acordoId)?.descricao || 'um acordo')}</a> (parcela ${l.parcela}).</div>`});
  fields.push(
    {k:'natureza', label:'Tipo', type:'select', empty:false, options:[{v:'entrada', t:'⬆ Entrada (recebimento)'}, {v:'saida', t:'⬇ Saída (pagamento)'}]},
    {k:'categoria', label:'Categoria', type:'select', empty:false, options:catOpts(nat)},
    {k:'pessoaId', label:'Cliente / pessoa', type:'select', options:pessoasOpts, newP:'Cliente'},
    {k:'processoId', label:'Processo', type:'select', options:() => procOpts(l.pessoaId)},
    {k:'descricao', label:'Descrição', req:true, full:true, ph:'Ex.: Honorários contratuais; Custas de preparo; Aluguel da sala'},
    {k:'valor', label:'Valor (R$)', type:'number', req:true});
  if(isNew) fields.push({k:'parcelas', label:'Repetir / parcelar em quantos meses?', type:'number', def:1},
    {k:'modoParc', label:'O valor informado é', type:'select', empty:false, options:[{v:'total', t:'o total (dividir entre os meses)'}, {v:'parcela', t:'o valor de cada mês (repetir)'}]});
  fields.push({k:'vencimento', label: isNew ? 'Vencimento (1º mês)' : 'Vencimento', type:'date', req:true, def:today()},
    {type:'sect', label:'Realização (preencha quando receber / pagar)'},
    {k:'pagoEm', label:'Recebido / pago em', type:'date'},
    {k:'valorPago', label:'Valor efetivo (R$)', type:'number'},
    {k:'forma', label:'Forma', type:'select', options:() => OPT.forma, lista:'forma'},
    ...(isNew || l.pagoEm ? [] : parcialFields(l)),
    {k:'obs', label:'Observações', type:'textarea', full:true});
  openForm({ title: isNew ? (nat === 'saida' ? 'Nova saída (pagamento)' : 'Nova entrada (recebimento)') : 'Editar lançamento', data:{natureza:nat, categoria:catOpts(nat)[0], ...l}, fields,
    after: f => { const ps = f.elements.pessoaId, pr = f.elements.processoId, nt = f.elements.natureza, ct = f.elements.categoria;
      ps.addEventListener('change', () => { const cur = pr.value; pr.innerHTML = '<option value=""></option>' + opts(procOpts(ps.value), cur); });
      pr.addEventListener('change', () => { const proc = byId('processos', pr.value); if(proc && !ps.value) ps.value = proc.clienteId; });
      nt.addEventListener('change', () => { ct.innerHTML = opts(catOpts(nt.value), ''); });
      if(!isNew && !l.pagoEm) parcialAfter(f, l); },
    onSave: out => {
      const n = Math.max(1, Math.min(120, parseInt(out.parcelas, 10) || 1)), modo = out.modoParc; delete out.parcelas; delete out.modoParc;
      if(out.pagoEm && !out.valorPago) out.valorPago = out.valor;
      if(isNew && n > 1){
        const total = Math.round(Number(out.valor) * 100), each = Math.floor(total / n);
        for(let i = 0; i < n; i++){
          const v = modo === 'parcela' ? Number(out.valor) : (i === n - 1 ? total - each * (n - 1) : each) / 100;
          db.financeiro.push({...out, id:uid(), criadoEm:new Date().toISOString(), descricao:`${out.descricao} (${i+1}/${n})`, valor:v, vencimento:addMonths(out.vencimento, i),
            pagoEm: i === 0 ? out.pagoEm : '', valorPago: i === 0 && out.pagoEm ? v : ''});
        }
        save(); toast(n + ' lançamentos criados');
      } else if(!isNew){ const r = aplicarPagamento(l, out); toast(r || 'Salvo'); }
      else { upsert('financeiro', {...l, ...out}); toast('Salvo'); }
    },
    onDelete: !isNew ? () => { if(!confirm('Excluir este lançamento?')) return false; removeItem('financeiro', l.id); } : null });
}
function payFin(id, direct){
  const l = byId('financeiro', id); if(!l) return;
  if(!direct && l.acordoId && l.natureza === 'entrada' && acordoLanc(l.acordoId, l.parcela).filter(x => x.natureza === 'entrada' && !x.pagoEm).length > 1) return receiveParcela(l.acordoId, l.parcela);
  const e = l.natureza === 'entrada', rp = l.categoria === CAT_REP;
  openForm({ title: e ? 'Registrar recebimento' : (rp ? 'Registrar repasse ao cliente' : 'Registrar pagamento'), data:{pagoEm:today(), valorPago:l.valor, forma:l.forma || (rp ? 'PIX' : '')},
    fields:[{type:'html', html:`<b>${esc(l.descricao)}</b><div class="muted small">${esc(pessoaNome(l.pessoaId))} · venc. ${fmtD(l.vencimento)} · ${money(l.valor)}</div>`},
      {k:'pagoEm', label: e ? 'Recebido em' : 'Pago em', type:'date', req:true}, {k:'valorPago', label: e ? 'Valor efetivamente recebido (R$)' : 'Valor efetivamente pago (R$)', type:'number', req:true},
      {k:'forma', label:'Forma', type:'select', options:() => OPT.forma, lista:'forma'},
      ...parcialFields(l)],
    after: f => parcialAfter(f, l),
    onSave: out => { const r = aplicarPagamento(l, out); toast(r || (e ? 'Recebimento registrado' : (rp ? 'Repasse registrado' : 'Pagamento registrado'))); } });
}
/* ----- Pagamento parcial: o que faltar fica em aberto ----- */
function parcialFields(l){
  return [{type:'html', html:'<div id="parcInfo" class="calc" style="display:none"></div>'},
    {k:'manterSaldo', label:'Manter a diferença em aberto (novo lançamento “saldo restante”)', type:'check', def:true},
    {k:'saldoVenc', label:'Vencimento do saldo restante', type:'date', def:l.vencimento || today()}];
}
function parcialAfter(f, l){
  const vp = f.elements.valorPago, ms = f.elements.manterSaldo, sv = f.elements.saldoVenc, info = f.querySelector('#parcInfo');
  const upd = () => {
    const prev = Number(f.elements.valor ? f.elements.valor.value : l.valor) || 0, pago = Number(vp.value) || 0, dif = Math.round((prev - pago) * 100) / 100;
    const show = !!f.elements.pagoEm.value && pago > 0 && dif > 0.004;
    info.style.display = show ? 'block' : 'none';
    ms.closest('.fld').style.display = show ? '' : 'none';
    sv.closest('.fld').style.display = show && ms.checked ? '' : 'none';
    if(show) info.innerHTML = `⚠️ Valor menor que o previsto (${money(prev)}). Diferença: <b>${money(dif)}</b>.`;
  };
  [vp, ms, f.elements.pagoEm, f.elements.valor].forEach(x => x && x.addEventListener('input', upd)); ms.addEventListener('change', upd); upd();
}
function aplicarPagamento(l, out){
  const {manterSaldo, saldoVenc, ...dados} = out;
  const prev = Number(dados.valor ?? l.valor) || 0, pago = Number(dados.valorPago) || 0, dif = Math.round((prev - pago) * 100) / 100;
  if(dados.pagoEm && pago > 0 && dif > 0.004 && manterSaldo){
    const {id, criadoEm, pagoEm, valorPago, forma, obs, saldoDe, ...base} = {...l, ...dados};
    const descBase = String(base.descricao || '').replace(/ — saldo restante$/, '');
    db.financeiro.push({...base, id:uid(), criadoEm:new Date().toISOString(), valor:dif, vencimento:saldoVenc || l.vencimento || today(), pagoEm:'', valorPago:'', forma:'',
      descricao:descBase + ' — saldo restante', saldoDe:l.id, obs:`Saldo do pagamento parcial de ${fmtD(dados.pagoEm)}: previsto ${money(prev)}, pago ${money(pago)}.`});
    upsert('financeiro', {...dados, id:l.id, valor:pago, valorPago:pago, obs:[l.obs, `Pagamento parcial: previsto ${money(prev)}; saldo de ${money(dif)} mantido em aberto.`].filter(Boolean).join('\n')});
    return `Registrado ${money(pago)} — saldo de ${money(dif)} continua em aberto`;
  }
  upsert('financeiro', {...dados, id:l.id});
  return '';
}
/* ----- Contrato de honorários ----- */
const qtdNum = q => Number(String(q ?? '').replace(',', '.')) || 0;
const qtdTxt = q => qtdNum(q) ? qtdNum(q).toLocaleString('pt-BR', {maximumFractionDigits:2}) : '?';
const TIPO_ITEM = {fixo:'Valor fixo', percentual:'% sobre o êxito', beneficios:'Salários de benefício', outro:'Outro'};
const modelos = () => db.meta.modelosHon || [];
function itemTxt(it){
  switch(it.tipo){
    case 'fixo': return `${Number(it.valor) ? money(it.valor) : 'valor a definir'}${parseInt(it.parcelas, 10) > 1 ? ` em ${it.parcelas}x` : ''} — ${it.descricao || 'honorários iniciais'}`;
    case 'percentual': return `${pctTxt(Number(it.pct) || 0)} sobre ${it.descricao || 'o êxito'}`;
    case 'beneficios': return `${qtdTxt(it.qtd)} ${it.descricao || 'salários de benefício'}`;
    default: return (it.descricao || 'outro') + (Number(it.valor) ? ' — ' + money(it.valor) : '');
  }
}
const contratoResumo = p => (p?.contrato?.itens || []).map(itemTxt).join(' + ');
const itemLanc = it => db.financeiro.filter(l => l.contratoItemId === it.id);
const itemExitoPend = pid => (byId('processos', pid)?.contrato?.itens || []).find(it => it.tipo === 'percentual' && it.status !== 'apurado');
function gerarLancHon(p, it, {total, n, venc, categoria, desc, pago}){
  n = Math.max(1, Math.min(120, parseInt(n, 10) || 1));
  const tc = Math.round(Number(total) * 100), each = Math.floor(tc / n);
  for(let i = 0; i < n; i++){
    const v = (i === n - 1 ? tc - each * (n - 1) : each) / 100, vv = addMonths(venc || today(), i);
    db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), natureza:'entrada', categoria, pessoaId:p.clienteId, processoId:p.id, contratoItemId:it.id,
      descricao: n > 1 ? `${desc} (${i+1}/${n})` : desc, valor:v, vencimento:vv, pagoEm: pago ? vv : '', valorPago: pago ? v : '', forma:''});
  }
}
function itemRowHtml(it){
  const t = it.tipo || 'fixo', pagoAlgum = !!it.id && itemLanc(it).some(l => l.pagoEm), dis = it.gerado && pagoAlgum ? 'disabled' : '';
  const ph = {fixo:'Honorários iniciais', percentual:'condenação em dano moral / o êxito / os atrasados', beneficios:'salários de benefício após a implantação', outro:'Ex.: 1 salário mínimo por audiência'}[t];
  const lb = {fixo:'Descrição', percentual:'Sobre o quê', beneficios:'De quê', outro:'Descrição'}[t];
  const L = (txt, inner, span) => `<label class="small" style="display:block;color:var(--muted)${span ? ';grid-column:span 2' : ''}">${txt}${inner}</label>`;
  return `<div class="item-row" data-id="${esc(it.id || '')}" data-tipo="${t}" style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px">
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><b class="small" style="color:var(--pri)">${TIPO_ITEM[t]}</b>${it.status === 'apurado' ? ' <span class="tag ok">apurado</span>' : ''}<span class="sp"></span><button type="button" class="mini rmIt">✕ remover</button></div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:6px">
      ${t === 'percentual' ? L('Percentual (%)', `<input class="it-pct" type="number" step="0.01" min="0" value="${esc(it.pct ?? '')}">`) : ''}
      ${t === 'beneficios' ? L('Quantidade', `<input class="it-qtd" type="number" step="any" min="0" placeholder="Ex.: 2,5" value="${esc(it.qtd ?? '')}">`) : ''}
      ${L(lb, `<input class="it-desc" value="${esc(it.descricao || '')}" placeholder="${esc(ph)}">`, true)}
      ${t === 'fixo' || t === 'outro' ? L('Valor total (R$)', `<input class="it-valor" type="number" step="0.01" min="0" value="${esc(it.valor ?? '')}" ${dis}>`) : ''}
      ${t === 'fixo' ? L('Parcelas', `<input class="it-parc" type="number" min="1" value="${esc(it.parcelas || 1)}" ${dis}>`) + L('1º vencimento', `<input class="it-venc" type="date" value="${esc(it.primeiroVenc || today())}" ${dis}>`) : ''}
    </div>
    ${t === 'fixo' ? (it.gerado ? (pagoAlgum ? '<div class="small muted" style="margin-top:6px">Já há valores recebidos deste item — para alterar o que falta, edite os lançamentos em aberto no financeiro.</div>'
        : '<div class="small muted" style="margin-top:6px">Já lançado no financeiro como “a receber”. Se você alterar valor, parcelas ou vencimento, os lançamentos serão refeitos.</div>')
      : `<div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:6px"><label class="chk small"><input type="checkbox" class="it-gerar" checked> lançar no financeiro como “a receber”</label><label class="chk small"><input type="checkbox" class="it-pago"> já recebido</label></div>`) : ''}
  </div>`;
}
function readItens(root){
  return [...root.querySelectorAll('.item-row')].map(r => { const v = c => (r.querySelector(c)?.value ?? '').trim(), ck = c => !!r.querySelector(c)?.checked;
    const o = {id:r.dataset.id || '', tipo:r.dataset.tipo, descricao:v('.it-desc')};
    if(o.tipo === 'percentual') o.pct = v('.it-pct');
    if(o.tipo === 'beneficios') o.qtd = v('.it-qtd');
    if(o.tipo === 'fixo' || o.tipo === 'outro') o.valor = v('.it-valor');
    if(o.tipo === 'fixo'){ o.parcelas = v('.it-parc'); o.primeiroVenc = v('.it-venc'); o._gerar = ck('.it-gerar'); o._pago = ck('.it-pago'); }
    return o; });
}
function formContrato(pid){
  const p = byId('processos', pid); if(!p) return;
  const c = p.contrato || {data:p.dataInicio || today(), itens:[], obs:''};
  openForm({ title:'Honorários contratados — ' + (procCode(p) ? procCode(p) + ' · ' : '') + (p.titulo || ''), data:{data:c.data, obs:c.obs},
    fields:[
      {k:'data', label:'Data do contrato', type:'date'},
      {k:'modelo', label:'Preencher com um modelo', type:'select', options:() => modelos().map((m, i) => ({v:String(i), t:m.nome})), emptyLabel:'— escolher modelo —'},
      {type:'html', html:`<div class="sect" style="margin:0 0 6px">Itens combinados com o cliente</div><div id="itensBox"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${Object.entries(TIPO_ITEM).map(([k, t]) => `<button type="button" class="mini addIt" data-t="${k}">+ ${t}</button>`).join('')}<span class="sp"></span><button type="button" class="mini" id="salvaModelo">💾 salvar estes itens como modelo</button></div>`},
      {k:'obs', label:'Observações / cláusulas especiais', type:'textarea', full:true},
    ],
    after: f => {
      const box = f.querySelector('#itensBox'), add = it => box.insertAdjacentHTML('beforeend', itemRowHtml(it));
      (c.itens || []).forEach(add);
      if(!box.children.length){ const i = modelos().findIndex(m => m.area && m.area === p.area); if(i >= 0){ modelos()[i].itens.forEach(it => add({...it, id:''})); toast('Modelo sugerido: ' + modelos()[i].nome); } }
      f.querySelectorAll('.addIt').forEach(b => b.onclick = () => add({tipo:b.dataset.t, pct: b.dataset.t === 'percentual' ? '30' : '', qtd: b.dataset.t === 'beneficios' ? '3' : ''}));
      box.addEventListener('click', e => { if(!e.target.classList.contains('rmIt')) return; const r = e.target.closest('.item-row'), old = (c.itens || []).find(x => x.id === r.dataset.id);
        if(old && itemLanc(old).length && !confirm('Este item já tem lançamentos no financeiro. Eles serão mantidos; apenas o item sai do contrato. Continuar?')) return; r.remove(); });
      f.elements.modelo.addEventListener('change', () => { const m = modelos()[parseInt(f.elements.modelo.value, 10)]; f.elements.modelo.value = ''; if(!m) return;
        if(box.children.length && !confirm('Substituir os itens atuais pelos do modelo “' + m.nome + '”?')) return; box.innerHTML = ''; m.itens.forEach(it => add({...it, id:''})); });
      f.querySelector('#salvaModelo').onclick = () => { const its = readItens(f); if(!its.length) return toast('Inclua ao menos um item');
        const nome = prompt('Nome do modelo (ex.: Família — 2.000 iniciais + 10% da partilha):'); if(!nome || !nome.trim()) return;
        db.meta.modelosHon = [...modelos(), {nome:nome.trim(), area:p.area || '', itens:its.map(({id, _gerar, _pago, primeiroVenc, ...r}) => r)}]; save(); toast('Modelo salvo'); };
    },
    onSave: out => {
      const old = Object.fromEntries((c.itens || []).map(i => [i.id, i]));
      const itens = readItens(mForm).map(r => {
        const {_gerar, _pago, ...it} = r, base = old[it.id] || {status:'pendente'}, m = {...base, ...it, id: it.id || uid()};
        if(base.gerado){ const ls = itemLanc(base);
          if(ls.some(l => l.pagoEm)){ m.valor = base.valor; m.parcelas = base.parcelas; m.primeiroVenc = base.primeiroVenc; }
          else if(String(m.valor) !== String(base.valor) || String(m.parcelas) !== String(base.parcelas) || String(m.primeiroVenc) !== String(base.primeiroVenc) || String(m.descricao) !== String(base.descricao)){
            db.financeiro = db.financeiro.filter(l => l.contratoItemId !== base.id);
            if(Number(m.valor) > 0) gerarLancHon(p, m, {total:m.valor, n:m.parcelas, venc:m.primeiroVenc, categoria:CAT_HC, desc:m.descricao || 'Honorários iniciais', pago:false}); else m.gerado = false; } }
        if(m.tipo === 'fixo' && !m.gerado && _gerar && Number(m.valor) > 0){
          gerarLancHon(p, m, {total:m.valor, n:m.parcelas, venc:m.primeiroVenc, categoria:CAT_HC, desc:m.descricao || 'Honorários iniciais', pago:_pago}); m.gerado = true; }
        return m; });
      upsert('processos', {id:p.id, contrato:{data:out.data, obs:out.obs, itens}}); toast('Honorários contratados salvos');
    } });
}
function formApurar(pid, iid){
  const p = byId('processos', pid), it = p?.contrato?.itens?.find(x => x.id === iid); if(!it) return;
  const perc = it.tipo === 'percentual', ajuste = it.status === 'apurado' && !it.acordoId;
  const lsOld = ajuste ? itemLanc(it) : [];
  if(lsOld.some(l => l.pagoEm)){ alert('Já há valores recebidos desta apuração. Para mudar o valor, edite os lançamentos em aberto no financeiro (ou use o pagamento parcial).'); return; }
  const calc = b => perc ? Math.round(b * Number(it.pct)) / 100 : Math.round(b * qtdNum(it.qtd) * 100) / 100;
  const data = ajuste ? {[perc ? 'base' : 'unit']:it.baseValor, valorFinal:it.valorApurado, parcelas:lsOld.length || 1, venc:[...lsOld].sort(byDateAsc('vencimento'))[0]?.vencimento || today()}
    : {venc:today(), parcelas: perc ? 1 : Math.max(1, Math.ceil(qtdNum(it.qtd)))};
  openForm({ title:(ajuste ? 'Ajustar honorários: ' : 'Apurar honorários: ') + itemTxt(it), data,
    fields:[
      {type:'html', html:`<div class="small muted">${perc ? 'Informe o valor que serviu de base (condenação, acordo, atrasados…). O programa calcula seus honorários; você pode <b>arredondar ou ajustar o valor final</b> antes de salvar.'
        : 'Informe o valor de cada salário de benefício. O programa calcula o total; você pode <b>arredondar ou ajustar o valor final</b> antes de salvar.'}
        ${perc && !ajuste ? '<br><b>Dica:</b> se o valor for pago em <b>acordo parcelado que passa pela sua conta</b>, cancele e use “Novo acordo / condenação” na aba Financeiro do processo — o percentual deste contrato já vem preenchido.' : ''}
        ${ajuste ? '<br>Os lançamentos em aberto desta apuração serão refeitos com os novos valores.' : ''}</div>`},
      perc ? {k:'base', label:'Valor base (R$)', type:'number', req:true} : {k:'unit', label:'Valor de cada salário de benefício (R$)', type:'number', req:true},
      {k:'valorFinal', label:'Valor final dos honorários (R$)', type:'number', req:true},
      {type:'html', html:'<div id="apPrev" class="calc" style="display:block"></div>'},
      {k:'parcelas', label:'Receber em quantas parcelas?', type:'number', req:true},
      {k:'venc', label:'1º vencimento', type:'date', req:true},
      {k:'pago', label:'Já recebido', type:'check'}],
    after: f => {
      const bEl = f.elements[perc ? 'base' : 'unit'], vf = f.elements.valorFinal;
      let manual = ajuste && Math.abs(calc(Number(bEl.value) || 0) - Number(vf.value)) > 0.004;
      const upd = () => { const b = Number(bEl.value) || 0, n = parseInt(f.elements.parcelas.value, 10) || 1, tot = calc(b);
        if(!manual) vf.value = b ? tot.toFixed(2) : '';
        const fin = Number(vf.value) || 0, aj = b && Math.abs(fin - tot) > 0.004;
        f.querySelector('#apPrev').innerHTML = b ? `Cálculo: <b>${money(tot)}</b>${perc ? ` (${pctTxt(Number(it.pct))} de ${money(b)})` : ` (${qtdTxt(it.qtd)} × ${money(b)})`}
          ${aj ? `<br>✏️ Valor final ajustado para <b>${money(fin)}</b> (diferença ${money(fin - tot)}) · <a href="#" id="voltaCalc">usar o valor calculado</a>` : ''}
          ${n > 1 && fin ? `<br>${n} parcelas de ~${money(fin / n)}` : ''}` : '🧮 Informe o valor para ver o cálculo.';
        const vc = f.querySelector('#voltaCalc'); if(vc) vc.onclick = e => { e.preventDefault(); manual = false; upd(); };
      };
      vf.addEventListener('input', () => { manual = true; upd(); });
      [bEl, f.elements.parcelas].forEach(x => x.addEventListener('input', upd)); upd();
    },
    onSave: out => {
      const b = Number(out[perc ? 'base' : 'unit']), fin = Math.round(Number(out.valorFinal) * 100) / 100;
      if(!(b > 0)){ toast('Informe o valor base'); return false; }
      if(!(fin > 0)){ toast('Informe o valor final dos honorários'); return false; }
      if(ajuste) db.financeiro = db.financeiro.filter(l => l.contratoItemId !== it.id || l.pagoEm);
      gerarLancHon(p, it, {total:fin, n:out.parcelas, venc:out.venc, categoria:'Honorários de êxito', desc:'Honorários — ' + itemTxt(it), pago:out.pago});
      Object.assign(it, {status:'apurado', apuradoEm: ajuste ? it.apuradoEm : today(), baseValor:b, valorCalculado:calc(b), valorApurado:fin}); delete it.acordoId;
      save(); toast((ajuste ? 'Honorários ajustados: ' : 'Honorários apurados e lançados: ') + money(fin));
    } });
}
function formJaLancado(pid, iid){
  const p = byId('processos', pid), it = p?.contrato?.itens?.find(x => x.id === iid); if(!it) return;
  const acs = db.acordos.filter(a => a.processoId === pid || (a.pessoaId === p.clienteId && !a.processoId));
  openForm({ title:'Marcar como já lançado: ' + itemTxt(it), data:{acordoId: acs.length === 1 ? acs[0].id : ''},
    fields:[{type:'html', html:'<div class="small muted">Use quando os honorários deste item já foram lançados por outro caminho — por exemplo, num acordo já cadastrado na aba Acordos. O item deixa de aparecer como pendente de apuração, e o combinado continua registrado no contrato.</div>'},
      {k:'acordoId', label:'Vincular a um acordo / condenação (opcional)', type:'select', full:true, options:acs.map(a => ({v:a.id, t:`${a.descricao} — ${fmtD(a.data)} — ${money((Number(a.principal) || 0) + (Number(a.sucumbencia) || 0))}`})), emptyLabel: acs.length ? '— sem vínculo —' : '— nenhum acordo neste processo —'},
      {k:'notaLanc', label:'Observação (opcional)', full:true, ph:'Ex.: honorários retidos no acordo de 20/10; recebido direto do cliente'}],
    onSave: out => {
      const a = byId('acordos', out.acordoId);
      if(a){ const hon = sum(acordoLanc(a.id).filter(l => isRec(l) && l.categoria !== CAT_HS).map(l => l.valor));
        Object.assign(it, {status:'apurado', apuradoEm:today(), acordoId:a.id, baseValor:Number(a.principal) || 0, valorApurado:Math.round(hon * 100) / 100, notaLanc:out.notaLanc}); delete it.jaLancado; }
      else Object.assign(it, {status:'apurado', apuradoEm:today(), jaLancado:true, notaLanc:out.notaLanc});
      save(); toast('Marcado como já lançado');
    } });
}
function itemStatusHtml(p, it){
  const ls = itemLanc(it), rec = sum(ls.filter(l => l.pagoEm).map(realV)), tot = sum(ls.map(l => l.valor));
  let st = '', act = '';
  if(it.tipo === 'fixo') st = !ls.length ? '<span class="tag grey">não lançado no financeiro</span>' : rec >= tot - 0.004 ? `<span class="tag ok">recebido ${money(rec)}</span>` : `<span class="tag">recebido ${money(rec)} de ${money(tot)}</span>`;
  else if(it.tipo === 'percentual' || it.tipo === 'beneficios'){
    if(it.status === 'apurado'){
      if(it.acordoId){ const a = byId('acordos', it.acordoId); st = a ? `<span class="tag ok">apurado via acordo</span> <a href="#/acordo/${a.id}">${esc(a.descricao)}</a> · honorários ${money(it.valorApurado)}` : '<span class="tag warn">o acordo vinculado foi excluído</span>'; }
      else if(it.jaLancado) st = `<span class="tag ok">✔ já lançado</span> marcado em ${fmtD(it.apuradoEm)}${it.notaLanc ? ' · ' + esc(it.notaLanc) : ''}`;
      else st = `<span class="tag ok">apurado em ${fmtD(it.apuradoEm)}</span> base ${money(it.baseValor)}${it.tipo === 'beneficios' ? ' por salário' : ''} → honorários <b>${money(it.valorApurado)}</b>${it.valorCalculado != null && Math.abs(it.valorCalculado - it.valorApurado) > 0.004 ? ` <span class="muted">(calculado ${money(it.valorCalculado)}, ajustado)</span>` : ''} · recebido ${money(rec)}`;
      act = `${!it.acordoId && !it.jaLancado && !ls.some(l => l.pagoEm) ? `<button class="mini" data-act="apurar" data-p="${p.id}" data-i="${it.id}">ajustar valor</button> ` : ''}<button class="mini" data-act="desfazApur" data-p="${p.id}" data-i="${it.id}">desfazer</button>`;
    } else { st = '<span class="tag warn">⏳ aguardando resultado</span>'; act = `<button class="mini" data-act="apurar" data-p="${p.id}" data-i="${it.id}">apurar valor</button> <button class="mini" data-act="jaLancado" data-p="${p.id}" data-i="${it.id}" title="O valor já foi lançado por outro caminho (ex.: acordo)">✔ já lançado</button>`; }
  }
  return `<div class="li"><div class="grow"><b>${esc(itemTxt(it))}</b> <span class="tag grey">${TIPO_ITEM[it.tipo] || ''}</span>${st ? `<div class="sub">${st}</div>` : ''}</div>${act}</div>`;
}
function contratoCard(p){
  const c = p.contrato, its = c?.itens || [];
  if(!its.length) return `<div class="card" style="border-style:dashed"><h2>📄 Honorários contratados<span class="sp"></span><button class="btn primary" data-act="editContrato" data-id="${p.id}">Informar honorários contratados</button></h2>
    <div class="empty">Ainda não informado. Registre o que foi combinado: valor inicial, % sobre o êxito, salários de benefício…</div></div>`;
  return `<div class="card"><h2>📄 Honorários contratados${c.data ? ` <span class="small muted" style="font-weight:400">contrato de ${fmtD(c.data)}</span>` : ''}<span class="sp"></span><button class="mini" data-act="editContrato" data-id="${p.id}">editar</button></h2>
    ${its.map(it => itemStatusHtml(p, it)).join('')}${c.obs ? `<div class="small muted" style="margin-top:8px">${nl2br(c.obs)}</div>` : ''}</div>`;
}

/* ----- Acordos / condenações ----- */
function splitCents(total, n){ const e = Math.floor(total / n); return Array.from({length:n}, (_, i) => i === n - 1 ? total - e * (n - 1) : e); }
function planoAcordo(a){
  const n = Math.max(1, Math.min(240, parseInt(a.parcelas, 10) || 1)), pct = (Number(a.pctContratual) || 0) / 100;
  const P = splitCents(Math.round((Number(a.principal) || 0) * 100), n), S = splitCents(Math.round((Number(a.sucumbencia) || 0) * 100), n);
  return P.map((p, i) => { const hon = Math.round(p * pct); return {p:p / 100, s:S[i] / 100, hon:hon / 100, cli:(p - hon) / 100}; });
}
function gerarAcordo(a){
  const pl = planoAcordo(a), n = pl.length, dias = parseInt(a.diasRepasse, 10) || 0, conta = a.modo !== 'cliente', now = new Date().toISOString();
  pl.forEach((x, i) => {
    const venc = addMonths(a.primeiroVenc, i), tag = ` — parc. ${i+1}/${n}`;
    const add = (natureza, categoria, valor, txt, vencimento) => { if(valor > 0) db.financeiro.push({id:uid(), criadoEm:now, pessoaId:a.pessoaId, processoId:a.processoId || '', acordoId:a.id, parcela:i + 1,
      natureza, categoria, valor, descricao:a.descricao + ' — ' + txt + tag, vencimento, pagoEm:'', valorPago:'', forma:''}); };
    if(conta){
      add('entrada', CAT_CLI, x.cli, 'valor do cliente', venc);
      add('entrada', CAT_HC, x.hon, 'honorários contratuais', venc);
      add('entrada', CAT_HS, x.s, 'honorários sucumbenciais', venc);
      add('saida', CAT_REP, x.cli, 'repasse ao cliente', addDays(venc, dias));
    } else {
      add('entrada', CAT_HC, x.hon, 'honorários contratuais (pagos pelo cliente)', addDays(venc, dias));
      add('entrada', CAT_HS, x.s, 'honorários sucumbenciais', venc);
    }
  });
  save();
}
function formAcordo(a = {}){
  const isNew = !a.id;
  const fields = [
    {k:'pessoaId', label:'Cliente', type:'select', options:pessoasOpts, req:true},
    {k:'processoId', label:'Processo', type:'select', options:() => procOpts(a.pessoaId)},
    {k:'descricao', label:'Descrição', req:true, def:'Acordo', ph:'Ex.: Acordo homologado em audiência'},
    {k:'data', label:'Data do acordo / decisão', type:'date', def:today()},
  ];
  if(isNew) fields.push(
    {type:'sect', label:'Valores totais'},
    {k:'principal', label:'Principal — valor do cliente (R$)', type:'number', req:true},
    {k:'sucumbencia', label:'Honorários sucumbenciais (R$)', type:'number'},
    {k:'parcelas', label:'Número de parcelas mensais', type:'number', def:1, req:true},
    {k:'primeiroVenc', label:'Vencimento da 1ª parcela', type:'date', req:true},
    {type:'sect', label:'Forma de pagamento e divisão'},
    {k:'modo', label:'Os valores são pagos', type:'select', empty:false, options:[{v:'conta', t:'Na minha conta — eu repasso ao cliente'}, {v:'cliente', t:'Direto ao cliente — ele me paga os honorários'}]},
    {k:'pctContratual', label:'Honorários contratuais (% sobre o principal)', type:'number', def:30},
    {k:'diasRepasse', label:'Repassar / receber em até quantos dias após o pagamento?', type:'number', def:0},
    {type:'html', html:'<div id="acPrev" class="calc" style="display:block;line-height:1.7"></div>'});
  else fields.push({type:'html', html:'<div class="small muted">Valores e parcelas não são alterados aqui. Para corrigir uma parcela específica (ex.: paga com correção), clique no valor dela na tabela do acordo. Para refazer o acordo inteiro, exclua-o e lance de novo.</div>'});
  fields.push({k:'obs', label:'Observações', type:'textarea', full:true});
  if(isNew && a.processoId && a.pctContratual == null){ const it = itemExitoPend(a.processoId); if(it) a = {...a, pctContratual:it.pct}; }
  openForm({ title: isNew ? 'Novo acordo / condenação' : 'Editar acordo', data:a, fields,
    after: f => {
      const ps = f.elements.pessoaId, pr = f.elements.processoId;
      ps.addEventListener('change', () => { const cur = pr.value; pr.innerHTML = '<option value=""></option>' + opts(procOpts(ps.value), cur); });
      pr.addEventListener('change', () => { const proc = byId('processos', pr.value); if(proc && !ps.value) ps.value = proc.clienteId; });
      if(!isNew) return;
      pr.addEventListener('change', () => { const it = itemExitoPend(pr.value); if(it){ f.elements.pctContratual.value = it.pct; upd(); toast(`Percentual do contrato aplicado: ${it.pct}%`); } });
      const upd = () => {
        const v = k => f.elements[k].value, a2 = {principal:v('principal'), sucumbencia:v('sucumbencia'), parcelas:v('parcelas'), pctContratual:v('pctContratual')};
        const box = f.querySelector('#acPrev');
        if(!(Number(a2.principal) > 0)){ box.innerHTML = '🧮 Preencha os valores para ver a simulação das parcelas.'; return; }
        const pl = planoAcordo(a2), n = pl.length, x = pl[0], u = pl[n - 1], tot = k => sum(pl.map(y => y[k])), conta = v('modo') === 'conta';
        const pc = 100 - (Number(a2.pctContratual) || 0);
        box.innerHTML = `<b>🧮 Simulação</b> — ${n} parcela(s) de <b>${money(x.p + x.s)}</b>${n > 1 && Math.abs((u.p + u.s) - (x.p + x.s)) > 0.001 ? ` (a última de ${money(u.p + u.s)}, ajuste de centavos)` : ''}<br>
          Cada parcela: principal ${money(x.p)}${x.s ? ` + sucumbência ${money(x.s)}` : ''}<br>
          ${conta ? `➡ Repasse ao cliente (${pc}%): <b>${money(x.cli)}</b>` : `➡ O cliente recebe ${money(x.p)} e lhe paga`} · seus honorários: <b>${money(x.hon)}</b>${x.s ? ` + ${money(x.s)} de sucumbência = <b>${money(x.hon + x.s)}</b>` : ''} por parcela<br>
          <b>Totais:</b> cliente ${money(tot('cli'))} · seus honorários ${money(tot('hon') + tot('s'))} (contratuais ${money(tot('hon'))}${tot('s') ? ` + sucumbenciais ${money(tot('s'))}` : ''})`;
      };
      ['principal','sucumbencia','parcelas','pctContratual','modo'].forEach(k => { f.elements[k].addEventListener('input', upd); f.elements[k].addEventListener('change', upd); }); upd();
    },
    onSave: out => {
      if(!isNew){ upsert('acordos', {...a, ...out}); toast('Salvo'); return; }
      const n = parseInt(out.parcelas, 10);
      if(!(n >= 1 && n <= 240)){ toast('Número de parcelas inválido'); return false; }
      if(!(Number(out.principal) > 0)){ toast('Informe o valor principal'); return false; }
      const ac = upsert('acordos', {...out, parcelas:n});
      const itP = itemExitoPend(out.processoId);
      if(itP){ const pl = planoAcordo(ac); Object.assign(itP, {status:'apurado', apuradoEm:today(), acordoId:ac.id, baseValor:Number(out.principal), valorApurado:Math.round(sum(pl.map(x => x.hon)) * 100) / 100}); }
      gerarAcordo(ac); toast(n + ' parcela(s) geradas'); go('#/acordo/' + ac.id);
    },
    onDelete: !isNew ? () => { const ls = acordoLanc(a.id), r = ls.filter(l => l.pagoEm).length;
      if(!confirm(`Excluir este acordo e seus ${ls.length} lançamentos financeiros?` + (r ? `\n\nATENÇÃO: ${r} lançamento(s) já foram recebidos/pagos e também serão apagados.` : ''))) return false;
      db.financeiro = db.financeiro.filter(l => l.acordoId !== a.id); removeItem('acordos', a.id); go('#/financeiro'); } : null });
}
const pctTxt = v => (Math.round(v * 10) / 10).toLocaleString('pt-BR') + '%';
function principalParcela(a, k){
  if(a.modo === 'cliente') return Math.round((planoAcordo(a)[k - 1]?.p || 0) * 100);
  const g = acordoLanc(a.id, k); return Math.round(sum(g.filter(l => l.categoria === CAT_CLI || l.categoria === CAT_HC).map(l => l.valor)) * 100);
}
function aplicarDivisao(a, k, pctHon){
  const g = acordoLanc(a.id, k); if(!g.length) return;
  const conta = a.modo !== 'cliente', cli = g.find(l => l.categoria === CAT_CLI), hon = g.find(l => l.categoria === CAT_HC);
  const ents = g.filter(l => l.natureza === 'entrada'), recebida = ents.length > 0 && ents.every(l => l.pagoEm), recRef = ents.find(l => l.pagoEm);
  const vencEnt = (cli || hon || ents[0] || g[0]).vencimento, dias = parseInt(a.diasRepasse, 10) || 0;
  const p = principalParcela(a, k), h = Math.round(p * pctHon / 100), c = p - h;
  const set = (l, cat, nat, cents, txt, venc) => {
    const v = cents / 100;
    if(l){ if(v > 0){ l.valor = v; if(l.pagoEm) l.valorPago = v; } else db.financeiro = db.financeiro.filter(x => x.id !== l.id); return; }
    if(v <= 0) return;
    const realizado = nat === 'entrada' && recebida && recRef;
    db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), pessoaId:g[0].pessoaId, processoId:g[0].processoId || '', acordoId:a.id, parcela:k, natureza:nat, categoria:cat, valor:v,
      descricao:`${a.descricao} — ${txt} — parc. ${k}/${a.parcelas}`, vencimento:venc, pagoEm: realizado ? recRef.pagoEm : '', valorPago: realizado ? v : '', forma: realizado ? (recRef.forma || '') : ''});
  };
  if(conta){
    set(cli, CAT_CLI, 'entrada', c, 'valor do cliente', vencEnt);
    set(hon, CAT_HC, 'entrada', h, 'honorários contratuais', vencEnt);
    const reps = g.filter(l => l.categoria === CAT_REP), pagos = reps.filter(l => l.pagoEm), pend = reps.find(l => !l.pagoEm);
    const jaPago = Math.round(sum(pagos.map(realV)) * 100), falta = c - jaPago;
    set(pend, CAT_REP, 'saida', falta, pagos.length ? 'complemento de repasse' : 'repasse ao cliente', recebida && recRef ? (pagos.length ? today() : recRef.pagoEm) : addDays(vencEnt, dias));
    if(falta < 0) return `parcela ${k}: já repassado ${money(jaPago / 100)}, a mais do que o novo valor (${money(c / 100)})`;
    if(falta > 0 && pagos.length) return `parcela ${k}: falta repassar ${money(falta / 100)} ao cliente (complemento gerado)`;
  } else set(hon, CAT_HC, 'entrada', h, 'honorários contratuais (pagos pelo cliente)', vencEnt);
}
function formDivisao(id, ks){
  const a = byId('acordos', id); if(!a) return;
  const conta = a.modo !== 'cliente', all = [...new Set(acordoLanc(id).map(l => l.parcela))].sort((x, y) => x - y);
  const explicit = ks && ks.length ? [...ks].sort((x, y) => x - y) : null;
  const fields = [{type:'html', html:`<div class="small muted">Define como o <b>principal</b> das parcelas é dividido entre o cliente e você. A <b>sucumbência continua 100% sua</b>. Os valores já recebidos ou repassados também são atualizados.</div>`}];
  if(explicit) fields.push({type:'html', html:`<b>Parcelas selecionadas:</b> ${explicit.join(', ')}`});
  else fields.push({k:'de', label:'Da parcela nº', type:'number', req:true}, {k:'ate', label:'Até a parcela nº', type:'number', req:true});
  fields.push({k:'pct', label: conta ? '% do principal que vai para o cliente' : '% de honorários contratuais sobre o principal', type:'number', req:true},
    {type:'html', html:'<div id="divPrev" class="calc" style="display:block;line-height:1.7"></div>'});
  openForm({ title:'Alterar divisão: cliente × honorários', data:{de:all[0], ate:all[all.length - 1], pct: conta ? 100 - (Number(a.pctContratual) || 0) : (Number(a.pctContratual) || 0)}, fields, focus: explicit ? 'pct' : 'de',
    after: f => {
      const upd = () => {
        const pc = Number(f.elements.pct.value), k0 = explicit ? explicit[0] : parseInt(f.elements.de.value, 10), box = f.querySelector('#divPrev');
        if(!(pc >= 0 && pc <= 100) || !all.includes(k0)){ box.innerHTML = 'Informe um percentual entre 0 e 100.'; return; }
        const p = principalParcela(a, k0) / 100, hp = conta ? 100 - pc : pc, h = Math.round(p * hp) / 100, c = Math.round((p - h) * 100) / 100;
        const suc = acordoLanc(id, k0).find(l => l.categoria === CAT_HS)?.valor || 0;
        box.innerHTML = `Exemplo — parcela ${k0}: principal ${money(p)}<br>➡ ${conta ? 'Repasse ao cliente' : 'Fica com o cliente'} (${pctTxt(conta ? pc : 100 - pc)}): <b>${money(c)}</b><br>➡ Seus honorários contratuais (${pctTxt(hp)}): <b>${money(h)}</b>${suc ? ` + sucumbência ${money(suc)} = <b>${money(h + suc)}</b>` : ''}`;
      };
      ['pct', 'de'].forEach(k => f.elements[k] && f.elements[k].addEventListener('input', upd)); upd();
    },
    onSave: out => {
      const pc = Number(out.pct);
      if(!(pc >= 0 && pc <= 100)){ toast('O percentual deve estar entre 0 e 100'); return false; }
      let sel = explicit;
      if(!sel){ const d = parseInt(out.de, 10), t = parseInt(out.ate, 10); if(!(d >= 1 && t >= d)){ toast('Intervalo de parcelas inválido'); return false; } sel = all.filter(k => k >= d && k <= t); }
      if(!sel.length){ toast('Nenhuma parcela nesse intervalo'); return false; }
      const rec = sel.filter(k => acordoLanc(id, k).some(l => l.pagoEm));
      if(rec.length && !confirm(`${rec.length} parcela(s) desse grupo já foram recebidas. Os valores recebidos e repassados delas também serão recalculados. Continuar?`)) return false;
      const avisos = sel.map(k => aplicarDivisao(a, k, conta ? 100 - pc : pc)).filter(Boolean);
      save(); toast(`Divisão alterada em ${sel.length} parcela(s)`);
      if(avisos.length) setTimeout(() => alert('Atenção a parcelas já repassadas:\n\n' + avisos.join('\n')), 100);
    } });
}
function receiveParcela(id, k){
  const a = byId('acordos', id); if(!a) return;
  const ls = acordoLanc(id, k), ent = ls.filter(l => l.natureza === 'entrada' && !l.pagoEm), rep = ls.find(l => l.natureza === 'saida' && l.categoria === CAT_REP && !l.pagoEm);
  if(!ent.length) return toast('Esta parcela já foi recebida');
  const fields = [{type:'html', html:`<b>${esc(a.descricao)} — parcela ${k}/${a.parcelas}</b><div class="small muted" style="margin-top:4px">${ent.map(l => esc(l.categoria) + ': ' + money(l.valor)).join('<br>')}</div><div style="margin-top:4px">Total recebido: <b>${money(sum(ent.map(l => l.valor)))}</b></div>`},
    {k:'pagoEm', label:'Recebido em', type:'date', req:true, def:today()}, {k:'forma', label:'Forma', type:'select', options:OPT.forma, def:'Alvará'}];
  if(rep) fields.push({k:'repassado', label:`Já fiz o repasse ao cliente (${money(rep.valor)}) nesta mesma data`, type:'check', def:true});
  openForm({ title:'Registrar recebimento da parcela', fields, onSave: out => {
    ent.forEach(l => Object.assign(l, {pagoEm:out.pagoEm, valorPago:l.valor, forma:out.forma}));
    if(rep){ if(out.repassado) Object.assign(rep, {pagoEm:out.pagoEm, valorPago:rep.valor, forma:'PIX'}); else rep.vencimento = addDays(out.pagoEm, parseInt(a.diasRepasse, 10) || 0); }
    save(); toast(rep && !out.repassado ? 'Recebido — repasse ao cliente pendente' : 'Recebimento registrado'); } });
}

