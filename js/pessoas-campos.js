/* ===== Cadastro de clientes e partes: pasta P0000, máscaras (CPF/CNPJ/RG/telefone), CEP, cidades, telefones, contas bancárias ===== */

/* ----- pasta: “P” + 4 dígitos (P0146) ----- */
const pastaNum = v => { const m = String(v || '').match(/(\d+)/); return m ? +m[1] : NaN; };
const pastaFmt = v => { const s = String(v || '').trim(); if(!s) return ''; const n = pastaNum(s); return isNaN(n) ? s : 'P' + String(n).padStart(4, '0'); };
const pastaCurta = v => { const n = pastaNum(v); return isNaN(n) ? '' : String(n); }; // “P0152” → “152” (para buscas digitadas sem o P)

/* ----- documentos ----- */
function cpfValido(d){ d = digits(d); if(d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { let s = 0; for(let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; }; return dv(9) === +d[9] && dv(10) === +d[10]; }
function cnpjValido(d){ d = digits(d); if(d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dv = n => { const w = n === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2]; const s = w.reduce((a, x, i) => a + x * d[i], 0), r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dv(12) === +d[12] && dv(13) === +d[13]; }
const fmtDoc = v => { const d = digits(v); if(d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); if(d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); return String(v || '').trim(); };
const fmtRG = v => { const s = String(v || '').toUpperCase().replace(/[^0-9X]/g, ''); if(/^\d{8}[0-9X]$/.test(s)) return s.replace(/(\d{2})(\d{3})(\d{3})([0-9X])/, '$1.$2.$3-$4'); return String(v || '').trim(); };
const fmtTel = v => { let d = digits(v); if(d.startsWith('55') && d.length >= 12) d = d.slice(2); if(d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3'); if(d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3'); return String(v || '').trim(); };
const fmtCEP = v => { const d = digits(v); return d.length === 8 ? d.replace(/(\d{5})(\d{3})/, '$1-$2') : String(v || '').trim(); };

/* ----- listas fixas ----- */
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const BANCOS = ['001 - Banco do Brasil', '104 - Caixa Econômica Federal', '237 - Bradesco', '341 - Itaú Unibanco', '033 - Santander', '260 - Nubank', '077 - Banco Inter', '336 - C6 Bank', '290 - PagBank (PagSeguro)', '323 - Mercado Pago',
  '380 - PicPay', '748 - Sicredi', '756 - Sicoob', '041 - Banrisul', '070 - BRB', '422 - Safra', '208 - BTG Pactual', '655 - Banco Votorantim (BV)', '212 - Banco Original', '403 - Cora', '197 - Stone', '536 - Neon', '021 - Banestes', '004 - Banco do Nordeste', '003 - Banco da Amazônia'];
const TIPOS_CONTA = ['Corrente', 'Poupança', 'Pagamento', 'Salário'];
const TIPOS_PIX = ['CPF / CNPJ', 'Celular', 'E-mail', 'Chave aleatória'];
const TIPOS_TEL = ['Celular', 'Residencial', 'Comercial', 'Recado', 'WhatsApp', 'Outro'];

/* ----- endereço ----- */
const enderecoTxt = p => p?.logradouro ? [[p.logradouro, p.numero].filter(Boolean).join(', '), p.complemento, p.bairro, [p.cidade, p.uf].filter(Boolean).join('/'), p.cep ? 'CEP ' + fmtCEP(p.cep) : ''].filter(Boolean).join(' – ') : (p?.endereco || '');
async function buscaCEP(cep){ const d = digits(cep); if(d.length !== 8) return null;
  try{ const r = await fetch(`https://viacep.com.br/ws/${d}/json/`); const j = await r.json(); return j.erro ? null : j; }catch(e){ return null; } }
const _cidades = {};
async function cidadesUF(uf){ if(!uf) return []; if(_cidades[uf]) return _cidades[uf];
  try{ const c = JSON.parse(localStorage.getItem('escritorio_cidades_' + uf) || 'null'); if(c) return _cidades[uf] = c; }catch(e){}
  try{ const r = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`); const j = await r.json(); const l = j.map(x => x.nome).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    try{ localStorage.setItem('escritorio_cidades_' + uf, JSON.stringify(l)); }catch(e){} return _cidades[uf] = l; }catch(e){ return []; } }

/* ----- telefones extras e contas bancárias (editores) ----- */
const telRow = (t = {}) => `<div class="tel-row"><select class="tTipo">${opts(TIPOS_TEL, t.tipo || 'Celular')}</select><span class="ddi">+55</span><input class="tNum" value="${esc(fmtTel(t.numero || ''))}" inputmode="tel" placeholder="(00) 00000-0000"><input class="tObs" value="${esc(t.obs || '')}" placeholder="observação (ex.: falar com a filha)"><button type="button" class="mini tRm">✕</button></div>`;
const telsLer = f => [...f.querySelectorAll('.tel-row')].map(r => ({tipo:r.querySelector('.tTipo').value, numero:fmtTel(r.querySelector('.tNum').value), obs:r.querySelector('.tObs').value.trim()})).filter(t => digits(t.numero).length >= 8);
const contaRow = (c = {}, i = 0) => `<div class="conta-row"><div class="contaH"><b>${i ? 'Outra conta' : 'Conta principal'}</b>${i ? '<button type="button" class="mini cRm">✕ remover</button>' : ''}</div>
  <div class="contaG"><label class="cBanco">Banco<input class="cB" list="dl_bancos" value="${esc(c.banco || '')}" placeholder="digite o nome ou o código"></label>
    <label>Agência<input class="cAg" value="${esc(c.agencia || '')}" inputmode="numeric"></label><label>Conta (com dígito)<input class="cCt" value="${esc(c.conta || '')}"></label>
    <label>Tipo<select class="cTp"><option value=""></option>${opts(TIPOS_CONTA, c.tipo || '')}</select></label>
    <label>Titular (se não for a própria pessoa)<input class="cTit" value="${esc(c.titular || '')}"></label><label>CPF / CNPJ do titular<input class="cTitDoc" value="${esc(c.titularDoc || '')}" inputmode="numeric"></label>
    <label>Tipo de chave PIX<select class="cPxT"><option value=""></option>${opts(TIPOS_PIX, c.pixTipo || '')}</select></label><label class="cPix">Chave PIX<input class="cPx" value="${esc(c.pix || '')}"></label></div></div>`;
const contasLer = f => [...f.querySelectorAll('.conta-row')].map(r => ({banco:r.querySelector('.cB').value.trim(), agencia:r.querySelector('.cAg').value.trim(), conta:r.querySelector('.cCt').value.trim(), tipo:r.querySelector('.cTp').value,
  titular:r.querySelector('.cTit').value.trim(), titularDoc:fmtDoc(r.querySelector('.cTitDoc').value), pixTipo:r.querySelector('.cPxT').value, pix:r.querySelector('.cPx').value.trim()})).filter(c => c.banco || c.conta || c.pix);
const contasVerHtml = p => (p.contas || []).map((c, i) => `<div class="contaV">${(p.contas.length > 1 ? `<b>${i ? 'Outra conta' : 'Conta principal'}</b> · ` : '')}${esc(c.banco || '')}${c.agencia ? ' · ag. ' + esc(c.agencia) : ''}${c.conta ? ' · ' + esc(c.tipo ? c.tipo.toLowerCase() : 'conta') + ' ' + esc(c.conta) : ''}${c.titular ? `<div class="small muted">Titular: ${esc(c.titular)}${c.titularDoc ? ' (' + esc(c.titularDoc) + ')' : ''}</div>` : ''}${c.pix ? `<div>PIX${c.pixTipo ? ' (' + esc(c.pixTipo) + ')' : ''}: <b>${esc(c.pix)}</b> <button class="mini" data-act="copy" data-txt="${esc(c.pix)}">copiar</button></div>` : ''}</div>`).join('');
// todos os telefones de uma pessoa (o celular é o principal: WhatsApp, lembretes…)
const telsDe = p => [p.telefone && {tipo:'Celular', numero:p.telefone}, p.telRes && {tipo:'Residencial', numero:p.telRes}, p.telCom && {tipo:'Comercial', numero:p.telCom}, p.telefone2 && {tipo:'Outro', numero:p.telefone2}, ...(p.telefones || [])].filter(Boolean);

/* ----- ligar o formulário (chamado no after do formPessoa) ----- */
function pessoaFormLigar(f){
  const el = n => f.elements[n], fld = n => el(n)?.closest('.fld'), mostra = (n, on) => { const x = fld(n); if(x) x.style.display = on ? '' : 'none'; };
  const grupo = id => f.querySelector('#' + id);
  // pessoa física x jurídica
  const nat = () => f.querySelector('[name=natureza]:checked')?.value || 'Física';
  const natUpd = () => { const pj = nat() === 'Jurídica';
    fld('nome').querySelector('label').textContent = pj ? 'Razão social *' : 'Nome completo *';
    fld('doc').querySelector('label').textContent = pj ? 'CNPJ' : 'CPF';
    fld('nascimento').querySelector('label').textContent = pj ? 'Data de abertura' : 'Data de nascimento';
    ['nomeFantasia', 'ie'].forEach(n => mostra(n, pj)); ['rg', 'rgOrgao', 'rgUF', 'rgData'].forEach(n => mostra(n, !pj));
    ['gPessoais', 'gRep'].forEach(g => { const x = grupo(g); if(x) x.style.display = pj ? 'none' : ''; }); const x = grupo('gRepPJ'); if(x) x.style.display = pj ? '' : 'none'; };
  f.querySelectorAll('[name=natureza]').forEach(r => r.addEventListener('change', natUpd)); natUpd();
  // pasta só para clientes
  const tipoUpd = () => mostra('pasta', el('tipo').value === 'Cliente'); el('tipo').addEventListener('change', tipoUpd); tipoUpd();
  el('pasta').addEventListener('blur', () => { el('pasta').value = pastaFmt(el('pasta').value); });
  // máscaras
  const docMsg = () => { const d = digits(el('doc').value), box = f.querySelector('#docAviso'); if(!box) return;
    const inval = (d.length === 11 && !cpfValido(d)) || (d.length === 14 && !cnpjValido(d)) || (d && ![11, 14].includes(d.length));
    const dup = d.length >= 11 && db.pessoas.find(x => x.id !== formCfg?.data?.id && digits(x.doc) === d);
    box.innerHTML = inval ? '⚠️ número inválido — confira os dígitos' : dup ? `⚠️ já cadastrado para <a href="#/pessoa/${dup.id}" onclick="closeModal()">${esc(dup.nome)}</a>` : ''; };
  el('doc').addEventListener('blur', () => { el('doc').value = fmtDoc(el('doc').value); docMsg(); }); el('doc').addEventListener('input', docMsg);
  el('rg').addEventListener('blur', () => { el('rg').value = fmtRG(el('rg').value); });
  ['telefone', 'telRes', 'telCom', 'repPjCpf'].forEach(n => el(n)?.addEventListener('blur', () => { el(n).value = n === 'repPjCpf' ? fmtDoc(el(n).value) : fmtTel(el(n).value); }));
  // origem → “indicado por” só quando for indicação
  const orUpd = () => mostra('indicacao', /indica/i.test(el('origem').value) || !!el('indicacao').value && !el('origem').value); el('origem').addEventListener('change', orUpd); orUpd();
  // CEP e cidades
  const dlCid = f.querySelector('#dl_cidade'), carregaCidades = async () => { const l = await cidadesUF(el('uf').value); if(dlCid) dlCid.innerHTML = l.map(c => `<option value="${esc(c)}">`).join(''); };
  el('uf').addEventListener('change', carregaCidades); if(el('uf').value) carregaCidades();
  const st = f.querySelector('#cepSt');
  const cepGo = async () => { el('cep').value = fmtCEP(el('cep').value); if(digits(el('cep').value).length !== 8) return; st.textContent = 'buscando…';
    const j = await buscaCEP(el('cep').value); if(!j){ st.textContent = 'CEP não encontrado — preencha à mão'; return; }
    st.textContent = '✔ endereço preenchido pelo CEP'; if(j.uf){ el('uf').value = j.uf; carregaCidades(); }
    if(j.localidade) el('cidade').value = j.localidade; if(j.logradouro) el('logradouro').value = j.logradouro; if(j.bairro) el('bairro').value = j.bairro; el('numero').focus(); };
  el('cep').addEventListener('blur', cepGo); f.querySelector('#cepBtn').onclick = cepGo;
  const leg = f.querySelector('#endLegCep'); if(leg) leg.onclick = () => { el('cep').value = leg.dataset.cep; cepGo(); };
  // telefones extras
  const tb = f.querySelector('#telBox'); tb.innerHTML = (formCfg?.data?._tels || []).map(telRow).join('');
  f.querySelector('#telAdd').onclick = () => { tb.insertAdjacentHTML('beforeend', telRow({tipo:'Celular'})); tb.lastElementChild.querySelector('.tNum').focus(); };
  tb.addEventListener('click', e => { if(e.target.classList.contains('tRm')) e.target.closest('.tel-row').remove(); });
  tb.addEventListener('focusout', e => { if(e.target.classList.contains('tNum')) e.target.value = fmtTel(e.target.value); });
  // contas bancárias
  const cb = f.querySelector('#contaBox'), cs = formCfg?.data?.contas || [];
  cb.innerHTML = (cs.length ? cs : [{}]).map(contaRow).join('');
  f.querySelector('#contaAdd').onclick = () => cb.insertAdjacentHTML('beforeend', contaRow({}, cb.children.length));
  cb.addEventListener('click', e => { if(e.target.classList.contains('cRm')) e.target.closest('.conta-row').remove(); });
  cb.addEventListener('focusout', e => { if(e.target.classList.contains('cTitDoc')) e.target.value = fmtDoc(e.target.value); });
  // tags
  f.querySelector('#tagsEdW').innerHTML = tagsEditorHtml(formCfg?.data?.tags || [], 'pes'); tagsEditorLigar(f);
  mForm._extraVals = () => ({telefones:telsLer(f), contas:contasLer(f), tags:tagsLer(f), _tels:telsLer(f)});
}
