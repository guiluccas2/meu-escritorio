/**
 * Robô do Escritório — publicações (DJEN) e andamentos (DataJud)
 * Roda na sua conta Google (Apps Script), todo dia por volta das 8h,
 * grava as novidades nesta planilha e envia um e-mail de resumo.
 *
 * 1ª vez: rode "configurar" e depois "testar" (menu acima: escolha a função e clique em Executar).
 */

// ===================== CONFIGURAÇÃO =====================
const CFG = {
  OABS: [{ numero: '355980', uf: 'SP' }], // inscrições suplementares: acrescente { numero:'...', uf:'..' }
  HORA_EMAIL: 8,          // hora do e-mail diário (horário de Brasília)
  DIAS_PRIMEIRA_VEZ: 7,   // na 1ª execução, busca publicações dos últimos N dias
  TZ: 'America/Sao_Paulo',
  // O DJEN recusa consultas vindas dos servidores do Google (HTTP 403); as publicações são buscadas pelo app.
  USAR_DJEN_NO_ROBO: false,
  AGENDA_EMAIL_SEPARADO: false, // true = a agenda do dia vem num e-mail próprio, separado das publicações
};
// Chave pública do DataJud (o CNJ pode trocá-la: https://datajud-wiki.cnj.jus.br/api-publica/acesso)
const DATAJUD_KEY_PADRAO = 'cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw==';
// O Google interrompe cada execução em 6 minutos: cada etapa respeita um limite e o restante fica para a próxima execução.
let T0_ = Date.now();
const decorrido_ = () => Date.now() - T0_;
const DJEN_URL = 'https://comunicaapi.pje.jus.br/api/v1/comunicacao';
const DATAJUD_URL = 'https://api-publica.datajud.cnj.jus.br/';

// ===================== FUNÇÕES QUE VOCÊ EXECUTA =====================

/** Cria as abas, o código de acesso do app e o agendamento diário. */
function configurar() {
  abas_();
  const P = PropertiesService.getScriptProperties();
  if (!P.getProperty('TOKEN')) P.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  if (!P.getProperty('DATAJUD_KEY')) P.setProperty('DATAJUD_KEY', DATAJUD_KEY_PADRAO);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'rotinaDiaria').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(CFG.HORA_EMAIL).nearMinute(0).inTimezone(CFG.TZ).create();
  // a leitura dos e-mails do PUSH foi retirada: apaga o agendamento antigo, se existir
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'lerPush').forEach(t => ScriptApp.deleteTrigger(t));
  log_('configurar', 'ok', 'Agendado para todo dia por volta das ' + CFG.HORA_EMAIL + 'h');
  Logger.log('✅ Configurado. Rotina diária agendada por volta das %sh.', CFG.HORA_EMAIL);
  Logger.log('🔑 Código de acesso para o app: %s', P.getProperty('TOKEN'));
}

/** Teste: consulta sem gravar nada e manda um e-mail com o resultado. */
function testar() {
  T0_ = Date.now();
  abas_();
  const fim = hoje_(), ini = addDias_(fim, -7);
  const linhas = [];
  // DJEN
  if (!CFG.USAR_DJEN_NO_ROBO) linhas.push('DJEN: desligado no robô (o Google é bloqueado pelo DJEN); as publicações serão buscadas pelo app.');
  if (CFG.USAR_DJEN_NO_ROBO) CFG.OABS.forEach(o => {
    try {
      const itens = djenBuscar_(o, ini, fim);
      linhas.push(`DJEN OAB ${o.numero}/${o.uf} (${br_(ini)} a ${br_(fim)}): ✅ ${itens.length} publicação(ões)`);
      const trib = {};
      itens.forEach(i => trib[i.tribunal || '?'] = (trib[i.tribunal || '?'] || 0) + 1);
      if (itens.length) linhas.push('   por tribunal: ' + Object.keys(trib).map(k => k + ': ' + trib[k]).join(', '));
      itens.slice(0, 3).forEach(i => linhas.push(`   • ${br_(i.data)} ${i.tribunal} ${i.numero} — ${i.titulo} — ${resumo_(i.texto, 160)}`));
      if (itens[0]) linhas.push('   campos recebidos: ' + Object.keys(itens[0].bruto || {}).join(', '));
    } catch (e) { linhas.push(`DJEN OAB ${o.numero}/${o.uf}: ❌ ${e.message}`); }
  });
  // DataJud
  const procs = processos_();
  if (!procs.length) linhas.push('DataJud: (nenhum processo na aba "Processos" — digite 2 ou 3 números CNJ na coluna A para testar)');
  procs.slice(0, 3).forEach((p, k) => { if (k) Utilities.sleep(1000); if (decorrido_() > 120000) return;
    try {
      const r = datajudBuscar_(p.numero);
      if (!r) { linhas.push(`DataJud ${p.numero}: ⚠️ tribunal não reconhecido pelo número`); return; }
      if (!r.encontrado) { linhas.push(`DataJud ${p.numero} (${r.alias}): ⚠️ não encontrado (segredo de justiça, número errado ou ainda não enviado ao CNJ)`); return; }
      const ult = r.movimentos[0];
      linhas.push(`DataJud ${p.numero} (${r.alias}): ✅ ${r.movimentos.length} movimentos; último: ${ult ? br_(ult.data.slice(0, 10)) + ' — ' + ult.titulo : '—'}; atualizado no CNJ em ${r.atualizadoEm ? br_(r.atualizadoEm.slice(0, 10)) : '?'}`);
    } catch (e) { linhas.push(`DataJud ${p.numero}: ❌ ${e.message}`); }
  });
  const txt = linhas.join('\n');
  Logger.log(txt);
  log_('testar', 'ok', txt);
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), '🧪 Robô do escritório — teste', txt);
}

