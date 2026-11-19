// Recebimento com valor do cliente (sem módulo de acordos) + pagamentos fora do combinado (a menos, a mais, quitar, renegociar)
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));let dialogs=[];p.on('dialog',d=>{dialogs.push(d.message().slice(0,70));d.accept();});
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[];db.financeiro=[];db.acordos=[];MP.p1.contrato={data:today(),itens:[{id:'it30',tipo:'percentual',pct:'30',descricao:'o que o cliente efetivamente receber'}]};
  db.meta.contasBanc=[{id:'bi',nome:'Banco Inter',tipo:'banco',ambito:'esc',saldoInicial:0,dataSaldo:'2026-01-01',ativo:true}];save();});
const sub=async()=>{await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(350);};
const v=(s,a)=>p.evaluate(s,a);
// UI sem acordos
await p.evaluate(()=>go('#/financeiro'));await p.waitForTimeout(300);
console.log('botão novo acordo no financeiro:',await v(()=>!!document.querySelector('#view h1 [data-act=newAcordo]')),'| aba acordos:',await v(()=>!!document.querySelector('[data-tab=acordos]')));
// 1) nova entrada → com valor do cliente
await p.evaluate(()=>formFin({natureza:'entrada',pessoaId:MP.ed.id,processoId:MP.p1.id}));await p.waitForTimeout(300);await p.click('[data-rtipo=cliente]');await p.waitForTimeout(400);
console.log('form:',await v(()=>document.getElementById('mTitle').textContent),'| pct:',await v(()=>mForm.elements.pctContratual.value),'| conta:',await v(()=>mForm.elements.honConta.selectedOptions[0].textContent));
await p.selectOption('[name=origem]','Alvará / levantamento judicial');await p.fill('[name=devedor]','Empresa XYZ');await p.fill('[name=descricao]','Alvará — depósito recursal');await p.fill('[name=principal]','10000');
await p.selectOption('[name=plano]','pr_vista');await p.fill('[name=diasRepasse]','2');await sub();
const ac1=await v(()=>db.acordos[0].id);
console.log('recebimento 1:',await v(a=>acordoLanc(a).map(l=>l.categoria.split(' ')[0]+' '+l.valor+' '+(contaDe(l).cod)+' '+finStatus(l)).join(' | '),ac1));
console.log('êxito do contrato:',await v(()=>{const it=MP.p1.contrato.itens[0];return it.status+' ids='+(it.acordoIds||[]).length+' hon='+it.valorApurado}));
// 2) segundo recebimento no mesmo processo (penhora) — puxa 30% de novo e soma
await p.evaluate(()=>formAcordo({pessoaId:MP.ed.id,processoId:MP.p1.id}));await p.waitForTimeout(300);console.log('pct 2º:',await v(()=>mForm.elements.pctContratual.value));
await p.fill('[name=descricao]','Penhora Sisbajud');await p.fill('[name=principal]','2000');await p.selectOption('[name=plano]','pr_vista');await sub();
console.log('êxito após 2º:',await v(()=>{const it=MP.p1.contrato.itens[0];return 'ids='+it.acordoIds.length+' hon='+it.valorApurado+' base='+it.baseValor}));
// 3) despesas adiantadas descontadas
await p.evaluate(()=>{db.financeiro.push({id:'cu1',natureza:'saida',conta:'pc3_2_01',categoria:'Custas / despesas do processo',descricao:'Perícia',valor:350,vencimento:today(),pagoEm:today(),valorPago:350,pessoaId:MP.ed.id,processoId:MP.p1.id});save();});
await p.evaluate(()=>formAcordo({pessoaId:MP.ed.id,processoId:MP.p1.id}));await p.waitForTimeout(300);console.log('aviso despesas:',await v(()=>document.getElementById('acDesp').textContent.slice(0,60)));
await p.fill('[name=descricao]','Acordo na execução');await p.fill('[name=principal]','6000');await p.fill('[name=sucumbencia]','600');await p.fill('[name=parcelas]','3');await p.fill('[name=primeiroVenc]','2026-12-10');await p.check('[name=descDesp]');await sub();
const ac3=await v(()=>db.acordos[2].id);
const P=async k=>console.log(await v(([a,k])=>{const g=acordoLanc(a,k);const s=c=>Math.round(g.filter(c).map(l=>l.pagoEm?realV(l):l.valor).reduce((x,y)=>x+y,0)*100)/100;return `  p${k}: cli ${s(l=>l.categoria===CAT_CLI)} hon ${s(l=>l.categoria===CAT_HC)} suc ${s(l=>l.categoria===CAT_HS)} reemb ${s(l=>l.reembAcordo)} rep ${s(l=>l.categoria===CAT_REP)} ${g.filter(l=>l.natureza==='entrada').every(l=>l.pagoEm)?'recebida':'aberta'} venc ${g.find(l=>l.natureza==='entrada')?.vencimento}`},[ac3,k]));
await P(1);await P(2);await P(3);
// 4) receber parcela 1 a MENOS (1000 de 2200) → saldo em nova parcela
await p.evaluate(a=>receiveParcela(a,1),ac3);await p.waitForTimeout(300);await p.fill('[name=valorRec]','1100');await p.dispatchEvent('[name=valorRec]','input');await p.waitForTimeout(100);
console.log('opções a menos:',await v(()=>[...mForm.elements.difModo.options].map(o=>o.value).join(',')));await p.selectOption('[name=difModo]','saldo');await p.fill('[name=saldoVenc]','2026-12-20');await sub();
console.log('após receber 1100 (saldo):');await P(1);await P(4);
// 5) receber parcela 2 a MAIS (3000 de 2200) → abate da próxima
await p.evaluate(a=>receiveParcela(a,2),ac3);await p.waitForTimeout(300);await p.fill('[name=valorRec]','3000');await p.dispatchEvent('[name=valorRec]','input');await p.waitForTimeout(100);
console.log('opções a mais:',await v(()=>[...mForm.elements.difModo.options].map(o=>o.value).join(',')));await p.selectOption('[name=difModo]','prox');await sub();
console.log('após receber 3000 (abate próxima):');await P(2);await P(3);await P(4);
// 6) quitar o restante do acordo com desconto
await p.evaluate(a=>formQuitar('acordo',a),ac3);await p.waitForTimeout(300);console.log('em aberto:',await v(()=>mForm.elements.valor.value));await p.fill('[name=valor]','1500');await sub();
console.log('após quitar com 1500:');await P(3);await P(4);
console.log('totais do recebimento: recebido',await v(a=>acordoLanc(a).filter(l=>l.natureza==='entrada').map(realV).reduce((x,y)=>x+y,0),ac3),'repasses',await v(a=>acordoLanc(a).filter(l=>l.categoria===CAT_REP).map(l=>l.valor).reduce((x,y)=>x+y,0),ac3));
// 7) conta comum em 3x — grupo, a menos para a próxima, a mais para as últimas, quitar
await p.evaluate(()=>formFin({natureza:'entrada'}));await p.waitForTimeout(300);await p.fill('[name=descricao]','Honorários contrato de compra e venda');await p.fill('[name=valor]','3000');await p.fill('[name=vencimento]','2026-12-01');
await p.evaluate(()=>document.getElementById('gfParc').open=true);await p.fill('[name=parcelas]','3');await p.dispatchEvent('[name=parcelas]','input');await sub();
const G=()=>v(()=>db.financeiro.filter(l=>/compra e venda/.test(l.descricao)).sort((a,b)=>a.vencimento.localeCompare(b.vencimento)).map(l=>l.valor+(l.pagoEm?'✔'+realV(l):'')).join(' | '));
console.log('grupo:',await v(()=>new Set(db.financeiro.filter(l=>/compra e venda/.test(l.descricao)).map(l=>l.grupo)).size),'→',await G());
const pagar=async(i,val,modo)=>{await p.evaluate(i=>payFin(db.financeiro.filter(l=>/compra e venda/.test(l.descricao)&&!l.pagoEm).sort((a,b)=>a.vencimento.localeCompare(b.vencimento))[i].id),i);await p.waitForTimeout(300);
  await p.fill('[name=valorPago]',val);await p.dispatchEvent('[name=valorPago]','input');await p.waitForTimeout(100);if(modo)await p.selectOption('[name=difModo]',modo);await sub();};
