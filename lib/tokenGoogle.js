// Verificação do ID token do Firebase Auth sem o firebase-admin/auth.
//
// O módulo de auth do Admin SDK depende de 'jose' (ESM), que o runtime da Vercel não
// consegue carregar via require(). Aqui a verificação segue o procedimento documentado
// pelo Firebase: assinatura RS256 com as chaves públicas do Google, e claims aud/iss/exp/iat/sub.
const crypto = require('crypto');

const URL_CHAVES = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let chaves = { certs: null, ate: 0 };

async function certificados() {
  if (chaves.certs && Date.now() < chaves.ate) return chaves.certs;
  const r = await fetch(URL_CHAVES);
  if (!r.ok) throw new Error('Não foi possível obter as chaves do Google.');
  const maxAge = Number((/max-age=(\d+)/.exec(r.headers.get('cache-control') || '') || [])[1] || 3600);
  chaves = { certs: await r.json(), ate: Date.now() + maxAge * 1000 };
  return chaves.certs;
}

const decodificar = parte => JSON.parse(Buffer.from(parte.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

async function verificarIdToken(token, projectId) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) throw new Error('Token malformado.');
  const cab = decodificar(partes[0]);
  const dados = decodificar(partes[1]);
  if (cab.alg !== 'RS256' || !cab.kid) throw new Error('Algoritmo inválido.');

  const certs = await certificados();
  const cert = certs[cab.kid];
  if (!cert) throw new Error('Chave do token desconhecida.');
  const ok = crypto.verify('RSA-SHA256', Buffer.from(partes[0] + '.' + partes[1]),
                           crypto.createPublicKey(cert), Buffer.from(partes[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
  if (!ok) throw new Error('Assinatura inválida.');

  const agora = Math.floor(Date.now() / 1000), folga = 60;
  if (dados.aud !== projectId) throw new Error('Token de outro projeto.');
  if (dados.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('Emissor inválido.');
  if (!dados.sub || typeof dados.sub !== 'string') throw new Error('Token sem usuário.');
  if (!(dados.exp > agora - folga)) throw new Error('Token expirado.');
  if (!(dados.iat <= agora + folga) || !(dados.auth_time <= agora + folga)) throw new Error('Token com data inválida.');
  return dados;
}

module.exports = { verificarIdToken };
