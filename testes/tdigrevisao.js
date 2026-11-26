// 📷 Digitalizar — revisão depois da foto (resultado primeiro, ◀ ▶ / arrastar, Comparar, filtros em miniatura, Sem sombra/Eco, aplicar a todas),
// 📷 Refazer, 📖 Livro/CTPS, 🖊 Marcar (tarja preta/branca, textos prontos, assinatura desenhada/fotografada — só no aparelho), 💧 marca d’água,
// qualidade (leve < normal < alta), 🧩 colagem (2/4/6 por folha, moldura), ▶ Retomar (rascunho no aparelho) e a câmera (lanterna, captura automática,
// ↶ desfazer, guia do modo ID Frente → Verso) + celular (390 px)
const maisDg=async(pg,a)=>{await pg.click('#digOv [data-dg="mais"]');await pg.click(`#digSheet [data-dg="${a}"]`);};
const {chromium,devices}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
const ctx=await b.newContext({viewport:{width:1366,height:1000},acceptDownloads:true});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);
await p.evaluate(()=>{window.folha=(o={})=>{const W=o.W||900,H=o.H||1200,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#2a2a2a';x.fillRect(0,0,W,H);
  const q=o.q||[[120,110],[780,130],[770,1090],[110,1080]];x.beginPath();q.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fillStyle='#f2efe8';x.fill();
  x.save();x.clip();const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(0,0,0,.28)');g.addColorStop(.5,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
  x.fillStyle='#222';for(let i=0;i<14;i++)x.fillRect(190,220+i*55,500,9);if(o.marca)x.fillStyle=o.marca,x.fillRect(190,170,200,20);x.restore();return c;};
  // livro aberto (CTPS): duas páginas lado a lado com a dobra escura no meio
  window.livro=()=>{const W=1400,H=900,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#1f3b6b';x.fillRect(0,0,W,H);
    x.fillStyle='#f2efe8';x.fillRect(80,80,1240,740);const g=x.createLinearGradient(640,0,760,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.5,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(640,80,120,740);
    x.fillStyle='#333';for(let i=0;i<10;i++){x.fillRect(140,160+i*60,440,8);x.fillRect(820,160+i*60,440,8);}return c;};
  window.px=(cv,u,v)=>{const d=cv.getContext('2d').getImageData(Math.round(u*cv.width),Math.round(v*cv.height),1,1).data;return [d[0],d[1],d[2]];};});
// 1) resultado primeiro, passar páginas (botões e arrastando), comparar
await p.evaluate(()=>{A.digAbrir({});[0,1,2].forEach(()=>digAddCanvas(folha()));digIrPag(0,0);});await p.waitForTimeout(300);
const r1=await p.evaluate(()=>({ver:dig.ver,svg:!!document.getElementById('digSvg'),nav:document.querySelector('.digNav b').textContent}));console.log('resultado primeiro:',r1);
if(!r1.ver||r1.svg||r1.nav!=='1 / 3')ERR.push('resultado primeiro / 1 de 3: '+JSON.stringify(r1));
await p.click('[data-dg="pgProx"]');if(await p.evaluate(()=>dig.at)!==1)ERR.push('▶ próxima página');
const st=await (await p.$('#digStage')).boundingBox();await p.mouse.move(st.x+st.width*.7,st.y+st.height/2);await p.mouse.down();await p.mouse.move(st.x+st.width*.2,st.y+st.height/2,{steps:5});await p.mouse.up();
if(await p.evaluate(()=>dig.at)!==2)ERR.push('arrastar para o lado deveria passar a página');await p.click('[data-dg="pgAnt"]');await p.click('[data-dg="pgAnt"]');
const cmp=await p.evaluate(()=>{const b=document.querySelector('[data-dg="comparar"]');b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));const c=document.getElementById('digCv'),p0=digPag(),a1=Math.abs(c.width/c.height-p0.img.width/p0.img.height)<.02,on=dig.comparar;
  b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));return {a1,on,off:!dig.comparar};});if(!cmp.a1||!cmp.on||!cmp.off)ERR.push('comparar (segurar mostra a foto original): '+JSON.stringify(cmp));