/** Executada automaticamente todo dia (também pode rodar manualmente). */
function rotinaDiaria() {
  T0_ = Date.now();
  abas_();
  const P = PropertiesService.getScriptProperties();
  const agora = new Date().toISOString(), fim = hoje_();
  const novos = [], erros = [];
  const vistos = idsExistentes_();
  // 1) Publicações (DJEN)
  const ultimo = P.getProperty('DJEN_ULTIMA_DATA');
  const ini = ultimo || addDias_(fim, -CFG.DIAS_PRIMEIRA_VEZ);
  if (CFG.USAR_DJEN_NO_ROBO) CFG.OABS.forEach(o => {
    try {
      djenBuscar_(o, ini, fim).forEach(i => { if (!vistos[i.id]) { vistos[i.id] = 1; novos.push(i); } });
    } catch (e) { erros.push(`Publicações (OAB ${o.numero}/${o.uf}): ${e.message}`); }
  });
  if (CFG.USAR_DJEN_NO_ROBO && !erros.length) P.setProperty('DJEN_ULTIMA_DATA', fim);
  // 3) Andamentos (DataJud)
  const sh = aba_('Processos'), procs = processos_();
  const falhas = [];
  const umProc = (p, final) => {
    try {
      const r = datajudBuscar_(p.numero);
      if (!r || !r.encontrado) { sh.getRange(p.linha, 3).setValue(r ? 'não encontrado no DataJud' : 'tribunal não reconhecido'); return; }
      const base = p.ultimo || addDias_(fim, -7) + 'T00:00:00';
      r.movimentos.filter(m => m.data > base).reverse().forEach(m => {
        const id = 'dj:' + soDig_(p.numero) + ':' + m.data + ':' + m.codigo;
        if (!vistos[id]) { vistos[id] = 1; novos.push({ id, tipo: 'movimento', fonte: 'DataJud', numero: p.numero, data: m.data.slice(0, 10), tribunal: r.alias.replace('api_publica_', '').toUpperCase(), orgao: m.orgao, titulo: m.titulo, texto: m.complemento, link: '' }); }
      });
      if (r.movimentos[0]) sh.getRange(p.linha, 2, 1, 2).setValues([[r.movimentos[0].data, 'ok ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM HH:mm')]]);
    } catch (e) { if (final) erros.push(`Andamentos ${p.numero}: ${resumo_(e.message, 120)}`); else falhas.push(p); }
  };
  // rodízio: começa de onde parou na execução anterior; para por volta de 4 min 30 s para dar tempo de gravar e enviar o e-mail
  let cur = Number(P.getProperty('DATAJUD_CURSOR') || 0); if (cur >= procs.length) cur = 0;
  let feitos = 0;
  for (; feitos < procs.length && decorrido_() < 240000; feitos++) { if (feitos) Utilities.sleep(400); umProc(procs[(cur + feitos) % procs.length], false); }
  P.setProperty('DATAJUD_CURSOR', String(procs.length ? (cur + feitos) % procs.length : 0));
  if (feitos < procs.length) log_('rotinaDiaria', 'parcial', `DataJud: ${feitos} de ${procs.length} processos consultados hoje; os demais amanhã.`);
  if (falhas.length && decorrido_() < 230000) { Utilities.sleep(15000); falhas.forEach(p => { if (decorrido_() < 270000) umProc(p, true); else erros.push(`Andamentos ${p.numero}: DataJud sobrecarregado; nova tentativa amanhã`); }); }
  else falhas.forEach(p => erros.push(`Andamentos ${p.numero}: DataJud sobrecarregado; nova tentativa amanhã`));
  // 3) Grava
  if (novos.length) aba_('Itens').getRange(aba_('Itens').getLastRow() + 1, 1, novos.length, 11)
    .setValues(novos.map(i => [i.id, i.tipo, i.fonte, i.numero, i.data, i.tribunal, i.orgao, i.titulo, String(i.texto || '').slice(0, 45000), i.link, agora]));
  log_('rotinaDiaria', erros.length ? 'com erros' : 'ok', `${novos.length} novidade(s)` + (erros.length ? ' | ' + erros.join(' | ') : ''));
  const desde = P.getProperty('ULTIMA_EXECUCAO') || '';
  const shI = aba_('Itens'), nI = shI.getLastRow() - 1, ids = {}, fimEm = new Date().toISOString();
  novos.forEach(i => ids[i.id] = 1);
  if (nI > 0) shI.getRange(2, 1, nI, 11).getValues().forEach(r => {
    if (r[1] === 'publicacao' && String(r[10]) > desde && String(r[10]) <= fimEm && !ids[r[0]]) novos.push({ id: r[0], tipo: r[1], fonte: r[2], numero: r[3], data: fmtData_(r[4]), tribunal: r[5], orgao: r[6], titulo: r[7], texto: r[8], link: r[9] });
  });
  emailDiario_(novos, erros, procs.length);
}

