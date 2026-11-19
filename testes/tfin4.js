// Financeiro — etapa 4: saldos por conta, transferências, retirada p/ pessoal, demonstrativo caixa × competência, repasses, extrato por pasta, relatórios
const {chromium,devices}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.meta.workflows=[];db.financeiro=[];db.acordos=[];const t=today(),m=t.slice(0,8);
  db.meta.contasBanc=[{id:'bi',nome:'Banco Inter PJ',tipo:'banco',ambito:'esc',saldoInicial:1000,dataSaldo:m+'01',ativo:true},{id:'cx',nome:'Caixa',tipo:'caixa',ambito:'esc',saldoInicial:0,dataSaldo:m+'01',ativo:true},{id:'it',nome:'Itaú pessoal',tipo:'banco',ambito:'pes',saldoInicial:500,dataSaldo:m+'01',ativo:true}];
  const L=(o)=>db.financeiro.push({id:uid(),criadoEm:new Date().toISOString(),...o});
  L({natureza:'entrada',conta:'pc1_1_01',categoria:'Honorários contratuais',descricao:'Honorários Maria',valor:1500,vencimento:m+'02',pagoEm:m+'03',valorPago:1500,contaBanc:'bi',pessoaId:MP.hi.id});
  L({natureza:'saida',conta:'pc2_1_01',categoria:'Aluguel e condomínio',descricao:'Aluguel',valor:800,vencimento:m+'05',pagoEm:m+'05',valorPago:800,contaBanc:'bi'});
  L({natureza:'entrada',conta:'pc1_1_04',categoria:'Consulta / parecer',descricao:'Consulta (competência mês passado)',valor:300,vencimento:m+'04',competencia:addMonths(m+'01',-1).slice(0,7),pagoEm:m+'04',valorPago:300,contaBanc:'cx'});
  L({natureza:'saida',conta:'pc2_6_01',categoria:'ISS',descricao:'ISS a pagar',valor:120,vencimento:addDays(t,10)});
  db.transf=[{id:'t1',data:m+'06',origem:'cx',destino:'bi',valor:200,historico:'depósito'}];save();});
console.log('saldos:',await p.evaluate(()=>['bi','cx','it'].map(c=>c+'='+saldoConta(c)).join(' ')));
// retirada pró-labore
await p.evaluate(()=>formRetirada());await p.waitForTimeout(300);await p.fill('[name=valor]','600');await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(300);
console.log('após retirada:',await p.evaluate(()=>['bi','it'].map(c=>c+'='+saldoConta(c)).join(' ')+' | lançs: '+db.financeiro.filter(l=>l.parRetirada).map(l=>ambDe(l)+':'+contaDe(l).cod).join(',')));
// DRE caixa x competência
const dre=r=>p.evaluate(r=>{const t=today(),de=t.slice(0,8)+'01',ate=addDays(addMonths(de,1),-1);const x=finDRE({de,ate,regime:r});return `rec ${x.kinds.rec} desp ${x.kinds.desp} oper ${x.operacional} ret ${x.kinds.ret} final ${x.final}`},r);
console.log('DRE caixa:',await dre('caixa'));console.log('DRE competência:',await dre('comp'));
// painel
await p.evaluate(()=>go('#/financeiro'));await p.waitForTimeout(400);console.log('painel saldos:',await p.evaluate(()=>[...document.querySelectorAll('.fSaldos .fcK')].map(k=>k.querySelector('small').textContent.trim()+' '+k.querySelector('b').textContent).join(' | ')));
console.log('painel resultado:',await p.evaluate(()=>!!document.querySelector('.finRes .dre')));await p.screenshot({path:SS+'fin_painel.png',fullPage:true});
// movimentações
await p.evaluate(()=>{MOV.cb='bi';go('#/financeiro/movimentacoes')});await p.waitForTimeout(300);
console.log('extrato bi:',await p.evaluate(()=>[...document.querySelectorAll('.card table tbody tr')].map(r=>r.children[1].textContent.trim().slice(0,22)+' '+r.children[3].textContent+' → '+r.children[4].textContent).join(' | ')));
await p.screenshot({path:SS+'fin_mov.png',fullPage:true});
// acordo com repasse para extrato por pasta e repasses
await p.evaluate(()=>{const ac=upsert('acordos',{pessoaId:MP.ed.id,processoId:MP.p1.id,descricao:'Acordo XYZ',data:today(),principal:6000,sucumbencia:600,parcelas:3,primeiroVenc:today(),pctContratual:30,diasRepasse:2,modo:'conta',honConta:'pc1_1_02'});gerarAcordo(ac);acordoPartSyncTodas(ac);
  acordoLanc(ac.id,1).filter(l=>l.natureza==='entrada').forEach(l=>Object.assign(l,{pagoEm:today(),valorPago:l.valor,contaBanc:'bi'}));const r=acordoLanc(ac.id,1).find(l=>l.categoria===CAT_REP);r.vencimento=addDays(today(),-1);save();});
