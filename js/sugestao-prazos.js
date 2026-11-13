// Meu Escritório — Sugestão automática de prazo para as publicações do DJEN (por regras fixas, SEM IA) e lançamento em lote
'use strict';
/* ================= SUGESTÃO DE PRAZO (sem IA) =================
   Lê o texto da publicação e o tipo de processo (Juizado, Trabalho, Federal) e sugere o prazo, como a tabela abaixo.
   Prazo escrito no texto ("no prazo de 5 dias") prevalece. Na dúvida, o prazo mais curto, sempre com "conferir –" no título.
   - sentença: apelação 15 (CPC 1.003 §5º) · Juizado: recurso inominado 10 (Lei 9.099, art. 42) · Trabalho: recurso ordinário 8 (CLT 895)
   - acórdão: embargos de declaração 5 (REsp/RE 15; Trabalho: recurso de revista 8)
   - decisão interlocutória: tarefa "avaliar recurso" em 2 dias úteis (agravo de instrumento: 15)
   - contestação, réplica, manifestação sobre laudo sem prazo fixado: 15 (Trabalho: 5)
   - outras providências sem prazo expresso: 5 (CPC 218, §3º)
   - audiência/perícia designada: compromisso na data e hora
   - certidão, remessa, juntada, conclusão e outros expedientes: só andamento
   - processo sigiloso (sem texto): "URGENTE conferir" no próximo dia útil */