// ===================== COMUNICAÇÃO COM O APP =====================
// O app lê as novidades (GET) e envia a lista de números de processos (POST).

function doGet(e) {
  const p = e.parameter || {};
  if (!tokenOk_(p.token)) return json_({ ok: false, erro: 'código de acesso inválido' });
  if (p.acao === 'ping') return json_({ ok: true, versao: 1 });
  const desde = p.desde || '';
  const sh = aba_('Itens'), n = sh.getLastRow() - 1;
  const itens = n > 0 ? sh.getRange(2, 1, n, 11).getValues()
    .filter(r => r[0] && String(r[10]) > desde)
    .map(r => ({ id: r[0], tipo: r[1], fonte: r[2], numero: r[3], data: fmtData_(r[4]), tribunal: r[5], orgao: r[6], titulo: r[7], texto: r[8], link: r[9], capturadoEm: String(r[10]) })) : [];
  return json_({ ok: true, itens, ultimaExecucao: PropertiesService.getScriptProperties().getProperty('ULTIMA_EXECUCAO') || '' });
}

function doPost(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, erro: 'JSON inválido' }); }
  if (!tokenOk_(b.token)) return json_({ ok: false, erro: 'código de acesso inválido' });
  abas_();
  if (Array.isArray(b.processos)) {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const atuais = {}; processos_().forEach(p => atuais[soDig_(p.numero)] = p);
      const lista = [...new Set(b.processos.map(soDig_).filter(d => d.length === 20))];
      const sh = aba_('Processos');
      if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 3).clearContent();
      if (lista.length) sh.getRange(2, 1, lista.length, 3).setValues(lista.map(d => { const a = atuais[d]; return [mascara_(d), a ? a.ultimo : '', a ? a.status : 'novo']; }));
    } finally { lock.releaseLock(); }
  }
  if (Array.isArray(b.agenda)) {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const sh = aba_('Agenda'), cols = ['id', 'data', 'hora', 'horaFim', 'tipo', 'subtipo', 'titulo', 'processo', 'cliente', 'local', 'dataFatal', 'reagendadoDe'];
      sh.clearContents(); sh.getRange('A:L').setNumberFormat('@');
      sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); sh.setFrozenRows(1);
      if (b.agenda.length) sh.getRange(2, 1, b.agenda.length, cols.length).setValues(b.agenda.slice(0, 400).map(i => cols.map(k => String(i[k] == null ? '' : i[k]))));
      PropertiesService.getScriptProperties().setProperty('AGENDA_EM', new Date().toISOString());
    } finally { lock.releaseLock(); }
  }
  if (Array.isArray(b.publicacoes) && b.publicacoes.length) {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      const vistos = idsExistentes_(), agora = new Date().toISOString();
      const novas = b.publicacoes.filter(i => i && i.id && !vistos[i.id]).slice(0, 300);
      if (novas.length) aba_('Itens').getRange(aba_('Itens').getLastRow() + 1, 1, novas.length, 11)
        .setValues(novas.map(i => [i.id, 'publicacao', 'DJEN (app)', i.numero || '', String(i.data || ''), i.tribunal || '', i.orgao || '', i.titulo || '', String(i.texto || '').slice(0, 45000), i.link || '', agora]));
    } finally { lock.releaseLock(); }
  }
  return json_({ ok: true });
}

