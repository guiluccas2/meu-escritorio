// Aparência: 5 paletas × claro/escuro, ajustes de cor (fundo, menu, destaque, botões), ícones discretos,
// legibilidade (contraste) de TODAS as combinações, gravação só no aparelho e impressão sempre em branco.
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
const ok=(c,m)=>{if(!c){errs.push(m);console.log('✘',m)}};
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);await p.waitForTimeout(300);
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(300);
ok(await p.locator('#apBox .apPal').count()===5,'5 paletas no cartão Aparência');
ok(await p.locator('#side .temaSeg button').count()===3,'Claro/Escuro/Auto do menu continua igual');
const v=n=>p.evaluate(n=>getComputedStyle(document.documentElement).getPropertyValue('--'+n).trim().toLowerCase(),n);
// padrão = exatamente as cores de antes
ok(await v('side')==='#16263a'&&await v('pri')==='#1f4e79','padrão continua o azul atual');
// todas as paletas, nos dois modos (o Azul escuro padrão é mantido idêntico ao visual de antes: branco sobre #5b9bd5)
const pals=await p.evaluate(()=>Object.keys(AP_PALETAS));
for(const m of ['light','dark'])for(const k of pals){
  await p.evaluate(m=>A.temaSet({v:m}),m);await p.evaluate(k=>A.apPaleta({k}),k);await p.waitForTimeout(40);
  const r=await p.evaluate(()=>{const c=s=>getComputedStyle(document.querySelector(s));const on=document.querySelector('#nav a.on')||document.querySelector('#nav a');on.classList.add('on');
    const bp=document.querySelector('.btn.primary');return {nav:[c('#nav a.on').color,c('#nav a.on').backgroundColor],btn:[c('.btn.primary').color,c('.btn.primary').backgroundColor],side:getComputedStyle(document.documentElement).getPropertyValue('--side').trim(),meta:document.querySelector('meta[name="theme-color"]').content}});
  const exp=await p.evaluate(([k,m])=>AP_PALETAS[k][m==='dark'?'escuro':'claro'].side,[k,m]);
  ok(r.side===exp&&r.meta===exp,`${k}/${m}: menu e barra do celular com a cor da paleta`);
  const cr=await p.evaluate(([a,b])=>{const h=s=>'#'+s.match(/\d+/g).slice(0,3).map(x=>(+x).toString(16).padStart(2,'0')).join('');return [apContraste(h(a[0]),h(a[1])),apContraste(h(b[0]),h(b[1]))]},[r.nav,r.btn]);
  ok(cr[0]>=4.5||(k==='azul'&&m==='dark'),`${k}/${m}: item ativo do menu legível (${cr[0].toFixed(1)})`);
  ok(cr[1]>=4.5||(k==='azul'&&m==='dark'),`${k}/${m}: botão principal legível (${cr[1].toFixed(1)})`);
}
// legibilidade de TODAS as combinações de ajustes (cálculo puro)
const ruins=await p.evaluate(()=>{const out=[];for(const k of Object.keys(AP_PALETAS))for(const m of ['claro','escuro']){
  const tenta=aj=>{const c=apCores(k,m,aj),t=(a,b,n,min)=>{const x=apContraste(c[a],c[b]);if(x<min)out.push(`${k}/${m} ${JSON.stringify(aj)} ${a}×${b}=${x.toFixed(2)}`)};
    t('text','panel',0,7);t('text','bg',0,7);t('muted','panel',0,4.5);t('sideText','side',0,4.5);t('onSide','side',0,4.5);if(!(k==='azul'&&m==='escuro'&&!aj.acc))t('accText','acc',0,4.5);
    if(!(k==='azul'&&m==='escuro'&&!aj.pri))t('priText','pri',0,4.5);t('pri','panel',0,m==='claro'?4.5:4.5);};
  tenta({});for(const o of ['bg','side','acc','pri'])for(const [h] of AP_OPCOES[o][m])tenta({[o]:h});
  for(const [b] of AP_OPCOES.bg[m])for(const [pr] of AP_OPCOES.pri[m])tenta({bg:b,pri:pr});}return out});
ok(!ruins.length,'combinações ilegíveis: '+ruins.slice(0,8).join(' | '));
// ajustes: menu branco no modo claro → logo sem inverter, texto escuro
await p.evaluate(()=>{A.temaSet({v:'light'});A.apPaleta({k:'dourado'});A.apCor({k:'side',c:'#ffffff'});A.apCor({k:'bg',c:'#ffffff'})});await p.waitForTimeout(50);
ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.brand img')).filter)==='none','menu claro: logotipo na cor original');
ok(await p.locator('#apBox .apCor.on').count()===4,'4 cores marcadas (2 ajustadas + 2 da paleta)');
ok(/2 ajuste/.test(await p.locator('#apBox summary').innerText()),'resumo mostra os ajustes');
// ajuste vale só para o modo em uso
await p.evaluate(()=>A.temaSet({v:'dark'}));await p.waitForTimeout(40);
ok(await v('side')==='#0e0d0c','escuro não pegou o ajuste do claro');
await p.evaluate(()=>A.temaSet({v:'light'}));
// ícones discretos
await p.evaluate(()=>A.apIcones({v:'cinza'}));ok(await p.evaluate(()=>document.documentElement.dataset.icones)==='cinza','ícones discretos');
// fica gravado no aparelho e volta depois de recarregar (sem tocar nos dados do escritório)
const dbAntes=await p.evaluate(()=>JSON.stringify(db.meta.painel||null));
await p.reload();await p.waitForTimeout(600);
ok(await v('side')==='#ffffff'&&await v('bg')==='#ffffff','ajustes voltam após recarregar');
ok(await p.evaluate(()=>document.documentElement.dataset.paleta)==='dourado'&&await p.evaluate(()=>document.documentElement.dataset.icones)==='cinza','paleta e ícones voltam');
ok(await p.evaluate(()=>JSON.stringify(db.meta.painel||null))===dbAntes,'dados do escritório intocados');
// impressão sempre em fundo branco
await p.emulateMedia({media:'print'});ok(await v('panel')==='#fff'&&await v('bg')==='#fff','impressão em branco');await p.emulateMedia({media:'screen'});
// restaurar e trocar de paleta (com ajustes pede confirmação: o diálogo é aceito)
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(200);
await p.click('#apBox [data-act="apRestaurar"]');await p.waitForTimeout(50);ok(await v('side')==='#1c1b19','restaurar volta à paleta');
await p.click('#apBox [data-k="azul"]');await p.evaluate(()=>A.apIcones({v:'cor'}));await p.waitForTimeout(50);
ok(await p.evaluate(()=>localStorage.getItem('escritorio_aparencia'))===null,'voltar ao padrão limpa o aparelho');
console.log('ERROS',errs);await b.close();})();
