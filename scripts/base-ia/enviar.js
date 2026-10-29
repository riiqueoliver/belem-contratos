// Envia a base extraída (extrair.js) para a coleção privada do Assistente de IA.
// Usa a conta de serviço local; a coleção é bloqueada ao navegador pelas regras do Firestore.
//
// Uso: node scripts/base-ia/enviar.js <base.jsonl>
// Cada envio cria uma versão nova (lotes + manifesto) e apaga a anterior no fim.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const COLECAO = 'ia_base_privada';
const TAM_TRECHO = 2500, SOBREPOSICAO = 250;
const MAX_LOTE_GZ = 900 * 1024;   // documento do Firestore tem limite de 1 MB

const sa = require(path.join(__dirname, '..', '..', 'serviceAccountKey.json.json'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Divide em trechos de ~2.500 caracteres, preferindo quebrar em fim de parágrafo ou frase
function trechos(texto) {
  const out = [];
  let i = 0;
  while (i < texto.length) {
    let fim = Math.min(i + TAM_TRECHO, texto.length);
    if (fim < texto.length) {
      const janela = texto.slice(i + TAM_TRECHO * 0.6, fim);
      const corte = Math.max(janela.lastIndexOf('\n\n'), janela.lastIndexOf('.\n'), janela.lastIndexOf('. '));
      if (corte > 0) fim = i + TAM_TRECHO * 0.6 + corte + 1;
    }
    out.push(texto.slice(i, fim).trim());
    if (fim >= texto.length) break;
    i = Math.max(fim - SOBREPOSICAO, i + 1);
  }
  return out.filter(t => t.length > 40);
}

(async () => {
  const linhas = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const catalogo = [], partes = [];
  linhas.forEach((d, idx) => {
    catalogo.push({ nome: d.nome, pasta: d.pasta, tipo: d.tipo, modificado: d.modificado });
    for (const t of trechos(d.texto)) partes.push({ d: idx, t });
  });
  console.log(`${catalogo.length} documentos → ${partes.length} trechos`);

  // Monta lotes que caibam em 1 MB depois de compactados
  const lotes = [];
  let atual = [];
  const fechar = () => {
    if (!atual.length) return;
    const gz = zlib.gzipSync(Buffer.from(JSON.stringify(atual)), { level: 9 });
    if (gz.length > MAX_LOTE_GZ && atual.length > 1) {
      const metade = atual.splice(Math.ceil(atual.length / 2));
      fechar(); atual = metade; fechar(); return;
    }
    lotes.push(gz); atual = [];
  };
  let bytes = 0;
  for (const p of partes) {
    atual.push(p); bytes += p.t.length;
    if (bytes > 3_000_000) { fechar(); bytes = 0; }
  }
  fechar();

  const versao = Date.now();
  for (let n = 0; n < lotes.length; n++) {
    await db.collection(COLECAO).doc(`lote_${versao}_${n}`).set({ tipo: 'lote', versao, n, dados: lotes[n] });
    console.log(`lote ${n + 1}/${lotes.length}: ${(lotes[n].length / 1024).toFixed(0)} KB`);
  }
  // O manifesto aponta para a versão nova só depois de todos os lotes gravados
  await db.collection(COLECAO).doc('manifesto').set({
    versao, documentos: catalogo.length, trechos: partes.length, lotes: lotes.length,
    catalogo: zlib.gzipSync(Buffer.from(JSON.stringify(catalogo)), { level: 9 }),
    atualizadoEm: FieldValue.serverTimestamp(),
  });
  const antigos = await db.collection(COLECAO).where('tipo', '==', 'lote').get();
  let apagados = 0;
  for (const d of antigos.docs) if (d.data().versao !== versao) { await d.ref.delete(); apagados++; }
  console.log(`Versão ${versao} publicada. Lotes antigos apagados: ${apagados}.`);
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
