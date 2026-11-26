// 📷 Digitalizar: recorte automático (folha torta → cantos certos), filtros, PDF (página inteira e modo ID em tamanho real),
// destinos padrão (ficha → Drive do cliente/processo · barra do topo → baixar · editor de arquivos → anexar), OCR “em breve” e celular (390 px)
const {chromium,devices}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
const SAIDA=process.env.DIG_PDF||'';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000},acceptDownloads:true});const pedidos=[];
await ctx.route('**/*',async r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();
  if(u.startsWith('https://script.google.com/')){let out={ok:true};if(r.request().method()==='POST'){const bd=JSON.parse(r.request().postData()||'{}');
      if(bd.arqPasta){pedidos.push({pasta:bd.arqPasta});const a=bd.arqPasta;out={ok:true,pasta:{id:'F1',url:'https://drive.google.com/drive/folders/F1',caminho:`Ativos › ${a.cliente} - ${a.nome}${a.proc?' › '+a.proc:''}`}};}
      if(bd.arqEnviar){pedidos.push({envio:bd.arqEnviar.nome,pastaId:bd.arqEnviar.pastaId,tipo:bd.arqEnviar.tipo,ini:bd.arqEnviar.base64.slice(0,8)});out={ok:true,arquivo:{nome:bd.arqEnviar.nome,url:'https://drive.google.com/file/d/X/view'}};}}
    return r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(out)});}
  return r.abort();});
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.monitor={...db.meta.monitor,roboUrl:'https://script.google.com/macros/s/X/exec',roboToken:'tok'};db.meta.arqCfg={ativos:'https://drive.google.com/drive/folders/A',encerrados:'https://drive.google.com/drive/folders/E'};setMonLocal({roboVersao:9});save();});
// imagem de teste: folha (ou cartão) torta sobre um fundo, com linhas de “texto” e sombra
await p.evaluate(()=>{window.fotoTeste=(q,papel,fundo,fundo2='#555',W=1200,H=900)=>{const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,fundo);g.addColorStop(1,fundo2);x.fillStyle=g;x.fillRect(0,0,W,H);
  x.beginPath();q.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fillStyle=papel;x.fill();
  x.save();x.clip();const sg=x.createLinearGradient(0,0,W,0);sg.addColorStop(0,'rgba(0,0,0,.25)');sg.addColorStop(.5,'rgba(0,0,0,0)');x.fillStyle=sg;x.fillRect(0,0,W,H);
  x.fillStyle='#222';for(let i=0;i<12;i++){const t=.15+i*.06;const a=[q[0][0]+(q[3][0]-q[0][0])*t,q[0][1]+(q[3][1]-q[0][1])*t],bb=[q[1][0]+(q[2][0]-q[1][0])*t,q[1][1]+(q[2][1]-q[1][1])*t];
    x.beginPath();x.moveTo(a[0]+(bb[0]-a[0])*.12,a[1]+(bb[1]-a[1])*.12);x.lineTo(a[0]+(bb[0]-a[0])*.85,a[1]+(bb[1]-a[1])*.85);x.lineWidth=7;x.strokeStyle='#222';x.stroke();}
  x.restore();return c;};
  window.fotoArq=(cv,nome)=>new Promise(r=>cv.toBlob(bl=>r(new File([bl],nome,{type:'image/png'})),'image/png'));});
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const conf=(det,q,tol,rot)=>det.quad.every((c,i)=>dist(c,q[i])<tol);
// 1) recorte automático: papel branco torto sobre mesa escura
const Q1=[[230,120],[960,180],[900,820],[180,760]],Q2=[[300,250],[880,300],[860,650],[280,610]];
const r1=await p.evaluate(q=>digDetectar(fotoTeste(q,'#f4f1ea','#2a2a2a')),Q1);console.log('papel → cantos',JSON.stringify(r1.quad.map(c=>c.map(Math.round))),r1.ok);
if(!r1.ok||!conf(r1,Q1,25))ERR.push('recorte automático (papel claro) errou: '+JSON.stringify(r1));
// cartão escuro sobre mesa clara
const r2=await p.evaluate(q=>digDetectar(fotoTeste(q,'#2f4a6b','#e8e6e0','#c9c5bb')),Q2);console.log('cartão → cantos',JSON.stringify(r2.quad.map(c=>c.map(Math.round))),r2.ok);
if(!r2.ok||!conf(r2,Q2,25))ERR.push('recorte automático (cartão escuro) errou: '+JSON.stringify(r2));
// foto sem documento: não inventa — avisa e deixa os cantos para ajustar
const r3=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=800;c.height=600;const x=c.getContext('2d');x.fillStyle='#777';x.fillRect(0,0,800,600);return digDetectar(c);});
if(r3.ok)ERR.push('foto lisa deveria cair no ajuste manual');
// 2) pela barra do topo → destino padrão “baixar”; filtros; PDF de página inteira
await p.click('#dgBtn');await p.waitForTimeout(200);
const est=await p.evaluate(()=>({destino:dig.destino,ocr:!!document.querySelector('#digOv .digOcr input[disabled]')&&/em breve/.test(document.querySelector('#digOv .digOcr').textContent)}));console.log('barra do topo:',est);
if(est.destino!=='baixar')ERR.push('barra do topo deveria baixar');if(!est.ocr)ERR.push('OCR “em breve” não aparece');
const f1=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#f4f1ea','#2a2a2a'),'folha1.png'),Q1);const f2=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#f4f1ea','#2a2a2a'),'folha2.png'),Q1);
await p.evaluate(async([a,c])=>{await digArquivos([a,c]);},[f1,f2]);await p.waitForTimeout(400);
const ed=await p.evaluate(()=>({n:dig.pags.length,handles:document.querySelectorAll('#digSvg .digH').length,thumbs:document.querySelectorAll('#digOv .digTh img').length,aviso:document.getElementById('digAviso').textContent}));console.log('editor:',ed);
if(ed.n!==2||ed.handles!==4)ERR.push('editor sem as páginas/cantos');if(!ed.thumbs)ERR.push('miniaturas não geradas');
// arrastar um canto muda o recorte
const antes=await p.evaluate(()=>dig.pags[1].quad[0].slice());const h=await p.$('#digSvg .digH[data-i="0"]');const bx=await h.boundingBox();
await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.down();await p.mouse.move(bx.x+bx.width/2+30,bx.y+bx.height/2+20,{steps:4});await p.mouse.up();
const depois=await p.evaluate(()=>dig.pags[1].quad[0].slice());console.log('canto arrastado',antes.map(Math.round),'→',depois.map(Math.round));if(dist(antes,depois)<10)ERR.push('arrastar canto não funcionou');
await p.click('[data-dg="auto"]');
// filtros: P&B deixa o fundo branco e o texto preto (sem a sombra)
for(const f of ['original','cinza','pb','realcado']){await p.click(`[data-dgf="${f}"]`);await p.waitForTimeout(50);}
await p.click('[data-dgf="pb"]');
const pb=await p.evaluate(()=>{const cv=digProcessar(dig.pags[1],800),x=cv.getContext('2d'),W=cv.width,H=cv.height;const px=(u,v)=>x.getImageData(Math.round(u*W),Math.round(v*H),1,1).data[0];
  return {W,H,cantoSombra:px(.04,.06),meio:px(.5,.05),texto:Math.min(...Array.from({length:40},(_,i)=>px(.5,.12+i*.004)))};});console.log('P&B:',pb);