// ===================== DJEN =====================
function djenBuscar_(oab, ini, fim) {
  const out = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const url = DJEN_URL + '?' + qs_({ numeroOab: oab.numero, ufOab: oab.uf, dataDisponibilizacaoInicio: ini, dataDisponibilizacaoFim: fim, pagina, itensPorPagina: 100 });
    const r = buscar_(url, { method: 'get', headers: { Accept: 'application/json' } });
    const j = r.json;
    const lista = j.items || j.itens || j.content || (Array.isArray(j) ? j : []);
    lista.forEach(x => out.push({
      id: 'djen:' + (x.id || x.hash || Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(x)))),
      tipo: 'publicacao', fonte: 'DJEN',
      numero: x.numeroprocessocommascara || mascara_(x.numero_processo || x.numeroProcesso || ''),
      data: String(x.data_disponibilizacao || x.dataDisponibilizacao || '').slice(0, 10),
      tribunal: x.siglaTribunal || '', orgao: x.nomeOrgao || '',
      titulo: [x.tipoComunicacao, x.tipoDocumento, x.nomeClasse].filter(Boolean).join(' · '),
      texto: limpar_(x.texto || ''), link: x.link || '', bruto: x,
    }));
    const total = Number(j.count || j.total || 0);
    if (lista.length < 100 || (total && out.length >= total)) break;
    Utilities.sleep(400);
  }
  return out;
}

// ===================== DATAJUD =====================
const TJ_UF = ['', 'ac', 'al', 'ap', 'am', 'ba', 'ce', 'dft', 'es', 'go', 'ma', 'mt', 'ms', 'mg', 'pa', 'pb', 'pr', 'pe', 'pi', 'rj', 'rn', 'rs', 'ro', 'rr', 'sc', 'se', 'sp', 'to'];
function aliasDoNumero_(num) {
  const d = soDig_(num); if (d.length !== 20) return null;
  const j = d[13], tr = Number(d.slice(14, 16));
  if (j === '8' && TJ_UF[tr]) return 'api_publica_tj' + TJ_UF[tr];
  if (j === '5') return tr === 0 ? 'api_publica_tst' : 'api_publica_trt' + tr;
  if (j === '4' && tr >= 1 && tr <= 6) return 'api_publica_trf' + tr;
  if (j === '3') return 'api_publica_stj';
  return null;
}
function datajudBuscar_(num) {
  const alias = aliasDoNumero_(num); if (!alias) return null;
  const key = PropertiesService.getScriptProperties().getProperty('DATAJUD_KEY') || DATAJUD_KEY_PADRAO;
  const r = buscar_(DATAJUD_URL + alias + '/_search', {
    method: 'post', contentType: 'application/json', headers: { Authorization: 'APIKey ' + key },
    payload: JSON.stringify({ query: { match: { numeroProcesso: soDig_(num) } }, size: 10 }),
  });
  const hits = (r.json.hits && r.json.hits.hits) || [];
  if (!hits.length) return { alias, encontrado: false, movimentos: [] };
  const movs = [];
  let atualizadoEm = '';
  hits.forEach(h => { const s = h._source || {}; if ((s.dataHoraUltimaAtualizacao || '') > atualizadoEm) atualizadoEm = s.dataHoraUltimaAtualizacao;
    (s.movimentos || []).forEach(m => movs.push({
      data: String(m.dataHora || ''), codigo: m.codigo || (m.movimentoNacional && m.movimentoNacional.codigoNacional) || (m.movimentoLocal && m.movimentoLocal.codigoMovimento) || '',
      titulo: m.nome || (m.movimentoNacional && m.movimentoNacional.nome) || (m.movimentoLocal && m.movimentoLocal.nome) || nomeMov_(m),
      complemento: (m.complementosTabelados || []).map(c => [c.nome, c.descricao].filter(Boolean).join(': ')).join('; '),
      orgao: (m.orgaoJulgador && m.orgaoJulgador.nome) || (s.orgaoJulgador && s.orgaoJulgador.nome) || '',
    })); });
  movs.sort((a, b) => b.data.localeCompare(a.data));
  const uniq = movs.filter((m, i) => !i || m.data + m.codigo !== movs[i - 1].data + movs[i - 1].codigo);
  return { alias, encontrado: true, movimentos: uniq, atualizadoEm };
}