// 2) filtros: miniaturas da própria página; aplicar a todas; Sem sombra e Eco
await p.waitForTimeout(500);const minis=await p.$$eval('#digOv canvas[data-ftc]',l=>l.filter(c=>c.width>10).length);if(minis!==6)ERR.push('miniaturas dos filtros: '+minis);
await p.click('[data-dgf="semsombra"]');if(await p.evaluate(()=>digDoc().pags.map(x=>x.filtro).join())!=='semsombra,semsombra,semsombra')ERR.push('filtro em todas as páginas');
await p.uncheck('#digFTodas');await p.click('[data-dgf="eco"]');const fl=await p.evaluate(()=>digDoc().pags.map(x=>x.filtro).join());if(fl!=='eco,semsombra,semsombra')ERR.push('filtro só nesta página: '+fl);await p.check('#digFTodas');
const eco=await p.evaluate(()=>{const c=digProcessar(digPag(),700);let t=255;for(let i=0;i<60;i++)t=Math.min(t,px(c,.5,.15+i*.004)[0]);return {fundo:px(c,.08,.5)[0],texto:t};});console.log('eco:',eco);
if(eco.fundo<250||eco.texto<60||eco.texto>140)ERR.push('Eco: fundo branco e texto cinza-escuro (economia de tinta) '+JSON.stringify(eco));
const ss=await p.evaluate(()=>{const c=digProcessar(digDoc().pags[1],700);return px(c,.05,.5)[0];});if(ss<235)ERR.push('Sem sombra não tirou a sombra: '+ss);
// 3) 📷 Refazer: a nova foto entra no lugar da página (câmera simulada, uma foto só)
await p.evaluate(()=>digIrPag(0,1));const idAnt=await p.evaluate(()=>digPag().id);await maisDg(p,'refazer');
await p.waitForFunction(()=>digCam&&digCam.video.videoWidth>0,null,{timeout:8000}).catch(()=>ERR.push('câmera do refazer não abriu'));
if(!(await p.evaluate(()=>/Refazer/.test(document.querySelector('#digCamOv').textContent))))ERR.push('câmera deveria avisar que é Refazer');
await p.click('#digCamOv .dcDisp');await p.waitForTimeout(500);
const rf=await p.evaluate(id=>({cam:!!document.getElementById('digCamOv'),n:digDoc().pags.length,at:dig.at,troca:digDoc().pags[1].id!==id,ant:digDoc().pags.some(x=>x.id===id)}),idAnt);console.log('refazer:',rf);
if(rf.cam||rf.n!==3||rf.at!==1||!rf.troca||rf.ant)ERR.push('refazer: '+JSON.stringify(rf));
await p.evaluate(()=>{digDoc().pags.splice(1,1,digAddCanvas(folha())[0]);digDoc().pags.pop();digIrPag(0,0);});
// 4) 📖 Livro/CTPS: acha a dobra e vira 2 páginas
await p.evaluate(()=>{digAddCanvas(livro());});const n0=await p.evaluate(()=>digDoc().pags.length);await maisDg(p,'livro');
const lv=await p.evaluate(()=>({...dig.livro,linha:!!document.getElementById('digDobra'),btn:!!document.querySelector('[data-dg="livroOk"]')}));console.log('livro:',lv);
if(lv.eixo!=='x'||Math.abs(lv.pos-.5)>.06||!lv.linha||!lv.btn)ERR.push('livro: dobra '+JSON.stringify(lv));
await p.click('[data-dg="livroOk"]');const lv2=await p.evaluate(()=>{const ps=digDoc().pags.slice(-2);return {n:digDoc().pags.length,w:ps.map(x=>x.img.width),h:ps.map(x=>x.img.height),esqTexto:px(digProcessar(ps[0],600,{filtro:'original'}),.4,.2)[0]};});console.log('livro dividido:',lv2);
if(lv2.n!==n0+1||Math.abs(lv2.w[0]-lv2.w[1])>lv2.w[0]*.2||lv2.w[0]>lv2.h[0]*1.1)ERR.push('livro: deveria virar 2 páginas em pé '+JSON.stringify(lv2));
// 5) 🖊 Marcar: tarja preta e branca (queimadas na imagem), texto pronto, cor, desfazer, remover
await p.evaluate(()=>digIrPag(0,0));await maisDg(p,'marcar');if(!(await p.$('[data-dgk="tp"]')))ERR.push('tela Marcar não abriu');
if(!(await p.evaluate(()=>document.querySelector('.digOk').disabled)))ERR.push('enviar deveria ficar travado enquanto marca');
const arrasta=async(u0,v0,u1,v1)=>{const bb=await (await p.$('#digCv')).boundingBox();await p.mouse.move(bb.x+bb.width*u0,bb.y+bb.height*v0);await p.mouse.down();await p.mouse.move(bb.x+bb.width*u1,bb.y+bb.height*v1,{steps:4});await p.mouse.up();await p.waitForTimeout(80);};
await p.click('[data-dgk="tp"]');await arrasta(.25,.18,.7,.26);await p.click('[data-dgk="tb"]');await arrasta(.25,.4,.7,.47);await p.click('[data-dgk="tb"]');
const mk=await p.evaluate(()=>{const pg=digPag(),c=digProcessar(pg,800);return {t:pg.marcas.map(m=>m.t).join(),preto:px(c,.47,.22),branco:px(c,.3,.432)};});console.log('tarjas:',mk);
if(mk.t!=='tp,tb'||Math.max(...mk.preto)>10||Math.min(...mk.branco)<245)ERR.push('tarjas não foram para a imagem: '+JSON.stringify(mk));
await p.click('[data-dgk="txt"]');const tx=await p.evaluate(()=>[...document.querySelectorAll('#digSheet [data-dgs^="t:"]')].map(b=>b.textContent.trim()));console.log('textos prontos:',tx.length,tx.slice(0,5));
if(tx.length<5||!/Confere com o original/.test(tx[0])||!tx.some(t=>/Cópia/.test(t))||!tx.some(t=>/uso exclusivo/.test(t)))ERR.push('textos prontos: '+tx);
await p.click('#digSheet [data-dgs="t:0"]');await p.waitForTimeout(100);
const t1=await p.evaluate(()=>{const m=digPag().marcas.at(-1);return {t:m.t,l:m.linhas,sheet:!!document.getElementById('digSheet')};});if(t1.t!=='txt'||t1.l[0]!=='CONFERE COM O ORIGINAL'||!/\d{2}\/\d{2}\/\d{4}/.test(t1.l[1]||'')||t1.sheet)ERR.push('texto “Confere com o original”: '+JSON.stringify(t1));
await p.click('[data-dgk="cor:vermelho"]');if(await p.evaluate(()=>digPag().marcas.at(-1).cor)!=='vermelho')ERR.push('cor do texto');
const antes=await p.evaluate(()=>digPag().marcas.at(-1).x);await arrasta(.1,.8,.3,.6);const dep=await p.evaluate(()=>digPag().marcas.at(-1).x);if(!(dep>antes+.1))ERR.push('mover o texto: '+antes+'→'+dep);
await p.click('[data-dgk="desf"]');if(Math.abs(await p.evaluate(()=>digPag().marcas.at(-1).x)-antes)>.01)ERR.push('↶ desfazer');
await p.click('[data-dgk="tnovo"]').catch(()=>{});
// texto seu (fica salvo na lista)
await p.evaluate(()=>{window.prompt=()=>'Via original | devolvida ao cliente';});await p.click('[data-dgk="txt"]');await p.click('#digSheet [data-dgs="tnovo"]');
if(!(await p.evaluate(()=>(db.meta.digTextos||[])[0]==='Via original | devolvida ao cliente'&&digPag().marcas.at(-1).linhas.length===2)))ERR.push('texto próprio salvo na lista');
// 6) ✍️ assinatura desenhada → salva SÓ no aparelho (fora do db) → posta na página; foto da assinatura → fundo transparente
await p.click('[data-dgk="ass"]');await p.click('#digSheet [data-dgs="adesenhar"]');const pad=await (await p.$('#digPad')).boundingBox();
await p.mouse.move(pad.x+30,pad.y+120);await p.mouse.down();for(let i=0;i<12;i++)await p.mouse.move(pad.x+30+i*20,pad.y+120-(i%2?50:0));await p.mouse.up();
await p.click('#digSheet [data-dgs="psalvar"]');await p.waitForTimeout(100);
const as=await p.evaluate(()=>({n:digAssLista().length,noDb:!JSON.stringify(db).includes('data:image/png'),itens:document.querySelectorAll('#digSheet [data-dgs^="a:"]').length}));if(as.n!==1||!as.noDb||as.itens!==1)ERR.push('assinatura salva só no aparelho: '+JSON.stringify(as));
await p.click('#digSheet [data-dgs^="a:"]');await p.waitForTimeout(200);if(await p.evaluate(()=>digPag().marcas.at(-1).t)!=='ass')ERR.push('assinatura na página');
const ft=await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=600;c.height=300;const x=c.getContext('2d');x.fillStyle='#e9e4da';x.fillRect(0,0,600,300);x.strokeStyle='#1a2a6c';x.lineWidth=6;x.beginPath();x.moveTo(60,200);x.bezierCurveTo(150,40,260,260,380,90);x.lineTo(540,180);x.stroke();
  const src=digAssDaFoto(c),im=new Image();im.src=src;await new Promise(r=>im.onload=r);const k=document.createElement('canvas');k.width=im.width;k.height=im.height;const kx=k.getContext('2d');kx.drawImage(im,0,0);const d=kx.getImageData(0,0,k.width,k.height).data;let tinta=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)tinta++;
  return {canto:kx.getImageData(1,1,1,1).data[3],tinta,w:im.width};});console.log('foto da assinatura:',ft);if(ft.canto!==0||ft.tinta<200||ft.w>560)ERR.push('foto da assinatura (papel transparente, recortada): '+JSON.stringify(ft));
