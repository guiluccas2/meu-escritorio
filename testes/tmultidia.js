// Compromisso de vários dias e prazo fatal: o reagendamento não empurra o período; aparece em todos os dias (Agenda do dia, calendário, quadro HOJE);
// barra única no calendário da aba Agenda; prazo fatal em qualquer tipo (fica fixo no reagendamento, aparece no dia e vai à Google Agenda como 2º evento);
// 🖨️ Pauta do dia (PDF/Excel/Word); cabe em 390 px
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});const ops=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal&&bd.gcal.ops){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>({id:o.id,ok:true,gcalId:'g_'+o.id,gcalCal:o.agenda||''}))};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const url='file://'+path.resolve(__dirname,'..','index.html'),errs=[];
const abrir=async(dia,vw)=>{const p=await ctx.newPage();if(vw)await p.setViewportSize(vw);p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());await p.clock.setFixedTime(new Date(dia+'T09:00:00'));await p.goto(url);await p.waitForTimeout(700);return p;};
// 26/11: cadastra a tarefa de vários dias e uma tarefa com dia de trabalho + prazo fatal
let p=await abrir('2026-11-26');
await p.evaluate(()=>{const c=upsert('pessoas',{nome:'Maria Cliente',tipo:'Cliente',pasta:'P0001'});
  upsert('prazos',{titulo:'Elaborar ação trabalhista',tipo:'Tarefa',data:'2026-11-27',dataFim:'2026-12-04',diaInteiro:true,situacao:'Pendente',concluido:false,pessoaId:c.id});
  upsert('prazos',{titulo:'Redigir recurso',tipo:'Tarefa',data:'2026-11-27',dataFim:'2026-11-27',dataFatal:'2026-12-04',situacao:'Pendente',concluido:false,pessoaId:c.id});save();});
await p.waitForTimeout(400);
// formulário: prazo fatal aparece para Tarefa e some para Audiência
const fld=await p.evaluate(async()=>{formPrazo({tipo:'Tarefa'});await new Promise(r=>setTimeout(r,200));const f=mForm,vis=()=>f.elements.dataFatal.closest('.fld').style.display!=='none';const a=vis();
  f.elements.tipo.value='Audiência';f.elements.tipo.dispatchEvent(new Event('change'));const b=vis();closeModal();return {tarefa:a,aud:b};});
if(!fld.tarefa||fld.aud)ERR.push('campo prazo fatal: '+JSON.stringify(fld));
await p.close();
// 28/11 (sábado): o de vários dias NÃO muda; o de um dia muda só o dia de trabalho (o fatal fica)
p=await abrir('2026-11-28');
const r28=await p.evaluate(()=>{const a=db.prazos.find(x=>x.titulo==='Elaborar ação trabalhista'),b=db.prazos.find(x=>x.titulo==='Redigir recurso');go('#/painel');
  const ag=document.querySelector('.card.agenda')?.textContent||'',hoje=document.querySelector('.hojeBox')?.textContent.replace(/\s+/g,' ')||'',
    li=[...document.querySelectorAll('#view .li')].find(l=>l.textContent.includes('Elaborar ação'))?.textContent.replace(/\s+/g,' ')||'';
  return {a:[a.data,a.dataFim,a.reagendamentos||0,!!atrasado(a)],b:[b.data,b.dataFatal],ag,hoje,li,
    fat:eventosDia('2026-12-04').map(e=>e.titulo),dia4:eventosDia('2026-12-04').some(e=>e.titulo==='Elaborar ação trabalhista')};});
console.log('28/11:',JSON.stringify({a:r28.a,b:r28.b,li:r28.li.slice(0,160),fat:r28.fat}));
if(r28.a.join()!=='2026-11-27,2026-12-04,0,false')ERR.push('vários dias foi reagendado/atrasado: '+r28.a);
if(r28.b[0]!=='2026-11-30'||r28.b[1]!=='2026-12-04')ERR.push('dia de trabalho / fatal no reagendamento: '+r28.b);
if(!/Elaborar ação trabalhista/.test(r28.ag)||!/dia 2 de 8/.test(r28.ag))ERR.push('agenda do dia sem a tarefa de vários dias');
if(!/Reuniões \/ compromissos ?1/.test(r28.hoje))ERR.push('quadro HOJE não conta a tarefa: '+r28.hoje);
if(!/em andamento · dia 2 de 8 · termina/.test(r28.li))ERR.push('lista sem “em andamento”: '+r28.li);
if(!r28.fat.includes('⚠️ Prazo fatal: Redigir recurso'))ERR.push('dia do prazo fatal sem o aviso');
if(!r28.dia4)ERR.push('último dia sem a tarefa');
// calendário da aba Agenda: barra única (semana e mês), mesma altura nos dias
const cal=await p.evaluate(async()=>{agCalVis='semana';agSem='2026-11-29';F.ag.vis='cal';go('#/agenda');await new Promise(r=>setTimeout(r,300));
  const bs=[...document.querySelectorAll('.bigCal .calBar')].filter(x=>x.title.startsWith('Elaborar'));
  const sem={n:bs.length,ini:bs.filter(x=>x.classList.contains('bIni')).length,fim:bs.filter(x=>x.classList.contains('bFim')).length,tops:[...new Set(bs.map(x=>Math.round(x.getBoundingClientRect().top)))].length,
    txt:bs[0]?.textContent,vazio:bs.slice(1).every(x=>x.textContent.trim()===''),fatal:[...document.querySelectorAll('.calFatal')].map(x=>x.textContent)};
  agCalVis='mes';agMes='2026-11';render();await new Promise(r=>setTimeout(r,300));
  const bm=[...document.querySelectorAll('.bigCal .calBar')].filter(x=>x.title.startsWith('Elaborar'));
  return {sem,mes:{n:bm.length,ini:bm.filter(x=>x.classList.contains('bIni')).length}};});
