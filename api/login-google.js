// POST /api/login-google — { idToken, sysId }
//
// Login com a conta Google como alternativa à senha. O Google só confirma QUEM é
// a pessoa; quem pode ENTRAR continua sendo decidido pelo admin: o e-mail
// verificado da conta Google precisa ser o e-mail de um usuário já cadastrado e
// aprovado na coleção 'users' (ou 'gcsp_users'). Gmail sem cadastro é recusado.
const { getAuth } = require('firebase-admin/auth');
const { getDb, getAdminApp } = require('../lib/firebaseAdmin');
const { emitirPasse } = require('../lib/baseIA');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }
  try {
    const { idToken, sysId } = req.body || {};
    if (!idToken) {
      res.status(400).json({ error: 'Token do Google ausente.' });
      return;
    }

    let conta;
    try { conta = await getAuth(getAdminApp()).verifyIdToken(String(idToken)); }
    catch { res.status(401).json({ error: 'Não foi possível confirmar a conta Google. Tente de novo.' }); return; }

    const email = String(conta.email || '').trim().toLowerCase();
    const provedor = conta.firebase && conta.firebase.sign_in_provider;
    if (!email || !conta.email_verified || provedor !== 'google.com') {
      res.status(401).json({ error: 'A conta Google precisa ter e-mail verificado.' });
      return;
    }

    // Só entra quem o admin já cadastrou com esse e-mail
    const usersCol = sysId === 'gcsp' ? 'gcsp_users' : 'users';
    const snap = await getDb().collection(usersCol).get();
    const achados = snap.docs.map(d => d.data()).filter(u => String(u.email || '').trim().toLowerCase() === email);
    if (achados.length === 0) {
      res.status(403).json({ error: `O e-mail ${email} não está autorizado neste sistema. Peça ao administrador para cadastrá-lo no seu usuário.` });
      return;
    }
    if (achados.length > 1) {
      res.status(409).json({ error: 'Este e-mail está ligado a mais de um usuário. Peça ao administrador para corrigir o cadastro.' });
      return;
    }

    const user = achados[0];
    let iaPasse = null;
    try { iaPasse = emitirPasse(user.username, sysId === 'gcsp' ? 'gcsp' : 'main'); } catch (e) { console.warn('iaPasse:', e.message); }
    res.status(200).json({ user, iaPasse });
  } catch (err) {
    console.error('Erro em /api/login-google:', err);
    res.status(500).json({ error: 'Erro interno ao autenticar com o Google.' });
  }
};
