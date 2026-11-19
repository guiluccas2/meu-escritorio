// Robô: pastas dos arquivos de atendimento no Drive (simulado) — cliente › Atendimentos; Leads ao lado de Ativos/Encerrados › nome › Atendimentos
const fs = require('fs'), vm = require('vm'), ERR = [];
let nid = 0; const F = (nome, pai) => { const f = {nome, id: 'f' + (++nid), filhos: [], pai,
  getName: () => f.nome, getId: () => f.id, getUrl: () => 'https://drive/' + f.id,
  getFolders: () => { let i = 0; return {hasNext: () => i < f.filhos.length, next: () => f.filhos[i++]}; },
  getParents: () => { let d = !f.pai; return {hasNext: () => !d, next: () => { d = true; return f.pai; }}; },
  createFolder: n => { const x = F(n, f); f.filhos.push(x); return x; }}; return f; };
const escr = F('Escritório'), ativos = escr.createFolder('Ativos'), enc = escr.createFolder('Encerrados'); ativos.createFolder('P0152 - Maria Exemplo');
const todos = () => { const o = []; const w = f => { o.push(f); f.filhos.forEach(w); }; w(escr); return o; };
const ctx = {console, Logger: {log() {}}, Utilities: {formatDate: d => new Date(d).toISOString().slice(0, 10)},
  PropertiesService: {getScriptProperties: () => ({getProperty: k => ({ARQ_ATIVOS: ativos.id, ARQ_ENC: enc.id})[k] || null, setProperty() {}})},
  DriveApp: {getFolderById: id => todos().find(f => f.id === id)}};
vm.createContext(ctx); vm.runInContext(fs.readFileSync(__dirname + '/../robo/robo-escritorio.gs', 'utf8'), ctx);
const r1 = vm.runInContext("arqPasta_({cliente:'P0152', nome:'Maria Exemplo', sub:'Atendimentos'})", ctx);
const r1b = vm.runInContext("arqPasta_({cliente:'P0152', nome:'Maria Exemplo', sub:'Atendimentos'})", ctx);
console.log('cliente:', r1.caminho, '· mesma pasta na 2ª vez?', r1.id === r1b.id);
if (r1.caminho !== 'Ativos › P0152 - Maria Exemplo › Atendimentos' || r1.id !== r1b.id) ERR.push('cliente › Atendimentos');
const r2 = vm.runInContext("arqPasta_({lead:'Carlos / Exemplo', sub:'Atendimentos'})", ctx), r2b = vm.runInContext("arqPasta_({lead:'carlos - exemplo', sub:'Atendimentos'})", ctx);
console.log('lead:', r2.caminho, '· Leads ao lado de Ativos?', escr.filhos.map(f => f.nome).join(', '), '· mesma pasta?', r2.id === r2b.id);
if (r2.caminho !== 'Leads › Carlos - Exemplo › Atendimentos' || !escr.filhos.some(f => f.nome === 'Leads') || r2.id !== r2b.id) ERR.push('lead');
try { vm.runInContext("arqPasta_({nome:'Sem número'})", ctx); ERR.push('cliente sem número criou pasta'); } catch (e) { console.log('sem número →', e.message); }
const r3 = vm.runInContext("arqPasta_({cliente:'P0152', nome:'Maria Exemplo', proc:'P0152.1', procNome:'Ação', procNum:''})", ctx); console.log('processo (como antes):', r3.caminho);
if (!/P0152\.1 - Ação$/.test(r3.caminho)) ERR.push('pasta do processo mudou');
console.log('ERROS', ERR); process.exit(ERR.length ? 1 : 0);