if(pb.cantoSombra<235||pb.meio<235)ERR.push('P&B não tirou a sombra/fundo');if(pb.texto>60)ERR.push('P&B apagou o texto');
if(Math.abs(pb.W/pb.H-732/643)>.08)ERR.push('proporção da página endireitada estranha: '+pb.W/pb.H);
const deit=await p.evaluate(()=>{const c=digProcessar(dig.pags[1],800);return c.width>c.height;});await p.click('[data-dg="girar"]');const gir=await p.evaluate(d=>{const c=digProcessar(dig.pags[1],800);return (c.width>c.height)!==d;},deit);if(!gir)ERR.push('girar não girou');await p.click('[data-dg="girar"]');await p.click('[data-dg="girar"]');await p.click('[data-dg="girar"]');
await p.click('[data-dg="ver"]');await p.waitForTimeout(100);if(await p.$('#digSvg'))ERR.push('ver resultado ainda mostra os cantos');await p.click('[data-dg="ver"]');
const pdfPag=await p.evaluate(async()=>{const bl=await digGerar(),t=await bl.text();return {tam:bl.size,ini:t.slice(0,5),pags:(t.match(/\/Type \/Page\b(?!s)/g)||[]).length,imgs:(t.match(/\/Subtype \/Image/g)||[]).length,fim:/%%EOF\s*$/.test(t)};});console.log('PDF página inteira:',pdfPag);
if(pdfPag.ini!=='%PDF-'||pdfPag.pags!==2||pdfPag.imgs!==2||!pdfPag.fim)ERR.push('PDF de página inteira inválido');
await p.fill('#digNome','RG e CPF / Maria');
const [down]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),p.click('[data-dg="gerar"]')]);
const nomeDown=down&&down.suggestedFilename();console.log('baixado:',nomeDown);if(nomeDown!=='RG e CPF - Maria.pdf')ERR.push('download do PDF: '+nomeDown);
if(down&&SAIDA){await down.saveAs(SAIDA.replace(/\.pdf$/,'-pagina.pdf'));}
await p.waitForTimeout(200);if(!(await p.evaluate(()=>/baixado/.test(document.querySelector('#digOv').textContent))))ERR.push('tela de concluído não apareceu');
await p.click('#digOv [data-dg="fechar"]');if(await p.evaluate(()=>!document.getElementById('digOv').hidden))ERR.push('não fechou');
// 3) modo ID: frente e verso na mesma folha A4, em tamanho real (8,6 × 5,4 cm)
await p.evaluate(()=>A.digAbrir({}));await p.click('[data-dgm="id"]');
const c1=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#2f4a6b','#e8e6e0','#c9c5bb'),'frente.png'),Q2),c2=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#2f4a6b','#e8e6e0','#c9c5bb'),'verso.png'),Q2);
await p.evaluate(async([a,c])=>{await digArquivos([a,c]);},[c1,c2]);await p.waitForTimeout(300);
const pdfId=await p.evaluate(async()=>{const bl=await digGerar(),t=await bl.text();const cm=[...t.matchAll(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/g)].map(m=>m.slice(1).map(Number));
  return {pags:(t.match(/\/Type \/Page\b(?!s)/g)||[]).length,imgs:(t.match(/\/Subtype \/Image/g)||[]).length,cm,b64:await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result.split(',')[1]);fr.readAsDataURL(bl);})};});
