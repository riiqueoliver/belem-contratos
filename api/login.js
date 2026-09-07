// POST /api/login — { username, password, sysId }
//
// Verifica as credenciais no servidor usando o Firebase Admin SDK, para que a
// coleção 'users' (com hashes de senha) nunca precise ser lida diretamente
// pelo navegador só para permitir o login.
//
// Compatibilidade de transição: se o campo 'password' armazenado ainda não for
// um hash bcrypt (ou seja, o usuário nunca fez login/trocou a senha depois da
// migração), compara em texto puro. Depois de rodar
// scripts/migrate-hash-passwords.js essa ramificação deixa de ser usada.
const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/firebaseAdmin');

const BCRYPT_RE = /^\$2[aby]\$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const { username, password, sysId } = req.body || {};
    if (!username || !password) {
      res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
      return;
    }

    const usersCol = sysId === 'gcsp' ? 'gcsp_users' : 'users';
    const db = getDb();
    const snap = await db.collection(usersCol)
      .where('username', '==', String(username).trim())
      .limit(1)
      .get();

    if (snap.empty) {
      res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      return;
    }

    const user = snap.docs[0].data();
    const stored = user.password || '';
    const ok = BCRYPT_RE.test(stored)
      ? bcrypt.compareSync(password, stored)
      : stored === password;

    if (!ok) {
      res.status(401).json({ error: 'Usuário ou senha incorretos.' });
      return;
    }

    res.status(200).json({ user });
  } catch (err) {
    console.error('Erro em /api/login:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar.' });
  }
};