await pagar(0,'600','prox');console.log('a menos → próxima:',await G());
await pagar(0,'1800','ult');console.log('a mais → últimas:',await G());
// 8) renegociar a que sobrou + nova conta 2x
await p.evaluate(()=>{const l=db.financeiro.find(l=>/compra e venda/.test(l.descricao)&&!l.pagoEm);formRenegociar('grupo',l.id)});await p.waitForTimeout(300);
await p.fill('[name=total]','700');await p.fill('[name=n]','2');await p.fill('[name=venc]','2027-03-01');await sub();
console.log('renegociado:',await v(()=>db.financeiro.filter(l=>/compra e venda/.test(l.descricao)&&!l.pagoEm).map(l=>l.descricao.slice(-18)+' '+l.valor+' '+l.vencimento).join(' | ')),'| histórico:',await v(()=>(db.meta.finReneg||[]).length));
// 9) migração de parcelas antigas
await p.evaluate(()=>{['(1/3)','(2/3)','(3/3)'].forEach((x,i)=>db.financeiro.push({id:'old'+i,natureza:'entrada',categoria:'Honorários contratuais',descricao:'Honorários antigos '+x,valor:500,vencimento:'2027-0'+(i+1)+'-05',pessoaId:MP.hi.id}));db.meta.finGrupoV1=false;finGruposMigrar();});
console.log('migração grupo antigo:',await v(()=>new Set(['old0','old1','old2'].map(i=>byId('financeiro',i).grupo)).size+' grupo, irmãs '+finIrmas(byId('financeiro','old0')).length));
// 10) excluir recebimento 1 → êxito continua ligado ao 2º e 3º
await p.evaluate(a=>{const ac=byId('acordos',a);formAcordo(ac)},ac1);await p.waitForTimeout(300);await p.click('#mDel');await p.waitForTimeout(300);
console.log('êxito após excluir o 1º:',await v(()=>{const it=MP.p1.contrato.itens[0];return it.status+' ids='+(it.acordoIds||[]).length}));
// telas
await p.evaluate(()=>go('#/processo/'+MP.p1.id));await p.waitForTimeout(300);await p.evaluate(()=>{document.querySelector('[data-act=tab][data-tab=fin]')?.click()});await p.waitForTimeout(300);await p.screenshot({path:SS+'rec_proc.png',fullPage:true});
await p.evaluate(a=>go('#/acordo/'+a),ac3);await p.waitForTimeout(300);await p.screenshot({path:SS+'rec_parc.png',fullPage:true});
console.log('verificação financeiro:',await v(()=>vincProblemas().filter(x=>/Financeiro/.test(x.area)).map(x=>x.titulo).join(' | ')||'ok'));
console.log('diálogos:',dialogs.join(' / '));
console.log('ERROS',errs);await b.close();})();