const SUG_RE = {
  sigilo: /documento sigiloso|segredo de justica|sigilos[oa]/,
  sentenca: /\bsentenca\b|julgo (parcialmente )?(im)?procedente|julgo extint|extingo o processo|resolvo o merito|homologo (o |a )?(acordo|transacao|desistencia)|homologo por sentenca/,
  acordao: /\bacordao\b|\bacordam\b|\bementa\b/,
  interloc: /\bdecisao\b|\bdefiro\b|\bindefiro\b|tutela (de urgencia|antecipada|provisoria)|\bliminar\b/,
  contestacao: /cite-se|\bcitacao\b|apresentar contestacao|para contestar|contestar a acao|oferecer contestacao/,
  replica: /\breplica\b|manifest[\w-]*(?: [a-z]+){0,3} sobre (a|as) contestac|impugnacao a contestacao|manifest[\w-]* em replica/,
  laudo: /\blaudo\b/,
  manifest: /manifeste-se|manifestem-se|manifestar-se|manifestacao da parte|\bdiga\b|\bdigam\b|especifique|especifiquem|providencie|recolh|comprove|junte|apresente|emende|cumpra a parte|cumpra o autor|cumpra o reu|regularize|esclare[cs]a|intime-se a parte autora para|intime-se a parte re para|intime-se o autor para|intime-se o reu para/,
  expediente: /remetid|remessa|redistribu|distribu[ií]d|conclusos|certifico|certidao|juntada|arquiv|vista ao ministerio|ato ordinatorio|recebidos os autos|transitad|baixa definitiva/,
};
function proximoDiaUtil(d, fed){ let x = addDays(d, 1); while(!isBusiness(x, false, fed)) x = addDays(x, 1); return x; }
function sugerirPrazo(it){
  const d = digits(it.numero), fed = ehFederal(it.numero), trab = d.length === 20 && d[13] === '5';
  const t = norm_s(String(it.texto || '')).replace(/\s+/g, ' ').trim();
  const org = norm_s([it.orgao, it.titulo].join(' '));
  const juizado = /juizado/.test(org) || /juizado especial/.test(t.slice(0, 800));
  const pub = pubDataPublicacao(it.data, fed), ini = pubInicioPrazo(it.data, fed);
  const r = {fed, trab, juizado, pub, ini, tipo:'Prazo processual', subtipo:'', hora:'', dias:0, contagem:'u', data:'', explicito:false, soAndamento:false, urgente:false};
  const prazo = (ato, nome, dias, fund, tipo) => Object.assign(r, {ato, titulo:'conferir – ' + nome, dias, fundamento:fund, tipo:tipo || 'Prazo processual'});
  // processo sigiloso / publicação sem texto
  if(!t || (SUG_RE.sigilo.test(t) && t.length < 500)){
    Object.assign(r, {ato:'Processo sigiloso ou publicação sem texto', titulo:'URGENTE conferir – intimação sem texto / processo sigiloso', urgente:true, fundamento:'conteúdo não disponível na publicação: conferir no sistema do tribunal', data:proximoDiaUtil(today(), fed)});
    return r;
  }
  // audiência ou perícia designada: compromisso na data marcada
  const ma = t.match(/(audiencia|pericia)[^.;]{0,260}?(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[^0-9]{0,20}?(\d{1,2})\s*(?:h|:)\s*(\d{2})?)?/);
  if(ma && /design|redesign|marcad|pauta|agend|realizar-se|sera realizad/.test(t)){
    const dt = `${ma[4]}-${ma[3].padStart(2, '0')}-${ma[2].padStart(2, '0')}`;
    if(dt >= it.data){
      const aud = ma[1] === 'audiencia', sub = aud ? (OPT.subtipo.find(s => s.split(' ').length === 1 && new RegExp('\\b' + norm_s(s) + '\\b').test(t)) || '') : '';
      Object.assign(r, {ato:aud ? 'Audiência designada' : 'Perícia designada', tipo:aud ? 'Audiência' : 'Perícia', subtipo:sub, titulo:aud ? (sub ? 'Audiência de ' + sub.toLowerCase() : 'Audiência') : 'Perícia',
        data:dt, hora:ma[5] ? `${ma[5].padStart(2, '0')}:${ma[6] || '00'}` : '', fundamento:'data e hora indicadas na publicação'});
      return r;
    }
  }
  // tipo de ato
  if(SUG_RE.sentenca.test(t)){
    if(trab) prazo('Sentença', 'Recurso ordinário (8 dias úteis; embargos de declaração: 5)', 8, 'sentença trabalhista: recurso ordinário 8 dias (CLT, art. 895); embargos de declaração 5 dias');
    else if(juizado) prazo('Sentença em Juizado', 'Recurso inominado (10 dias úteis; embargos de declaração: 5)', 10, 'sentença em Juizado: recurso inominado 10 dias (Lei 9.099/95, art. 42); embargos de declaração 5 dias');
    else prazo('Sentença', 'Apelação (15 dias úteis; embargos de declaração: 5)', 15, 'sentença: apelação 15 dias (CPC, art. 1.003, §5º); embargos de declaração 5 dias (CPC, art. 1.023)');
  } else if(SUG_RE.acordao.test(t)){
    prazo('Acórdão', trab ? 'Embargos de declaração (5 dias; recurso de revista: 8)' : 'Embargos de declaração (5 dias; REsp/RE: 15)', 5,
      trab ? 'acórdão trabalhista: embargos de declaração 5 dias; recurso de revista 8 dias' : 'acórdão: embargos de declaração 5 dias (CPC, art. 1.023); recurso especial/extraordinário 15 dias');
  } else if(SUG_RE.contestacao.test(t)){
    prazo('Citação / contestação', 'Contestação', trab ? 5 : 15, trab ? 'Justiça do Trabalho: conferir a data da audiência (defesa até a audiência)' : 'contestação: 15 dias (CPC, art. 335)');
  } else if(SUG_RE.replica.test(t)){
    prazo('Réplica', 'Réplica', trab ? 5 : 15, trab ? 'Justiça do Trabalho: manifestação 5 dias' : 'réplica: 15 dias (CPC, arts. 350 e 351)');
  } else if(SUG_RE.laudo.test(t) && /manifest|cien|vista/.test(t)){
    prazo('Laudo pericial', 'Manifestação sobre o laudo', trab ? 5 : 15, trab ? 'Justiça do Trabalho: manifestação 5 dias' : 'manifestação sobre o laudo: 15 dias (CPC, art. 477, §1º)');
  } else if(SUG_RE.interloc.test(t) && !SUG_RE.manifest.test(t)){
    prazo('Decisão interlocutória', trab ? 'Avaliar a decisão' : 'Avaliar recurso (agravo de instrumento: 15 dias)', 2,
      trab ? 'decisão interlocutória trabalhista (em regra irrecorrível de imediato): avaliar em 2 dias úteis' : 'decisão interlocutória: avaliar o cabimento de agravo de instrumento (15 dias, CPC art. 1.015) — tarefa em 2 dias úteis', 'Tarefa');
  } else if(SUG_RE.manifest.test(t)){
    prazo('Intimação para providência / manifestação', 'Manifestação', 5, 'sem prazo fixado: 5 dias (CPC, art. 218, §3º)' + (trab ? '; Justiça do Trabalho: 5 dias' : ''));
  } else if(SUG_RE.expediente.test(t)){
    Object.assign(r, {ato:'Mero expediente (certidão, remessa, juntada, conclusão…)', soAndamento:true, titulo:'', fundamento:'ato sem providência para a parte: só o andamento'});
    return r;
  } else {
    prazo('Ato não identificado', 'Verificar intimação (ato não identificado)', 5, 'o sistema não reconheceu o tipo de ato: prazo mais curto (5 dias, CPC art. 218, §3º) para conferência');
  }
  // prazo escrito no texto prevalece
  const mx = t.match(/(?:prazo (?:comum |sucessivo |legal |improrrogavel )*de|no prazo de|em ate|dentro de|\bem)\s+(\d{1,3})\s*(?:\([^)]{0,40}\)\s*)?dias?(?:\s+(uteis|corridos))?/);
  const mh = t.match(/(?:prazo (?:comum |sucessivo )*de|no prazo de|em)\s+(\d{2,3})\s*(?:\([^)]{0,40}\)\s*)?horas/);
  if(r.tipo === 'Prazo processual' && mx && +mx[1] > 0 && +mx[1] <= 120){
    r.dias = +mx[1]; r.explicito = true; if(mx[2] === 'corridos') r.contagem = 'c';
    r.titulo = r.titulo.replace(/\s*\([^)]*\)\s*$/, '') + ` (${r.dias} dias ${r.contagem === 'c' ? 'corridos' : 'úteis'}, fixado no ato)`;
    r.fundamento = `prazo fixado no próprio ato: ${r.dias} dias ${r.contagem === 'c' ? 'corridos' : 'úteis'}`;
  } else if(r.tipo === 'Prazo processual' && mh){
    r.dias = Math.max(1, Math.ceil(+mh[1] / 24)); r.contagem = 'c'; r.explicito = true;
    r.titulo = r.titulo.replace(/\s*\([^)]*\)\s*$/, '') + ` (${mh[1]} horas, fixado no ato)`; r.fundamento = `prazo em horas fixado no ato (${mh[1]} h): conferir o horário`;
  }
  if(r.dias) r.data = calcPrazo(pub, r.dias, r.contagem, fed);
  return r;
}
function sugestaoObs(it, s){
  return `Publicação DJEN — disponibilizada em ${fmtD(it.data)}, publicada em ${fmtD(s.pub)}, prazo começa a contar em ${fmtD(s.ini)}.\n`
    + `Regra: ${s.fundamento}.\nPrazo sugerido automaticamente pelo sistema (sem IA) — CONFERIR. Feriados municipais/locais não considerados${s.fed ? '; feriados da Justiça Federal considerados' : ''}.`;
}
function sugestaoRegistro(it, s, pr){
  const rec = {titulo:s.titulo, tipo:s.tipo, subtipo:s.subtipo, data:s.data, hora:s.hora, processoId:pr?.id || '', pessoaId:pr?.clienteId || '', situacao:'Pendente', concluido:false, obs:sugestaoObs(it, s)};
  if(rec.tipo === 'Prazo processual' && rec.data) rec.dataFatal = rec.data;
  rec.coluna = colunaAuto(rec); return rec;
}
const sugDataTxt = (d, h) => d ? `${parseD(d).toLocaleDateString('pt-BR', {weekday:'short'}).replace('.', '')}, ${fmtD(d)}${h ? ' às ' + h : ''}` : '';
function sugestaoHtml(it){
  const s = sugerirPrazo(it);
  if(s.soAndamento) return `<div class="sugPz neutro">💡 <b>Sugestão:</b> ${esc(s.ato)} → só registrar o andamento, sem prazo.</div>`;
  const qd = s.tipo === 'Audiência' || s.tipo === 'Perícia' ? `${s.tipo === 'Audiência' ? '⚖️' : '🔬'} ${esc(s.titulo)} em <b>${sugDataTxt(s.data, s.hora)}</b>`
    : `${esc(s.ato)} → <b>${esc(s.titulo.replace(/^conferir – /, ''))}</b>${s.dias && !/dias|horas/.test(s.titulo) ? ` — ${s.dias} dia(s) ${s.contagem === 'c' ? 'corridos' : 'úteis'}` : ''} → ${s.tipo === 'Tarefa' ? 'até' : 'vence'} <b>${sugDataTxt(s.data)}</b>`;
  return `<div class="sugPz ${s.urgente ? 'urg' : ''}">💡 <b>Prazo sugerido:</b> ${qd} <span class="muted">(conferir${s.fed ? ' · feriados da Justiça Federal considerados' : ''})</span></div>`;
}