console.log('PDF modo ID:',{pags:pdfId.pags,imgs:pdfId.imgs,cm:pdfId.cm});
if(pdfId.pags!==1||pdfId.imgs!==2)ERR.push('modo ID deveria pôr frente e verso numa folha');
const larg=85.6*72/25.4;if(!pdfId.cm.length||pdfId.cm.some(c=>Math.abs(c[0]-larg)>3))ERR.push('modo ID fora do tamanho real');
if(pdfId.cm.length===2&&!(pdfId.cm[0][3]>pdfId.cm[1][3]))ERR.push('modo ID: verso deveria ficar abaixo da frente');
if(SAIDA)fs.writeFileSync(SAIDA.replace(/\.pdf$/,'-id.pdf'),Buffer.from(pdfId.b64,'base64'));
const cfg=await p.evaluate(()=>db.meta.digCfg);if(cfg?.modo!=='id')ERR.push('preferência do modo não guardada');
await p.evaluate(()=>digFechar(true));
// 4) pela ficha do processo → destino padrão é a pasta do processo no Drive
const pr=await p.evaluate(()=>MP.p1.id);await p.evaluate(id=>go('#/processo/'+id),pr);await p.waitForTimeout(300);
await p.click(`[data-act="digAbrir"][data-proc="${pr}"]`);await p.waitForTimeout(200);
const fic=await p.evaluate(()=>({destino:dig.destino,txt:document.querySelector('#digOv .digDest').textContent,rot:document.querySelector('#digOv .digOk').textContent}));console.log('ficha do processo:',fic);
if(fic.destino!=='drive'||!/☁️/.test(fic.rot))ERR.push('ficha do processo deveria ir para o Drive');
const f3=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#f4f1ea','#2a2a2a'),'x.png'),Q1);await p.evaluate(async a=>{await digArquivos([a]);},f3);await p.waitForTimeout(200);
await p.click('[data-dg="gerar"]');await p.waitForTimeout(1500);
console.log('pedidos ao robô:',JSON.stringify(pedidos));
const ped=pedidos.find(x=>x.pasta)?.pasta;const cliP=await p.evaluate(()=>MP.ed.pasta);
if(!ped||ped.cliente!==cliP)ERR.push('pasta do processo errada');if(!pedidos.some(x=>x.envio&&/\.pdf$/.test(x.envio)&&x.tipo==='application/pdf'&&x.ini.startsWith('JVBER')))ERR.push('PDF não enviado ao Drive');
if(!(await p.evaluate(()=>/abrir a pasta/.test(document.querySelector('#digOv').textContent))))ERR.push('sem link da pasta depois de enviar');
await p.evaluate(()=>digFechar(true));
// ficha do cliente e do serviço também têm o botão
const cli=await p.evaluate(()=>MP.ed.id);await p.evaluate(id=>go('#/pessoa/'+id),cli);await p.waitForTimeout(300);if(!(await p.$(`[data-act="digAbrir"][data-pessoa="${cli}"]`)))ERR.push('ficha do cliente sem 📷');
const sv=await p.evaluate(()=>{const s=upsert('processos',{titulo:'Inventário extrajudicial',servico:true,clienteId:MP.ed.id,statusServ:'Em andamento',status:'Ativo'});return s.id;});
await p.evaluate(id=>go('#/processo/'+id),sv);await p.waitForTimeout(300);if(!(await p.$(`[data-act="digAbrir"][data-proc="${sv}"]`)))ERR.push('ficha do serviço sem 📷');
// cliente sem número de pasta → baixa (avisa)
const sem=await p.evaluate(()=>{const c=upsert('pessoas',{nome:'Sem Pasta',tipo:'Cliente'});A.digAbrir({pessoa:c.id});const r={destino:dig.destino,nota:dig.nota};digFechar(true);return r;});
if(sem.destino!=='baixar'||!sem.nota)ERR.push('cliente sem pasta deveria baixar com aviso');
// 5) editor de arquivos do compromisso → “anexar” (vai pela pasta do compromisso e entra na lista)
pedidos.length=0;
await p.evaluate(()=>formPrazo({titulo:'Audiência teste',tipo:'Audiência',data:today(),processoId:MP.p1.id,pessoaId:MP.ed.id}));await p.waitForTimeout(300);
await p.evaluate(()=>{const g=document.getElementById('gArq');if(g)g.open=true;});await p.waitForTimeout(300);
if(!(await p.$('#arqDig')))ERR.push('editor de arquivos sem “Digitalizar”');else{
  await p.click('#arqDig');await p.waitForTimeout(200);if(await p.evaluate(()=>dig.destino)!=='anexar')ERR.push('editor de arquivos deveria anexar');
  const f4=await p.evaluateHandle(q=>fotoArq(fotoTeste(q,'#f4f1ea','#2a2a2a'),'ata.png'),Q1);await p.evaluate(async a=>{await digArquivos([a]);},f4);await p.waitForTimeout(200);
  await p.fill('#digNome','Ata da audiência');await p.click('[data-dg="gerar"]');await p.waitForTimeout(1500);
  const lista=await p.evaluate(()=>document.querySelector('#arqLista').textContent);console.log('anexados:',lista,JSON.stringify(pedidos));
  if(!/Ata da audiência\.pdf/.test(lista))ERR.push('PDF digitalizado não foi anexado ao compromisso');
  if(await p.evaluate(()=>modal.classList.contains('hidden')))ERR.push('o formulário do compromisso fechou');}
