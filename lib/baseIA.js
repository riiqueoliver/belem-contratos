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

async function carregar() {
  const db = getDb();
  const man = await db.collection(COLECAO).doc('manifesto').get();
  if (!man.exists) return null;
  const m = man.data();
  if (cache && cache.versao === m.versao) return cache;
  if (carregando) return carregando;
  carregando = (async () => {
    const lotes = await db.collection(COLECAO).where('tipo', '==', 'lote').where('versao', '==', m.versao).get();
    const docs = JSON.parse(zlib.gunzipSync(Buffer.from(m.catalogo)).toString('utf8'));
    const partes = [];
    lotes.docs.sort((a, b) => a.data().n - b.data().n).forEach(l => {
      partes.push(...JSON.parse(zlib.gunzipSync(Buffer.from(l.data().dados)).toString('utf8')));
    });
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
    cache = { versao: m.versao, docs, partes, postings, tam, media, atualizadoEm: m.atualizadoEm };
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

module.exports = { COLECAO, emitirPasse, validarPasse, cifrar, decifrar, buscar, resumo };
