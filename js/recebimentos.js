/* ===== ⬆ Recebimentos com valor do cliente e pagamentos “fora do combinado” =====
   • O antigo “acordo / condenação” é agora um TIPO de conta a receber (“com valor do cliente”): acordo, condenação, alvará, penhora,
     pagamento voluntário… Por dentro continua em db.acordos (parcelas, repasses, parceiros, ajustes) — nada dos lançamentos antigos muda.
   • Êxito do contrato: o % vem do contrato do processo e o item fica “apurado” ligado ao(s) recebimento(s) (it.acordoIds) — sem contar duas vezes.
   • Despesas adiantadas pelo escritório (3.2.01) podem ser descontadas da parte do cliente (lançamentos l.reembAcordo, conta 3.2.02).
   • Grupos de parcelas (l.grupo): parcelas da mesma conta ficam ligadas — base para “abater da próxima”, “quitar o restante” e “renegociar”.
   • Pagou a menos / a mais: o sistema pergunta o que fazer com a diferença (manter saldo, próxima, dividir, desconto / abater próxima, últimas, dividir, acréscimo).
   • Renegociar: as parcelas substituídas vão para o histórico (db.meta.finReneg) e o novo parcelamento fica ligado a elas. */

/* ----- contrato (êxito) e despesas ----- */
function itemPctContrato(pid){ const its = (byId('processos', pid)?.contrato?.itens || []).filter(it => it.tipo === 'percentual'); return its.find(it => it.status !== 'apurado') || its[0]; }
function recDesvincularExito(acId){ db.processos.forEach(p => (p.contrato?.itens || []).forEach(it => { const ids = (it.acordoIds || (it.acordoId ? [it.acordoId] : [])).filter(x => x !== acId);
  if(!ids.length && (it.acordoId === acId || (it.acordoIds || []).includes(acId))){ delete it.acordoIds; delete it.acordoId; it.status = ''; delete it.apuradoEm; delete it.valorApurado; delete it.baseValor; }
  else if(ids.length !== (it.acordoIds || []).length && it.acordoIds){ it.acordoIds = ids; it.acordoId = ids[0]; } })); }
// despesas que o escritório adiantou para o cliente (3.2.01, pagas) menos o que já foi reembolsado ou está previsto para reembolso (3.2.02)
function despAReembolsar(pessoaId, procId){
  if(!pessoaId) return 0; const doCli = l => (l.pessoaId === pessoaId || byId('processos', l.processoId)?.clienteId === pessoaId) && (!procId || !l.processoId || l.processoId === procId);
  const adi = sum(db.financeiro.filter(l => doCli(l) && contaDe(l)?.chave === 'custas_adiant' && l.pagoEm).map(realV)), reemb = sum(db.financeiro.filter(l => doCli(l) && contaDe(l)?.chave === 'reemb_receb').map(l => l.pagoEm ? realV(l) : Number(l.valor) || 0));
  return Math.max(0, Math.round((adi - reemb) * 100) / 100);
}
function acordoDescontarDespesas(a, cents){
  if(a.modo === 'cliente') return; const ks = [...new Set(acordoLanc(a.id).map(l => l.parcela))].sort((x, y) => x - y), conta = pcPorChave('reemb_receb');
  for(const k of ks){ if(cents <= 0) break; const g = acordoLanc(a.id, k), cli = g.find(l => l.categoria === CAT_CLI && !l.pagoEm), rep = g.find(l => l.categoria === CAT_REP && !l.pagoEm); if(!cli) continue;
    const t = Math.min(cents, centavos(cli.valor)); if(t <= 0) continue; cents -= t;
    cli.valor = (centavos(cli.valor) - t) / 100; if(rep){ rep.valor = (centavos(rep.valor) - t) / 100; if(rep.valor <= 0) db.financeiro = db.financeiro.filter(x => x.id !== rep.id); }
    db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), pessoaId:a.pessoaId, processoId:a.processoId || '', acordoId:a.id, parcela:k, natureza:'entrada', categoria:'Reembolso de despesas', conta:conta?.id, reembAcordo:true,
      valor:t / 100, descricao:`${a.descricao} — reembolso de despesas adiantadas (descontado do repasse) — parc. ${k}/${a.parcelas}`, vencimento:cli.vencimento, pagoEm:'', valorPago:'', forma:''});
    if(cli.valor <= 0) db.financeiro = db.financeiro.filter(x => x.id !== cli.id); }
}

