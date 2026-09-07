// Envio de e-mail via Resend (https://resend.com).
// Requer a env var RESEND_API_KEY na Vercel.
// RESEND_FROM é opcional — por padrão usa o domínio de testes do Resend,
// que só entrega de verdade depois que um domínio próprio for verificado
// lá (Resend > Domains). Até isso ser feito, defina RESEND_FROM com o
// e-mail que você verificou como remetente de teste na sua conta Resend.
async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY não configurada nas variáveis de ambiente.');
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
