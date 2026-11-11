// Meu Escritório — Inicialização do sistema
'use strict';
/* ================= INÍCIO ================= */
(async function init(){
  try{ navigator.storage?.persist?.(); }catch(e){}
  render();
  const voltouDoDropbox = await dbxRetorno();
  setStatus(driveAtivo() ? (isDirty() ? 'sync' : 'ok') : 'off');
  if(!voltouDoDropbox && driveAtivo()){ if(temSessao()) driveSync('abertura'); else setStatus(isDirty() ? 'pendente-auth' : 'auth'); }
  monLimpar(); setTimeout(monitorAuto, driveAtivo() ? 5000 : 1500);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') roboEnviarAgenda(); else setTimeout(monitorAuto, 4000); }); setInterval(monitorAuto, 5 * 60000);
  if('showSaveFilePicker' in window){
    const h = await idbGet('fh');
    if(h){ fileHandle = h; try{ filePerm = (await h.queryPermission({mode:'readwrite'})) === 'granted'; }catch(e){ filePerm = false; } render(); }
  }
})();
