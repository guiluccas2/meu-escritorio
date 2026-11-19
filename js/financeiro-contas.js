/* ===== 💰 Financeiro — A receber / A pagar e recorrência =====
   Telas: #/financeiro/receber e #/financeiro/pagar (filtros, totais, tabela por mês com “vencidos” e “sem data — ao final do processo”).
   Recorrência: db.meta.finSeries[id] = {freq:'d'|'s'|'m'|'a', a, fim:'indet'|'data'|'n', fimData, fimN, ativa, ultima, n}; cada lançamento leva l.serie.
   As indeterminadas vão sendo geradas até 12 meses à frente (finSeriesEstender, na abertura e uma vez por dia). */
const FREQ_FIN = {d:'dia(s)', s:'semana(s)', m:'mês(es)', a:'ano(s)'};
const finSerie = id => (db.meta.finSeries || {})[id];
const finSerieTxt = s => `a cada ${s.a} ${FREQ_FIN[s.freq]}${s.fim === 'data' ? ' até ' + fmtD(s.fimData) : s.fim === 'n' ? `, ${s.fimN} vezes` : ', sem data para terminar'}${s.ativa === false ? ' (encerrada)' : ''}`;
const finProxData = (d, s) => s.freq === 'd' ? addDays(d, s.a) : s.freq === 's' ? addDays(d, 7 * s.a) : s.freq === 'a' ? addMonths(d, 12 * s.a) : addMonths(d, s.a);
// datas da recorrência a partir de base (inclusive); com “depois”, só as posteriores a essa data
function finSerieDatas(s, base, depois, jaFeitas = 0){
  const lim = s.fim === 'data' ? (s.fimData || base) : addDays(today(), 365), out = []; let d = base, k = 0;
  if(depois){ while(d <= depois && k < 2000){ d = finProxData(d, s); k++; } }
  while(out.length < 600 && (s.fim === 'n' ? jaFeitas + out.length < s.fimN : d <= lim)){ out.push(d); d = finProxData(d, s); }
  return out.length || depois ? out : [base];
}
function finSerieEncerrar(id, quieto){ const s = finSerie(id); if(!s) return;
  const fut = db.financeiro.filter(x => x.serie === id && !x.pagoEm && (x.vencimento || '') > today());
  if(!quieto && fut.length && confirm(`Encerrar a recorrência e excluir as ${fut.length} próximas que ainda estão em aberto?`)) db.financeiro = db.financeiro.filter(x => !fut.includes(x));
  s.ativa = false; save(); toast('Recorrência encerrada'); }
// gera as próximas parcelas das recorrências sem data de término
function finSeriesEstender(){
  if(ARM.carregando) return; let n = 0;
  Object.entries(db.meta.finSeries || {}).forEach(([id, s]) => { if(s.ativa === false || s.fim !== 'indet') return;
    const ls = db.financeiro.filter(x => x.serie === id); if(!ls.length) return;
    const modelo = [...ls].sort((a, b) => (b.vencimento || '').localeCompare(a.vencimento || ''))[0], ult = s.ultima || modelo.vencimento;
    finSerieDatas(s, ult, ult).forEach(d => { const {id:_i, criadoEm, pagoEm, valorPago, juros, multa, desconto, saldoDe, ...base} = modelo;
      db.financeiro.push({...base, id:uid(), criadoEm:new Date().toISOString(), vencimento:d, pagoEm:'', valorPago:'', competencia:'', serie:id}); s.ultima = d; s.n = (s.n || 0) + 1; n++; }); });
  if(n) save();
}
setTimeout(finSeriesEstender, 5000); setInterval(finSeriesEstender, 6 * 3600e3);