// ===================== E-MAIL =====================
function agendaHtml_() {
  const sh = aba_('Agenda'), n = sh.getLastRow() - 1, P = PropertiesService.getScriptProperties();
  const em = P.getProperty('AGENDA_EM');
  if (!em) return { html: '', resumo: '' };
  const it = n > 0 ? sh.getRange(2, 1, n, 12).getValues().map(r => ({ id: r[0], data: String(r[1]), hora: String(r[2]), horaFim: String(r[3]), tipo: String(r[4]), subtipo: String(r[5]), titulo: String(r[6]), processo: String(r[7]), cliente: String(r[8]), local: String(r[9]), dataFatal: String(r[10]), reagendadoDe: String(r[11]) })) : [];
  const t = hoje_(); let prox = addDias_(t, 1); while ([0, 6].indexOf(new Date(prox + 'T12:00:00Z').getUTCDay()) >= 0) prox = addDias_(prox, 1);
  const lim = addDias_(t, 7);
  const atr = it.filter(i => i.data < t), hj = it.filter(i => i.data === t), pr = it.filter(i => i.data > t && i.data <= prox), sem = it.filter(i => i.data > prox && i.data <= lim);
  const e = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const ico = tp => ({ 'Audiência': '⚖️', 'Perícia': '🔬', 'Prazo processual': '⏰', 'Reunião': '👥', 'Diligência': '🚗' }[tp] || '📌');
  const linha = (i, comData) => `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap;vertical-align:top;width:105px">${comData ? br_(i.data).slice(0, 5) + ' ' : ''}${i.hora ? '<b>' + e(i.hora) + (i.horaFim ? '–' + e(i.horaFim) : '') + '</b>' : ''}</td>`
    + `<td style="padding:5px 8px;border-bottom:1px solid #eee">${ico(i.tipo)} <b>${e(i.titulo)}</b> <span style="color:#6b7385">(${e(i.tipo)}${i.subtipo ? ' · ' + e(i.subtipo) : ''})</span>`
    + `${i.processo || i.cliente ? `<br><span style="color:#6b7385;font-size:12.5px">${e([i.cliente, i.processo].filter(Boolean).join(' — '))}</span>` : ''}`
    + `${i.local ? `<br><span style="font-size:12.5px">📍 ${e(i.local)}</span>` : ''}`
    + `${i.dataFatal && i.dataFatal < t ? `<br><span style="color:#b42318;font-size:12.5px">⚠️ prazo fatal: ${br_(i.dataFatal)} (vencido)</span>` : i.dataFatal && i.dataFatal !== i.data ? `<br><span style="color:#a86400;font-size:12.5px">prazo fatal: ${br_(i.dataFatal)}</span>` : ''}`
    + `${i.reagendadoDe ? `<br><span style="color:#a86400;font-size:12.5px">🔁 reagendado de ${br_(i.reagendadoDe)}</span>` : ''}</td></tr>`;
  const bloco = (tit, cor, lista, comData) => lista.length ? `<h3 style="margin:14px 0 6px;color:${cor}">${tit} (${lista.length})</h3><table style="border-collapse:collapse;font-size:13.5px;width:100%">${lista.map(i => linha(i, comData)).join('')}</table>` : '';
  let h = `<h2 style="color:#1f4e79;margin:0 0 6px">📅 Agenda — ${br_(t)}</h2>`;
  h += bloco('🔴 Atrasados', '#b42318', atr, true);
  h += hj.length ? bloco('🟠 Hoje', '#a86400', hj, false) : `<p>🟠 <b>Hoje:</b> nenhum prazo ou compromisso.</p>`;
  h += bloco(`Próximo dia útil — ${br_(prox)}`, '#1f4e79', pr, true);
  h += bloco('Próximos 7 dias', '#1f4e79', sem, true);
  const desat = (Date.now() - new Date(em).getTime()) > 3 * 864e5;
  h += `<p style="font-size:12px;color:${desat ? '#b42318' : '#6b7385'}">Agenda enviada pelo app em ${Utilities.formatDate(new Date(em), CFG.TZ, 'dd/MM/yyyy HH:mm')}${desat ? ' — ⚠️ há mais de 3 dias: abra o app para atualizar.' : '.'} Os atrasados não concluídos são reagendados ao abrir o app (exceto audiências e perícias).</p>`;
  return { html: h, resumo: `${hj.length} hoje${atr.length ? ', ' + atr.length + ' atrasado(s)' : ''}`, n: hj.length + atr.length };
}

