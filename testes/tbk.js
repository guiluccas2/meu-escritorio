const {chromium}=require('playwright');const fs=require('fs');const seed=fs.readFileSync(__dirname+'/seed2.js','utf8');const SS=require('os').tmpdir()+'/';
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:1000}});await ctx.route('https://**',r=>r.abort());
const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));await p.waitForTimeout(600);await p.evaluate(`(function(){const t=today();${seed}})()`);
await p.evaluate(()=>save());await p.waitForTimeout(300);
const r1=await p.evaluate(async()=>{await bkAgora('automático');return (await bkListar()).map(x=>x.motivo+' '+x.total+' gz='+x.gz).join(' | ')});console.log('1ª cópia:',r1);
// sem alteração não repete
console.log('sem alteração:',await p.evaluate(async()=>!!(await bkAgora('automático'))));
// exclusão em massa -> cópia "antes de remover"
const n0=await p.evaluate(()=>db.prazos.length);
await p.evaluate(()=>{db.prazos=db.prazos.slice(0,2);save();});await p.waitForTimeout(800);
console.log('após excluir prazos:',await p.evaluate(async()=>(await bkListar()).map(x=>x.motivo+' prazos='+x.n.prazos).join(' | ')));
// cópia automática agora deve ser suspeita
await p.evaluate(async()=>{await bkAgora('automático',true)});await p.waitForTimeout(200);
console.log('suspeita:',await p.evaluate(async()=>(await bkListar())[0].suspeita),'| banner:',await p.evaluate(()=>document.querySelector('#banner').textContent.slice(0,60)));
// restaurar a "antes de remover"
await p.evaluate(()=>go('#/config'));await p.waitForTimeout(200);await p.screenshot({path:SS+'bk_cfg.png'});
await p.click('[data-act=bkVer]');await p.waitForTimeout(400);await p.screenshot({path:SS+'bk_lista.png'});
const id=await p.evaluate(async()=>(await bkListar()).find(x=>/antes de remover/.test(x.motivo)).id);
await p.click(`[data-bkres="${id}"]`);await p.waitForTimeout(800);
console.log('restaurado prazos:',await p.evaluate(()=>db.prazos.length),'(antes',n0+')', '| cópias:',await p.evaluate(async()=>(await bkListar()).map(x=>x.motivo).join(', ')));
// desfazer restauração
await p.evaluate(()=>document.querySelector('#toastU button')?.click());await p.waitForTimeout(800);console.log('após desfazer:',await p.evaluate(()=>db.prazos.length));
// poda: cria cópias antigas falsas
const pd=await p.evaluate(async()=>{const d=await bkIdb();const mk=(h)=>({id:new Date(Date.now()-h*3600e3).toISOString(),motivo:'automático',n:{},total:1,tam:1,gz:false,dados:'{}',suspeita:''});
 await new Promise(r=>{const t=d.transaction('snaps','readwrite');for(let h=25;h<24*100;h+=0.5)t.objectStore('snaps').put(mk(h));t.oncomplete=r;});const a=(await bkListar()).length;await bkPodar();return a+' → '+(await bkListar()).length});
console.log('poda:',pd);
await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{closeModal();go('#/config')});await p.waitForTimeout(300);await p.evaluate(()=>bkTela());await p.waitForTimeout(400);await p.screenshot({path:SS+'bk_mob.png'});
console.log('overflow:',await p.evaluate(()=>document.documentElement.scrollWidth));
console.log('ERROS',errs);await b.close();})();
