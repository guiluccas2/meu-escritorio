// Modelos de honorários: criar, editar, ordenar (▲▼) e excluir em Configurações; escolha pelo id; aplicar não liga o contrato ao modelo;
// área guardada pelo nome (renomear acompanha, área excluída aparece na Verificação); formulário cabe no celular
const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
const v=(s,a)=>p.evaluate(s,a), sub=async()=>{await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(350);};
const ok=(c,m)=>{if(!c)errs.push(m);console.log((c?'✔ ':'✘ ')+m);};
// 1. todos os modelos têm id (inclusive os antigos, sem id)
await p.evaluate(()=>{db.meta.modelosHon.push({nome:'Antigo sem id',area:'',itens:[{tipo:'outro',descricao:'x'}]});localStorage.clear();});
await p.evaluate(()=>save());await p.waitForTimeout(500);
await p.reload();await p.waitForTimeout(800);
await p.evaluate(()=>{const P=n=>db.pessoas.find(x=>x.nome===n);window.MP={p4:db.processos.find(x=>x.titulo==='Alimentos'),hi:P('Higor Barros')};});
ok(await v(()=>modelos().length>=3&&modelos().every(m=>m.id)),'todos os modelos com id');
// 2. novo modelo pela tela de Configurações
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(400);
ok(await v(()=>!!document.querySelector('[data-act=novoModelo]')),'botão “+ novo modelo”');
ok(await v(()=>document.querySelectorAll('[data-act=editModelo]').length===modelos().length&&document.querySelectorAll('[data-act=modeloSobe]').length===modelos().length),'editar e ▲▼ em cada modelo');
await p.click('[data-act=novoModelo]');await p.waitForTimeout(300);
await p.fill('[name=nome]','Família — 2.000 iniciais + 10% da partilha');await p.selectOption('[name=area]','Família e Sucessões');
await p.click('.addIt[data-t=fixo]');await p.click('.addIt[data-t=percentual]');await p.waitForTimeout(100);
ok(await v(()=>!mForm.querySelector('.it-venc')&&!mForm.querySelector('.it-gerar')&&!mForm.querySelector('.it-pago')),'modelo sem vencimento / lançar / já recebido');
await p.evaluate(()=>{const r=mForm.querySelectorAll('.item-row');r[0].querySelector('.it-valor').value='2000';r[0].querySelector('.it-parc').value='2';r[1].querySelector('.it-pct').value='10';r[1].querySelector('.it-desc').value='a partilha';});
await sub();
const mid=await v(()=>modelos().find(m=>/partilha/.test(m.nome))?.id);
ok(!!mid,'modelo criado');
ok(await v(id=>{const m=modeloPorId(id);return m.area==='Família e Sucessões'&&m.itens.length===2&&m.itens[0].valor==='2000'&&m.itens[0].parcelas==='2'&&!('primeiroVenc' in m.itens[0])&&!('id' in m.itens[0])&&m.itens[1].pct==='10'},mid),'itens gravados limpos');
// nome repetido não salva; sem itens não salva
await p.click('[data-act=novoModelo]');await p.waitForTimeout(300);await p.fill('[name=nome]','família — 2.000 INICIAIS + 10% da partilha');await p.click('.addIt[data-t=outro]');await sub();
ok(await v(()=>!document.getElementById('modal').classList.contains('hidden')&&modelos().filter(m=>/partilha/i.test(m.nome)).length===1),'nome repetido bloqueado');
await p.evaluate(()=>closeModal());
await p.click('[data-act=novoModelo]');await p.waitForTimeout(300);await p.fill('[name=nome]','Vazio');await sub();
ok(await v(()=>!modelos().some(m=>m.nome==='Vazio')),'modelo sem itens bloqueado');await p.evaluate(()=>closeModal());
// 3. aplicar num processo (contrato) — sugerido pela área
await p.evaluate(id=>formContrato(id),await v(()=>MP.p4.id));await p.waitForTimeout(300);
ok(await v(()=>mForm.querySelectorAll('.item-row').length===2),'modelo sugerido pela área do processo');
ok(await v(id=>[...mForm.elements.modelo.options].some(o=>o.value===id),mid),'opções do select pelo id');
await sub();
ok(await v(()=>{const c=byId('processos',MP.p4.id).contrato;return c.itens.length===2&&c.itens.every(i=>i.id)&&c.itens[1].pct==='10'}),'contrato gravado no processo');
// 4. editar o modelo não muda o contrato já feito
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(300);
await p.click(`[data-act=editModelo][data-id="${mid}"]`);await p.waitForTimeout(300);
ok(await v(()=>mForm.elements.nome.value.includes('partilha')&&mForm.querySelectorAll('.item-row').length===2),'editar abre com os dados');
await p.evaluate(()=>{const r=mForm.querySelectorAll('.item-row');r[1].querySelector('.it-pct').value='20';r[0].querySelector('.rmIt').click();});await sub();
ok(await v(id=>{const m=modeloPorId(id);return m.itens.length===1&&m.itens[0].pct==='20'},mid),'modelo atualizado (mesmo id)');
ok(await v(()=>{const c=byId('processos',MP.p4.id).contrato;return c.itens.length===2&&c.itens[1].pct==='10'}),'contrato antigo intacto');
// 5. ordenar
const ordem0=await v(()=>modelos().map(m=>m.id));
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(300);
ok(await v(()=>document.querySelector('[data-act=modeloSobe]').disabled&&[...document.querySelectorAll('[data-act=modeloDesce]')].pop().disabled),'▲ do primeiro e ▼ do último desativados');
await p.click(`[data-act=modeloSobe][data-id="${mid}"]`);await p.waitForTimeout(300);
const ordem1=await v(()=>modelos().map(m=>m.id));
ok(ordem1.indexOf(mid)===ordem0.indexOf(mid)-1&&ordem1.length===ordem0.length,'▲ sobe uma posição');
await p.click(`[data-act=modeloDesce][data-id="${mid}"]`);await p.waitForTimeout(300);
ok(JSON.stringify(await v(()=>modelos().map(m=>m.id)))===JSON.stringify(ordem0),'▼ volta à posição');
await p.evaluate(id=>{moverModelo(id,-1);moverModelo(id,-1);moverModelo(id,-1);moverModelo(id,-1);moverModelo(id,-1);},mid);
ok(await v(id=>modelos()[0].id===id,mid),'subir até o topo (sem passar do limite)');
// 6. novo processo usa o modelo escolhido pelo id, na ordem nova
await p.evaluate(()=>formProc({clienteId:MP.hi.id}));await p.waitForTimeout(300);
ok(await v(id=>mForm.elements.modeloHon.options[1].value===id,mid),'cadastro do processo lista na ordem nova');
await p.fill('[name=titulo]','Divórcio');await p.selectOption('[name=area]','Família e Sucessões');await p.waitForTimeout(100);
ok(await v(id=>mForm.elements.modeloHon.value===id,mid),'área sugere o modelo no cadastro');
await sub();
ok(await v(()=>{const pr=db.processos.find(x=>x.titulo==='Divórcio');return pr?.contrato?.itens?.length===1&&pr.contrato.itens[0].pct==='20'&&pr.contrato.itens[0].status==='pendente'}),'processo novo com os itens do modelo');
// 7. salvar itens como modelo (no contrato) também ganha id
await p.evaluate(()=>{window.prompt=()=>'Salvo do contrato';formContrato(MP.p4.id)});await p.waitForTimeout(300);await p.click('#salvaModelo');await p.evaluate(()=>closeModal());
ok(await v(()=>{const m=modelos().find(x=>x.nome==='Salvo do contrato');return !!m?.id&&m.itens.every(i=>!i.id&&!('status' in i))}),'“salvar estes itens como modelo” com id e itens limpos');
// 8. área: renomear acompanha; área excluída → Verificação (corrigir)
await p.evaluate(()=>{const its=listaItens('area').map(x=>({...x}));its.find(x=>x.v==='Família e Sucessões').v='Família';renomearOpcao('area','Família e Sucessões','Família');db.meta.listas={...db.meta.listas,area:its};save();});
ok(await v(id=>modeloPorId(id).area==='Família',mid),'renomear a área atualiza o modelo');
await p.evaluate(()=>{db.meta.listas={...db.meta.listas,area:listaItens('area').filter(x=>x.v!=='Família')};save();});
ok(await v(()=>vincProblemas().some(x=>/Modelos de honor/.test(x.area)&&x.corrigir==='modArea')),'Verificação aponta área excluída');
await p.evaluate(()=>{VER_CORRIGIR.modArea();save();});
ok(await v(id=>modeloPorId(id).area===''&&!vincProblemas().some(x=>/Modelos de honor/.test(x.area)),mid),'corrigir deixa “qualquer área”');
// 9. excluir não mexe nos contratos
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(300);await p.click(`[data-act=delModelo][data-id="${mid}"]`);await p.waitForTimeout(300);
ok(await v(id=>!modeloPorId(id)&&byId('processos',MP.p4.id).contrato.itens.length===2&&db.processos.find(x=>x.titulo==='Divórcio').contrato.itens.length===1,mid),'excluir mantém os contratos');
// restaurar padrão: ids novos
await p.evaluate(()=>{db.meta.modelosHon=[];save();A.resetModelos();});
ok(await v(()=>modelos().length===3&&modelos().every(m=>m.id)),'restaurar padrão com id');
// 10. celular: formulário e quadro cabem em 390 px
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>go('#/config'));await p.waitForTimeout(400);
ok(await v(()=>document.documentElement.scrollWidth<=390),'Configurações cabe em 390 px');
await p.evaluate(()=>formModelo(modelos()[1].id));await p.waitForTimeout(300);await p.click('.addIt[data-t=fixo]');await p.click('.addIt[data-t=beneficios]');
ok(await v(()=>document.documentElement.scrollWidth<=390&&[...mForm.querySelectorAll('input,select,button')].every(e=>e.getBoundingClientRect().right<=391)),'formulário do modelo cabe em 390 px');
await p.screenshot({path:SS+'modhon_cel.png'});
console.log('ERROS',JSON.stringify(errs));await b.close();})();