function emailDiario_(novos, erros, nProc) {
  const P = PropertiesService.getScriptProperties();
  P.setProperty('ULTIMA_EXECUCAO', new Date().toISOString());
  const ag = agendaHtml_();
  if (ag.html && CFG.AGENDA_EMAIL_SEPARADO) MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: `📅 Agenda do dia: ${ag.resumo} — ${br_(hoje_())}`, htmlBody: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2330">${ag.html}</div>` });
  const pubs = novos.filter(i => i.tipo === 'publicacao'), movs = novos.filter(i => i.tipo === 'movimento');
  const e = s => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let h = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1d2330">`;
  if (ag.html && !CFG.AGENDA_EMAIL_SEPARADO) h += ag.html + `<hr style="border:0;border-top:1px solid #e2e5ea;margin:18px 0">`;
  h += `<h2 style="color:#1f4e79;margin:0 0 6px">📰 Publicações e andamentos</h2>`;
  h += `<p style="margin:0 0 14px;color:#6b7385">📰 ${pubs.length} publicação(ões) · ⚖️ ${movs.length} movimentação(ões) do DataJud em ${nProc} processo(s) monitorado(s)</p>`;
  if (erros.length) h += `<div style="background:#fde8e6;border:1px solid #b42318;border-radius:8px;padding:10px;margin-bottom:14px"><b>⚠️ Falhas nas consultas — confira manualmente:</b><br>${erros.map(e).join('<br>')}</div>`;
  if (pubs.length) {
    h += `<h3 style="margin:16px 0 8px">📰 Publicações (DJEN)</h3>`;
    pubs.forEach(i => h += `<div style="border:1px solid #e2e5ea;border-radius:8px;padding:10px;margin-bottom:8px"><b>${e(i.numero)}</b> · ${e(i.tribunal)} · disponibilizada em ${br_(i.data)}<br><span style="color:#6b7385">${e(i.orgao)}${i.titulo ? ' — ' + e(i.titulo) : ''}</span><div style="margin-top:6px;white-space:pre-wrap">${e(resumo_(i.texto, 900))}</div>${i.link ? `<a href="${e(i.link)}">ver documento</a>` : ''}</div>`);
    h += `<p style="font-size:12px;color:#6b7385">Publicação: 1º dia útil após a disponibilização; o prazo começa no dia útil seguinte. Confira sempre no DJEN e nos sistemas dos tribunais.</p>`;
  }
  if (movs.length) {
    h += `<h3 style="margin:16px 0 8px">⚖️ Movimentações (DataJud) — confirme no app para virarem andamento</h3><table style="border-collapse:collapse;font-size:13px">`;
    movs.sort((a, b) => (a.numero + a.data).localeCompare(b.numero + b.data)).forEach(i => h += `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:nowrap">${br_(i.data)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#6b7385;white-space:nowrap">${e(i.fonte)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:nowrap">${e(i.numero)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee"><b>${e(i.titulo)}</b>${i.texto ? ' — ' + e(i.texto) : ''}</td></tr>`);
    h += `</table>`;
  }
  if (!novos.length && !erros.length) h += `<p>✅ Nenhuma novidade hoje. O robô está funcionando.</p>`;
  if (!CFG.USAR_DJEN_NO_ROBO) h += `<p style="font-size:12px;color:#6b7385">As publicações do DJEN são buscadas pelo app (o DJEN bloqueia o Google): aqui aparecem as que o app encontrou desde o último e-mail. Abra o app para buscar as mais recentes.</p>`;
  h += `<p style="font-size:12px;color:#6b7385;margin-top:18px">Ferramenta de apoio: não substitui a conferência no DJEN, no Domicílio Judicial Eletrônico e nos sistemas dos tribunais.</p></div>`;
  const assunto = `${erros.length ? '⚠️' : '📰'} Escritório ${br_(hoje_()).slice(0, 5)}: ${ag.html && !CFG.AGENDA_EMAIL_SEPARADO ? '📅 ' + ag.resumo + ' · ' : ''}${pubs.length} publicação(ões), ${movs.length} movimentação(ões)`;
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(), subject: assunto, htmlBody: h });
}