/* ----- telas A receber / A pagar ----- */
const FC = {entrada:{q:'', pessoa:'', proc:'', conta:'', cb:'', per:'venc', de:'', ate:'', sit:'aberto'}, saida:{q:'', pessoa:'', proc:'', conta:'', cb:'', per:'venc', de:'', ate:'', sit:'aberto'}};
const FC_SIT = {aberto:'Em aberto (com vencidas)', vencido:'Só vencidas', semdata:'Sem data (ao final do processo)', pago:'Pagas / recebidas', todos:'Todas'};
function finContasView(nat){
  const f = FC[nat], e = nat === 'entrada', rot = e ? {t:'⬆ Contas a receber', novo:'+ Nova conta a receber', pago:'Recebido', quem:'Cliente / devedor'} : {t:'⬇ Contas a pagar', novo:'+ Nova conta a pagar', pago:'Pago', quem:'Pagar para'};
  listFn = () => {
    const sel = (f.per === 'pago' ? 'pagoEm' : f.per === 'comp' ? 'competencia' : 'vencimento'), t = today();
    const grupoConta = f.conta && pcById(f.conta)?.grupo;
    const l = db.financeiro.filter(x => {
      if(x.natureza !== nat || (FIN_AMB !== 'tudo' && ambDe(x) !== FIN_AMB)) return false;
      const st = finStatus(x);
      if(f.sit === 'aberto' && st === 'ok') return false; if(f.sit === 'vencido' && st !== 'vencido') return false; if(f.sit === 'pago' && st !== 'ok') return false; if(f.sit === 'semdata' && st !== 'semdata') return false;
      if(f.pessoa && x.pessoaId !== f.pessoa) return false; if(f.proc && x.processoId !== f.proc) return false;
      if(f.conta){ const c = contaDe(x); if(grupoConta ? c?.pai !== f.conta : c?.id !== f.conta) return false; }
      if(f.cb && x.contaBanc !== f.cb) return false;
      if(f.de || f.ate){ let d = x[sel] || ''; if(sel === 'competencia') d = d ? d + '-01' : ''; if(!d || (f.de && d < f.de) || (f.ate && d > f.ate)) return false; }
      return has(f.q, x.descricao, x.numDoc, contaDe(x)?.nome, contaDe(x)?.cod, pessoaNome(x.pessoaId), procLabel(byId('processos', x.processoId)));
    }).sort(f.sit === 'pago' ? byDateDesc('pagoEm') : (a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
    window._finList = l;
    const pagas = l.filter(x => x.pagoEm), abertas = l.filter(x => !x.pagoEm && finStatus(x) !== 'semdata'), venc = l.filter(x => finStatus(x) === 'vencido'), semd = l.filter(x => finStatus(x) === 'semdata');
    const parciais = pagas.filter(x => db.financeiro.some(y => y.saldoDe === x.id)).length;
    const k = (cls, tt, v, sub) => `<div class="fcK ${cls}"><small>${tt}</small><b>${v}</b><span>${sub}</span></div>`;
    document.getElementById('list').innerHTML = `<div class="fcKs">${k('', 'Registros', l.length, 'contas na busca')}${k('ok', rot.pago, money(sum(pagas.map(realV))), `${pagas.length - parciais} quitada(s) · ${parciais} parcial(is)`)}
      ${k('wa', 'Em aberto', money(sum(abertas.map(x => x.valor))), `${abertas.length} conta(s)`)}${k('bd', 'Vencido', money(sum(venc.map(x => x.valor))), `${venc.length} em atraso`)}${k('', '📌 Sem data', money(sum(semd.map(x => x.valor))), 'ao final do processo')}</div>
      <div class="card">${l.length ? finTableMes(l.slice(0, limiteDe('fc' + nat, 300)), {realizados:f.sit === 'pago', agrupar:true}) + maisBtn('fc' + nat, l.length, 300) : `<div class="empty">Não há contas ${e ? 'a receber' : 'a pagar'} com estes filtros.</div>`}</div>`;
  };
  const sF = (k, ops, vazio) => `<select data-fc="${nat}.${k}"><option value="">${vazio}</option>${opts(ops, f[k])}</select>`;
  return `<h1>💰 Financeiro<span class="sp"></span><button class="btn" data-act="print">🖨️ Imprimir</button><button class="btn" data-act="exportCsv">⬇ Excel</button>${relMenu('fin')}<button class="btn primary" data-act="newFin" data-nat="${nat}">${rot.novo}</button></h1>${finAbasHtml(e ? 'receber' : 'pagar')}
    <div class="card fcFiltros"><div class="fcG">
      <label>Buscar<input data-fc="${nat}.q" value="${esc(f.q)}" placeholder="histórico, nº do documento, conta…"></label>
      <label>${rot.quem}${sF('pessoa', pessoasOpts(), 'Todos')}</label>
      <label>Pasta / processo${sF('proc', procOpts(f.pessoa), 'Todas')}</label>
      <label>Conta do plano<select data-fc="${nat}.conta"><option value="">Todas</option>${contaFiltroOpts(f.conta, FIN_AMB)}</select></label>
      <label>Conta bancária${sF('cb', cbOpts(FIN_AMB === 'tudo' ? '' : FIN_AMB, f.cb), 'Todas')}</label>
      <label>Situação<select data-fc="${nat}.sit">${opts(Object.entries(FC_SIT).map(([v, t]) => ({v, t})), f.sit)}</select></label>
      <label>Período de<select data-fc="${nat}.per">${opts([{v:'venc', t:'Vencimento'}, {v:'comp', t:'Competência'}, {v:'pago', t:e ? 'Recebimento' : 'Pagamento'}], f.per)}</select></label>
      <label>De<input type="date" data-fc="${nat}.de" value="${f.de}"></label><label>Até<input type="date" data-fc="${nat}.ate" value="${f.ate}"></label>
      <div class="fcBt"><button class="mini" data-act="fcPer" data-nat="${nat}" data-p="mes">este mês</button><button class="mini" data-act="fcPer" data-nat="${nat}" data-p="prox">próx. 30 dias</button><button class="mini" data-act="fcLimpar" data-nat="${nat}">limpar</button></div>
    </div></div><div id="list"></div>`;
}
document.addEventListener('input', e => { const k = e.target.dataset?.fc; if(!k) return; const [nat, c] = k.split('.'); FC[nat][c] = e.target.value; if(e.target.tagName === 'INPUT' && c === 'q'){ clearTimeout(FC._t); FC._t = setTimeout(() => listFn && listFn(), 200); } });
document.addEventListener('change', e => { const k = e.target.dataset?.fc; if(!k) return; const [nat, c] = k.split('.'); FC[nat][c] = e.target.value; if(c === 'pessoa') FC[nat].proc = ''; LIM['fc' + nat] = 0; if(c === 'pessoa') render(); else listFn && listFn(); });
Object.assign(A, {
  fcPer: d => { const f = FC[d.nat], t = today(); f.per = 'venc'; if(d.p === 'mes'){ f.de = t.slice(0, 8) + '01'; f.ate = addDays(addMonths(f.de, 1), -1); } else { f.de = t; f.ate = addDays(t, 30); } render(); },
  fcLimpar: d => { FC[d.nat] = {q:'', pessoa:'', proc:'', conta:'', cb:'', per:'venc', de:'', ate:'', sit:'aberto'}; render(); },
});

/* ----- avisos: conta “ao final do processo” de processo já encerrado; recorrência sem parcelas futuras ----- */
VINCULOS.verificar.push(() => {
  const out = [], ls = db.financeiro.filter(l => !l.pagoEm && !l.vencimento && l.processoId && INATIVOS.includes(byId('processos', l.processoId)?.status));
  if(ls.length) out.push({area:'💰 Financeiro', titulo:`${ls.length} conta(s) “ao final do processo” de processo já encerrado`, txt:ls.slice(0, 3).map(l => `${l.descricao} (${procCode(byId('processos', l.processoId))})`).join(' · ') + ' — hora de cobrar ou de definir o vencimento.', href:'#/financeiro/receber', grave:true});
  return out;
});
