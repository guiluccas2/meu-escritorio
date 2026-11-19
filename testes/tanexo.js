// Atendimento: anexar arquivos → Google Drive (pasta do cliente › Atendimentos; lead → Leads › nome › Atendimentos), lista no histórico
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});const pedidos=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');
      if(bd.arqPasta){pedidos.push({pasta:bd.arqPasta});const a=bd.arqPasta;out={ok:true,pasta:{id:'F1',url:'https://drive.google.com/drive/folders/F1',caminho:a.lead?`Leads › ${a.lead} › ${a.sub}`:`Ativos › ${a.cliente} - ${a.nome} › ${a.sub||''}`}};}
      if(bd.arqEnviar){pedidos.push({envio:bd.arqEnviar.nome,pastaId:bd.arqEnviar.pastaId});out={ok:true,arquivo:{nome:bd.arqEnviar.nome,url:'https://drive.google.com/file/d/X/view'}};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};db.meta.arqCfg={ativos:'https://drive.google.com/drive/folders/A',encerrados:'https://drive.google.com/drive/folders/E'};setMonLocal({roboVersao:9});save();});
const cli=await p.evaluate(()=>{const c=db.pessoas.find(x=>x.pasta&&x.tipo==='Cliente');return {id:c.id,pasta:c.pasta,nome:c.nome};});
// 1) atendimento de cliente: arquivo vai para a pasta do cliente › Atendimentos
await p.evaluate(id=>formConv({pessoaId:id}),cli.id);await p.waitForTimeout(250);
await p.fill('[name=relato]','Cliente enviou os documentos pessoais.');
await p.click('#gArq summary');await p.waitForTimeout(400);
const dest=await p.textContent('#arqDest');console.log('destino:',dest);
await p.setInputFiles('#arqIn',{name:'RG e CPF.jpg',mimeType:'image/jpeg',buffer:Buffer.from('teste')});await p.waitForTimeout(600);
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
const conv=await p.evaluate(()=>{const c=db.conversas.find(x=>x.relato==='Cliente enviou os documentos pessoais.');return c&&c.arquivos;});
console.log('pedidos ao robô:',JSON.stringify(pedidos),'· arquivos no atendimento:',JSON.stringify(conv));
const pa=pedidos.find(x=>x.pasta)?.pasta;
if(!pa||pa.sub!=='Atendimentos'||pa.cliente!==cli.pasta||pa.proc)ERR.push('pasta do cliente › Atendimentos');
if(!pedidos.some(x=>x.envio==='RG e CPF.jpg'&&x.pastaId==='F1'))ERR.push('arquivo não enviado');
if(!conv||conv.length!==1||conv[0].nome!=='RG e CPF.jpg')ERR.push('arquivo não ficou no atendimento');
// aparece no histórico de atendimentos
await p.evaluate(()=>{go('#/conversas');render();});await p.waitForTimeout(300);
const hist=await p.evaluate(()=>[...document.querySelectorAll('.tl-arqs a')].map(a=>a.textContent+' '+a.href));console.log('no histórico:',hist);if(!hist.some(h=>/RG e CPF\.jpg/.test(h)))ERR.push('arquivo não aparece no histórico');
// editar o atendimento mantém os arquivos
await p.evaluate(()=>{const c=db.conversas.find(x=>x.relato==='Cliente enviou os documentos pessoais.');formConv(c);});await p.waitForTimeout(250);
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
if(await p.evaluate(()=>(db.conversas.find(x=>x.relato==='Cliente enviou os documentos pessoais.').arquivos||[]).length)!==1)ERR.push('editar perdeu os arquivos');
// 2) atendimento de lead: Leads › nome › Atendimentos
pedidos.length=0;
await p.evaluate(()=>{const l=upsert('leads',{nome:'Lead Exemplo',status:'Novo'});formConv({leadId:l.id});});await p.waitForTimeout(250);
await p.click('#gArq summary');await p.waitForTimeout(400);console.log('lead → destino:',await p.textContent('#arqDest'));
const pl=pedidos.find(x=>x.pasta)?.pasta;if(!pl||pl.lead!=='Lead Exemplo'||pl.sub!=='Atendimentos'||pl.cliente)ERR.push('pasta do lead: '+JSON.stringify(pl));
await p.click('#mCancel');
// 3) robô antigo: avisa para atualizar, não envia
pedidos.length=0;await p.evaluate(()=>setMonLocal({roboVersao:8}));
await p.evaluate(id=>formConv({pessoaId:id}),cli.id);await p.waitForTimeout(250);await p.click('#gArq summary');await p.waitForTimeout(300);
const av=await p.textContent('#arqDest');console.log('robô antigo:',av);if(!/versão nova do robô/.test(av)||pedidos.length)ERR.push('robô antigo');
await p.click('#mCancel');await p.evaluate(()=>setMonLocal({roboVersao:9}));
// 4) cliente sem número de pasta: explica
await p.evaluate(()=>{const c=upsert('pessoas',{nome:'Sem Pasta',tipo:'Cliente'});formConv({pessoaId:c.id});});await p.waitForTimeout(250);await p.click('#gArq summary');await p.waitForTimeout(300);
const sp=await p.textContent('#arqDest');console.log('sem pasta:',sp);if(!/número de pasta/.test(sp))ERR.push('cliente sem pasta');
await p.click('#mCancel');
// celular
await p.setViewportSize({width:390,height:844});await p.evaluate(id=>formConv({pessoaId:id}),cli.id);await p.waitForTimeout(250);await p.click('#gArq summary');await p.waitForTimeout(300);
const w=await p.evaluate(()=>document.documentElement.scrollWidth);if(w>390)ERR.push('celular: largura '+w);
console.log('ERROS',[...ERR,...errs]);await b.close();})();
