/**
 * scripts/migrate-hash-passwords.js
 *
 * Migração ÚNICA: converte todas as senhas em texto puro já gravadas no
 * Firestore (coleções users, gcsp_users, pendingUsers, gcsp_pendingUsers)
 * para hash bcrypt. Idempotente — pula qualquer documento cujo campo
 * 'password' já pareça um hash bcrypt (começa com $2a$, $2b$ ou $2y$).
 *
 * IMPORTANTE — antes de rodar:
 *   1. Faça um backup/export do Firestore (Firebase Console > Firestore >
 *      Exportar, ou `gcloud firestore export`).
 *   2. Coloque o MESMO arquivo JSON de conta de serviço usado na Vercel
 *      (Firebase Console > Configurações do projeto > Contas de serviço)
 *      na raiz do projeto como 'serviceAccountKey.json'. Esse nome já está
 *      no .gitignore — nunca vai para o repositório.
 *      (Alternativa: exportar FIREBASE_SERVICE_ACCOUNT como variável de
 *      ambiente com o conteúdo do JSON, se preferir não salvar o arquivo.)
 *
 * Uso:
 *   node scripts/migrate-hash-passwords.js --dry-run   (só mostra o que mudaria)
 *   node scripts/migrate-hash-passwords.js             (aplica de fato)
 */
const fs = require('fs');
const path = require('path');

if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
  const keyFile = path.join(__dirname, '..', 'serviceAccountKey.json');
  if (fs.existsSync(keyFile)) {
    process.env.FIREBASE_SERVICE_ACCOUNT = fs.readFileSync(keyFile, 'utf8');
  }
}

const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/firebaseAdmin');

const BCRYPT_RE = /^\$2[aby]\$/;
const COLLECTIONS = ['users', 'gcsp_users', 'pendingUsers', 'gcsp_pendingUsers'];
const DRY_RUN = process.argv.includes('--dry-run');

async function migrateCollection(db, name) {
  const snap = await db.collection(name).get();
  let updated = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const pwd = data.password;
    if (typeof pwd !== 'string' || pwd.length === 0) { skipped++; continue; }
    if (BCRYPT_RE.test(pwd)) { skipped++; continue; }

    const hash = bcrypt.hashSync(pwd, 10);
    if (DRY_RUN) {
      console.log(`  [dry-run] ${name}/${doc.id} (${data.username || '?'}) seria migrado.`);
    } else {
      await doc.ref.update({ password: hash });
      console.log(`  ✓ ${name}/${doc.id} (${data.username || '?'}) migrado.`);
    }
    updated++;
  }

  console.log(`${name}: ${updated} migrado(s), ${skipped} já ok/ignorado(s).\n`);
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN — nenhuma escrita será feita ===\n' : '=== Migração de senhas para bcrypt ===\n');
  const db = getDb();
  for (const col of COLLECTIONS) {
    console.log(`Coleção: ${col}`);
    await migrateCollection(db, col);
  }
  console.log('Concluído.');
}

main().catch(err => {
  console.error('Falha na migração:', err);
  process.exit(1);
});
