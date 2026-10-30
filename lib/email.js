// Envio de e-mail do sistema (aviso de cadastro, redefinição de senha).
//
// Preferência: Gmail por SMTP, com senha de app do Google.
//   GMAIL_USER         → endereço Gmail remetente (ex.: henriquebelemdigital@gmail.com)
//   GMAIL_APP_PASSWORD → senha de app de 16 letras (Conta Google > Segurança > Senhas de app;
//                        exige verificação em duas etapas). Não é a senha normal da conta.
//   GMAIL_FROM_NAME    → opcional, nome exibido (padrão "Belém Digital")
//
// Alternativa: Resend (https://resend.com), usado só se o Gmail não estiver configurado.
//   RESEND_API_KEY e RESEND_FROM. Sem domínio verificado, o Resend só entrega ao dono da conta.
const nodemailer = require('nodemailer');

let transporte = null;

async function sendEmail({ to, subject, html }) {
  const gmail = process.env.GMAIL_USER;
  const senhaApp = process.env.GMAIL_APP_PASSWORD;
  if (gmail && senhaApp) {
    if (!transporte) {
      transporte = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: gmail, pass: senhaApp.replace(/\s+/g, '') },
      });
    }
    const nome = process.env.GMAIL_FROM_NAME || 'Belém Digital';
    return transporte.sendMail({ from: `"${nome}" <${gmail}>`, to, subject, html });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('envio de e-mail não configurado (cadastre GMAIL_USER e GMAIL_APP_PASSWORD na Vercel).');
  }
  const from = process.env.RESEND_FROM || 'Belém Digital <onboarding@resend.dev>';

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail (${resp.status}): ${text}`);
  }
  return resp.json();
}

module.exports = { sendEmail };
