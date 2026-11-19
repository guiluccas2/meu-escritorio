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
  JANELA_DATAJUD: 60,     // DataJud: 1ª consulta de cada processo traz TODO o histórico; depois, confere os últimos N dias
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

/** Rode UMA vez para permitir que o robô salve os cadastros recebidos pelo link na sua pasta do Google Drive. */
function autorizarCadastro() {
  Logger.log('✔ Google Drive autorizado: ' + DriveApp.getRootFolder().getName() + ' · e-mails disponíveis hoje: ' + MailApp.getRemainingDailyQuota() + '. Agora rode “ativarLembretes” e atualize a implantação (Implantar > Gerenciar implantações > lápis > Nova versão).');
}

/** Rode UMA vez: o robô passa a enviar, a cada 15 minutos, os e-mails de lembrete programados no app. */
function ativarLembretes() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'enviarLembretes').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('enviarLembretes').timeBased().everyMinutes(15).create();
  Logger.log('✔ Envio automático de lembretes por e-mail ativado (a cada 15 minutos). E-mails disponíveis hoje: ' + MailApp.getRemainingDailyQuota());
}

/** Rode UMA vez para permitir que o robô grave compromissos na sua Google Agenda. */
function autorizarAgenda() {
  const c = CalendarApp.getDefaultCalendar();
  Logger.log('✔ Google Agenda autorizada: ' + c.getName() + '. Agora atualize a implantação (Implantar > Gerenciar implantações > lápis > Nova versão).');
}

/** Cria as abas, o código de acesso do app e o agendamento diário. */
function configurar() {
  abas_();
  const P = PropertiesService.getScriptProperties();
  if (!P.getProperty('TOKEN')) P.setProperty('TOKEN', Utilities.getUuid().replace(/-/g, ''));
  if (!P.getProperty('DATAJUD_KEY')) P.setProperty('DATAJUD_KEY', DATAJUD_KEY_PADRAO);
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'rotinaDiaria').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('rotinaDiaria').timeBased().everyDays(1).atHour(CFG.HORA_EMAIL).nearMinute(0).inTimezone(CFG.TZ).create();
  // repescagem do DataJud (quando o servidor do CNJ recusa por sobrecarga de manhã)
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'repescagemDataJud').forEach(t => ScriptApp.deleteTrigger(t));
  [12, 16].forEach(h => ScriptApp.newTrigger('repescagemDataJud').timeBased().everyDays(1).atHour(h).nearMinute(0).inTimezone(CFG.TZ).create());
  // a leitura dos e-mails do PUSH foi retirada: apaga o agendamento antigo, se existir
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'lerPush').forEach(t => ScriptApp.deleteTrigger(t));
  log_('configurar', 'ok', 'Agendado para todo dia por volta das ' + CFG.HORA_EMAIL + 'h (repescagem do DataJud às 12h e às 16h)');
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
      const nSup = r.movimentos.filter(m => m.sup).length;
      linhas.push(`DataJud ${p.numero} (${r.alias}${nSup ? ' + ' + [...new Set(r.movimentos.filter(m => m.sup).map(m => m.sup))].join('/') + ': ' + nSup : ''}): ✅ ${r.movimentos.length} movimentos; último: ${ult ? br_(ult.data.slice(0, 10)) + ' — ' + ult.titulo : '—'}; atualizado no CNJ em ${r.atualizadoEm ? br_(r.atualizadoEm.slice(0, 10)) : '?'}`);
    } catch (e) { linhas.push(/HTTP 429/.test(e.message) ? `DataJud ${p.numero}: ⏳ servidor do CNJ sobrecarregado (HTTP 429) — não é erro do robô; a rotina tenta de novo sozinha (12h e 16h)` : `DataJud ${p.numero}: ❌ ${e.message}`); }
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
  if (P.getProperty('HISTORICO_COMPLETO_V2') !== 'feito') { // uma vez: os processos já monitorados também recebem o histórico completo
    const shp = aba_('Processos'); if (shp.getLastRow() > 1) shp.getRange(2, 2, shp.getLastRow() - 1, 1).clearContent();
    P.setProperty('HISTORICO_COMPLETO_V2', 'feito'); P.setProperty('DATAJUD_CURSOR', '0'); }
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
    try { djProcesso_(p, sh, fim, vistos, novos); }
    catch (e) { if (final) falhas2.push(p); else falhas.push(p); }
  };
  const falhas2 = [];
  // rodízio: começa de onde parou na execução anterior; para por volta de 4 min 30 s para dar tempo de gravar e enviar o e-mail
  let cur = Number(P.getProperty('DATAJUD_CURSOR') || 0); if (cur >= procs.length) cur = 0;
  let feitos = 0;
  for (; feitos < procs.length && decorrido_() < 240000; feitos++) { if (feitos) Utilities.sleep(400); umProc(procs[(cur + feitos) % procs.length], false); }
  P.setProperty('DATAJUD_CURSOR', String(procs.length ? (cur + feitos) % procs.length : 0));
  if (feitos < procs.length) log_('rotinaDiaria', 'parcial', `DataJud: ${feitos} de ${procs.length} processos consultados hoje; os demais amanhã.`);
  if (falhas.length && decorrido_() < 230000) { Utilities.sleep(15000); falhas.forEach(p => { if (decorrido_() < 270000) umProc(p, true); else falhas2.push(p); }); }
  else falhas.forEach(p => falhas2.push(p));
  // o que o DataJud recusou (sobrecarga) fica para a repescagem das 12h e das 16h
  P.setProperty('DATAJUD_PENDENTES', JSON.stringify(falhas2.map(p => p.numero)));
  if (falhas2.length) erros.push(`DataJud sobrecarregado (servidor do CNJ) em ${falhas2.length} processo(s): ${falhas2.map(p => p.numero).join(', ')} — nova tentativa automática às 12h e às 16h`);
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

