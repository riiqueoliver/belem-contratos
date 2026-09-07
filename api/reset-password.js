// POST /api/reset-password — { token, newPassword, sysId }
//
// Valida o token de redefinição (deve existir, não estar expirado) e
// grava a nova senha já em hash bcrypt. O token é apagado logo depois
// de usado (uso único).
const bcrypt = require('bcryptjs');
const { getDb } = require('../lib/firebaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const { token, newPassword, sysId } = req.body || {};
    if (!token || !newPassword) {
      res.status(400).json({ error: 'Dados incompletos.' });
      return;
    }
    if (String(newPassword).length < 4) {
      res.status(400).json({ error: 'A senha deve ter no mínimo 4 caracteres.' });
      return;
    }

    const crypto = require('crypto');
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');

    const usersCol = sysId === 'gcsp' ? 'gcsp_users' : 'users';
    const resetsCol = sysId === 'gcsp' ? 'gcsp_passwordResets' : 'passwordResets';
    const db = getDb();

    const resetRef = db.collection(resetsCol).doc(tokenHash);
    const resetSnap = await resetRef.get();

    if (!resetSnap.exists) {
      res.status(400).json({ error: 'Link inválido ou já utilizado.' });
      return;
    }

    const resetData = resetSnap.data();
    if (Date.now() > resetData.expiresAt) {
      await resetRef.delete();
      res.status(400).json({ error: 'Link expirado. Solicite uma nova redefinição.' });
      return;
    }

    const hash = bcrypt.hashSync(String(newPassword), 10);
    await db.collection(usersCol).doc(String(resetData.userId)).update({ password: hash });
    await resetRef.delete();

    res.status(200).json({ message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('Erro em /api/reset-password:', err);
    res.status(500).json({ error: 'Erro interno ao redefinir a senha.' });
  }
};
