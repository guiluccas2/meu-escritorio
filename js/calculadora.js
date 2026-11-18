/* ===== 🧮 Calculadora — aba Prazo (as demais ficam visíveis, “em breve”) =====
   Usa o mesmo cálculo do sistema: fins de semana, feriados nacionais, feriados cadastrados no calendário,
   feriados da Justiça Federal (se o processo for federal) e recesso de 20/12 a 20/01 nos prazos em dias úteis. */
let calcAba = 'prazo', calcUlt = {modo:'pub', data:'', dias:15, tipo:'u', proc:''};
function calcPrazoDetalhe(v){
  const proc = byId('processos', v.proc), fed = ehFederal(proc), r = {};
  if(!v.data || !(v.dias > 0)) return null;
  let base = v.data;
  if(v.modo === 'disp'){ let d = addDays(base, 1); while(!isBusiness(d, false, fed)) d = addDays(d, 1); r.pub = d; base = d; } // publicação = 1º dia útil após a disponibilização
  r.inicio = (() => { let d = addDays(base, 1); while(!isBusiness(d, v.tipo === 'u', fed)) d = addDays(d, 1); return d; })();
  r.fim = calcPrazo(base, Number(v.dias), v.tipo, fed);
  r.fed = fed;
  // dias não úteis no caminho (para conferência)
  const pulados = [], fer = s => nomeFeriado(s) || (fed && holidaysJF(+s.slice(0, 4)).has(s) ? 'feriado da Justiça Federal' : '');
  let fds = 0, rec = 0;
  for(let d = addDays(v.data, 1); d <= r.fim; d = addDays(d, 1)){
    const wd = parseD(d).getDay(), md = d.slice(5);
    if(wd === 0 || wd === 6){ fds++; continue; }
    const f = fer(d); if(f){ pulados.push(`${fmtD(d).slice(0, 5)} (${f})`); continue; }
    if(v.tipo === 'u' && (md >= '12-20' || md <= '01-20')) rec++;
  }
  r.pulados = pulados; r.fds = fds; r.rec = rec;
  return r;
}
const diaSem = d => parseD(d).toLocaleDateString('pt-BR', {weekday:'long'});
function calcAbrir(){
  const abas = [['prazo', '📅 Prazo'], ['correcao', '📈 Correção / juros'], ['honor', '💼 Honorários'], ['comum', '🔢 Comum']];
  const v = {...calcUlt, data:calcUlt.data || today()};
  openForm({title:'🧮 Calculadora', soFechar:true, fields:[{type:'html', html:`<div class="clTabs">${abas.map(([k, l]) => `<button type="button" data-cla="${k}" class="${calcAba === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div id="clCorpo">${calcAba === 'prazo' ? `
      <div class="row2"><label>A data informada é
        <select id="clModo"><option value="pub" ${v.modo === 'pub' ? 'selected' : ''}>da publicação / intimação</option><option value="disp" ${v.modo === 'disp' ? 'selected' : ''}>da disponibilização no DJE / DJEN</option></select></label>
        <label>Data<input type="date" id="clData" value="${v.data}"></label></div>
      <div class="row2"><label>Prazo (dias)<input type="number" id="clDias" min="1" value="${v.dias}"></label>
        <label>Contagem<select id="clTipo"><option value="u" ${v.tipo === 'u' ? 'selected' : ''}>dias úteis (CPC / CLT)</option><option value="c" ${v.tipo === 'c' ? 'selected' : ''}>dias corridos</option></select></label></div>
      <label>Processo (opcional — define se entram os feriados da Justiça Federal)<select id="clProc"><option value="">— nenhum —</option>${opts(procOpts(), v.proc)}</select></label>
      <div id="clRes" class="clRes"></div>
      <div class="small muted" style="margin-top:6px">Considera fins de semana, feriados nacionais, os feriados cadastrados no calendário (🏖️ Feriados) e o recesso de 20/12 a 20/01. <b>Confira</b> suspensões de expediente do tribunal.</div>`
      : `<div class="clBreve"><div style="font-size:40px">🚧</div><b>Em breve</b><p class="small muted">${{correcao:'Atualização monetária e juros (tabela do TJSP, IPCA-E, Selic, INPC…).', honor:'Cálculo de honorários contratuais, sucumbenciais e de êxito.', comum:'Calculadora comum para contas rápidas.'}[calcAba]}</p></div>`}</div>`}],
    after:f => {
      f.querySelectorAll('[data-cla]').forEach(b => b.onclick = () => { calcAba = b.dataset.cla; calcAbrir(); });
      if(calcAba !== 'prazo') return;
      const ler = () => ({modo:f.querySelector('#clModo').value, data:f.querySelector('#clData').value, dias:+f.querySelector('#clDias').value, tipo:f.querySelector('#clTipo').value, proc:f.querySelector('#clProc').value});
      const pinta = () => { const v = ler(); calcUlt = v; const r = calcPrazoDetalhe(v), el = f.querySelector('#clRes');
        if(!r){ el.innerHTML = '<span class="muted">Informe a data e o número de dias.</span>'; return; }
        el.innerHTML = `${r.pub ? `<div class="small">Publicação considerada: <b>${fmtD(r.pub)}</b> (1º dia útil após a disponibilização)</div>` : ''}
          <div class="small">Contagem começa em <b>${fmtD(r.inicio)}</b></div>
          <div class="small muted" style="margin-top:6px">Vence em</div><div class="clFim">${diaSem(r.fim)}, ${fmtD(r.fim)}</div>
          <div class="small">${[r.pulados.length ? 'Desconsiderados: ' + r.pulados.join(', ') : '', r.fds ? r.fds + ' dia(s) de fim de semana' : '', r.rec ? r.rec + ' dia(s) de recesso forense' : '', r.fed ? 'feriados da Justiça Federal considerados' : ''].filter(Boolean).join(' · ')}</div>
          <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap"><button type="button" class="btn primary" id="clCriar">📅 Criar prazo com esta data</button><button type="button" class="btn" id="clCopiar">📋 Copiar</button></div>`;
        el.querySelector('#clCriar').onclick = () => { const p = byId('processos', v.proc); closeModal(); formPrazo({titulo:'', tipo:'Prazo processual', data:r.fim, dataFatal:r.fim, processoId:v.proc || '', pessoaId:p?.clienteId || '', obs:`Prazo de ${v.dias} dia(s) ${v.tipo === 'u' ? 'úteis' : 'corridos'} — ${v.modo === 'disp' ? 'disponibilização' : 'publicação/intimação'} em ${fmtD(v.data)} (calculado pela calculadora do sistema).`}); };
        el.querySelector('#clCopiar').onclick = () => navigator.clipboard?.writeText(`Prazo de ${v.dias} dia(s) ${v.tipo === 'u' ? 'úteis' : 'corridos'} a partir de ${fmtD(r.pub || v.data)}: vence em ${diaSem(r.fim)}, ${fmtD(r.fim)}.`).then(() => toast('Copiado'));
      };
      onForm(f, 'input', pinta); onForm(f, 'change', pinta); pinta();
    }});
}
A.calcAbrir = () => calcAbrir();
