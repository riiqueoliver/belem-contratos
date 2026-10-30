// POST /api/notificar-cadastro — { passe, pendenteId, decisao: 'aprovado' | 'recusado' }
//
// Avisa por e-mail quem pediu acesso se a solicitação foi aprovada ou recusada.
// Só um admin logado (passe assinado de /api/login) pode disparar, e o e-mail de
// destino vem da própria solicitação no Firestore — nunca do navegador. Por isso o
// navegador chama isto ANTES de apagar a solicitação pendente.
const { getDb } = require('../lib/firebaseAdmin');
const { sendEmail } = require('../lib/email');
const { validarPasse } = require('../lib/baseIA');

const SISTEMA = {
  main: { nome: 'Belém Digital – Gestão de Contratos', url: 'https://belem-contratos.vercel.app', prefixo: '' },
  gcsp: { nome: 'GCSP – Contratos, Suprimentos e Patrimônio', url: 'https://belem-contratos.vercel.app/gcsp', prefixo: 'gcsp_' },
};
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function corpoEmail({ sistema, nome, username, aprovado }) {
  const cor = aprovado ? '#3A8A35' : '#B91C1C';
  const titulo = aprovado ? 'Seu acesso foi aprovado' : 'Sua solicitação de acesso não foi aprovada';
  const texto = aprovado
    ? `Sua solicitação de acesso ao <b>${esc(sistema.nome)}</b> foi aprovada. Você já pode entrar com o login <b>${esc(username)}</b> e a senha que cadastrou, ou com o botão <b>Entrar com Google</b> usando este mesmo e-mail.`
    : `Sua solicitação de acesso ao <b>${esc(sistema.nome)}</b> não foi aprovada pelo administrador. Se achar que houve engano, procure o Núcleo de Gestão Comercial e Contratual (NGCC) da Belém Digital.`;
  return `<!doctype html><html><body style="margin:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#0B2B5E;padding:22px;text-align:center">
        <img src="https://belem-contratos.vercel.app/belem-digital-branco.png" alt="Belém Digital" height="44" style="height:44px">
      </td></tr>
      <tr><td style="padding:26px 28px">
        <p style="margin:0 0 6px;font-size:13px;color:#64748b">Olá, ${esc(nome || username)}</p>
        <h1 style="margin:0 0 14px;font-size:20px;color:${cor}">${titulo}</h1>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.6">${texto}</p>
        ${aprovado ? `<a href="${sistema.url}" style="display:inline-block;background:#0B2B5E;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:11px 22px;border-radius:10px">Acessar o sistema</a>` : ''}
      </td></tr>
      <tr><td style="padding:14px 28px;background:#F8FAFC;font-size:12px;color:#64748b">Ficou com alguma dúvida? É só responder este e-mail.<br>Núcleo de Gestão Comercial e Contratual (NGCC) · Belém Digital</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }
  try {
    const { passe, pendenteId, decisao } = req.body || {};
    if (!['aprovado', 'recusado'].includes(decisao) || !pendenteId) { res.status(400).json({ error: 'Requisição inválida.' }); return; }

    let sessao = null;
    try { sessao = validarPasse(passe); } catch {}
    if (!sessao) { res.status(401).json({ error: 'Sessão expirada: saia e entre de novo para enviar o aviso por e-mail.' }); return; }

    const sistema = SISTEMA[sessao.s] || SISTEMA.main;
    const db = getDb();
    // Só admin dispara
    const admin = await db.collection(sistema.prefixo + 'users').where('username', '==', sessao.u).get();
    if (!admin.docs.some(d => d.data().role === 'admin')) { res.status(403).json({ error: 'Apenas administradores enviam este aviso.' }); return; }

    // E-mail de destino vem da solicitação gravada, não do navegador
    const pend = await db.collection(sistema.prefixo + 'pendingUsers').doc(String(pendenteId)).get();
    if (!pend.exists) { res.status(404).json({ error: 'Solicitação não encontrada.' }); return; }
    const p = pend.data();
    const email = String(p.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { res.status(422).json({ error: 'A solicitação não tem um e-mail válido.' }); return; }

    const aprovado = decisao === 'aprovado';
    await sendEmail({
      to: email,
      subject: aprovado ? `${p.name ? String(p.name).split(' ')[0] + ', seu' : 'Seu'} acesso ao sistema de contratos foi liberado`
                        : 'Sobre a sua solicitação de acesso ao sistema de contratos',
      html: corpoEmail({ sistema, nome: p.name, username: p.username, aprovado }),
    });
    res.status(200).json({ ok: true, email });
  } catch (err) {
    console.error('Erro em /api/notificar-cadastro:', err);
    res.status(500).json({ error: 'Não foi possível enviar o e-mail: ' + err.message });
  }
};
