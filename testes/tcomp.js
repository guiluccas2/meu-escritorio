const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
const log=[];
async function robo(route){const req=route.request();let out={ok:true};
  if(req.method()==='POST'){const b=JSON.parse(req.postData()||'{}');
    if(b.arqCfg) out={ok:true,ativos:'Ativos',encerrados:'Encerrados'};
    else if(b.arqPasta){log.push('pasta:'+b.arqPasta.cliente+'|'+b.arqPasta.proc);out={ok:true,pasta:{id:'F1',url:'https://drive.google.com/drive/folders/F1',caminho:'Ativos › '+b.arqPasta.cliente+' - '+b.arqPasta.nome+(b.arqPasta.proc?' › '+b.arqPasta.proc+' - '+b.arqPasta.procNome:'')}};}
    else if(b.arqEnviar){log.push('arquivo:'+b.arqEnviar.nome);out={ok:true,arquivo:{id:'A1',url:'https://drive.google.com/file/d/A1',nome:b.arqEnviar.nome}};}
    else if(b.arqMover){log.push('mover:'+b.arqMover.cliente+'→'+b.arqMover.destino);}
    else if(b.emails){log.push('emails:'+b.emails.length+':'+(b.emails[0]?.para||''));out={ok:true,emailsEnviados:[]};}
    else if(b.gcal) out={ok:true,gcal:(b.gcal.ops||[]).map(o=>({id:o.id,ok:true,gcalId:'ev'+o.id.slice(0,4)}))};
  }
  await route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://comunicaapi.pje.jus.br/**',r=>r.abort());await ctx.route('https://script.google.com/**',robo);
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));let dlg=[];p.on('dialog',d=>{dlg.push(d.message().slice(0,60));d.type()==='prompt'?d.accept('Psicológica'):d.accept();});
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...(db.meta.monitor||{}),roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok',ativo:false};
  const pr=MP.p1;const t1=upsert('pessoas',{nome:'Carlos Lima',tipo:'Testemunha',telefone:'(19) 98888-1111',email:'carlos@x.com'});pr.testemunhas=[{id:'tt1',pessoaId:t1.id}];
  const ed=byId('pessoas',pr.clienteId);ed.email='eduardo@x.com';upsert('conversas',{pessoaId:ed.id,processoId:pr.id,dataHora:'2026-11-10T10:00',assunto:'Cliente perguntou das testemunhas',relato:'x'});save();go('#/agenda');});
