// Audiência na Google Agenda: título “pasta - subtipo - cliente”, agenda “Audiências” com a cor padrão da agenda,
// local conforme presencial (endereço) ou online (link), descrição com partes, nº, ação, juízo, sala, plataforma, ID e senha
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:900}});const ops=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');if(bd.gcal&&bd.gcal.ops){bd.gcal.ops.forEach(o=>ops.push(o));out={ok:true,gcal:bd.gcal.ops.map(o=>({id:o.id,ok:true,gcalId:'g_'+o.id,gcalCal:o.agenda||''}))};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
// configuração antiga (salva antes desta versão): Audiência vermelha, sem agenda por tipo
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};
  db.meta.gcal={modo:'direto',agenda:'Escritório',ativadoEm:new Date(Date.now()-864e5).toISOString(),cores:{'Audiência':'11','Reunião':'7'},auto:{'Audiência':1}};
  const c=upsert('pessoas',{nome:'João Silva',tipo:'Cliente',pasta:'P0152'}),r=upsert('pessoas',{nome:'Empresa Ré Ltda',tipo:'Parte contrária'}),r2=upsert('pessoas',{nome:'Banco Réu S/A',tipo:'Parte contrária'});
  upsert('processos',{titulo:'Reclamação trabalhista',clienteId:c.id,seq:'1',status:'Ativo',posicao:'Reclamante',numero:'0010123-45.2026.5.15.0001',vara:'1ª Vara do Trabalho',comarca:'Bauru',tribunal:'TRT-15',advContrario:'Dr. Fulano',
    partes:[{pessoaId:c.id,polo:'ativo'},{pessoaId:r.id,polo:'passivo'},{pessoaId:r2.id,polo:'passivo'}]});save();});
const pid=await p.evaluate(()=>db.processos.find(x=>x.titulo==='Reclamação trabalhista').id);
const cfg=await p.evaluate(()=>{const c=gcalCfg();return {cor:c.cores['Audiência'],ag:c.agendaTipo['Audiência'],tit:c.tituloTipo['Audiência'],reun:c.cores['Reunião']};});
console.log('config migrada:',cfg);if(cfg.cor!==''||cfg.ag!=='Audiências'||cfg.reun!=='7')ERR.push('migração da configuração errada');
// formulário: campos de presencial × online
await p.evaluate(pid=>formPrazo({processoId:pid}),pid);await p.waitForTimeout(200);
const vis=async()=>p.evaluate(()=>Object.fromEntries(['modalidade','plataforma','local','sala','audLink','audId','audSenha'].map(n=>[n,mForm.elements[n].closest('.fld').style.display!=='none'])));
let v=await vis();console.log('prazo processual:',v);if(v.modalidade||v.audLink||!v.local)ERR.push('campos de audiência aparecem fora da audiência');
await p.selectOption('[name=tipo]','Audiência');await p.selectOption('[name=modalidade]','Online');v=await vis();console.log('online:',v);
if(!v.plataforma||!v.audLink||!v.audId||!v.audSenha||v.local||v.sala)ERR.push('campos do online errados');
const larg=await p.evaluate(()=>document.documentElement.scrollWidth);if(larg>390)ERR.push('formulário não cabe em 390 px: '+larg);
await p.selectOption('[name=subtipo]','Instrução');await p.fill('[name=titulo]','Audiência de instrução');
const d=await p.evaluate(()=>addDays(today(),10));await p.fill('[name=data]',d);await p.fill('[name=hora]','14:00');
await p.selectOption('[name=plataforma]','Zoom');await p.fill('[name=audLink]','https://zoom.us/j/123');await p.fill('[name=audId]','123 456 789');await p.fill('[name=audSenha]','abc123');
await p.evaluate(()=>{mForm._modo='fechar';});await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
await p.evaluate(()=>{const m=document.getElementById('modal');if(m&&m.classList.contains('open'))closeModal();});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(500);
const o=ops.find(x=>x.acao==='salvar');console.log('evento online:',o&&{titulo:o.titulo,agenda:o.agenda,cor:o.cor,local:o.local});console.log(o&&o.desc);
if(!o)ERR.push('audiência não foi enviada');else{
  if(o.titulo!=='P0152.1 - Instrução - João Silva')ERR.push('título errado: '+o.titulo);
  if(o.agenda!=='Audiências')ERR.push('agenda errada: '+o.agenda);if(o.cor!=='')ERR.push('cor deveria ser a padrão da agenda');
  if(o.local!=='https://zoom.us/j/123')ERR.push('local do online deveria ser o link');
  ['Cliente: João Silva','Partes contrárias: Empresa Ré Ltda, Banco Réu S/A','Processo nº: 0010123-45.2026.5.15.0001','Ação: Reclamação trabalhista','Juízo: 1ª Vara do Trabalho · Bauru · TRT-15','Modalidade: Online','Plataforma: Zoom','Link: https://zoom.us/j/123','ID: 123 456 789','Senha: abc123','Advogado da parte contrária: Dr. Fulano']
    .forEach(t=>{if(!o.desc.includes(t))ERR.push('descrição sem “'+t+'”');});}