/** Consulta um processo no DataJud e acrescenta as movimentações novas em `novos` (lança erro se o DataJud falhar). */
function djProcesso_(p, sh, fim, vistos, novos) {
  const r = datajudBuscar_(p.numero);
  if (!r || !r.encontrado) { sh.getRange(p.linha, 3).setValue(r ? 'não encontrado no DataJud' : 'tribunal não reconhecido'); return; }
  // 1ª consulta do processo: todo o histórico; depois: os últimos N dias (o que já foi enviado é ignorado pelo id)
  const primeira = !p.ultimo, base = primeira ? '' : addDias_(fim, -CFG.JANELA_DATAJUD) + 'T00:00:00';
  r.movimentos.filter(m => m.data > base).reverse().forEach(m => {
    const id = 'dj:' + soDig_(p.numero) + ':' + m.data + ':' + m.codigo + (m.sup ? ':' + m.sup : '');
    if (!vistos[id]) { vistos[id] = 1; novos.push({ id, tipo: 'movimento', fonte: primeira ? 'DataJud (histórico)' : 'DataJud', numero: p.numero, data: m.data.slice(0, 10), tribunal: m.sup || r.alias.replace('api_publica_', '').toUpperCase(), orgao: m.orgao, titulo: m.titulo, texto: m.complemento, link: '' }); }
  });
  if (r.movimentos[0]) sh.getRange(p.linha, 2, 1, 2).setValues([[r.movimentos[0].data, 'ok ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM HH:mm')]]);
}

/** Repescagem (12h e 16h): consulta de novo os processos que o DataJud recusou de manhã por sobrecarga. Não envia e-mail. */
function repescagemDataJud() {
  T0_ = Date.now();
  abas_();
  const P = PropertiesService.getScriptProperties();
  const pend = JSON.parse(P.getProperty('DATAJUD_PENDENTES') || '[]'); if (!pend.length) return;
  const sh = aba_('Processos'), procs = processos_().filter(p => pend.indexOf(p.numero) >= 0);
  const vistos = idsExistentes_(), novos = [], resta = [], fim = hoje_();
  procs.forEach((p, k) => {
    if (decorrido_() > 270000) { resta.push(p.numero); return; }
    if (k) Utilities.sleep(1500);
    try { djProcesso_(p, sh, fim, vistos, novos); } catch (e) { resta.push(p.numero); }
  });
  if (novos.length) aba_('Itens').getRange(aba_('Itens').getLastRow() + 1, 1, novos.length, 11)
    .setValues(novos.map(i => [i.id, i.tipo, i.fonte, i.numero, i.data, i.tribunal, i.orgao, i.titulo, String(i.texto || '').slice(0, 45000), i.link, new Date().toISOString()]));
  P.setProperty('DATAJUD_PENDENTES', JSON.stringify(resta));
  log_('repescagemDataJud', resta.length ? 'ainda com pendências' : 'ok', `${procs.length - resta.length} de ${procs.length} processo(s) consultado(s); ${novos.length} movimentação(ões) nova(s)` + (resta.length ? '; pendentes: ' + resta.join(', ') : ''));
}

// ===================== COMUNICAÇÃO COM O APP =====================
// O app lê as novidades (GET) e envia a lista de números de processos (POST).