/* ----- tipo de recebimento (comum × com valor do cliente) nos formulários ----- */
const recTipoSeg = on => `<div class="small muted" style="margin-bottom:4px">Tipo de recebimento</div><div class="seg recTipo"><button type="button" class="${on === 'comum' ? 'on' : ''}" data-rtipo="comum">Comum (honorários, consulta, serviço…)</button><button type="button" class="${on === 'cliente' ? 'on' : ''}" data-rtipo="cliente">Com valor do cliente — acordo, condenação, alvará, penhora, pagamento voluntário…</button></div>`;
function recTipoLigar(f){ f.querySelectorAll('[data-rtipo]').forEach(b => b.onclick = () => { if(b.classList.contains('on')) return; const pessoaId = f.elements.pessoaId?.value || '', processoId = f.elements.processoId?.value || '';
  closeModal(); setTimeout(() => b.dataset.rtipo === 'cliente' ? formAcordo({pessoaId, processoId}) : formFin({natureza:'entrada', pessoaId, processoId}), 60); }); }

/* ----- grupos de parcelas ----- */
const finGrupoChave = l => l.grupo || l.serie || '';
const finIrmas = l => { const g = finGrupoChave(l); return g ? (agrupar('fin:grupo', () => db.financeiro, x => finGrupoChave(x)).get(g) || []).filter(x => x !== l) : []; };
const ordVenc = (a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999');
// parcelas antigas com “(k/n)” na descrição, mesma pessoa, mesmo tipo e mesma conta → ligadas (uma vez só)
function finGruposMigrar(){
  if(db.meta.finGrupoV1) return; const mapa = new Map();
  db.financeiro.forEach(l => { if(l.grupo || l.serie || l.acordoId || l.partDe) return; const m = String(l.descricao || '').match(/^(.*) \((\d+)\/(\d+)\)$/); if(!m || +m[3] < 2) return;
    const k = [l.natureza, l.pessoaId || '', l.processoId || '', m[1].trim(), m[3], l.conta || l.categoria || ''].join('|'); (mapa.get(k) || mapa.set(k, []).get(k)).push({l, i:+m[2]}); });
  let n = 0; mapa.forEach(ls => { if(ls.length < 2 || new Set(ls.map(x => x.i)).size !== ls.length) return; const id = uid(); ls.forEach(x => { x.l.grupo = id; }); n++; });
  db.meta.finGrupoV1 = true; if(n) save();
}

/* ----- diferença no pagamento: o que fazer ----- */
const DIF_MENOS = {saldo:'Deixar o que falta em aberto nesta parcela (novo vencimento)', prox:'Somar o que falta à próxima parcela', div:'Dividir o que falta entre as parcelas que restam', desc:'Dar por encerrado (desconto / perdão)'};
const DIF_MAIS = {prox:'Abater da próxima parcela (o que sobrar segue para a seguinte)', ult:'Abater das últimas parcelas (encurta o prazo)', div:'Dividir o abatimento entre as que restam', acr:'É juros / acréscimo por atraso (não abate nada)'};
function difFields(l){ return [{type:'html', html:'<div id="difInfo" class="calc" style="display:none"></div>'}, {k:'difModo', label:'O que fazer com a diferença?', type:'select', empty:false, full:true, options:[{v:'', t:'—'}]},
  {k:'saldoVenc', label:'Novo vencimento do que falta', type:'date', def:l.vencimento && l.vencimento > today() ? l.vencimento : addDays(today(), 30)}]; }
function difLigar(f, l, totalPrevisto){
  const vp = f.elements.valorPago || f.elements.valorRec, md = f.elements.difModo, sv = f.elements.saldoVenc, info = f.querySelector('#difInfo'), abertas = () => totalPrevisto.irmas.filter(x => !x.pagoEm).length;
  let ult = '';
  const upd = () => { const aj = k => Number(f.elements[k]?.value) || 0, prev = totalPrevisto.valor() + aj('juros') + aj('multa') - aj('desconto'), pago = Number(vp.value) || 0, dif = Math.round((prev - pago) * 100) / 100, temOutras = abertas() > 0;
    const sinal = Math.abs(dif) <= 0.004 ? 0 : dif > 0 ? -1 : 1;
    info.style.display = sinal ? 'block' : 'none'; md.closest('.fld').style.display = sinal ? '' : 'none';
    const chave = sinal + '|' + temOutras;
    if(chave !== ult){ ult = chave; const ops = sinal < 0 ? DIF_MENOS : sinal > 0 ? DIF_MAIS : {}, ok = Object.keys(ops).filter(k => temOutras || ['saldo', 'desc', 'acr'].includes(k));
      md.innerHTML = opts(ok.map(k => ({v:k, t:ops[k]})), ok.includes(md.value) ? md.value : ok[0]); }
    sv.closest('.fld').style.display = sinal < 0 && md.value === 'saldo' ? '' : 'none';
    if(sinal) info.innerHTML = sinal < 0 ? `⚠️ Recebeu <b>${money(Math.abs(dif))}</b> a menos do que o previsto (${money(prev)}).` : `ℹ️ Recebeu <b>${money(Math.abs(dif))}</b> a mais do que o previsto (${money(prev)}).${temOutras ? ` Há ${abertas()} outra(s) parcela(s) em aberto.` : ''}`; };
  [vp, f.elements.juros, f.elements.multa, f.elements.desconto, f.elements.pagoEm].forEach(x => x && x.addEventListener('input', upd)); md.addEventListener('change', upd); upd();
}
// soma (+) ou abate (−) centavos numa lista de contas em aberto, na ordem dada; abatidas a zero ficam quitadas
function finEspalhar(alvos, cents, modo, data, nota){
  alvos = alvos.filter(x => !x.pagoEm); if(!alvos.length || !cents) return cents;
  if(modo === 'div'){ const n = alvos.length, base = Math.trunc(cents / n); let resto = cents - base * n;
    alvos.forEach((x, i) => { let d = base + (i === n - 1 ? resto : 0); const v = centavos(x.valor); if(v + d < 0){ resto += v + d; d = -v; } x.valor = (v + d) / 100; });
    cents = 0; }
  else { const ord = modo === 'ult' ? [...alvos].reverse() : alvos;
    if(cents > 0){ ord[0].valor = (centavos(ord[0].valor) + cents) / 100; cents = 0; }
    else for(const x of ord){ if(!cents) break; const v = centavos(x.valor), t = Math.min(v, -cents); x.valor = (v - t) / 100; cents += t; } }
  alvos.forEach(x => { if(centavos(x.valor) <= 0){ Object.assign(x, {valor:0, pagoEm:data, valorPago:0, obs:[x.obs, nota].filter(Boolean).join('\n')}); } finPartSync(x); });
  return cents;
}
// conta comum (ou de um grupo): registra o pagamento tratando a diferença
function finPagarComDiferenca(l, out){
  const modo = out.difModo || 'saldo', aj = k => Number(out[k]) || 0, prev = (Number(l.valor) || 0) + aj('juros') + aj('multa') - aj('desconto'), pago = Number(out.valorPago) || 0, dif = Math.round((prev - pago) * 100);
  const irmas = finIrmas(l).filter(x => !x.pagoEm && x.id !== l.id).sort(ordVenc), nota = `Ajustada pelo pagamento de ${fmtD(out.pagoEm)} (${l.descricao}).`;
  const {difModo, saldoVenc, ...dados} = out;
  if(!dif || !out.pagoEm) return aplicarPagamento(l, {...dados, manterSaldo:false});
  if(dif > 0){ // a menos
    if(modo === 'saldo') return aplicarPagamento(l, {...dados, manterSaldo:true, saldoVenc});
    if(modo === 'desc'){ upsert('financeiro', {...dados, id:l.id, desconto:(aj('desconto') + dif / 100) || undefined, obs:[l.obs, `Encerrada com desconto de ${money(dif / 100)} (pagou ${money(pago)}).`].filter(Boolean).join('\n')}); finPartSync(byId('financeiro', l.id)); return `Recebido ${money(pago)} — ${money(dif / 100)} dado como desconto`; }
    upsert('financeiro', {...dados, id:l.id, valor:Math.round((pago - aj('juros') - aj('multa') + aj('desconto')) * 100) / 100, obs:[l.obs, `Pagou ${money(pago)} de ${money(prev)}; a diferença foi ${modo === 'prox' ? 'para a próxima parcela' : 'dividida entre as restantes'}.`].filter(Boolean).join('\n')});
    finEspalhar(irmas, dif, modo === 'prox' ? 'prox' : 'div', out.pagoEm, nota); finPartSync(byId('financeiro', l.id));
    return `Recebido ${money(pago)} — ${money(dif / 100)} ${modo === 'prox' ? 'somados à próxima parcela' : 'divididos entre as restantes'}`;
  }
  // a mais
  upsert('financeiro', {...dados, id:l.id}); finPartSync(byId('financeiro', l.id));
  if(modo === 'acr') return `Recebido ${money(pago)} (inclui ${money(-dif / 100)} de acréscimo)`;
  const sobra = finEspalhar(irmas, dif, modo, out.pagoEm, `Quitada com o valor pago a mais em ${fmtD(out.pagoEm)}.`);
  return `Recebido ${money(pago)} — ${money((-dif + sobra) / 100)} abatidos ${modo === 'ult' ? 'das últimas parcelas' : modo === 'div' ? 'das parcelas restantes' : 'das próximas parcelas'}${sobra ? ` (sobraram ${money(-sobra / 100)} sem parcela para abater)` : ''}`;
}

/* ----- recebimento com valor do cliente: muda o total de uma parcela mantendo as proporções ----- */
function acordoMudarTotal(a, k, deltaCents){
  const ents = acordoLanc(a.id, k).filter(l => l.natureza === 'entrada' && !l.pagoEm); if(!ents.length || !deltaCents) return deltaCents;
  const tot = sum(ents.map(l => centavos(l.valor))); if(deltaCents < 0 && -deltaCents >= tot){ ents.forEach(l => { l.valor = 0; }); acordoRecalcParcela(a, k); return deltaCents + tot; }
  let usado = 0; ents.forEach((l, i) => { const d = i === ents.length - 1 ? deltaCents - usado : Math.round(deltaCents * centavos(l.valor) / (tot || 1)); usado += d; l.valor = (centavos(l.valor) + d) / 100; });
  acordoRecalcParcela(a, k); return 0;
}
// depois de mexer nas entradas de uma parcela: repasse = parte do cliente; zeradas somem; participantes refeitos
function acordoRecalcParcela(a, k, data){
  const g = acordoLanc(a.id, k);
  g.filter(l => l.natureza === 'entrada' && !l.pagoEm && centavos(l.valor) <= 0).forEach(l => { db.financeiro = db.financeiro.filter(x => x.id !== l.id); });
  if(a.modo !== 'cliente'){ const g2 = acordoLanc(a.id, k), cli = centavos(sum(g2.filter(l => l.categoria === CAT_CLI).map(l => l.pagoEm ? realV(l) : l.valor))), reps = g2.filter(l => l.categoria === CAT_REP), pagos = centavos(sum(reps.filter(l => l.pagoEm).map(realV))), pend = reps.find(l => !l.pagoEm), falta = cli - pagos;
    const ents = g2.filter(l => l.natureza === 'entrada'), rec = ents.length > 0 && ents.every(l => l.pagoEm), dias = parseInt(a.diasRepasse, 10) || 0, base = ents[0];
    const venc = rec ? addDays(data || ents.map(l => l.pagoEm).sort().pop(), dias) : (base?.vencimento ? addDays(base.vencimento, dias) : '');
    if(pend){ if(falta > 0){ pend.valor = falta / 100; pend.vencimento = venc; } else db.financeiro = db.financeiro.filter(x => x.id !== pend.id); }
    else if(falta > 0 && base) db.financeiro.push({id:uid(), criadoEm:new Date().toISOString(), pessoaId:a.pessoaId, processoId:a.processoId || '', acordoId:a.id, parcela:k, natureza:'saida', categoria:CAT_REP, conta:pcPorChave('cli_repasse')?.id, valor:falta / 100,
      descricao:`${a.descricao} — ${pagos ? 'complemento de repasse' : 'repasse ao cliente'} — parc. ${k}/${a.parcelas}`, vencimento:venc, pagoEm:'', valorPago:'', forma:''}); }
  acordoPartSync(a, k);
}
function acordoAddParcela(a, venc, porCat){ // porCat: [{categoria, conta, cents, reembAcordo}]
  const k = (Math.max(0, ...acordoLanc(a.id).map(l => l.parcela)) || 0) + 1; a.parcelas = Math.max(Number(a.parcelas) || 0, k); const agora = new Date().toISOString();
  porCat.filter(x => x.cents > 0).forEach(x => db.financeiro.push({id:uid(), criadoEm:agora, pessoaId:a.pessoaId, processoId:a.processoId || '', acordoId:a.id, parcela:k, natureza:'entrada', categoria:x.categoria, conta:x.conta, ...(x.reembAcordo ? {reembAcordo:true} : {}),
    valor:x.cents / 100, descricao:`${a.descricao} — ${x.categoria === CAT_CLI ? 'valor do cliente' : x.categoria === CAT_HS ? 'honorários sucumbenciais' : x.reembAcordo ? 'reembolso de despesas' : 'honorários ' + (pcById(x.conta)?.nome || '').toLowerCase()} — parc. ${k}/${a.parcelas}`, vencimento:venc, pagoEm:'', valorPago:'', forma:''}));
  acordoRecalcParcela(a, k); return k;
}
const parcAbertas = (a, menos) => [...new Set(acordoLanc(a.id).filter(l => l.natureza === 'entrada' && !l.pagoEm).map(l => l.parcela))].filter(k => k !== menos).sort((x, y) => { const v = k => acordoLanc(a.id, k).find(l => l.natureza === 'entrada')?.vencimento || '9999'; return v(x).localeCompare(v(y)) || x - y; });
// recebimento de uma parcela com qualquer valor
function acordoReceber(a, k, out){
  const ents = acordoLanc(a.id, k).filter(l => l.natureza === 'entrada' && !l.pagoEm), T = sum(ents.map(l => centavos(l.valor))), R = centavos(out.valorRec), dif = T - R, modo = out.difModo || 'saldo';
  const fatia = ents.map((l, i) => ({l, novo: i === ents.length - 1 ? R - ents.slice(0, -1).reduce((s, x) => s + Math.round(centavos(x.valor) * R / (T || 1)), 0) : Math.round(centavos(l.valor) * R / (T || 1))}));
  const resto = fatia.map(({l, novo}) => ({categoria:l.categoria, conta:l.conta, reembAcordo:l.reembAcordo, cents:centavos(l.valor) - novo}));
  fatia.forEach(({l, novo}) => Object.assign(l, {valor:novo / 100, pagoEm:out.pagoEm, valorPago:novo / 100, forma:out.forma || '', contaBanc:out.contaBanc || ''}));
  let msg = '';
  if(dif > 0){ if(modo === 'saldo'){ const nk = acordoAddParcela(a, out.saldoVenc || addDays(out.pagoEm, 30), resto); msg = `${money(dif / 100)} ficaram em aberto (nova parcela ${nk}, ${fmtD(out.saldoVenc)})`; }
    else if(modo === 'desc') msg = `${money(dif / 100)} dados por encerrados`;
    else { const ks = parcAbertas(a, k); if(!ks.length){ const nk = acordoAddParcela(a, out.saldoVenc || addDays(out.pagoEm, 30), resto); msg = `${money(dif / 100)} em aberto (nova parcela ${nk})`; }
      else if(modo === 'prox'){ acordoMudarTotal(a, ks[0], dif); msg = `${money(dif / 100)} somados à parcela ${ks[0]}`; }
      else { const n = ks.length, b = Math.trunc(dif / n); ks.forEach((kk, i) => acordoMudarTotal(a, kk, b + (i === n - 1 ? dif - b * n : 0))); msg = `${money(dif / 100)} divididos entre ${n} parcela(s)`; } } }
  else if(dif < 0 && modo !== 'acr'){ let e = dif; const ks = parcAbertas(a, k), ord = modo === 'ult' ? [...ks].reverse() : ks;
    if(modo === 'div'){ const n = ks.length, b = Math.trunc(e / n); ks.forEach((kk, i) => { acordoMudarTotal(a, kk, b + (i === n - 1 ? e - b * n : 0)); }); e = 0; }
    else for(const kk of ord){ if(!e) break; e = acordoMudarTotal(a, kk, e); }
    ks.forEach(kk => { if(!acordoLanc(a.id, kk).some(l => l.natureza === 'entrada' && !l.pagoEm)) acordoLanc(a.id, kk).filter(l => l.partId && !l.pagoEm && !centavos(l.valor)).forEach(l => { db.financeiro = db.financeiro.filter(x => x.id !== l.id); }); });
    msg = `${money(-dif / 100)} abatidos ${modo === 'ult' ? 'das últimas parcelas' : modo === 'div' ? 'das parcelas restantes' : 'das próximas parcelas'}${e ? ` (sobraram ${money(-e / 100)})` : ''}`; }
  acordoRecalcParcela(a, k, out.pagoEm);
  return msg;
}

/* ----- quitar o restante ----- */
function formQuitar(tipo, id){
  const a = tipo === 'acordo' && byId('acordos', id), l0 = tipo === 'grupo' && byId('financeiro', id);
  const abertas = a ? acordoLanc(a.id).filter(l => l.natureza === 'entrada' && !l.pagoEm) : [l0, ...finIrmas(l0)].filter(x => x && !x.pagoEm && x.natureza === l0.natureza);
  if(!abertas.length) return toast('Não há parcelas em aberto');
  const T = sum(abertas.map(l => centavos(l.valor))), e = a ? true : l0.natureza === 'entrada';
  openForm({title:'⏩ Quitar o restante de uma vez', data:{pagoEm:today(), valor:(T / 100).toFixed(2), contaBanc:cbUltima('esc'), forma:'PIX'},
    fields:[{type:'html', html:`<div class="small">Em aberto: <b>${money(T / 100)}</b> em ${a ? parcAbertas(a).length : abertas.length} parcela(s). Informe o valor que de fato ${e ? 'entrou' : 'saiu'} — se for menor, a diferença vira <b>desconto</b>; se for maior, <b>acréscimo</b>.${a && a.modo !== 'cliente' ? ' O repasse ao cliente é recalculado sobre o que entrou.' : ''}</div>`},
      {k:'pagoEm', label:e ? 'Recebido em' : 'Pago em', type:'date', req:true}, {k:'valor', label:'Valor total (R$)', type:'number', req:true},
      {k:'forma', label:'Forma', type:'select', options:() => OPT.forma, lista:'forma'}, {k:'contaBanc', label:'Conta bancária', type:'select', options:() => cbOpts('', '')}],
    onSave:o => { const R = centavos(o.valor); if(R <= 0){ toast('Informe o valor'); return false; }
      let usado = 0; abertas.forEach((l, i) => { const v = i === abertas.length - 1 ? R - usado : Math.round(centavos(l.valor) * R / T); usado += v;
        Object.assign(l, {valor: a ? v / 100 : l.valor, pagoEm:o.pagoEm, valorPago:v / 100, forma:o.forma || '', contaBanc:o.contaBanc || '', obs:[l.obs, `Quitada de uma vez em ${fmtD(o.pagoEm)}${R !== T ? ` (${R < T ? 'desconto' : 'acréscimo'} proporcional)` : ''}.`].filter(Boolean).join('\n'),
          ...(!a && R < T ? {desconto:(centavos(l.valor) - v) / 100} : {})}); if(!a) finPartSync(l); });
      if(a) [...new Set(abertas.map(l => l.parcela))].forEach(k => acordoRecalcParcela(a, k, o.pagoEm));
      save(); render(); toast(`Quitado: ${money(R / 100)}${R !== T ? ` (${R < T ? 'desconto' : 'acréscimo'} de ${money(Math.abs(T - R) / 100)})` : ''}`); }});
}

/* ----- renegociar ----- */
function formRenegociar(tipo, id){
  const a = tipo === 'acordo' && byId('acordos', id), l0 = tipo === 'grupo' && byId('financeiro', id);
  const itens = a ? parcAbertas(a).map(k => ({k, ls:acordoLanc(a.id, k).filter(l => !l.pagoEm), venc:acordoLanc(a.id, k).find(l => l.natureza === 'entrada' && !l.pagoEm)?.vencimento || '', v:sum(acordoLanc(a.id, k).filter(l => l.natureza === 'entrada' && !l.pagoEm).map(l => centavos(l.valor)))}))
    : [l0, ...finIrmas(l0)].filter(x => x && !x.pagoEm && x.natureza === l0.natureza).sort(ordVenc).map(l => ({k:l.id, ls:[l], venc:l.vencimento, v:centavos(l.valor), desc:l.descricao}));
  if(!itens.length) return toast('Não há parcelas em aberto para renegociar');
  openForm({title:'🔁 Renegociar parcelas', data:{n:Math.max(1, itens.length), venc:addDays(today(), 30), entre:1},
    fields:[{type:'html', html:`<div class="small muted">Escolha as parcelas atrasadas ou em aberto que entram na renegociação. Elas saem da lista e ficam no histórico; o novo parcelamento é criado no lugar${a ? ', com o repasse e os participantes recalculados' : ''}.</div>
      <div class="rnL">${itens.map((x, i) => `<label class="chk"><input type="checkbox" data-rn="${i}" checked> ${a ? 'Parcela ' + x.k : esc(x.desc)} — ${x.venc ? fmtD(x.venc) : 'sem data'} — <b>${money(x.v / 100)}</b>${x.venc && x.venc < today() ? ' <span class="tag bad">vencida</span>' : ''}</label>`).join('')}</div><div id="rnTot" class="small"></div>`},
      {k:'total', label:'Novo valor total (R$) — já com juros, se houver', type:'number'}, {k:'n', label:'Nº de novas parcelas', type:'number', req:true},
      {k:'venc', label:'1º vencimento', type:'date', req:true}, {k:'entre', label:'Intervalo (meses)', type:'number'}],
    after:f => { const upd = () => { const sel = itens.filter((x, i) => f.querySelector(`[data-rn="${i}"]`).checked), t = sum(sel.map(x => x.v)); f.querySelector('#rnTot').innerHTML = `Selecionado: <b>${money(t / 100)}</b> em ${sel.length} parcela(s)`; if(!f.elements.total.dataset.mexeu) f.elements.total.value = (t / 100).toFixed(2); };
      f.elements.total.addEventListener('input', () => { f.elements.total.dataset.mexeu = 1; }); onForm(f, 'change', upd); upd(); },
    onSave:o => { const sel = itens.filter((x, i) => mForm.querySelector(`[data-rn="${i}"]`).checked); if(!sel.length){ toast('Escolha ao menos uma parcela'); return false; }
      const n = Math.max(1, Math.min(240, parseInt(o.n, 10) || 1)), T = sum(sel.map(x => x.v)), N = centavos(o.total) || T, datas = Array.from({length:n}, (_, i) => addMonths(o.venc, i * Math.max(1, parseInt(o.entre, 10) || 1)));
      const hist = {id:uid(), data:today(), tipo, ref:a ? a.id : '', valorAntigo:T / 100, valorNovo:N / 100, n, itens:sel.flatMap(x => x.ls).map(l => JSON.parse(JSON.stringify(l)))};
      db.meta.finReneg = [...(db.meta.finReneg || []), hist];
      const tirar = new Set(sel.flatMap(x => x.ls).map(l => l.id).concat(a ? sel.flatMap(x => acordoLanc(a.id, x.k).filter(l => l.partId && !l.pagoEm).map(l => l.id)) : []));
      if(a){ const cats = new Map(); sel.flatMap(x => x.ls).filter(l => l.natureza === 'entrada').forEach(l => { const kk = l.categoria + '|' + (l.conta || '') + '|' + (l.reembAcordo ? 1 : ''); const c = cats.get(kk) || {categoria:l.categoria, conta:l.conta, reembAcordo:l.reembAcordo, cents:0}; c.cents += centavos(l.valor); cats.set(kk, c); });
        db.financeiro = db.financeiro.filter(l => !tirar.has(l.id));
        datas.forEach((d, i) => { const parte = i === n - 1 ? null : 1; const porCat = [...cats.values()].map(c => { const tot = Math.round(c.cents * N / (T || 1)), each = Math.trunc(tot / n); return {...c, cents:parte ? each : tot - each * (n - 1)}; }); acordoAddParcela(a, d, porCat); });
        a.renegociado = [...(a.renegociado || []), hist.id]; }
      else { const base = sel[0].ls[0], grupo = uid(), each = Math.trunc(N / n), agora = new Date().toISOString(), descB = String(base.descricao || '').replace(/ \(\d+\/\d+\)$/, '').replace(/ — saldo restante$/, '');
        db.financeiro = db.financeiro.filter(l => !tirar.has(l.id) && !(l.partDe && tirar.has(l.partDe) && !l.pagoEm));
        datas.forEach((d, i) => { const {id:_i, criadoEm, pagoEm, valorPago, juros, multa, desconto, saldoDe, serie, ...b} = base; const novo = {...b, id:uid(), criadoEm:agora, grupo, renegDe:hist.id, valor:(i === n - 1 ? N - each * (n - 1) : each) / 100, vencimento:d, pagoEm:'', valorPago:'', descricao:`${descB} (renegociado ${i + 1}/${n})`}; db.financeiro.push(novo); finPartSync(novo); }); }
      save(); render(); toast(`Renegociado: ${sel.length} parcela(s) → ${n} nova(s), ${money(N / 100)}`); }});
}

/* ----- grupo de parcelas de uma conta comum (janela “parcelas”) ----- */
function finGrupoVer(id){
  const l = byId('financeiro', id); if(!l) return; const ls = [l, ...finIrmas(l)].sort(ordVenc), ab = ls.filter(x => !x.pagoEm);
  openForm({title:'🧾 Parcelas desta conta', soFechar:true, fields:[{type:'html', html:`<div class="tablewrap"><table><thead><tr><th>Venc.</th><th>Descrição</th><th class="right">Valor</th><th>Situação</th><th></th></tr></thead><tbody>
    ${ls.map(x => `<tr><td class="nowrap">${x.vencimento ? fmtD(x.vencimento) : 'sem data'}</td><td>${esc(x.descricao)}${x.obs ? `<div class="small muted">${esc(String(x.obs).split('\n').pop())}</div>` : ''}</td><td class="right nowrap">${money(x.pagoEm ? realV(x) : x.valor)}</td><td>${finTag(x)}</td><td>${x.pagoEm ? '' : `<button type="button" class="mini" data-act="payFin" data-id="${x.id}">${x.natureza === 'entrada' ? 'receber' : 'pagar'}</button>`}</td></tr>`).join('')}
    </tbody></table></div><div class="small" style="margin-top:6px">Pago: <b>${money(sum(ls.filter(x => x.pagoEm).map(realV)))}</b> · em aberto: <b>${money(sum(ab.map(x => x.valor)))}</b></div>
    ${ab.length ? `<div class="toolbar" style="margin-top:8px"><button type="button" class="btn" data-act="finQuitar" data-t="grupo" data-id="${ab[0].id}">⏩ Quitar o restante</button><button type="button" class="btn" data-act="finReneg" data-t="grupo" data-id="${ab[0].id}">🔁 Renegociar</button></div>` : ''}`}]});
}
Object.assign(A, {
  finQuitar: d => { closeModal(); setTimeout(() => formQuitar(d.t, d.id), 60); },
  finReneg: d => { closeModal(); setTimeout(() => formRenegociar(d.t, d.id), 60); },
  finGrupo: d => finGrupoVer(d.id),
  recNovo: d => formAcordo({pessoaId:d.pessoa || '', processoId:d.proc || ''}),
});
setTimeout(() => { if(!ARM.carregando) finGruposMigrar(); }, 2500);

/* ----- verificação ----- */
VINCULOS.verificar.push(() => {
  const out = [], vinc = [];
  db.processos.forEach(p => (p.contrato?.itens || []).forEach(it => (it.acordoIds || []).forEach(id => { if(!byId('acordos', id)) vinc.push({p, it, id}); })));
  if(vinc.length){ VER_CORRIGIR.recExito = () => { vinc.forEach(x => recDesvincularExito(x.id)); return vinc.length; };
    out.push({area:'💰 Financeiro', titulo:`${vinc.length} êxito(s) de contrato ligados a recebimento excluído`, txt:'Corrigir volta o êxito para “aguardando” quando não sobra nenhum recebimento ligado.', corrigir:'recExito', grave:true}); }
  return out;
});
