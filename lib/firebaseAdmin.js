// Inicialização compartilhada do Firebase Admin SDK.
// Usado só em código server-side (funções serverless da Vercel e scripts locais
// de manutenção) — nunca importar isto a partir do index.html.
//
// Requer a env var FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço
// (Firebase Console > Configurações do projeto > Contas de serviço > Gerar
// nova chave privada), colado como string única.
//
// Nota: firebase-admin v14 não expõe mais o namespace clássico (admin.apps,
// admin.firestore(), admin.credential.cert()) no require() top-level — é
// preciso usar as entradas modulares 'firebase-admin/app' e
// 'firebase-admin/firestore'.
const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function getAdminApp() {
  const existing = getApps();
  if (existing.length) return existing[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada nas variáveis de ambiente.');
  }
  const serviceAccount = JSON.parse(raw);
  return initializeApp({
    credential: cert(serviceAccount),
  });
}

function getDb() {
  const app = getAdminApp();
  return getFirestore(app);
}

module.exports = { getDb };