// Respostas sempre legíveis: erros viram JSON, e com ?callback=fn a resposta vem como JSONP (para a página pública de cadastro,
// quando o navegador do celular bloqueia a leitura normal da resposta).
function doGet(e) {
  const p = (e && e.parameter) || {}; let t;
  try { t = doGet0_(e); } catch (x) { t = json_({ ok: false, erro: 'erro no robô: ' + (x && x.message || x) }); }
  if (p.callback && /^[\w$.]{1,40}$/.test(p.callback)) return ContentService.createTextOutput(p.callback + '(' + t.getContent() + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  return t;
}
function doPost(e) { try { return doPost0_(e); } catch (x) { return json_({ ok: false, erro: 'erro no robô: ' + (x && x.message || x) }); } }

function doGet0_(e) {
  const p = e.parameter || {};
  // página pública de cadastro: só com link válido. O código vai no parâmetro “cod” (o Google bloqueia pedidos com um parâmetro chamado “c”).
  if (p.acao === 'cadInfo') return json_(cadInfo_(p.cod || p.c));
  if (!tokenOk_(p.token)) return json_({ ok: false, erro: 'código de acesso inválido' });
  if (p.acao === 'ping') return json_({ ok: true, versao: 6 });
  if (p.acao === 'cadRecebidos') return json_({ ok: true, cadastros: cadLista_() });
  const desde = p.desde || '';
  const sh = aba_('Itens'), n = sh.getLastRow() - 1;
  const itens = n > 0 ? sh.getRange(2, 1, n, 11).getValues()
    .filter(r => r[0] && String(r[10]) > desde)
    .map(r => ({ id: r[0], tipo: r[1], fonte: r[2], numero: r[3], data: fmtData_(r[4]), tribunal: r[5], orgao: r[6], titulo: r[7], texto: r[8], link: r[9], capturadoEm: String(r[10]) })) : [];
  return json_({ ok: true, itens, ultimaExecucao: PropertiesService.getScriptProperties().getProperty('ULTIMA_EXECUCAO') || '' });
}

function doPost0_(e) {
  let b = {};
  try { b = JSON.parse(e.postData.contents); } catch (x) { return json_({ ok: false, erro: 'JSON inválido' }); }
  if (b.cadEnviar) return json_(cadEnviar_(b.cadEnviar)); // página pública de cadastro: só com link válido
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
  if (b.gcal) return json_({ ok: true, gcal: gcal_(b.gcal) });
  if (b.cadCfg) return json_(cadCfg_(b.cadCfg));
  if (b.cadConvite) return json_(cadConvite_(b.cadConvite));
  if (b.cadCancelar) return json_(cadMudar_(b.cadCancelar, { status: 'cancelado' }));
  if (b.cadImportado) return json_(cadImportado_(b.cadImportado));
  if (b.arqCfg) return json_(arqCfg_(b.arqCfg));
  if (b.arqPasta) { const r = arqPasta_(b.arqPasta); return json_({ ok: true, pasta: { id: r.id, url: r.url, caminho: r.caminho } }); }
  if (b.arqEnviar) return json_(arqEnviar_(b.arqEnviar));
  if (b.arqMover) return json_(arqMover_(b.arqMover));
  if (Array.isArray(b.emails)) return json_(emailsProgramar_(b.emails));
  return json_({ ok: true });
}

// ===================== GOOGLE AGENDA (compromissos enviados pelo app) =====================
function gcalAgenda_(nome) {
  if (!nome) return CalendarApp.getDefaultCalendar();
  const l = CalendarApp.getCalendarsByName(nome);
  return l.length ? l[0] : CalendarApp.createCalendar(nome, { timeZone: CFG.TZ });
}
const gcalHora_ = (d, h) => Utilities.parseDate(d + ' ' + (h || '12:00'), CFG.TZ, 'yyyy-MM-dd HH:mm');
function gcalAchar_(cal, id, gcalId, data) {
  if (gcalId) { try { const ev = cal.getEventById(gcalId); if (ev) return ev; } catch (e) {} }
  if (id && data) { // procura pela etiqueta do app (evita duplicar quando o identificador se perdeu)
    try { return cal.getEventsForDay(gcalHora_(data)).find(ev => ev.getTag('meuEscritorio') === id) || null; } catch (e) {}
  }
  return null;
}
function gcal_(g) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (g.testar) { try { return { agenda: gcalAgenda_(g.agenda || '').getName() }; } catch (e) { return { erro: String(e.message || e).slice(0, 200) }; } }
    return (g.ops || []).slice(0, 25).map(op => {
      try {
        if (op.acao === 'apagar') {
          const cal = gcalAgenda_(op.gcalCal || ''), ev = gcalAchar_(cal, op.id, op.gcalId, op.dataAnt);
          if (ev) ev.deleteEvent();
          return { id: op.id, ok: true };
        }
        const cal = gcalAgenda_(op.agenda || '');
        let ev = null;
        if ((op.gcalCal || '') !== (op.agenda || '') && op.gcalId) { // trocou de agenda: apaga da antiga
          try { const ant = gcalAchar_(gcalAgenda_(op.gcalCal || ''), op.id, op.gcalId, op.dataAnt); if (ant) ant.deleteEvent(); } catch (e) {}
        } else ev = gcalAchar_(cal, op.id, op.gcalId, op.dataAnt || op.data);
        const diaTodo = !op.hora, fim = op.dataFim && op.dataFim >= op.data ? op.dataFim : op.data;
        const ini = diaTodo ? gcalHora_(op.data) : gcalHora_(op.data, op.hora);
        const fimD = diaTodo ? gcalHora_(fim) : gcalHora_(fim, op.horaFim);
        const fimExcl = new Date(fimD.getTime() + 864e5); // dia inteiro: a data final é exclusiva
        const opc = { description: op.desc || '', location: op.local || '' };
        if (!ev) ev = diaTodo ? (fim === op.data ? cal.createAllDayEvent(op.titulo, ini, opc) : cal.createAllDayEvent(op.titulo, ini, fimExcl, opc))
                              : cal.createEvent(op.titulo, ini, fimD > ini ? fimD : new Date(ini.getTime() + 3600e3), opc);
        else {
          ev.setTitle(op.titulo); ev.setDescription(op.desc || ''); ev.setLocation(op.local || '');
          if (diaTodo) { if (fim === op.data) ev.setAllDayDate(ini); else ev.setAllDayDates(ini, fimExcl); }
          else ev.setTime(ini, fimD > ini ? fimD : new Date(ini.getTime() + 3600e3));
        }
        if (op.cor) ev.setColor(String(op.cor));
        if (Array.isArray(op.lembretes)) { ev.removeAllReminders(); op.lembretes.slice(0, 5).forEach(m => ev.addPopupReminder(Number(m))); }
        else ev.resetRemindersToDefault();
        ev.setTag('meuEscritorio', op.id);
        return { id: op.id, ok: true, gcalId: ev.getId(), gcalCal: op.agenda || '' };
      } catch (e) { return { id: op.id, ok: false, erro: String(e.message || e).slice(0, 200) }; }
    });
  } finally { lock.releaseLock(); }
}