await p.evaluate(()=>closeModal());
// Esc fecha só o digitalizador, não o formulário de baixo
await p.evaluate(()=>{formPrazo({titulo:'x',tipo:'Reunião',data:today()});A.digAbrir({});});await p.keyboard.press('Escape');
if(await p.evaluate(()=>!!dig||modal.classList.contains('hidden')))ERR.push('Esc deveria fechar só o digitalizador');await p.evaluate(()=>closeModal());
// 6) celular (390 px): nada vaza da tela; menu “+” tem o atalho
const cx=await b.newContext({...devices['iPhone 13']});await cx.route('https://**',r=>r.abort());const m=await cx.newPage();m.on('pageerror',e=>errs.push(e.message));
await m.goto('file://'+path.resolve(__dirname,'..','index.html'));await m.waitForTimeout(600);
if(!(await m.$('#plusSheet [data-act="digAbrir"]')))ERR.push('menu + sem Digitalizar');
await m.evaluate(()=>A.plusMenu());await m.click('#plusSheet [data-act="digAbrir"]');await m.waitForTimeout(200);
await m.evaluate(()=>{const c=document.createElement('canvas');c.width=1200;c.height=1600;const x=c.getContext('2d');x.fillStyle='#333';x.fillRect(0,0,1200,1600);x.fillStyle='#fff';x.fillRect(150,200,900,1200);digAddCanvas(c);});await m.waitForTimeout(400);
const W=await m.evaluate(()=>innerWidth);
const vz=await m.evaluate(W=>{const out=[];document.querySelectorAll('#digOv *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width)return;let a=e.parentElement,clip=false;while(a&&a.id!=='digOv'){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'){clip=true;break}a=a.parentElement}if(!clip&&(r.right>W+1||r.left<-1))out.push((e.id||e.tagName)+':'+Math.round(r.right))});return out.slice(0,5);},W);
const palco=await m.evaluate(()=>{const r=document.getElementById('digCv').getBoundingClientRect();return {h:r.height,vh:innerHeight};});
console.log('celular:',W,'px · vaza',vz,'· foto',palco);if(vz.length)ERR.push('celular: vaza '+vz.join(' '));if(palco.h>palco.vh*.56)ERR.push('celular: foto cobre a tela');
if(process.env.FOTOS){await m.screenshot({path:require('os').tmpdir()+'/cel_digitalizar.png'});await p.screenshot({path:require('os').tmpdir()+'/digitalizar.png'});}
console.log('ERROS',[...ERR,...errs]);await b.close();})();
