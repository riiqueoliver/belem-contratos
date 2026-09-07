// Inicialização compartilhada do Firebase Admin SDK.
// Usado só em código server-side (funções serverless da Vercel e scripts locais
// de manutenção) — nunca importar isto a partir do index.html.
//
// Requer a env var FIREBASE_SERVICE_ACCOUNT com o JSON da conta de serviço
// (Firebase Console > Configurações do projeto > Contas de serviço > Gerar
// nova chave privada), colado como string única.
const admin = require('firebase-admin');

function getAdminApp() {
  if (admin.apps.length) return admin.apps[0];

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada nas variáveis de ambiente.');
  }
  const serviceAccount = JSON.parse(raw);
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

function getDb() {
  getAdminApp();
  return admin.firestore();
}

module.exports = { getDb };