// ===================== CADASTRO DE CLIENTES PELO LINK =====================
// Aba “Cadastros”: um link por linha. A página pública só consegue (1) saber se o link vale e (2) enviar o cadastro uma vez.
const CAD_COLS = ['link', 'nome', 'tipo', 'criado em', 'expira em', 'situação', 'recebido em', 'pasta', 'dados', 'arquivos'];
function cadAba_() { const s = aba_('Cadastros'); if (s.getLastRow() === 0) { s.appendRow(CAD_COLS); s.setFrozenRows(1); s.getRange(1, 1, 1, CAD_COLS.length).setFontWeight('bold'); s.getRange('A:H').setNumberFormat('@'); } return s; }
function cadLinha_(c) { if (!c || String(c).length < 16) return null; const s = cadAba_(), n = s.getLastRow() - 1; if (n < 1) return null;
  const v = s.getRange(2, 1, n, CAD_COLS.length).getValues(), i = v.findIndex(r => r[0] === c); return i < 0 ? null : { n: i + 2, r: v[i] }; }
const cadWhats_ = () => PropertiesService.getScriptProperties().getProperty('CAD_WHATS') || '';
function cadInfo_(c) {
  const L = cadLinha_(c), w = cadWhats_(); if (!L) return { ok: false, motivo: 'invalido', whats: w };
  const st = L.r[5]; if (st === 'recebido' || st === 'importado') return { ok: false, motivo: 'usado', whats: w };
  if (st === 'cancelado') return { ok: false, motivo: 'cancelado', whats: w };
  if (String(L.r[4]) < new Date().toISOString()) return { ok: false, motivo: 'expirado', whats: w };
  return { ok: true, nome: L.r[1], tipo: L.r[2], whats: w };
}
function cadCfg_(g) {
  const P = PropertiesService.getScriptProperties(), m = String(g.pasta || '').match(/folders\/([\w-]{10,})/) || String(g.pasta || '').match(/^([\w-]{10,})$/);
  if (!m) return { ok: false, erro: 'cole o link da pasta do Google Drive (abra a pasta e copie o endereço)' };
  let nome; try { nome = DriveApp.getFolderById(m[1]).getName(); } catch (e) { return { ok: false, erro: 'não consegui abrir a pasta: ' + (/autoriz|permiss/i.test(e.message) ? 'rode “autorizarCadastro” no Apps Script e atualize a implantação' : e.message) }; }
  P.setProperty('CAD_PASTA', m[1]); if (g.whats != null) P.setProperty('CAD_WHATS', soDig_(g.whats)); cadAba_();
  return { ok: true, pasta: nome };
}
function cadConvite_(g) {
  if (!g.link || String(g.link).length < 16) return { ok: false, erro: 'link inválido' };
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try { if (!cadLinha_(g.link)) cadAba_().appendRow([g.link, String(g.nome || '').slice(0, 80), g.tipo === 'PJ' ? 'PJ' : 'PF', new Date().toISOString(), String(g.expira || ''), 'aguardando', '', '', '', '']); }
  finally { lock.releaseLock(); }
  return { ok: true };
}
function cadMudar_(c, o) { const L = cadLinha_(c); if (!L) return { ok: false, erro: 'link não encontrado' }; if (o.status) cadAba_().getRange(L.n, 6).setValue(o.status); return { ok: true }; }
function cadImportado_(g) { const L = cadLinha_(g.link); if (!L) return { ok: false, erro: 'link não encontrado' }; cadAba_().getRange(L.n, 6).setValue('importado');
  if (L.r[7]) { try { const f = DriveApp.getFolderById(String(L.r[7]).match(/folders\/([\w-]+)/)[1]);
    if (g.cliente && PropertiesService.getScriptProperties().getProperty('ARQ_ATIVOS')) { const cli = arqPasta_({ cliente: g.cliente, nome: g.nome || '' }); f.setName('Cadastro pelo link ' + hoje_()); f.moveTo(DriveApp.getFolderById(cli.id)); }
    else if (g.renomear) f.setName(String(g.renomear).slice(0, 120)); } catch (e) {} }
  return { ok: true }; }
