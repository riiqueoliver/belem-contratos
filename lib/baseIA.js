// Base de conhecimento privada do Assistente de IA (só servidor).
//
// Os documentos ficam em lotes compactados na coleção 'ia_base_privada', que as regras
// do Firestore bloqueiam ao navegador; só o Admin SDK lê. A busca é BM25 em memória.
//
// Sigilo no caminho até a IA: o resultado da busca volta ao navegador CIFRADO
// (AES-256-GCM, chave derivada da conta de serviço) e só é decifrado aqui, na hora
// de repassar ao modelo. O navegador nunca vê o texto bruto dos documentos.
//
// Acesso: só com o passe assinado que /api/login entrega (usuário do sistema principal).
const crypto = require('crypto');
const zlib = require('zlib');
const { getDb } = require('./firebaseAdmin');

const COLECAO = 'ia_base_privada';
const PASSE_DIAS = 30;

function segredo(uso) {
  const sa = process.env.FIREBASE_SERVICE_ACCOUNT || '';
  let base = sa;
  try { base = JSON.parse(sa).private_key || sa; } catch {}
  if (!base) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada.');
  return crypto.createHash('sha256').update(uso + ':' + base).digest();
}

/* ── Passe de sessão (emitido no login) ─────────────────────────── */
const b64url = b => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function emitirPasse(username, sysId) {
  const corpo = b64url(JSON.stringify({ u: username, s: sysId || 'main', exp: Date.now() + PASSE_DIAS * 864e5 }));
  const assinatura = b64url(crypto.createHmac('sha256', segredo('ia-passe')).update(corpo).digest());
  return corpo + '.' + assinatura;
}
function validarPasse(passe) {
  if (typeof passe !== 'string' || !passe.includes('.')) return null;
  const [corpo, assinatura] = passe.split('.');
  const esperado = b64url(crypto.createHmac('sha256', segredo('ia-passe')).update(corpo).digest());
  if (assinatura.length !== esperado.length || !crypto.timingSafeEqual(Buffer.from(assinatura), Buffer.from(esperado))) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
    return dados.exp > Date.now() ? dados : null;
  } catch { return null; }
}

