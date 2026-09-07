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
 *   2. Gere uma conta de serviço em Firebase Console > Configurações do
 *      projeto > Contas de serviço > Gerar nova chave privada.
 *   3. Exporte o conteúdo do JSON baixado como variável de ambiente:
 *        (PowerShell)  $env:FIREBASE_SERVICE_ACCOUNT = Get-Content .\serviceAccountKey.json -Raw
 *        (bash)        export FIREBASE_SERVICE_ACCOUNT="$(cat serviceAccountKey.json)"
 *      NUNCA commite esse arquivo JSON no repositório.
 *
 * Uso:
 *   node scripts/migrate-hash-passwords.js --dry-run   (só mostra o que mudaria)
 *   node scripts/migrate-hash-passwords.js             (aplica de fato)
 */
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