await p.click('[data-dgk="pronto"]');if(await p.evaluate(()=>!!dig.marcar))ERR.push('Pronto não saiu da marcação');
// 7) 💧 marca d’água, qualidade, colagem
await p.click('.digMaisOpc summary');await p.check('#digMarcaOn');const ag=await p.evaluate(()=>({on:digDoc().marcaOn,txt:digDoc().marca,campo:!!document.getElementById('digMarcaTxt')}));if(!ag.on||!/Cópia/.test(ag.txt)||!ag.campo)ERR.push('marca d’água: '+JSON.stringify(ag));
const wm=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=600;c.height=800;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,600,800);digMarcaDagua(x,600,800,'Cópia — uso exclusivo');let verm=0;const d=x.getImageData(0,0,600,800).data;for(let i=0;i<d.length;i+=4)if(d[i]-d[i+1]>20)verm++;return verm;});
if(wm<2000)ERR.push('marca d’água não desenhada: '+wm);
const tam={};for(const q of ['leve','normal','alta']){await p.click(`[data-dgq="${q}"]`);tam[q]=await p.evaluate(async()=>(await digGerar()).size);}console.log('qualidade (bytes):',tam);
if(!(tam.leve<tam.normal&&tam.normal<tam.alta))ERR.push('qualidade: leve < normal < alta '+JSON.stringify(tam));await p.click('[data-dgq="normal"]');
await p.click('[data-dgm="colagem"]');if(!(await p.$('[data-dgcol="4"].on')))ERR.push('colagem: 4 por folha como padrão');await p.click('[data-dgcol="2"]');await p.check('#digColMold');
const col=await p.evaluate(async()=>{const t=await (await digGerar()).text();return {n:digDoc().pags.length,pags:(t.match(/\/Type \/Page\b(?!s)/g)||[]).length,imgs:(t.match(/\/Subtype \/Image/g)||[]).length,mold:(t.match(/ re S/g)||[]).length,txt:document.querySelector('.digOpc').textContent};});console.log('colagem:',{...col,txt:undefined});
if(col.pags!==Math.ceil(col.n/2)||col.imgs!==col.n||col.mold!==col.n||!/2 por folha = \d folha/.test(col.txt))ERR.push('colagem 2 por folha com moldura: '+JSON.stringify({...col,txt:undefined}));
await p.click('[data-dgcol="6"]');const c6=await p.evaluate(async()=>{const t=await (await digGerar()).text();return (t.match(/\/Type \/Page\b(?!s)/g)||[]).length;});if(c6!==1)ERR.push('colagem 6 por folha: '+c6);
await p.click('[data-dgm="pagina"]');
// 8) ▶ Retomar: fechar com páginas não enviadas guarda tudo no aparelho; ao abrir de novo, Retomar (com marcas) ou Descartar
const antesR=await p.evaluate(()=>({n:digTodas().length,marcas:digDoc().pags[0].marcas.length}));await p.waitForTimeout(1200);
await p.evaluate(()=>digFechar());await p.waitForTimeout(600);if(await p.evaluate(()=>!!dig))ERR.push('fechar (confirmado) deveria fechar');
await p.evaluate(()=>A.digAbrir({}));await p.waitForTimeout(800);const ban=await p.evaluate(()=>document.querySelector('.digRasc')?.textContent||'');console.log('retomar:',ban.replace(/\s+/g,' ').trim());
if(!/não concluída/.test(ban)||!new RegExp(antesR.n+' páginas').test(ban))ERR.push('aviso de Retomar: '+ban);
await p.click('[data-dg="retomar"]');await p.waitForTimeout(1200);const dep2=await p.evaluate(()=>({n:digTodas().length,marcas:digDoc().pags[0].marcas.length,filtro:digDoc().pags[0].filtro,marca:digDoc().marcaOn}));
if(dep2.n!==antesR.n||dep2.marcas!==antesR.marcas||!dep2.marca)ERR.push('retomar: '+JSON.stringify({antesR,dep2}));
await p.evaluate(()=>digFechar(true));await p.waitForTimeout(400);await p.evaluate(()=>A.digAbrir({}));await p.waitForTimeout(700);if(await p.$('.digRasc'))ERR.push('descartado/enviado não deveria oferecer Retomar');
// Descartar pelo aviso
await p.evaluate(()=>digAddCanvas(folha()));await p.waitForTimeout(1200);await p.evaluate(()=>digFechar());await p.waitForTimeout(500);await p.evaluate(()=>A.digAbrir({}));await p.waitForTimeout(700);
await p.click('[data-dg="descartar"]');await p.waitForTimeout(300);await p.evaluate(()=>digFechar(true));await p.evaluate(()=>A.digAbrir({}));await p.waitForTimeout(700);if(await p.$('.digRasc'))ERR.push('Descartar');await p.evaluate(()=>digFechar(true));
// 9) câmera: lanterna (aparelho sem lanterna → aviso), captura automática, ↶ desfazer, filtro na câmera, guia do modo ID
await p.evaluate(()=>{A.digAbrir({});dig.captura='lote';digRender();});await p.click('#digOv [data-dg="cam"]');await p.waitForFunction(()=>digCam&&digCam.video.videoWidth>0,null,{timeout:8000});
const cam0=await p.evaluate(()=>({luz:digCam.luz,auto:digCam.auto,chips:document.querySelectorAll('#digCamOv [data-dcf]').length}));if(cam0.luz||cam0.auto||cam0.chips!==6||!/^semsombra/.test(await p.evaluate(()=>document.querySelector('#digCamOv [data-dcf]').dataset.dcf)))ERR.push('câmera: lanterna e automática desligadas, 6 filtros '+JSON.stringify(cam0));
await p.click('#digCamOv [data-dc="luz"]');await p.waitForTimeout(150);if(!(await p.evaluate(()=>/Lanterna/.test(document.getElementById('toast')?.textContent||''))))ERR.push('lanterna sem suporte deveria avisar');
if(!(await p.evaluate(()=>document.querySelector('#digCamOv .dcMaisP').hidden)))ERR.push('opções extras da câmera deveriam ficar escondidas no ⋯');await p.click('#digCamOv [data-dc="mais"]');await p.click('#digCamOv [data-dcf="pb"]');if(await p.evaluate(()=>dig.filtro+db.meta.digCfg.filtro)!=='pbpb')ERR.push('filtro escolhido na câmera vira o padrão');
await p.click('#digCamOv .dcDisp');await p.waitForTimeout(400);await p.click('#digCamOv .dcDisp');await p.waitForTimeout(400);
if(await p.evaluate(()=>digDoc().pags.map(x=>x.filtro).join())!=='pb,pb')ERR.push('fotos com o filtro da câmera');
await p.click('#digCamOv [data-dc="desfazer"]');const dz=await p.evaluate(()=>({n:digDoc().pags.length,fim:document.querySelector('#digCamOv .dcFim').textContent}));if(dz.n!==1||dz.fim!=='Concluir (1)')ERR.push('↶ desfazer a última: '+JSON.stringify(dz));
await p.click('#digCamOv [data-dc="auto"]');if(!(await p.evaluate(()=>digCam.auto)))ERR.push('ligar captura automática');
const au=await p.evaluate(()=>{let n=0;const orig=window.digCamFoto;digCamFoto=()=>{n++;};const c={ov:digCam.ov,auto:true,armado:true,est:0,ult:null,perdido:0},q=[[10,10],[200,12],[198,280],[12,278]],ok={ok:true,quad:q},sai={ok:false};
  for(let i=0;i<5;i++)digCamAutoPasso(c,ok,240,320);const a=n;for(let i=0;i<5;i++)digCamAutoPasso(c,ok,240,320);const b2=n;digCamAutoPasso(c,sai,240,320);digCamAutoPasso(c,sai,240,320);for(let i=0;i<4;i++)digCamAutoPasso(c,ok,240,320);
  const mex=n;const c2={...c,auto:true,armado:true,est:0,ult:null};for(let i=0;i<6;i++)digCamAutoPasso(c2,{ok:true,quad:q.map(([x,y])=>[x+i*15,y])},240,320);digCamFoto=orig;return {a,b2,mex,tremendo:n-mex};});