// presencial: local = endereço, sala na descrição; subtipo vazio não deixa “ - - ”
ops.length=0;await p.evaluate(()=>{const x=db.prazos.find(y=>y.titulo==='Audiência de instrução');upsert('prazos',{id:x.id,modalidade:'Presencial',local:'Av. Getúlio Vargas, 21-40 — Bauru',sala:'Sala 3 — 2º andar',subtipo:''});});
await p.evaluate(()=>gcalSincronizar(true));await p.waitForTimeout(500);
const o2=ops.find(x=>x.acao==='salvar');console.log('evento presencial:',o2&&{titulo:o2.titulo,local:o2.local,mesmo:!!o2.gcalId});
if(!o2||o2.local!=='Av. Getúlio Vargas, 21-40 — Bauru'||!/Sala: Sala 3/.test(o2.desc)||/Senha/.test(o2.desc))ERR.push('presencial errado');
if(o2&&o2.titulo!=='P0152.1 - João Silva')ERR.push('título sem subtipo errado: '+(o2&&o2.titulo));
// outros tipos continuam com a agenda e o título gerais
const ev=await p.evaluate(pid=>{const x=upsert('prazos',{titulo:'Contestação',tipo:'Prazo processual',processoId:pid,data:addDays(today(),5)});return gcalEvento(x);},pid);
console.log('prazo:',ev.titulo,'·',ev.agenda);if(ev.titulo!=='Contestação'||ev.agenda!=='Escritório')ERR.push('outros tipos mudaram');
// mensagem ao cliente com {local} da audiência online
const msg=await p.evaluate(()=>{const x=db.prazos.find(y=>y.titulo==='Audiência de instrução');return lembMsg({...x,modalidade:'Online'},{msg:'{titulo}{local}'},'João');});
console.log('mensagem:',msg);if(!/videoconferência \(Zoom\): https:\/\/zoom\.us/.test(msg))ERR.push('mensagem do online sem o link');
// tela de configuração: agenda/título por tipo, cabe no celular e salva
await p.evaluate(()=>formGoogleAgenda());await p.waitForTimeout(200);
const row=await p.evaluate(()=>{const r=document.querySelector('.gcTp[data-tp="Audiência"]');return r&&{ag:r.querySelector('[data-tpag]').value,tit:r.querySelector('[data-tptit]').value,ex:r.querySelector('[data-tpex]').textContent};});
console.log('config audiência:',row);if(!row||row.ag!=='Audiências'||!/P0152\.1 - Instrução - João Silva/.test(row.ex))ERR.push('tela de configuração sem agenda/título da audiência');
const larg2=await p.evaluate(()=>document.documentElement.scrollWidth);if(larg2>390)ERR.push('configuração não cabe em 390 px: '+larg2);
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const salvo=await p.evaluate(()=>({v:db.meta.gcal.audV1,ag:db.meta.gcal.agendaTipo['Audiência'],cor:db.meta.gcal.cores['Audiência']}));console.log('salvo:',salvo);
if(salvo.v!==1||salvo.ag!=='Audiências'||salvo.cor!=='')ERR.push('configuração não salvou');
// renomear o tipo leva agenda e título juntos
await p.evaluate(()=>VINCULOS.renomear.forEach(fn=>fn('tipoPrazo','Audiência','Audiência judicial')));
const ren=await p.evaluate(()=>({ag:db.meta.gcal.agendaTipo['Audiência judicial'],tit:db.meta.gcal.tituloTipo['Audiência judicial']}));console.log('renomeado:',ren);
if(ren.ag!=='Audiências'||!ren.tit)ERR.push('renomear o tipo perdeu agenda/título');
console.log('ERROS',[...ERR,...errs]);await b.close();})();