await p.evaluate(()=>go('#/financeiro/repasses'));await p.waitForTimeout(300);console.log('repasses:',await p.evaluate(()=>[...document.querySelectorAll('.fcK')].map(k=>k.querySelector('small').textContent+':'+k.querySelector('b').textContent).join(' | ')));
await p.screenshot({path:SS+'fin_rep.png',fullPage:true});
await p.evaluate(()=>{MOV.vis='pasta';MOV.cli=MP.ed.id;go('#/financeiro/movimentacoes')});await p.waitForTimeout(300);
console.log('prestação:',await p.evaluate(()=>[...document.querySelectorAll('.prest .fcK')].map(k=>k.querySelector('small').textContent+':'+k.querySelector('b').textContent).join(' | ')),'| mostra sucumbência?',await p.evaluate(()=>/sucumb/i.test(document.querySelector('.prest').textContent.replace('honorários de sucumbência e participações',''))));
await p.screenshot({path:SS+'fin_pasta.png',fullPage:true});
// relatórios
await p.evaluate(()=>go('#/financeiro/relatorios'));await p.waitForTimeout(400);console.log('relatórios:',await p.evaluate(()=>[...document.querySelectorAll('.card h2')].map(h=>h.textContent.trim().split(' ').slice(0,3).join(' ')).join(' | ')));
await p.click('[data-act=finReg][data-v=comp]');await p.waitForTimeout(300);console.log('competência ativa:',await p.evaluate(()=>FIN_REG));
await p.screenshot({path:SS+'fin_rel.png',fullPage:true});
// pessoal
await p.click('[data-act=finAmb][data-v=pes]');await p.waitForTimeout(300);console.log('DRE pessoal:',await p.evaluate(()=>{const t=today(),de=t.slice(0,8)+'01';const x=finDRE({de,ate:addDays(addMonths(de,1),-1),regime:'caixa'});return 'rec '+x.kinds.rec}));
// verificação: excluir conta bancária usada em transferência
await p.evaluate(()=>{FIN_AMB='esc';db.meta.contasBanc=db.meta.contasBanc.filter(c=>c.id!=='cx');save();});console.log('verificação:',await p.evaluate(()=>vincProblemas().filter(x=>/Financeiro/.test(x.area)).map(x=>x.titulo).join(' | ')));
// celular
const m=await (await b.newContext({...devices['iPhone 13']})).newPage();await m.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await m.waitForTimeout(500);
await m.evaluate(`(function(){const t=today();${seed}})()`);
for(const v of ['','repasses','movimentacoes','relatorios']){await m.evaluate(v=>go('#/financeiro'+(v?'/'+v:'')),v);await m.waitForTimeout(300);console.log('mob '+(v||'painel')+':',await m.evaluate(()=>document.documentElement.scrollWidth));}
await m.screenshot({path:SS+'fin_rel_mob.png',fullPage:true});
console.log('ERROS',errs);await b.close();})();
