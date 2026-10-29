// Extrai o texto dos documentos de uma pasta para a base privada do Assistente de IA.
// Roda só no computador local; não envia nada. Saída: um .jsonl com um documento por linha.
//
// Uso: node scripts/base-ia/extrair.js <pasta-de-origem> <saida.jsonl>
// Requer pdftotext (poppler) no PATH para PDFs.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const JSZip = require('jszip');
const XLSX = require('xlsx');

const [ORIGEM, SAIDA] = process.argv.slice(2);
if (!ORIGEM || !SAIDA) { console.error('Uso: node extrair.js <pasta> <saida.jsonl>'); process.exit(1); }

// Pastas que não entram: pessoais, backups, instaladores e dados sensíveis de atendidos
const PASTAS_FORA = [/^pessoal$/i, /backup/i, /instaladores/i, /arcanjo/i, /^neotrix$/i, /node_modules/i, /^\./];
// Nomes com cara de credencial
const ARQUIVOS_FORA = /senha|password|credencia|token|chave.?api|api.?key|serviceaccount|\.env/i;
const TIPOS = new Set(['.pdf', '.docx', '.xlsx', '.xls', '.pptx', '.odt', '.txt', '.csv', '.md']);
const MAX_BYTES = 60 * 1024 * 1024;

const xmlTexto = x => x.replace(/<w:tab\/>|<a:tab\/>/g, '\t').replace(/<\/w:tc>/g, ' | ')
  .replace(/<\/(w:p|a:p|text:p|text:h)>/g, '\n').replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

async function extrairTexto(arq, ext) {
  if (ext === '.pdf') {
    // pdftotext sai com erro em PDFs com avisos (assinatura, fonte), mas o texto costuma vir mesmo assim
    const rodar = a => execFileSync('pdftotext', ['-enc', 'UTF-8', '-layout', '-q', a, '-'], { maxBuffer: 200 * 1024 * 1024 }).toString('utf8');
    try { return rodar(arq); }
    catch (err) {
      if (err.stdout && err.stdout.length) return err.stdout.toString('utf8');
      // No Windows o pdftotext não abre caminhos com acentos: tenta por uma cópia com nome simples
      const tmp = path.join(require('os').tmpdir(), `base-ia-${process.pid}.pdf`);
      fs.copyFileSync(arq, tmp);
      try { return rodar(tmp); } catch (e2) { if (e2.stdout && e2.stdout.length) return e2.stdout.toString('utf8'); throw e2; }
      finally { fs.rmSync(tmp, { force: true }); }
    }
  }
  if (ext === '.txt' || ext === '.csv' || ext === '.md') return fs.readFileSync(arq, 'utf8');
  if (ext === '.xlsx' || ext === '.xls') {
    const wb = XLSX.readFile(arq, { cellText: true, cellDates: true });
    return wb.SheetNames.map(n => `## Planilha: ${n}\n` + XLSX.utils.sheet_to_csv(wb.Sheets[n], { FS: ' | ', blankrows: false })).join('\n\n');
  }
  const z = await JSZip.loadAsync(fs.readFileSync(arq));
  if (ext === '.docx') {
    const partes = Object.keys(z.files).filter(n => /^word\/(document|header\d*|footer\d*)\.xml$/.test(n)).sort();
    return (await Promise.all(partes.map(n => z.file(n).async('string')))).map(xmlTexto).join('\n');
  }
  if (ext === '.pptx') {
    const slides = Object.keys(z.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    return (await Promise.all(slides.map(n => z.file(n).async('string')))).map((x, i) => `## Slide ${i + 1}\n` + xmlTexto(x)).join('\n');
  }
  if (ext === '.odt') return xmlTexto(await z.file('content.xml').async('string'));
  return '';
}

function* percorrer(dir, rel = '') {
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(dir, e.name), r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) { if (!PASTAS_FORA.some(re => re.test(e.name))) yield* percorrer(p, r); }
    else if (TIPOS.has(path.extname(e.name).toLowerCase()) && !e.name.startsWith('~$') && !ARQUIVOS_FORA.test(e.name)) yield { p, r };
  }
}

(async () => {
  const vistos = new Set();
  const saida = fs.createWriteStream(SAIDA);
  const st = { lidos: 0, gravados: 0, duplicados: 0, semTexto: [], erros: [], chars: 0 };
  for (const { p, r } of percorrer(ORIGEM)) {
    st.lidos++;
    const ext = path.extname(p).toLowerCase();
    let info;
    try { info = fs.statSync(p); } catch { continue; }
    if (info.size > MAX_BYTES) { st.erros.push(r + ' (grande demais)'); continue; }
    let texto;
    try { texto = await extrairTexto(p, ext); }
    catch (err) { st.erros.push(`${r} (${String(err.message).split('\n')[0].slice(0, 80)})`); continue; }
    texto = String(texto || '').replace(/\r/g, '').replace(/[ \t]{3,}/g, '  ').replace(/\n{3,}/g, '\n\n').trim();
    if (texto.replace(/\s/g, '').length < 150) { st.semTexto.push(r); continue; }   // PDF escaneado ou vazio
    const hash = crypto.createHash('sha1').update(texto.replace(/\s+/g, ' ')).digest('hex');
    if (vistos.has(hash)) { st.duplicados++; continue; }
    vistos.add(hash);
    saida.write(JSON.stringify({ caminho: r, nome: path.basename(p), pasta: path.dirname(r), tipo: ext.slice(1),
                                 modificado: info.mtime.toISOString().slice(0, 10), hash, texto }) + '\n');
    st.gravados++; st.chars += texto.length;
    if (st.lidos % 50 === 0) process.stdout.write(`… ${st.lidos} lidos\n`);
  }
  saida.end();
  console.log(`\nLidos: ${st.lidos} | Na base: ${st.gravados} | Duplicados: ${st.duplicados} | Sem texto (escaneados?): ${st.semTexto.length} | Erros: ${st.erros.length}`);
  console.log(`Texto total: ${(st.chars / 1e6).toFixed(1)} milhões de caracteres`);
  fs.writeFileSync(SAIDA.replace(/\.jsonl$/, '') + '-relatorio.json', JSON.stringify(st, null, 1));
})();