console.log('calendário:',JSON.stringify(cal));
if(cal.sem.n!==6||cal.sem.ini!==1||cal.sem.fim!==1||cal.sem.tops!==1||!/\(cont\.\)/.test(cal.sem.txt||'')||!cal.sem.vazio)ERR.push('barra na semana');
if(!cal.sem.fatal.some(x=>/fatal: Redigir recurso/.test(x)))ERR.push('calendário sem o chip do prazo fatal');
if(cal.mes.n!==8||cal.mes.ini!==2)ERR.push('barra no mês (2 trechos: 27–28 e 29/11–04/12)');
// pauta do dia
const pauta=await p.evaluate(()=>{calSel='2026-12-04';const f=REL_FONTES.pautaDia();return {t:f.titulo,s:f.secoes.map(s=>s.titulo+':'+s.linhas.map(l=>l.titulo||l.q).join('|')),html:relDoc(f).length};});
console.log('pauta:',JSON.stringify(pauta));
if(!/Pauta do dia — .*4 de dezembro/.test(pauta.t)||!/Compromissos.*Elaborar ação trabalhista/.test(pauta.s[0])||!/Prazos fatais.*Redigir recurso/.test(pauta.s[1]))ERR.push('pauta do dia');
// Google Agenda: o prazo fatal vai como 2º evento (vermelho, dia inteiro) e é apagado junto
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',agenda:'Escritório',ativadoEm:'2000-01-01'};const b=db.prazos.find(x=>x.titulo==='Redigir recurso');b.gcalPedido=true;save();});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(600);
const g1=ops.filter(o=>o.acao==='salvar').map(o=>({id:o.id.slice(-6),t:o.titulo.slice(0,16),d:o.data,h:o.hora,cor:o.cor}));console.log('gcal:',JSON.stringify(g1));
if(g1.length!==2||!g1.some(o=>o.id==='~fatal'&&o.d==='2026-12-04'&&o.cor==='11'&&/PRAZO FATAL/.test(o.t)))ERR.push('2º evento do prazo fatal');
const st=await p.evaluate(()=>{const b=db.prazos.find(x=>x.titulo==='Redigir recurso');return [!!b.gcalId,!!b.gcalFId,Object.keys(db.meta.gcalMapa||{}).length];});if(st.join()!=='true,true,2')ERR.push('estado gcal: '+st);
ops.length=0;await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);if(ops.length)ERR.push('reenviou sem mudança: '+ops.length);
await p.evaluate(()=>{const b=db.prazos.find(x=>x.titulo==='Redigir recurso');upsert('prazos',{id:b.id,dataFatal:''});});ops.length=0;await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(400);
if(!ops.some(o=>o.acao==='apagar'&&o.id.endsWith('~fatal'))||ops.some(o=>o.acao==='apagar'&&!o.id.endsWith('~fatal')))ERR.push('tirar o fatal deveria apagar só o 2º evento: '+JSON.stringify(ops.map(o=>o.acao+o.id.slice(-6))));
await p.close();
// 05/12: passou do último dia → atrasado, sem mudar a data
p=await abrir('2026-12-05');
const r5=await p.evaluate(()=>{const a=db.prazos.find(x=>x.titulo==='Elaborar ação trabalhista');return [a.data,a.dataFim,!!atrasado(a)];});if(r5.join()!=='2026-11-27,2026-12-04,true')ERR.push('depois do último dia: '+r5);
await p.close();
// celular: Agenda do dia com o botão da pauta cabe em 390 px
p=await abrir('2026-11-28',{width:390,height:844});
const larg=await p.evaluate(()=>{go('#/painel');return {doc:document.documentElement.scrollWidth,btn:!!document.querySelector('.card.agenda [data-k="pautaDia"]')};});
if(larg.doc>390||!larg.btn)ERR.push('celular: '+JSON.stringify(larg));
await p.close();
if(errs.length)ERR.push('erros: '+errs.join(' | '));
console.log('ERROS',JSON.stringify(ERR));await b.close();})();
