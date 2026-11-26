// Biblioteca: abas (Documentos · Arquivos · Jurisprudência), pesquisa de jurisprudência (vários termos, sintaxes, tribunais, salvas) e “Organizar menu”
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const ERR=[];
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+path.resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{window._abertos=[];window.open=(u)=>{_abertos.push(u);return {};};window._toasts=[];const o=toast;toast=m=>{_toasts.push(m);o(m);};});
// menu: Biblioteca logo depois de Serviços
const menu=await p.evaluate(()=>[...document.querySelectorAll('#nav a')].filter(a=>a.style.display!=='none').map(a=>a.dataset.v));console.log('menu:',menu.join(' '));
if(menu.indexOf('biblioteca')!==menu.indexOf('servicos')+1)ERR.push('Biblioteca fora do lugar no menu');
// abas na ordem pedida; Documentos e Arquivos “em breve”
await p.evaluate(()=>go('#/biblioteca'));await p.waitForTimeout(300);
const abas=await p.evaluate(()=>[...document.querySelectorAll('#view .tabs button')].map(x=>x.textContent.trim()));console.log('abas:',abas.join(' | '));
if(!/Documentos/.test(abas[0])||!/Arquivos/.test(abas[1])||!/Jurisprud/.test(abas[2]))ERR.push('ordem das abas');
for(const k of ['docs','arqs']){await p.evaluate(k=>A.bibAba({k}),k);await p.waitForTimeout(150);const t=await p.evaluate(()=>document.querySelector('#view .card.breve')?.textContent||'');if(!/em breve/.test(t))ERR.push('aba '+k+' sem “em breve”');}
await p.evaluate(()=>A.bibAba({k:'juris'}));await p.waitForTimeout(150);
// monta a pesquisa pela tela
await p.fill('[data-jur="txt"][data-i="0"]','dano moral');
await p.click('[data-act="jurAdd"][data-op="E"]');await p.fill('[data-jur="txt"][data-i="1"]','plano de saúde');
await p.click('[data-act="jurAdd"][data-op="OU"]');await p.fill('[data-jur="txt"][data-i="2"]','negativa de cobertura; recusa de tratamento');
await p.click('[data-act="jurAdd"][data-op="NAO"]');await p.fill('[data-jur="txt"][data-i="3"]','odontológico');
await p.click('[data-act="jurAdd"][data-op="PROX"]');await p.fill('[data-jur="txt"][data-i="4"]','prisão');await p.fill('[data-jur="txt2"][data-i="4"]','civil');await p.fill('[data-jur="n"][data-i="4"]','3');
const q=await p.textContent('#jurQ');console.log('pesquisa:',q);
const esp='"dano moral" E "plano de saúde" E prisão PROX3 civil E ("negativa de cobertura" OU "recusa de tratamento") NÃO odontológico';
if(q!==esp)ERR.push('pesquisa montada: '+q);
const en=await p.evaluate(()=>jurMontar(JUR,'en'));console.log('em inglês:',en);if(!/ AND .* OR .* NOT odontológico/.test(en))ERR.push('sintaxe AND/OR/NOT');
// sem “frase exata”: sem aspas
await p.click('[data-jur="exata"][data-i="0"]');const q2=await p.textContent('#jurQ');if(!/^dano moral E/.test(q2))ERR.push('frase exata desmarcada');await p.click('[data-jur="exata"][data-i="0"]');
// abrir no STJ (endereço com {q}) e no TJSP (sem {q}: só abre e copia)
await p.click('[data-act="jurAbrir"][data-id="stj"]');await p.click('[data-act="jurAbrir"][data-id="tjsp"]');await p.waitForTimeout(200);
const ab=await p.evaluate(()=>_abertos);console.log('abertos:',ab);
if(!ab[0]||!ab[0].startsWith('https://scon.stj.jus.br/')||decodeURIComponent(ab[0].split('livre=')[1])!==esp)ERR.push('link do STJ');
if(ab[1]!=='https://esaj.tjsp.jus.br/cjsg/consultaCompleta.do')ERR.push('link do TJSP');
// só ementa → STF recebe pesquisa_inteiro_teor=false
await p.selectOption('[data-jur="inteiro"]','0');await p.waitForTimeout(150);await p.click('[data-act="jurAbrir"][data-id="stf"]');await p.waitForTimeout(150);
const stf=await p.evaluate(()=>_abertos[_abertos.length-1]);if(!/pesquisa_inteiro_teor=false/.test(stf)||!/queryString=/.test(stf))ERR.push('STF: '+stf);
// tribunais: desmarcar TST tira o botão
await p.click('[data-act="jurTrib"][data-id="tst"]');await p.waitForTimeout(150);if(await p.$('[data-act="jurAbrir"][data-id="tst"]'))ERR.push('TST continua na lista');
// salvar a pesquisa e usar de novo
await p.click('[data-act="jurSalvar"]');await p.waitForTimeout(150);await p.fill('[name=nome]','Plano de saúde – negativa');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(250);
await p.click('[data-act="jurLimpar"]');await p.waitForTimeout(150);if((await p.textContent('#jurQ')).trim()!=='—')ERR.push('limpar');
const sid=await p.evaluate(()=>db.meta.jurSalvas[0].id);await p.click(`[data-act="jurUsar"][data-id="${sid}"]`);await p.waitForTimeout(150);
const q3=await p.textContent('#jurQ');console.log('salva → usada:',q3===esp);if(q3!==esp)ERR.push('pesquisa salva');
// ⚙️ Tribunais: incluir o TJMG com {q}
await p.click('h1 [data-act="jurTribs"]');await p.waitForTimeout(200);await p.click('#jtAdd');
await p.fill('.jurTr:last-child .jtNome','TJMG');await p.fill('.jurTr:last-child .jtUrl','https://www5.tjmg.jus.br/jurisprudencia/pesquisaPalavrasEspelhoAcordao.do?palavras={q}');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(250);
const tr=await p.evaluate(()=>db.meta.jurTribunais.map(t=>t.nome).join(','));console.log('tribunais:',tr);if(!/TJMG/.test(tr)||(tr.match(/,/g)||[]).length!==6)ERR.push('incluir tribunal');
if(!await p.$('[data-act="jurAbrir"][data-id^="t"]:not([data-id="tst"]):not([data-id="tjsp"]):not([data-id^="trt"]):not([data-id^="trf"])'))ERR.push('TJMG não aparece para abrir');
// ✏️ Personalizar telas › Menu lateral: subir a Biblioteca para depois do Início
await p.click('[data-act="menuOrg"]');await p.waitForTimeout(200);await p.click('[data-paba="menu"]');
for(let i=0;i<5;i++){await p.click('.pRow[data-k="biblioteca"] .pUp');}
await p.click('.pRow[data-k="horas"] input[type=checkbox]');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
const m2=await p.evaluate(()=>[...document.querySelectorAll('#nav a')].filter(a=>a.style.display!=='none').map(a=>a.dataset.v));console.log('menu organizado:',m2.join(' '));
if(m2[1]!=='biblioteca'||m2.includes('horas'))ERR.push('organizar menu');
const pers=await p.evaluate(()=>{const c=painelCfg();return c.ordem.menu[1]+'/'+c.menu.horas+'/'+(c.ordem.atalhos.length>0);});if(pers!=='biblioteca/0/true')ERR.push('personalizar perdeu dados: '+pers);
// celular
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('#/biblioteca/juris'));await p.waitForTimeout(300);
const w=await p.evaluate(()=>document.documentElement.scrollWidth);if(w>390)ERR.push('celular: largura '+w);
await p.screenshot({path:'/tmp/claude-0/tjuris_cel.png',fullPage:true});
console.log('ERROS',[...ERR,...errs]);await b.close();})();