/* ── Cifra do resultado que passa pelo navegador ─────────────────── */
function cifrar(texto) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', segredo('ia-base'), iv);
  const ct = Buffer.concat([c.update(texto, 'utf8'), c.final()]);
  return 'cifrado:' + Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
}
function decifrar(valor) {
  const buf = Buffer.from(String(valor).slice(8), 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', segredo('ia-base'), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString('utf8');
}

/* ── Índice BM25 em memória ──────────────────────────────────────── */
const PARADAS = new Set(('a o as os de da do das dos e em no na nos nas um uma uns umas para por com sem que se ao aos à às ' +
  'é ser foi são como mais menos sua seu suas seus ou nao não sobre entre pelo pela pelos pelas este esta isto esse essa isso ' +
  'aquele aquela the of and to in').split(' '));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const tokens = s => norm(s).split(/[^a-z0-9]+/).filter(t => t && (t.length > 1 || /\d/.test(t)) && !PARADAS.has(t));

let cache = null;          // { versao, docs, partes, postings, tam, media }
let carregando = null;

// Além dos lotes (montados pelo script scripts/base-ia), a base aceita documentos avulsos
// anexados pelo próprio sistema ("modelos"): um doc 'extra' cada, que sobrevive às remontagens.
// O manifesto guarda um contador 'extras' para o cache saber que mudou.
const PASTA_EXTRAS = 'Modelos anexados no sistema';
const TAM_TRECHO = 2500, SOBREPOSICAO = 250;

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

async function carregar() {
  const db = getDb();
  const man = await db.collection(COLECAO).doc('manifesto').get();
  const m = man.exists ? man.data() : {};
  const chave = `${m.versao || 0}:${m.extras || 0}`;
  if (cache && cache.chave === chave) return cache;
  if (carregando) return carregando;
  carregando = (async () => {
    const [lotes, extras] = await Promise.all([
      m.versao ? db.collection(COLECAO).where('tipo', '==', 'lote').where('versao', '==', m.versao).get() : null,
      db.collection(COLECAO).where('tipo', '==', 'extra').get(),
    ]);
    const docs = m.catalogo ? JSON.parse(zlib.gunzipSync(Buffer.from(m.catalogo)).toString('utf8')) : [];
    const partes = [];
    if (lotes) lotes.docs.sort((a, b) => a.data().n - b.data().n).forEach(l => {
      partes.push(...JSON.parse(zlib.gunzipSync(Buffer.from(l.data().dados)).toString('utf8')));
    });
    for (const e of extras.docs) {
      const x = e.data();
      const d = docs.push({ nome: x.nome, pasta: PASTA_EXTRAS, tipo: 'modelo', modificado: x.modificado }) - 1;
      for (const t of JSON.parse(zlib.gunzipSync(Buffer.from(x.dados)).toString('utf8'))) partes.push({ d, t });
    }
    if (!docs.length) return null;
    const postings = new Map();
    const tam = new Uint32Array(partes.length);
    partes.forEach((p, i) => {
      const d = docs[p.d] || {};
      const tk = tokens(`${d.nome} ${d.nome} ${d.pasta} ${p.t}`);   // nome conta em dobro
      tam[i] = tk.length;
      const tf = new Map();
      for (const t of tk) tf.set(t, (tf.get(t) || 0) + 1);
      for (const [t, f] of tf) { let l = postings.get(t); if (!l) postings.set(t, l = []); l.push(i, f); }
    });
    const media = tam.reduce((s, x) => s + x, 0) / Math.max(1, partes.length);
    cache = { chave, docs, partes, postings, tam, media, atualizadoEm: m.atualizadoEm };
    return cache;
  })().finally(() => { carregando = null; });
  return carregando;
}

async function buscar(consulta, limite = 6) {
  const b = await carregar();
  if (!b) return { resultados: [], aviso: 'A base privada ainda não foi carregada.' };
  const termos = [...new Set(tokens(consulta))];
  if (!termos.length) return { resultados: [], aviso: 'Informe termos de busca.' };
  const N = b.partes.length, k1 = 1.4, bb = 0.75;
  const pontos = new Map();
  for (const t of termos) {
    const l = b.postings.get(t);
    if (!l) continue;
    const df = l.length / 2;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (let j = 0; j < l.length; j += 2) {
      const i = l[j], f = l[j + 1];
      const s = idf * (f * (k1 + 1)) / (f + k1 * (1 - bb + bb * b.tam[i] / b.media));
      pontos.set(i, (pontos.get(i) || 0) + s);
    }
  }
  const melhores = [...pontos.entries()].sort((x, y) => y[1] - x[1]);
  const resultados = [];
  const porDoc = new Map();
  for (const [i] of melhores) {
    const p = b.partes[i];
    if ((porDoc.get(p.d) || 0) >= 2) continue;          // no máximo 2 trechos por documento
    porDoc.set(p.d, (porDoc.get(p.d) || 0) + 1);
    const d = b.docs[p.d] || {};
    resultados.push({ documento: d.nome, pasta: d.pasta, modificado: d.modificado, trecho: p.t });
    if (resultados.length >= limite) break;
  }
  return { encontrados: melhores.length, resultados };
}

async function resumo() {
  const b = await carregar();
  return b ? { documentos: b.docs.length, trechos: b.partes.length, atualizadoEm: b.atualizadoEm } : { documentos: 0, trechos: 0 };
}

// Guarda um documento anexado pelo sistema na base (texto já extraído no navegador)
async function adicionarExtra({ nome, descricao, texto, usuario }) {
  const corpo = (descricao ? `Para que serve: ${descricao}\n\n` : '') + texto;
  const lista = trechos(corpo);
  if (!lista.length) throw new Error('O arquivo não tem texto suficiente para entrar na base.');
  const dados = zlib.gzipSync(Buffer.from(JSON.stringify(lista)), { level: 9 });
  if (dados.length > 900 * 1024) throw new Error('Arquivo grande demais para a base (o texto passa de 1 MB compactado).');
  const db = getDb();
  const { FieldValue } = require('firebase-admin/firestore');
  const ref = db.collection(COLECAO).doc();
  await ref.set({ tipo: 'extra', nome: String(nome).slice(0, 200), descricao: String(descricao || '').slice(0, 1000),
                  modificado: new Date().toISOString().slice(0, 10), enviadoPor: usuario, dados, criadoEm: FieldValue.serverTimestamp() });
  await db.collection(COLECAO).doc('manifesto').set({ extras: FieldValue.increment(1) }, { merge: true });
  return { id: ref.id, trechos: lista.length };
}

module.exports = { COLECAO, emitirPasse, validarPasse, cifrar, decifrar, buscar, resumo, adicionarExtra };
