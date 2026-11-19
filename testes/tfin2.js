// Financeiro — etapa 2: A receber / A pagar, parcelas por plano, recorrência, sem data, baixa com juros/multa/desconto e parcial
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[];db.financeiro=[];save();});
const sub=async()=>{await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);};
// 1) conta a receber com plano Entrada + 30/60
await p.evaluate(()=>formFin({natureza:'entrada'}));await p.waitForTimeout(300);
console.log('grupos:',await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo summary')].map(s=>s.textContent.trim().split(' ').slice(0,3).join(' ')).join(' | ')));
await p.selectOption('[name=pessoaId]',await p.evaluate(()=>MP.ed.id));await p.fill('[name=descricao]','Honorários iniciais');await p.fill('[name=valor]','3000');await p.fill('[name=vencimento]','2026-12-01');
await p.evaluate(()=>document.getElementById('gfParc').open=true);await p.selectOption('[name=plano]','pr_e3060');await p.waitForTimeout(150);
console.log('prévia:',await p.textContent('#fParcPrev'));await sub();
console.log('parcelas:',await p.evaluate(()=>db.financeiro.map(l=>l.descricao+' '+l.vencimento+' '+l.valor).join(' | ')));
// 2) recorrência mensal indeterminada (aluguel, a pagar)
await p.evaluate(()=>formFin({natureza:'saida'}));await p.waitForTimeout(300);await p.fill('[name=descricao]','Aluguel da sala');await p.fill('[name=valor]','1800');await p.fill('[name=vencimento]',await p.evaluate(()=>today().slice(0,8)+'05'));
await p.evaluate(()=>document.getElementById('gfParc').open=true);await p.check('[name=recorr]');await p.waitForTimeout(100);await p.selectOption('#fConta','pc2_1_01');await sub();
console.log('aluguel:',await p.evaluate(()=>{const ls=db.financeiro.filter(l=>l.descricao==='Aluguel da sala');return ls.length+' parcelas, conta '+contaDe(ls[0]).nome+', última '+ls.at(-1).vencimento+', série '+finSerieTxt(finSerie(ls[0].serie))}));
// estender (simula passagem do tempo: apaga as 3 últimas e roda)
console.log('estender:',await p.evaluate(()=>{const ls=db.financeiro.filter(l=>l.descricao==='Aluguel da sala');const s=finSerie(ls[0].serie);const tira=ls.slice(-3);db.financeiro=db.financeiro.filter(x=>!tira.includes(x));s.ultima=ls.at(-4).vencimento;finSeriesEstender();return db.financeiro.filter(l=>l.descricao==='Aluguel da sala').length}));
// 3) convênio sem data
await p.evaluate(()=>formFin({natureza:'entrada'}));await p.waitForTimeout(300);await p.selectOption('[name=pessoaId]',await p.evaluate(()=>MP.el.id));await p.waitForTimeout(100);await p.selectOption('[name=processoId]',await p.evaluate(()=>MP.p3.id));
await p.fill('[name=descricao]','Honorários convênio Defensoria/OAB');await p.fill('[name=valor]','1200');await p.check('[name=semData]');await p.selectOption('#fConta','pc1_1_08');await sub();
console.log('sem data:',await p.evaluate(()=>{const l=db.financeiro.find(x=>/convênio/.test(x.descricao));return 'venc="'+l.vencimento+'" status='+finStatus(l)+' conta='+contaDe(l).nome}));
await p.evaluate(()=>{upsert('processos',{...MP.p3,status:'Encerrado'});});console.log('aviso encerrado:',await p.evaluate(()=>vincProblemas().filter(x=>/ao final/.test(x.titulo)).map(x=>x.titulo).join('')));
// 4) baixa atrasada com juros e multa
await p.evaluate(()=>{upsert('financeiro',{id:'J1',natureza:'entrada',conta:'pc1_1_01',categoria:'Honorários contratuais',descricao:'Parcela atrasada',valor:1000,vencimento:addDays(today(),-30),jurosMes:1,multaPct:2});payFin('J1');});await p.waitForTimeout(300);
console.log('baixa calc:',await p.evaluate(()=>['juros','multa','desconto','valorPago'].map(k=>k+'='+mForm.elements[k].value).join(' ')));await sub();
console.log('baixa ok:',await p.evaluate(()=>{const l=byId('financeiro','J1');return l.pagoEm+' '+l.valorPago+' j='+l.juros+' m='+l.multa+' parcial='+db.financeiro.some(x=>x.saldoDe==='J1')}));
// 5) baixa parcial
await p.evaluate(()=>{upsert('financeiro',{id:'P1',natureza:'saida',conta:'pc2_1_04',categoria:'Internet e telefone',descricao:'Internet',valor:200,vencimento:today()});payFin('P1');});await p.waitForTimeout(300);await p.fill('[name=valorPago]','120');await p.dispatchEvent('[name=valorPago]','input');await p.waitForTimeout(100);await sub();
console.log('parcial:',await p.evaluate(()=>db.financeiro.filter(x=>x.id==='P1'||x.saldoDe==='P1').map(x=>x.descricao+' '+x.valor+(x.pagoEm?' pago':' aberto')).join(' | ')));
// 6) telas
await p.evaluate(()=>go('#/financeiro/receber'));await p.waitForTimeout(400);
console.log('cards receber:',await p.evaluate(()=>[...document.querySelectorAll('.fcK')].map(k=>k.querySelector('small').textContent+':'+k.querySelector('b').textContent).join(' | ')));
console.log('grupos tabela:',await p.evaluate(()=>[...document.querySelectorAll('#list tr th[colspan], #list .mhead, #list tr.mes td')].slice(0,6).map(x=>x.textContent.trim().slice(0,40)).join(' | ')));
await p.screenshot({path:SS+'fin_receber.png',fullPage:true});
await p.selectOption('[data-fc="entrada.sit"]','semdata');await p.waitForTimeout(200);console.log('filtro sem data:',await p.evaluate(()=>window._finList.map(x=>x.descricao).join(',')));
await p.selectOption('[data-fc="entrada.sit"]','pago');await p.waitForTimeout(200);console.log('filtro pagas:',await p.evaluate(()=>window._finList.map(x=>x.descricao).join(',')));
await p.evaluate(()=>go('#/financeiro/pagar'));await p.waitForTimeout(300);await p.click('[data-act=fcPer][data-p=mes]');await p.waitForTimeout(200);console.log('pagar este mês:',await p.evaluate(()=>window._finList.map(x=>x.descricao+' '+x.vencimento).join(' | ')));
// 7) excluir uma da recorrência → pergunta das futuras
await p.evaluate(()=>{const l=db.financeiro.filter(x=>x.descricao==='Aluguel da sala').sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[2];formFin(l)});await p.waitForTimeout(300);await p.click('#mDel');await p.waitForTimeout(300);
console.log('após excluir com futuras:',await p.evaluate(()=>db.financeiro.filter(x=>x.descricao==='Aluguel da sala').length+' · ativa='+finSerie(db.financeiro.find(x=>x.descricao==='Aluguel da sala').serie).ativa));
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('#/financeiro/receber'));await p.waitForTimeout(300);await p.screenshot({path:SS+'fin_receber_mob.png',fullPage:true});
console.log('overflow mob:',await p.evaluate(()=>document.documentElement.scrollWidth));
await p.evaluate(()=>formFin({natureza:'entrada'}));await p.waitForTimeout(300);await p.evaluate(()=>document.querySelectorAll('#mForm details').forEach(d=>d.open=true));console.log('form mob overflow:',await p.evaluate(()=>document.documentElement.scrollWidth));
console.log('ERROS',errs);await b.close();})();
