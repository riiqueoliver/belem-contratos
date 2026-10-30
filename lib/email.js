// Envio de e-mail do sistema (aviso de cadastro, redefinição de senha).
//
// Preferência: Gmail por SMTP, com senha de app do Google.
//   GMAIL_USER         → endereço Gmail remetente (ex.: henriquebelemdigital@gmail.com)
//   GMAIL_APP_PASSWORD → senha de app de 16 letras (Conta Google > Segurança > Senhas de app;
//                        exige verificação em duas etapas). Não é a senha normal da conta.
//   GMAIL_FROM_NAME    → opcional, nome exibido (padrão "Belém Digital")
//   EMAIL_REPLY_TO     → opcional, endereço que recebe as respostas (padrão: o próprio remetente)
//
// Todo e-mail sai com versão HTML e versão em texto simples: e-mail só em HTML
// pesa contra nos filtros de spam. Se o chamador não mandar `text`, ele é gerado do HTML.
//
// Alternativa: Resend (https://resend.com), usado só se o Gmail não estiver configurado.
//   RESEND_API_KEY e RESEND_FROM. Sem domínio verificado, o Resend só entrega ao dono da conta.
const nodemailer = require('nodemailer');

let transporte = null;

// Versão em texto simples a partir do HTML: links viram "texto (url)", blocos viram linhas
function htmlParaTexto(html) {
  return String(html || '')
    .replace(/<(style|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, url, t) => `${t.replace(/<[^>]+>/g, '').trim()}: ${url}`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|div|tr|li)>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail({ to, subject, html, text, replyTo }) {
  const gmail = process.env.GMAIL_USER;
  const senhaApp = process.env.GMAIL_APP_PASSWORD;
  text = text || htmlParaTexto(html);
  replyTo = replyTo || process.env.EMAIL_REPLY_TO || gmail || undefined;
  if (gmail && senhaApp) {
    if (!transporte) {
      transporte = nodemailer.createTransport({
        host: 'smtp.gmail.com', port: 465, secure: true,
        auth: { user: gmail, pass: senhaApp.replace(/\s+/g, '') },
      });
    }
    const nome = process.env.GMAIL_FROM_NAME || 'Belém Digital';
    return transporte.sendMail({ from: `"${nome}" <${gmail}>`, to, subject, html, text, replyTo });
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
    body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Falha ao enviar e-mail (${resp.status}): ${text}`);
  }
  return resp.json();
}

module.exports = { sendEmail };