await p.waitForTimeout(400);
console.log('menu:', await p.evaluate(()=>document.querySelector('#nav a[data-v=agenda]').textContent.trim()), '| h1:', await p.evaluate(()=>document.querySelector('#view h1').textContent.split('🖨')[0].trim()));
// configurar pastas
await p.evaluate(()=>formArqCfg());await p.fill('[name=ativos]','https://drive.google.com/drive/folders/AAAAAAAAAAAA');await p.fill('[name=encerrados]','https://drive.google.com/drive/folders/BBBBBBBBBBBB');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
console.log('pastas:', await p.evaluate(()=>JSON.stringify(arqCfg())));
// novo compromisso
await p.evaluate(()=>A.newPrazo({}));await p.waitForTimeout(300);
console.log('título:', await p.textContent('#mTitle'), '| seções:', await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo')].map(d=>(d.open?'▾':'▸')+d.querySelector('summary').textContent.trim().split(' ').slice(0,2).join(' ')).join(' | ')));
console.log('rodapé:', await p.evaluate(()=>[...document.querySelectorAll('#mForm .mfoot button')].map(b=>b.textContent).join(' · ')));
console.log('subtipos prazo:', await p.evaluate(()=>[...mForm.elements.subtipo.options].length), '| lembretes iniciais:', await p.evaluate(()=>mForm._lembs?.length ?? document.querySelectorAll('#lbLista .lb').length));
await p.selectOption('[name=tipo]','Audiência');console.log('subtipos audiência:', await p.evaluate(()=>[...mForm.elements.subtipo.options].map(o=>o.textContent).slice(1,4).join(', ')), '| lembretes modelo:', await p.evaluate(()=>document.querySelectorAll('#lbLista .lb').length));
await p.selectOption('[name=subtipo]','Instrução e julgamento');
await p.fill('[name=titulo]','Audiência de instrução — Eduardo');
const d7=await p.evaluate(()=>addDays(today(),7));await p.fill('[name=data]',d7);await p.fill('[name=hora]','14:00');
await p.selectOption('[name=processoId]',await p.evaluate(()=>MP.p1.id));await p.dispatchEvent('[name=processoId]','change');await p.waitForTimeout(200);
console.log('lembretes texto:', (await p.innerText('#lbLista')).split('\n').filter(x=>/—/.test(x)).slice(0,5).join(' | '));
await p.click('[data-tg=c2]');
await p.click('#vcConvAdd');await p.waitForTimeout(100);await p.click('#vcPick .vcPickL button');console.log('conversa vinculada:', await p.evaluate(()=>document.querySelector('#vcConv').textContent.trim().slice(0,60)));
// arquivos
await p.click('#gArq summary');await p.waitForTimeout(500);console.log('pasta destino:', await p.textContent('#arqDest'));
await p.setInputFiles('#arqIn',{name:'ata.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 teste')});await p.waitForTimeout(500);console.log('arquivo:', await p.evaluate(()=>document.querySelector('#arqLista').textContent.trim()), log.slice(-2));
await p.screenshot({path:SS+'cp-form.png',fullPage:false});
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(500);
console.log('após salvar e continuar:', await p.textContent('#mTitle'));
await p.screenshot({path:SS+'cp-passos.png'});
const id=await p.evaluate(()=>db.prazos.find(x=>x.titulo==='Audiência de instrução — Eduardo').id);
console.log('salvo:', await p.evaluate(id=>{const x=byId('prazos',id);return JSON.stringify({sub:x.subtipo,tags:x.tags,conv:x.conversas.length,lemb:x.lembretes.length,arq:x.arquivos.length,rel:x.relacionados.length});},id));
console.log('tarefas criadas:', await p.evaluate(id=>db.prazos.filter(x=>x.lembDe?.pai===id).map(x=>x.titulo+' '+fmtD(x.data)+' rel:'+(x.relacionados||[]).includes(id)).join(' | '),id));
// próximos passos: google com ajuste
await p.fill('#ppTit','Audiência ★ Eduardo');await p.selectOption('#ppCor','3');await p.click('#ppGcal');await p.waitForTimeout(200);
console.log('override:', await p.evaluate(id=>JSON.stringify(byId('prazos',id).gcalOver),id), '| evento:', await p.evaluate(id=>{const e=gcalEvento(byId('prazos',id));return e.titulo+' cor '+e.cor;},id));
await p.click('#ppVolta');await p.waitForTimeout(200);console.log('voltou:', await p.textContent('#mTitle'));
// lembrete whats de hoje (7 dias antes = hoje)
await p.click('#mCancel');await p.evaluate(()=>go('#/agenda'));await p.waitForTimeout(300);
console.log('card lembretes:', await p.evaluate(()=>(document.querySelector('#view .card')?.innerText||'').split('\n').slice(0,2).join(' | ')));
await p.screenshot({path:SS+'cp-agenda.png'});
const [pg]=await Promise.all([ctx.waitForEvent('page'),p.click('[data-act=lembEnviar]')]);console.log('whats url:', decodeURIComponent(pg.url()).slice(0,90));await pg.close();
console.log('marcado enviado:', await p.evaluate(id=>Object.keys(byId('prazos',id).lembretes.find(l=>l.tipo==='whats').enviados||{}).length,id));
// e-mails
await p.evaluate(()=>emailsSincronizar(true));await p.waitForTimeout(300);console.log('emails robô:', log.filter(x=>x.startsWith('emails')).pop());
// salvar e criar novo
await p.evaluate(id=>formPrazo(byId('prazos',id)),id);await p.click('#fpNovo');await p.waitForTimeout(400);
console.log('criar novo:', await p.textContent('#mTitle'), '| processo mantido:', await p.evaluate(()=>!!mForm.elements.processoId.value));
// recorrência
await p.selectOption('[name=tipo]','Tarefa');await p.fill('[name=titulo]','Postar no feed do Instagram');await p.fill('[name=data]',await p.evaluate(()=>today()));await p.selectOption('[name=processoId]','');
await p.click('#gRec summary');await p.check('#rcOn');await p.click('[data-rf=s]');
await p.evaluate(()=>{document.querySelectorAll('[data-rd]').forEach(c=>c.checked=['2','4'].includes(c.dataset.rd));document.querySelector('#rcFim').value='data';document.querySelector('#rcAte').value=addDays(today(),30);document.querySelector('#rcAte').dispatchEvent(new Event('input',{bubbles:true}));});
console.log('resumo rec:', await p.textContent('#rcResumo'));
await p.click('#fpFechar');await p.waitForTimeout(500);
console.log('série:', await p.evaluate(()=>db.prazos.filter(x=>x.titulo==='Postar no feed do Instagram').map(x=>parseD(x.data).getDay()).join(',')), '| modal fechado:', await p.evaluate(()=>modal.classList.contains('hidden')));
// editar ocorrência e aplicar às próximas
dlg=[];const oc=await p.evaluate(()=>db.prazos.filter(x=>x.titulo==='Postar no feed do Instagram').sort((a,b)=>a.data.localeCompare(b.data))[1].id);
await p.evaluate(id=>formPrazo(byId('prazos',id)),oc);await p.fill('[name=titulo]','Postar no feed (carrossel)');await p.click('#fpFechar');await p.waitForTimeout(400);
console.log('série editada:', dlg[0]||'', '|', await p.evaluate(()=>db.prazos.filter(x=>/Postar no feed/.test(x.titulo)).sort((a,b)=>a.data.localeCompare(b.data)).map(x=>x.titulo.includes('carrossel')?'C':'o').join('')));
// mover para encerrados
await p.evaluate(()=>{arqEstadoInicial();const c=MP.ed;db.processos.filter(x=>x.clienteId===c.id).forEach(x=>x.status='Encerrado');save();});await p.evaluate(()=>arqVerificar());await p.waitForTimeout(400);
console.log('mover:', log.filter(x=>x.startsWith('mover')).join(','));
// subtipo novo pelo ＋
await p.evaluate(()=>A.newPrazo({}));await p.selectOption('[name=tipo]','Perícia');
await p.click('[data-addopt=subtipo]');await p.waitForTimeout(200);console.log('subtipo novo:', await p.evaluate(()=>subtiposDe('Perícia').includes('Psicológica')&&!subtiposDe('Audiência').includes('Psicológica')));
await p.click('#mCancel');
// mobile
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await m.newPage();mp.on('pageerror',e=>errs.push('M '+e.message));
await mp.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await mp.evaluate(()=>A.newPrazo({}));await mp.waitForTimeout(300);
console.log('mobile overflow:', await mp.evaluate(()=>document.querySelector('.modal-box').scrollWidth>document.querySelector('.modal-box').clientWidth+2));await mp.screenshot({path:SS+'cp-mob.png'});
console.log('errs',errs);await b.close();})();
