// POST /api/request-password-reset — { email, sysId }
//
// Gera um token de redefinição de senha, salva o hash dele no Firestore
// com expiração de 30 minutos e envia um e-mail com o link. Sempre
// responde com a mesma mensagem genérica, exista ou não o e-mail —
// isso evita que alguém descubra quais e-mails estão cadastrados no
// sistema (enumeration attack).
const crypto = require('crypto');
const { getDb } = require('../lib/firebaseAdmin');
const { sendEmail } = require('../lib/email');

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  try {
    const { email, sysId } = req.body || {};
    if (!email) {
      res.status(400).json({ error: 'Informe o e-mail.' });
      return;
    }

    const usersCol = sysId === 'gcsp' ? 'gcsp_users' : 'users';
    const resetsCol = sysId === 'gcsp' ? 'gcsp_passwordResets' : 'passwordResets';
    const db = getDb();

    const snap = await db.collection(usersCol)
      .where('email', '==', String(email).trim().toLowerCase())
      .limit(1)
      .get();

    // Resposta genérica sempre — não revela se o e-mail existe.
    const genericResponse = () => res.status(200).json({
      message: 'Se esse e-mail estiver cadastrado, enviamos um link de redefinição.',
    });

    if (snap.empty) {
      genericResponse();
      return;
    }

    const userDoc = snap.docs[0];
    const user = userDoc.data();

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = Date.now() + TOKEN_TTL_MS;

    await db.collection(resetsCol).doc(tokenHash).set({
      tokenHash,
      userId: user.id,
      email: user.email,
      username: user.username,
      createdAt: Date.now(),
      expiresAt,
    });

    const host = req.headers.host;
    const basePath = sysId === 'gcsp' ? '/gcsp' : '';
    const resetLink = `https://${host}${basePath}/?resetToken=${token}`;

    try {
      await sendEmail({
        to: user.email,
        subject: 'Redefinição de senha — Sistema de Gestão de Contratos',
        html: `
          <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
            <h2 style="color:#0B2B5E;">Redefinição de senha</h2>
            <p>Olá, ${user.name || user.username}.</p>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta
            (<strong>@${user.username}</strong>) no Sistema de Gestão de Contratos da Belém Digital.</p>
            <p style="margin:24px 0;">
              <a href="${resetLink}"
                 style="background:#0B2B5E;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                Criar nova senha
              </a>
            </p>
            <p style="font-size:13px;color:#6b7280;">Esse link expira em 30 minutos e só pode ser usado uma vez.
            Se você não solicitou essa redefinição, pode ignorar este e-mail — sua senha atual continua válida.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      // Não expõe o erro de envio ao cliente (evita enumeration e vazamento
      // de detalhes de configuração), mas fica registrado no log do servidor.
      console.error('Erro ao enviar e-mail de redefinição:', emailErr);
    }

    genericResponse();
  } catch (err) {
    console.error('Erro em /api/request-password-reset:', err);
    res.status(500).json({ error: 'Erro interno ao processar a solicitação.' });
  }
};