console.log('captura automática:',au);if(au.a!==1||au.b2!==1||au.mex!==2||au.tremendo!==0)ERR.push('captura automática (parado ~1 s, uma vez por folha, não com o celular mexendo): '+JSON.stringify(au));
await p.click('#digCamOv .dcFim');
await p.evaluate(()=>{digDoc().modo='id';digDoc().pags=[];dig.captura='lote';digRender();});await p.click('#digOv [data-dg="cam"]');await p.waitForFunction(()=>digCam&&digCam.video.videoWidth>0,null,{timeout:8000});await p.waitForTimeout(200);
const g1=await p.evaluate(()=>({vis:!document.querySelector('#digCamOv .dcGuia').hidden,txt:document.querySelector('#digCamOv .dcGuia b').textContent,chips:[...document.querySelectorAll('#digCamOv [data-dcid]')].map(b=>b.textContent).join('|'),g:digCam.guia}));console.log('guia ID:',g1.txt,g1.chips);
if(!g1.vis||g1.txt!=='FRENTE (1 de 2)'||!/RG novo \/ CNH/.test(g1.chips)||!g1.g||Math.abs(g1.g.w/g1.g.h-85.6/54)>.05)ERR.push('guia do cartão: '+JSON.stringify(g1));
await p.click('#digCamOv .dcDisp');await p.waitForTimeout(500);const g2=await p.evaluate(()=>({txt:document.querySelector('#digCamOv .dcGuia b').textContent,falhou:digDoc().pags[0].falhou,quad:digDoc().pags[0].quad.map(c=>c.map(Math.round))}));console.log('depois da frente:',g2);
if(g2.txt!=='VERSO (2 de 2)'||g2.falhou)ERR.push('modo ID: depois da frente pede o verso e recorta pelo guia '+JSON.stringify(g2));
await p.click('#digCamOv [data-dcid="rg"]');const g3=await p.evaluate(()=>({tam:digDoc().idTam,ar:digCam.guia.w/digCam.guia.h}));if(g3.tam!=='rg'||Math.abs(g3.ar-102/68)>.05)ERR.push('trocar o tipo do documento na câmera: '+JSON.stringify(g3));
await p.click('#digCamOv .dcFim');await p.evaluate(()=>digFechar(true));
// 📖 livro na câmera: cada foto vira 2 páginas
const la=await p.evaluate(()=>{A.digAbrir({});dig.livroAuto=true;const r=digAddCanvas(livro());const n=digDoc().pags.length;digFechar(true);return {r:r.length,n};});if(la.r!==2||la.n!==2)ERR.push('livro automático: '+JSON.stringify(la));
// 10) celular 390 px: marcar e as janelinhas cabem na tela
const cx=await b.newContext({...devices['iPhone 13']});await cx.route('https://**',r=>r.abort());const m=await cx.newPage();m.on('pageerror',e=>errs.push(e.message));
await m.goto('file://'+path.resolve(__dirname,'..','index.html'));await m.waitForTimeout(600);
await m.evaluate(()=>{const W=900,H=1200,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#333';x.fillRect(0,0,W,H);x.fillStyle='#fff';x.fillRect(100,100,700,1000);A.digAbrir({});digAddCanvas(c);digAddCanvas(c);});await m.waitForTimeout(300);
const vaza=async nome=>{const W=await m.evaluate(()=>innerWidth);const v=await m.evaluate(W=>{const out=[];document.querySelectorAll('#digOv *').forEach(e=>{const r=e.getBoundingClientRect();if(!r.width)return;let a=e.parentElement,clip=false;while(a&&a.id!=='digOv'){const o=getComputedStyle(a).overflowX;if(o==='auto'||o==='scroll'||o==='hidden'){clip=true;break}a=a.parentElement}if(!clip&&(r.right>W+1||r.left<-1))out.push((e.id||e.className||e.tagName)+':'+Math.round(r.right))});return out.slice(0,4);},W);if(v.length)ERR.push(`celular (${nome}) vaza: `+v.join(' '));};
await vaza('revisão');await maisDg(m,'marcar');await vaza('marcar');await m.click('[data-dgk="txt"]');await vaza('textos');await m.click('#digSheet .dsX');
await m.click('[data-dgk="ass"]');await m.click('#digSheet [data-dgs="adesenhar"]');await vaza('assinatura');await m.evaluate(()=>{document.getElementById('digSheet').remove();dig.marcar=null;digRender();});
await maisDg(m,'livro');await vaza('livro');
if(process.env.FOTOS){await m.evaluate(()=>{dig.livro=null;digRender();});await m.screenshot({path:require('os').tmpdir()+'/cel_revisao.png'});}
console.log('ERROS',[...ERR,...errs]);await b.close();})();
