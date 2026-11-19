const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://comunicaapi.pje.jus.br/**',r=>r.abort());
await ctx.route('https://viacep.com.br/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({cep:'13010-000',logradouro:'Rua Barão de Jaguara',bairro:'Centro',localidade:'Campinas',uf:'SP'})}));
await ctx.route('https://servicodados.ibge.gov.br/**',r=>r.fulfill({contentType:'application/json',body:JSON.stringify([{nome:'Campinas'},{nome:'Sumaré'},{nome:'Hortolândia'}])}));
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>{console.log('  [diálogo]',d.message().slice(0,80));d.accept();});
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>{db.pessoas[0].telefone2='(19) 3333-4444';db.pessoas[0].endereco='Rua A, 10, Centro, Campinas/SP, CEP 13010-000';db.meta.pastaV2=false;save();});
await p.reload();await p.waitForTimeout(800);
console.log('pastas migradas:', await p.evaluate(()=>db.pessoas.map(x=>x.pasta).join(',')), '| código proc:', await p.evaluate(()=>procCode(db.processos[0])), '| próxima:', await p.evaluate(()=>nextPasta()));
console.log('rápido 152.1 / P0152.1:', await p.evaluate(()=>[parseRapido('contestação 15 dias 152.1').processoId?'achou':'não', parseRapido('réplica 15 dias P0152.1').processoId?'achou':'não'].join(' / ')));
await p.evaluate(()=>A.newPessoa({}));await p.waitForTimeout(300);
console.log('seções:', await p.evaluate(()=>[...document.querySelectorAll('#mForm details.fgrupo')].map(d=>(d.open?'▾':'▸')+d.querySelector('summary').textContent.trim().split(' ').slice(0,2).join(' ')).join(' | ')));
console.log('pasta sugerida:', await p.inputValue('[name=pasta]'));
await p.fill('[name=nome]','Maria Teste');
await p.fill('[name=doc]','11144477735');await p.locator('[name=doc]').blur();await p.fill('[name=rg]','123456789');await p.locator('[name=rg]').blur();
console.log('máscaras:', await p.inputValue('[name=doc]'), await p.inputValue('[name=rg]'), '| aviso:', await p.textContent('#docAviso'));
await p.fill('[name=doc]','11144477700');await p.locator('[name=doc]').blur();console.log('cpf inválido:', await p.textContent('#docAviso'));await p.fill('[name=doc]','111.444.777-35');
await p.selectOption('[name=estadoCivil]','Casado(a)');await p.selectOption('[name=sexo]','Feminino');await p.fill('[name=nacionalidade]','Brasileira');await p.fill('[name=mae]','Ana Teste');
await p.fill('[name=cep]','13010000');await p.locator('[name=cep]').blur();await p.waitForTimeout(400);
console.log('CEP:', await p.inputValue('[name=logradouro]'), '/', await p.inputValue('[name=cidade]'), '/', await p.inputValue('[name=uf]'), '|', await p.textContent('#cepSt'), '| cidades:', await p.evaluate(()=>document.querySelectorAll('#dl_cidade option').length));
await p.fill('[name=numero]','100');
await p.fill('[name=telefone]','19999998888');await p.locator('[name=telefone]').blur();console.log('celular:', await p.inputValue('[name=telefone]'));
await p.click('#telAdd');await p.fill('.tel-row .tNum','1932221111');await p.fill('.tel-row .tObs','recado com a irmã');
await p.selectOption('[name=origem]','Indicação');console.log('indicado por aparece:', await p.evaluate(()=>getComputedStyle(mForm.elements.indicacao.closest('.fld')).display));
await p.fill('[name=indicacao]','João');
await p.click('#mForm summary:has-text("Dados bancários")');await p.fill('.cB','341 - Itaú Unibanco');await p.fill('.cAg','1234');await p.fill('.cCt','56789-0');await p.selectOption('.cPxT','CPF / CNPJ');await p.fill('.cPx','111.444.777-35');
await p.click('#contaAdd');console.log('contas:', await p.evaluate(()=>document.querySelectorAll('.conta-row').length));await p.fill('.conta-row:last-child .cB','260 - Nubank');
await p.click('[data-tg=p3]');
await p.screenshot({path:SS+'pe-form.png'});
// PJ
await p.check('[name=natureza][value=Jurídica]');
console.log('PJ:', await p.evaluate(()=>[mForm.elements.nome.closest('.fld').querySelector('label').textContent, getComputedStyle(mForm.elements.rg.closest('.fld')).display, document.getElementById('gPessoais').style.display, document.getElementById('gRepPJ').style.display].join(' | ')));
await p.check('[name=natureza][value=Física]');
await p.click('#mForm .mfoot button[type=submit]');await p.waitForTimeout(400);
console.log('salvo:', await p.evaluate(()=>{const x=db.pessoas.find(x=>x.nome==='Maria Teste');return JSON.stringify({pasta:x.pasta,doc:x.doc,rg:x.rg,end:x.endereco,tels:x.telefones,contas:x.contas.map(c=>c.banco),tags:x.tags,orig:x.origem,ind:x.indicacao,nat:x.natureza});}));
await p.screenshot({path:SS+'pe-ficha.png',fullPage:true});
console.log('ficha:', (await p.innerText('#view .card .info')).replace(/\n+/g,' | ').slice(0,500));
// CPF duplicado
await p.evaluate(()=>A.newPessoa({}));await p.fill('[name=nome]','Outra');await p.fill('[name=doc]','11144477735');await p.locator('[name=doc]').blur();console.log('dup aviso:', await p.textContent('#docAviso'));await p.click('#mCancel');
// editar pessoa antiga: telefone2 vira extra, endereço antigo
const id0=await p.evaluate(()=>db.pessoas[0].id);await p.evaluate(id=>formPessoa(byId('pessoas',id)),id0);await p.waitForTimeout(200);
console.log('antigo:', await p.evaluate(()=>document.querySelectorAll('.tel-row').length), await p.evaluate(()=>!!document.querySelector('.endLeg')));
await p.click('#endLegCep');await p.waitForTimeout(300);console.log('cep do texto:', await p.inputValue('[name=logradouro]'));
await p.click('#mCancel');
// lista: busca "152" acha P0152
await p.evaluate(()=>{go('#/pessoas');});await p.waitForTimeout(200);await p.fill('[data-f="pes.q"]','152');await p.waitForTimeout(200);console.log('busca 152:', await p.evaluate(()=>document.querySelectorAll('#list tbody tr').length));
await p.evaluate(()=>{F.proc.q='152.1';go('#/processos');});await p.waitForTimeout(300);console.log('busca processo 152.1:', await p.evaluate(()=>document.querySelectorAll('#list tbody tr').length));
// lead -> cliente
await p.evaluate(()=>{const l=upsert('leads',{nome:'Lead X',telefone:'19988887777',origem:'Instagram',status:'Novo'});convertLead(l.id);});await p.waitForTimeout(200);
console.log('lead convertido:', await p.evaluate(()=>{const x=db.pessoas.find(x=>x.nome==='Lead X');return [x.pasta,x.origem,x.telefone].join(' | ');}));
// mobile
const m=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await m.newPage();mp.on('pageerror',e=>errs.push('M '+e.message));
await mp.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await mp.evaluate(()=>A.newPessoa({}));await mp.waitForTimeout(300);
console.log('mobile overflow:', await mp.evaluate(()=>document.querySelector('.modal-box').scrollWidth > document.querySelector('.modal-box').clientWidth+2));await mp.screenshot({path:SS+'pe-mob.png'});
console.log('errs',errs);await b.close();})();