function cadLista_() { const s = cadAba_(), n = s.getLastRow() - 1; if (n < 1) return [];
  return s.getRange(2, 1, n, CAD_COLS.length).getValues().filter(r => r[5] && r[5] !== 'aguardando').slice(-200).map(r => ({ link: r[0], status: r[5], recebidoEm: String(r[6] || ''), pasta: r[7], dados: (() => { try { return JSON.parse(r[8] || '{}'); } catch (e) { return {}; } })(), arquivos: (() => { try { return JSON.parse(r[9] || '[]'); } catch (e) { return []; } })() })); }
const CAD_CAMPOS = ['nome', 'cpf', 'rg', 'nascimento', 'estadoCivil', 'profissao', 'razaoSocial', 'cnpj', 'respNome', 'respCpf', 'celular', 'email', 'avisos', 'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'lgpd'];
function cadEnviar_(g) {
  const lock = LockService.getScriptLock(); lock.waitLock(25000);
  try {
    const info = cadInfo_(g.link); if (!info.ok) return { ok: false, motivo: info.motivo };
    const L = cadLinha_(g.link), P = PropertiesService.getScriptProperties(), pastaId = P.getProperty('CAD_PASTA');
    if (!pastaId) return { ok: false, erro: 'o escritório ainda não configurou a pasta de cadastros' };
    const d = {}; CAD_CAMPOS.forEach(k => { if (g.dados && g.dados[k] != null) d[k] = String(g.dados[k]).slice(0, 300); });
    if (!d.lgpd) return { ok: false, erro: 'é preciso autorizar o uso dos dados' };
    const quem = d.razaoSocial || d.nome || info.nome || 'Cliente', pasta = DriveApp.getFolderById(pastaId).createFolder(hoje_() + ' – ' + quem + ' (cadastro pelo link)');
    const arqs = []; let total = 0;
    (g.arquivos || []).slice(0, 12).forEach((a, i) => { try {
      const bytes = Utilities.base64Decode(String(a.base64 || '')); total += bytes.length; if (!bytes.length || total > 30e6) return;
      const tipo = /^(image\/(jpeg|png|webp|heic)|application\/pdf)$/.test(a.tipo) ? a.tipo : 'application/octet-stream';
      const nome = String(a.nome || ('documento-' + (i + 1))).replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
      const f = pasta.createFile(Utilities.newBlob(bytes, tipo, nome)); arqs.push({ nome, url: f.getUrl(), grupo: String(a.grupo || '').slice(0, 40) }); } catch (e) {} });
    const rot = { nome: 'Nome', cpf: 'CPF', rg: 'RG', nascimento: 'Nascimento', estadoCivil: 'Estado civil', profissao: 'Profissão', razaoSocial: 'Razão social', cnpj: 'CNPJ', respNome: 'Responsável', respCpf: 'CPF do responsável',
      celular: 'Celular / WhatsApp', email: 'E-mail', avisos: 'Prefere receber avisos por', cep: 'CEP', logradouro: 'Rua', numero: 'Número', complemento: 'Complemento', bairro: 'Bairro', cidade: 'Cidade', uf: 'UF' };
    pasta.createFile('Ficha de cadastro.txt', 'Cadastro enviado pelo link em ' + Utilities.formatDate(new Date(), CFG.TZ, 'dd/MM/yyyy HH:mm') + '\n\n' +
      Object.keys(rot).filter(k => d[k]).map(k => rot[k] + ': ' + d[k]).join('\n') + '\n\nAutorizou o uso dos dados (LGPD): sim' + (arqs.length ? '\nDocumentos: ' + arqs.map(a => a.nome).join(', ') : ''), MimeType.PLAIN_TEXT);
    cadAba_().getRange(L.n, 6, 1, 5).setValues([['recebido', new Date().toISOString(), pasta.getUrl(), JSON.stringify(d).slice(0, 45000), JSON.stringify(arqs).slice(0, 45000)]]);
    return { ok: true };
  } catch (e) { return { ok: false, erro: 'não foi possível salvar agora — tente de novo em instantes' }; }
  finally { lock.releaseLock(); }
}

// ===================== ARQUIVOS NO GOOGLE DRIVE (pastas dos clientes) =====================
// Pastas do cliente: “P0159 - Maria” dentro de Ativos ou Encerrados; do processo: “P0159.1 - …” (aceita também o padrão antigo “1. Ação … - número”).
const idPasta_ = u => (String(u || '').match(/folders\/([\w-]{10,})/) || String(u || '').match(/^([\w-]{10,})$/) || [])[1];
function arqCfg_(g) {
  const P = PropertiesService.getScriptProperties(), a = idPasta_(g.ativos), e = idPasta_(g.encerrados);
  if (!a || !e) return { ok: false, erro: 'cole os links das duas pastas (Ativos e Encerrados)' };
  try { const na = DriveApp.getFolderById(a).getName(), ne = DriveApp.getFolderById(e).getName(); P.setProperty('ARQ_ATIVOS', a); P.setProperty('ARQ_ENC', e); return { ok: true, ativos: na, encerrados: ne }; }
  catch (x) { return { ok: false, erro: 'não consegui abrir as pastas: ' + (/autoriz|permiss/i.test(x.message) ? 'rode “autorizarCadastro” no Apps Script e atualize a implantação' : x.message) }; }
}
const numPasta_ = s => { const m = String(s || '').match(/^\s*P?0*(\d+)/i); return m ? +m[1] : NaN; };
function achaFilha_(pai, teste) { const it = pai.getFolders(); while (it.hasNext()) { const f = it.next(); if (teste(f.getName())) return f; } return null; }
function pastaCliente_(cliente, nome, criar) {
  const P = PropertiesService.getScriptProperties(), raizA = DriveApp.getFolderById(P.getProperty('ARQ_ATIVOS')), raizE = DriveApp.getFolderById(P.getProperty('ARQ_ENC')), n = numPasta_(cliente);
  const ehDele = nm => numPasta_(nm) === n && !/^\s*P?\d+\.\d/i.test(nm);
  let f = achaFilha_(raizA, ehDele), onde = 'Ativos'; if (!f) { f = achaFilha_(raizE, ehDele); onde = 'Encerrados'; }
  if (!f && criar) { f = raizA.createFolder(cliente + (nome ? ' - ' + nome : '')); onde = 'Ativos'; }
  return f ? { f, onde: onde === 'Ativos' ? raizA.getName() : raizE.getName(), raizA, raizE } : null;
}
function arqPasta_(g) {
  if (!PropertiesService.getScriptProperties().getProperty('ARQ_ATIVOS')) throw new Error('as pastas Ativos/Encerrados ainda não foram configuradas no app');
  const c = pastaCliente_(g.cliente, g.nome, true); let alvo = c.f, caminho = c.onde + ' › ' + c.f.getName();
  if (g.proc) { const seq = (String(g.proc).match(/\.(\d+)$/) || [])[1], dig = soDig_(g.procNum);
    let sub = achaFilha_(c.f, nm => nm.toUpperCase().startsWith(String(g.proc).toUpperCase())) || (seq ? achaFilha_(c.f, nm => new RegExp('^\\s*' + seq + '\\s*[.\\-–)]').test(nm)) : null) || (dig.length === 20 ? achaFilha_(c.f, nm => soDig_(nm).includes(dig)) : null);
    if (!sub) sub = c.f.createFolder(g.proc + (g.procNome ? ' - ' + g.procNome : ''));
    alvo = sub; caminho += ' › ' + sub.getName(); }
  return { id: alvo.getId(), url: alvo.getUrl(), caminho };
}
function arqEnviar_(g) {
  const bytes = Utilities.base64Decode(String(g.base64 || '')); if (!bytes.length) return { ok: false, erro: 'arquivo vazio' }; if (bytes.length > 25e6) return { ok: false, erro: 'arquivo grande demais (máx. ~20 MB)' };
  const nome = String(g.nome || 'arquivo').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120), f = DriveApp.getFolderById(g.pastaId).createFile(Utilities.newBlob(bytes, g.tipo || 'application/octet-stream', nome));
  return { ok: true, arquivo: { id: f.getId(), url: f.getUrl(), nome } };
}
function arqMover_(g) {
  const c = pastaCliente_(g.cliente, g.nome, false); if (!c) return { ok: true, nada: true };
  const destino = g.destino === 'enc' ? c.raizE : c.raizA; if (c.f.getParents().hasNext() && c.f.getParents().next().getId() === destino.getId()) return { ok: true };
  c.f.moveTo(destino); return { ok: true, movida: destino.getName() };
}