// ===================== AUXILIARES =====================
function buscar_(url, opt) {
  let ultimo;
  for (let t = 0; t < 3; t++) {
    const r = UrlFetchApp.fetch(url, Object.assign({ muteHttpExceptions: true, followRedirects: true }, opt));
    const c = r.getResponseCode(), body = r.getContentText();
    if (c >= 200 && c < 300) { try { return { code: c, json: JSON.parse(body) }; } catch (e) { throw new Error('resposta não é JSON: ' + body.slice(0, 150)); } }
    ultimo = `HTTP ${c}: ${body.replace(/\s+/g, ' ').slice(0, 200)}`;
    if (c === 401 || c === 403) break;
    Utilities.sleep(c === 429 || c >= 500 ? [5000, 15000, 0][t] : 1500 * (t + 1));
  }
  throw new Error(ultimo);
}
function abas_() {
  const def = { Itens: ['id', 'tipo', 'fonte', 'processo', 'data', 'tribunal', 'órgão', 'título', 'texto', 'link', 'capturado em'],
    Processos: ['número CNJ (o app preenche)', 'último movimento visto', 'situação'], Log: ['quando', 'função', 'resultado', 'detalhes'] };
  Object.keys(def).forEach(n => { const s = aba_(n); if (s.getLastRow() === 0) { s.appendRow(def[n]); s.setFrozenRows(1); s.getRange(1, 1, 1, def[n].length).setFontWeight('bold'); } });
  // datas guardadas como texto, para comparação exata
  aba_('Itens').getRange('E:E').setNumberFormat('@'); aba_('Itens').getRange('K:K').setNumberFormat('@');
  aba_('Processos').getRange('A:B').setNumberFormat('@');
}
function aba_(n) { const ss = SpreadsheetApp.getActive(); return ss.getSheetByName(n) || ss.insertSheet(n); }
function processos_() {
  const sh = aba_('Processos'), n = sh.getLastRow() - 1; if (n < 1) return [];
  return sh.getRange(2, 1, n, 3).getValues().map((r, i) => ({ numero: String(r[0]).trim(), ultimo: r[1] instanceof Date ? r[1].toISOString() : String(r[1] || ''), status: r[2], linha: i + 2 })).filter(p => soDig_(p.numero).length === 20);
}
function idsExistentes_() { const sh = aba_('Itens'), n = sh.getLastRow() - 1, o = {}; if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(r => o[r[0]] = 1); return o; }
function log_(f, res, det) { const s = aba_('Log'); s.appendRow([new Date(), f, res, String(det).slice(0, 45000)]); if (s.getLastRow() > 400) s.deleteRows(2, 100); }
function tokenOk_(t) { const k = PropertiesService.getScriptProperties().getProperty('TOKEN'); return !!k && t === k; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function qs_(o) { return Object.keys(o).map(k => k + '=' + encodeURIComponent(o[k])).join('&'); }
function nomeMov_(m) { const c = (m.complementosTabelados || [])[0]; if (c && (c.descricao || c.nome)) return c.descricao || c.nome; const k = m.codigo || (m.movimentoNacional && m.movimentoNacional.codigoNacional); return k ? 'Movimento código ' + k : 'Movimentação'; }
function soDig_(s) { return String(s || '').replace(/\D/g, ''); }
function mascara_(s) { const d = soDig_(s); return d.length === 20 ? `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d[13]}.${d.slice(14, 16)}.${d.slice(16)}` : String(s || ''); }
function hoje_() { return Utilities.formatDate(new Date(), CFG.TZ, 'yyyy-MM-dd'); }
function addDias_(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function br_(iso) { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || ''); }
function fmtData_(v) { return v instanceof Date ? Utilities.formatDate(v, CFG.TZ, 'yyyy-MM-dd') : String(v || ''); }
function limpar_(h) { return String(h).replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\n{3,}/g, '\n\n').trim(); }
function resumo_(t, n) { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; }