/* ================= LANÇAR TODAS (em lote, com conferência) ================= */
A.pubLote = () => {
  const lista = monNovas('publicacao').sort((a, b) => a.data.localeCompare(b.data));
  if(!lista.length) return toast('Nenhuma publicação nova');
  const linhas = lista.map(it => { const pr = monProc(it), s = sugerirPrazo(it), temPz = !s.soAndamento && !!s.data;
    return `<div class="lote${pr ? '' : ' semProc'}" data-id="${esc(it.id)}">
      <label class="loteTop"><input type="checkbox" class="lOk" ${pr && !it.cancelada ? 'checked' : ''} ${pr ? '' : 'disabled'}>
        <span><b>${esc(pr ? procLabel(pr) : it.numero)}</b>${pr ? '' : ' <span class="tag warn">processo não cadastrado — fica na lista</span>'}${it.cancelada ? ' <span class="tag bad">cancelada</span>' : ''}
        <span class="small muted"> · ${esc(it.tribunal)} · disponibilizada ${fmtD(it.data)} · ${esc(s.ato)}</span></span></label>
      <div class="loteCampos">
        <label class="small"><input type="checkbox" class="lPz" ${temPz ? 'checked' : ''}> criar ${s.tipo === 'Audiência' || s.tipo === 'Perícia' ? 'compromisso' : s.tipo === 'Tarefa' ? 'tarefa' : 'prazo'}</label>
        <input class="lTit" value="${esc(s.titulo || 'conferir – Manifestação')}" placeholder="Descrição">
        <input type="date" class="lData" value="${esc(s.data || '')}">
        ${s.tipo === 'Audiência' || s.tipo === 'Perícia' ? `<input type="time" class="lHora" value="${esc(s.hora)}">` : ''}
      </div>
      <div class="small muted">${esc(s.fundamento || '')}</div></div>`; }).join('');
  openForm({ title:`⚡ Lançar ${lista.length} publicação(ões)`, data:{},
    fields:[{type:'html', html:`<p class="small" style="margin-top:0">Para cada publicação marcada, o sistema registra o <b>andamento</b> (com o texto completo) e, se marcado, o <b>prazo sugerido</b> — sem IA. Confira e ajuste a descrição e a data antes de confirmar. Publicações de processos não cadastrados ficam na lista.</p>
      <div class="loteLista">${linhas}</div>`}],
    onSave: () => {
      let na = 0, np = 0;
      mForm.querySelectorAll('.lote').forEach(row => {
        if(!row.querySelector('.lOk')?.checked) return;
        const it = byId('monitor', row.dataset.id), pr = it && monProc(it); if(!it || !pr) return;
        const s = sugerirPrazo(it), fed = ehFederal(it.numero);
        const and = upsert('andamentos', {processoId:pr.id, data:pubDataPublicacao(it.data, fed), tipo:'Publicação / Intimação', descricao:pubDescricao(it), origem:'DJEN', monitorId:it.id}); na++;
        const upd = {id:it.id, status:'registrada', andamentoId:and.id, processoId:pr.id};
        const data = row.querySelector('.lData').value, tit = row.querySelector('.lTit').value.trim();
        if(row.querySelector('.lPz').checked && data){
          const rec = sugestaoRegistro(it, s, pr); rec.titulo = tit || rec.titulo; rec.data = data; rec.hora = row.querySelector('.lHora')?.value || rec.hora;
          if(s.soAndamento){ rec.tipo = 'Prazo processual'; rec.obs = sugestaoObs(it, {...s, fundamento:'prazo informado manualmente no lançamento em lote'}); }
          if(rec.tipo === 'Prazo processual') rec.dataFatal = data;
          rec.coluna = colunaAuto(rec);
          const pz = upsert('prazos', rec); np++; upd.status = 'prazo'; upd.prazoId = pz.id;
        }
        upsert('monitor', upd);
      });
      toast(`✅ ${na} andamento(s) e ${np} prazo(s)/compromisso(s) lançados`);
    } });
};