// ===================== E-MAILS DE LEMBRETE (enviados pela conta Google deste robô) =====================
// Aba “Emails”: o app manda a lista de e-mails programados; o robô envia na hora certa (gatilho de 15 min — rode “ativarLembretes”).
const EM_COLS = ['id', 'quando', 'para', 'assunto', 'corpo', 'situação', 'enviado em'];
function emAba_() { const s = aba_('Emails'); if (s.getLastRow() === 0) { s.appendRow(EM_COLS); s.setFrozenRows(1); s.getRange(1, 1, 1, EM_COLS.length).setFontWeight('bold'); s.getRange('A:G').setNumberFormat('@'); } return s; }
function emailsProgramar_(lista) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    const s = emAba_(), n = s.getLastRow() - 1, v = n > 0 ? s.getRange(2, 1, n, EM_COLS.length).getValues() : [], novos = {}, enviados = [];
    lista.slice(0, 500).forEach(e => { if (e && e.id && /@/.test(e.para || '')) novos[e.id] = e; });
    v.forEach((r, i) => { const e = novos[r[0]];
      if (r[5] === 'enviado') { enviados.push(r[0]); delete novos[r[0]]; return; }
      if (r[5] !== 'pendente') return;
      if (!e) s.getRange(i + 2, 6).setValue('cancelado');
      else { s.getRange(i + 2, 2, 1, 4).setValues([[e.quando, e.para, String(e.assunto).slice(0, 200), String(e.corpo).slice(0, 20000)]]); delete novos[r[0]]; } });
    const add = Object.values(novos).map(e => [e.id, e.quando, e.para, String(e.assunto).slice(0, 200), String(e.corpo).slice(0, 20000), 'pendente', '']);
    if (add.length) s.getRange(s.getLastRow() + 1, 1, add.length, EM_COLS.length).setValues(add);
    return { ok: true, emailsEnviados: enviados, cota: MailApp.getRemainingDailyQuota() };
  } finally { lock.releaseLock(); }
}
function enviarLembretes() {
  const lock = LockService.getScriptLock(); if (!lock.tryLock(10000)) return;
  try {
    const s = emAba_(), n = s.getLastRow() - 1; if (n < 1) return; const v = s.getRange(2, 1, n, EM_COLS.length).getValues(), agora = new Date().toISOString(), velho = new Date(Date.now() - 2 * 864e5).toISOString();
    const nome = PropertiesService.getScriptProperties().getProperty('EMAIL_NOME') || 'Guilherme Garcia Advogado';
    v.forEach((r, i) => { if (r[5] !== 'pendente' || String(r[1]) > agora) return;
      if (String(r[1]) < velho) { s.getRange(i + 2, 6).setValue('expirado'); return; }
      if (MailApp.getRemainingDailyQuota() < 1) return;
      try { MailApp.sendEmail({ to: r[2], subject: r[3], body: r[4], name: nome }); s.getRange(i + 2, 6, 1, 2).setValues([['enviado', new Date().toISOString()]]); }
      catch (e) { s.getRange(i + 2, 6).setValue('erro: ' + String(e.message).slice(0, 80)); } });
  } finally { lock.releaseLock(); }
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
// Tribunais superiores guardam no DataJud, com o MESMO número CNJ, a fase recursal: TST (recurso de revista) para a Justiça
// do Trabalho; STJ (recurso especial) para a Justiça Estadual e Federal.
function aliasesSuperiores_(num) {
  const d = soDig_(num); if (d.length !== 20) return [];
  const j = d[13], tr = Number(d.slice(14, 16));
  if (j === '5' && tr !== 0) return ['api_publica_tst'];
  if (j === '8' || j === '4') return ['api_publica_stj'];
  return [];
}
function datajudBuscar_(num) {
  const alias = aliasDoNumero_(num); if (!alias) return null;
  const key = PropertiesService.getScriptProperties().getProperty('DATAJUD_KEY') || DATAJUD_KEY_PADRAO;
  const consulta = a => { const r = buscar_(DATAJUD_URL + a + '/_search', {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'APIKey ' + key },
      payload: JSON.stringify({ query: { match: { numeroProcesso: soDig_(num) } }, size: 10 }),
    }); return (r.json.hits && r.json.hits.hits) || []; };
  const hits = consulta(alias).map(h => ({ h, a: alias }));
  aliasesSuperiores_(num).forEach(a => { Utilities.sleep(300); consulta(a).forEach(h => hits.push({ h, a })); });
  if (!hits.length) return { alias, encontrado: false, movimentos: [] };
  const movs = [];
  let atualizadoEm = '';
  hits.forEach(({ h, a }) => { const s = h._source || {}; if ((s.dataHoraUltimaAtualizacao || '') > atualizadoEm) atualizadoEm = s.dataHoraUltimaAtualizacao;
    const sup = a !== alias ? a.replace('api_publica_', '').toUpperCase() : '';
    (s.movimentos || []).forEach(m => movs.push({ sup,
      data: String(m.dataHora || ''), codigo: m.codigo || (m.movimentoNacional && m.movimentoNacional.codigoNacional) || (m.movimentoLocal && m.movimentoLocal.codigoMovimento) || '',
      titulo: m.nome || (m.movimentoNacional && m.movimentoNacional.nome) || (m.movimentoLocal && m.movimentoLocal.nome) || nomeMov_(m),
      complemento: (m.complementosTabelados || []).map(c => [c.nome, c.descricao].filter(Boolean).join(': ')).join('; '),
      orgao: [sup, (m.orgaoJulgador && m.orgaoJulgador.nome) || (s.orgaoJulgador && s.orgaoJulgador.nome) || ''].filter(Boolean).join(' — '),
    })); });
  movs.sort((a, b) => b.data.localeCompare(a.data));
  const uniq = movs.filter((m, i) => !i || m.data + m.codigo + m.sup !== movs[i - 1].data + movs[i - 1].codigo + movs[i - 1].sup);
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
  const hist = movs.filter(i => /histórico/.test(i.fonte)), movsN = movs.filter(i => !/histórico/.test(i.fonte));
  if (hist.length) { const np = {}; hist.forEach(i => np[i.numero] = (np[i.numero] || 0) + 1);
    h += `<p style="background:#e7eff8;border-radius:8px;padding:8px 10px">📚 <b>Carga inicial do histórico (DataJud):</b> ${hist.length} movimentação(ões) em ${Object.keys(np).length} processo(s) — ${Object.keys(np).map(n => n + ' (' + np[n] + ')').join(', ')}. Confira e confirme no app (⚖️ Movimentações).</p>`; }
  if (movsN.length) {
    const lista = movsN.slice(0, 40);
    h += `<h3 style="margin:16px 0 8px">⚖️ Movimentações (DataJud) — confirme no app para virarem andamento</h3><table style="border-collapse:collapse;font-size:13px">`;
    lista.sort((a, b) => (a.numero + a.data).localeCompare(b.numero + b.data)).forEach(i => h += `<tr><td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:nowrap">${br_(i.data)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;color:#6b7385;white-space:nowrap">${e(i.fonte)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee;white-space:nowrap">${e(i.numero)}</td><td style="padding:4px 8px;border-bottom:1px solid #eee"><b>${e(i.titulo)}</b>${i.texto ? ' — ' + e(i.texto) : ''}</td></tr>`);
    h += `</table>` + (movsN.length > lista.length ? `<p style="font-size:12px;color:#6b7385">… e mais ${movsN.length - lista.length} no app.</p>` : '');
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
    Utilities.sleep(c === 429 || c >= 500 ? [10000, 30000, 0][t] : 1500 * (t + 1));
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
