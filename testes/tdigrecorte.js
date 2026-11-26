// 📷 Câmera dentro do app (foto única / lote, com câmera simulada) e recorte automático em fotos difíceis (mesa de madeira, reflexo encostado no canto, sombra forte num canto, dedo segurando a folha,
// folha pequena e muito torta). Os cantos têm que sair a menos de 2% da diagonal do lugar certo.
const {chromium}=require('playwright');const path=require('path');const ERR=[];
(async()=>{const b=await chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(500);
await p.evaluate(()=>{window.cena=(q,o={})=>{const W=o.W||1200,H=o.H||1600,c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');
  // madeira: faixas marrons com veios
  let sd=3;const rnd=()=>(sd=sd*16807%2147483647)/2147483647;
  x.fillStyle=o.fundo||'#7a5232';x.fillRect(0,0,W,H);if(!o.fundo)for(let i=0;i<260;i++){x.strokeStyle=`rgba(${60+rnd()*80|0},${35+rnd()*45|0},${15+rnd()*30|0},.5)`;x.lineWidth=1+rnd()*6;x.beginPath();const y0=rnd()*H;x.moveTo(0,y0);x.bezierCurveTo(W*.3,y0+rnd()*40-20,W*.6,y0+rnd()*40-20,W,y0+rnd()*30-15);x.stroke();}
  if(o.reflexo){const [rx,ry,rr]=o.reflexo,g=x.createRadialGradient(rx,ry,0,rx,ry,rr);g.addColorStop(0,'rgba(235,222,200,.95)');g.addColorStop(.6,'rgba(220,200,170,.7)');g.addColorStop(1,'rgba(200,170,130,0)');x.fillStyle=g;x.fillRect(0,0,W,H);}
  x.save();x.shadowColor='rgba(0,0,0,.45)';x.shadowBlur=18;x.shadowOffsetX=6;x.shadowOffsetY=8;x.beginPath();q.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.fillStyle='#f3f1ec';x.fill();x.restore();
  x.save();x.beginPath();q.forEach(([a,b],i)=>i?x.lineTo(a,b):x.moveTo(a,b));x.closePath();x.clip();
  if(o.sombra){const [sx,sy,sr]=o.sombra,g=x.createRadialGradient(sx,sy,0,sx,sy,sr);g.addColorStop(0,'rgba(40,30,20,.55)');g.addColorStop(1,'rgba(40,30,20,0)');x.fillStyle=g;x.fillRect(0,0,W,H);}
  x.fillStyle='#333';for(let i=0;i<30;i++){const t=.08+i*.028;const a=[q[0][0]+(q[3][0]-q[0][0])*t,q[0][1]+(q[3][1]-q[0][1])*t],bb=[q[1][0]+(q[2][0]-q[1][0])*t,q[1][1]+(q[2][1]-q[1][1])*t];
    x.beginPath();x.moveTo(a[0]+(bb[0]-a[0])*.1,a[1]+(bb[1]-a[1])*.1);x.lineTo(a[0]+(bb[0]-a[0])*(.5+rnd()*.4),a[1]+(bb[1]-a[1])*(.5+rnd()*.4));x.lineWidth=5;x.strokeStyle='#333';x.stroke();}
  x.restore();
  if(o.dedo){const [dx,dy,ang]=o.dedo;x.save();x.translate(dx,dy);x.rotate(ang);x.fillStyle='#d9a383';x.beginPath();x.ellipse(0,0,60,170,0,0,7);x.fill();x.restore();}
  return c;};});
const casos=[
  ['madeira, folha torta (como a foto do usuário)',[[80,110],[1110,90],[1080,1450],[150,1470]],{}],
  ['reflexo claro encostado no canto superior direito',[[110,160],[1050,120],[1090,1440],[90,1500]],{reflexo:[1150,60,260]}],
  ['sombra forte no canto superior direito',[[120,140],[1060,170],[1040,1480],[110,1450]],{sombra:[1060,170,420]}],
  ['dedo cobrindo o canto inferior esquerdo',[[140,130],[1050,150],[1070,1430],[120,1460]],{dedo:[150,1500,.5]}],
  ['folha menor e bem inclinada',[[300,300],[900,420],[820,1250],[200,1120]],{}],
];
for(const [nome,Q,o] of casos){const r=await p.evaluate(([Q,o])=>{const c=cena(Q,o),t=performance.now(),d=digDetectar(c);return {...d,ms:Math.round(performance.now()-t),diag:Math.hypot(c.width,c.height)};},[Q,o]);
  const erro=Math.max(...r.quad.map((c,i)=>Math.hypot(c[0]-Q[i][0],c[1]-Q[i][1])));console.log(nome,'→',r.ok?'ok':'falhou',`erro máx ${Math.round(erro)} px · ${r.ms} ms`);
  if(!r.ok||erro>r.diag*.02)ERR.push(`${nome}: erro ${Math.round(erro)} px ${JSON.stringify(r.quad.map(c=>c.map(Math.round)))}`);
  if(r.ms>1500)ERR.push(`${nome}: lento (${r.ms} ms)`);}
// câmera: lote = fica aberta e conta as fotos; foto única = fecha sozinha; sem permissão = oferece a câmera do aparelho
await p.evaluate(()=>{A.digAbrir({});dig.captura='lote';digRender();});await p.click('#digOv [data-dg="cam"]');
await p.waitForFunction(()=>digCam&&digCam.video.videoWidth>0,null,{timeout:8000}).catch(()=>ERR.push('câmera não abriu'));
await p.click('#digCamOv .dcDisp');await p.waitForTimeout(400);await p.click('#digCamOv .dcDisp');await p.waitForTimeout(400);
const lote=await p.evaluate(()=>({aberta:!!document.getElementById('digCamOv'),n:digDoc().pags.length,fim:document.querySelector('#digCamOv .dcFim').textContent,cont:document.querySelector('#digCamOv .dcMini b').textContent}));console.log('câmera em lote:',lote);
if(!lote.aberta||lote.n!==2||lote.fim!=='Concluir (2)'||lote.cont!=='2')ERR.push('câmera em lote: '+JSON.stringify(lote));
const trilha=await p.evaluate(()=>{const t=digCam.stream.getTracks()[0];window._t=t;return t.readyState;});
await p.click('#digCamOv .dcFim');const fech=await p.evaluate(()=>({camOv:!!document.getElementById('digCamOv'),trilha:_t.readyState,editor:!!document.getElementById('digSvg')}));
if(fech.camOv||fech.trilha!=='ended'||!fech.editor)ERR.push('concluir a câmera: '+JSON.stringify(fech));
await p.click('#digOv [data-dccap],#digOv [data-dg="cam"]');await p.waitForFunction(()=>digCam&&digCam.video.videoWidth>0,null,{timeout:8000}).catch(()=>{});
await p.click('#digCamOv [data-dccap="unica"]');await p.click('#digCamOv .dcDisp');await p.waitForTimeout(500);
const uni=await p.evaluate(()=>({camOv:!!document.getElementById('digCamOv'),n:digDoc().pags.length,cfg:db.meta.digCfg.captura}));console.log('foto única:',uni);
if(uni.camOv||uni.n!==3||uni.cfg!=='unica')ERR.push('foto única: '+JSON.stringify(uni));
await p.evaluate(()=>{navigator.mediaDevices.getUserMedia=()=>Promise.reject(Object.assign(new Error('x'),{name:'NotAllowedError'}));});await p.click('#digOv [data-dg="cam"]');await p.waitForTimeout(200);
const neg=await p.evaluate(()=>document.querySelector('#digCamOv .dcMsg').textContent);if(!/permissão negada/.test(neg)||!(await p.$('#digCamOv [data-dc="sistema"]')))ERR.push('sem permissão: '+neg);
await p.keyboard.press('Escape');if(await p.evaluate(()=>!!document.getElementById('digCamOv')||!dig))ERR.push('Esc deveria fechar só a câmera');
await p.evaluate(()=>digFechar(true));
console.log('ERROS',[...ERR,...errs]);await b.close();})();
