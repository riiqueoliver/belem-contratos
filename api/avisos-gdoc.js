// POST /api/avisos-gdoc — chamado pela extensão SGC ↔ GDoc ao fim de cada varredura.
//
// Manda um e-mail por novidade do GDoc, com o assunto já dizendo o que aconteceu
// (ex.: "Nota Fiscal adicionada ao GDoc 990/2026"). Não recebe texto de fora:
// o conteúdo sai só do que a extensão registrou no Firestore (gdoc_movs e gdoc_caixa),
// e cada item é marcado como avisado — chamar de novo não repete nem inventa nada.
const { getDb } = require('../lib/firebaseAdmin');
const { sendEmail } = require('../lib/email');

// Quem recebe (usuários do sistema; o e-mail vem do cadastro)
const DESTINATARIOS = ['henriquecorreia'];
// Só novidades a partir da implantação: o histórico anterior não é reenviado
const DESDE = '2026-11-06T05:20:00.000Z';
const MAX_POR_VEZ = 15;
const URL_SISTEMA = 'https://belem-contratos.vercel.app';

const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const curto = (s, n = 90) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function assuntoMov(m) {
  const g = `GDoc ${m.gdoc}`;
  const ctr = m.contractNumber ? ` · Contrato ${m.contractNumber}` : '';
  if (m.tipo === 'nf') return `Nota Fiscal adicionada ao ${g}${ctr}`;
  if (m.tipo === 'nl') return `Nota de Liquidação adicionada ao ${g}${ctr}`;
  if (m.tipo === 'tramitacao') return m.setor ? `${g} tramitou para ${curto(m.setor, 60)}${ctr}` : `${g} tramitou${ctr}`;
  return `Aviso do ${g}: ${curto(m.descricao, 70)}`;
}
function assuntoCaixa(p) {
  return `Novo processo na caixa do NGCC: ${p.processo}${p.tipo ? ' · ' + p.tipo : ''}`;
}

function html(titulo, linhas, rodape) {
  const linha = (r, v) => v ? `<tr><td style="padding:4px 14px 4px 0;font-size:12px;color:#64748b;white-space:nowrap;vertical-align:top">${r}</td><td style="padding:4px 0;font-size:14px;color:#1e293b">${v}</td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F3F5F8;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E3E8EF">
      <tr><td style="background:#0B2B5E;padding:16px 24px;color:#fff;font-size:13px;font-weight:bold">Gestão de Contratos · Avisos do GDoc</td></tr>
      <tr><td style="padding:22px 24px">
        <p style="margin:0 0 14px;font-size:18px;font-weight:bold;color:#0B2B5E">${esc(titulo)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0">${linhas.map(([r, v]) => linha(r, v)).join('')}</table>
        <p style="margin:22px 0 0"><a href="${URL_SISTEMA}" style="display:inline-block;background:#0B2B5E;color:#fff;text-decoration:none;font-weight:bold;font-size:13px;padding:10px 18px;border-radius:8px">Abrir o sistema</a></p>
      </td></tr>
      <tr><td style="padding:12px 24px;background:#F8FAFC;font-size:11px;color:#64748b">${rodape}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Reserva o item para não mandar duas vezes se duas varreduras chamarem juntas
async function reservar(db, ref) {
  return db.runTransaction(async tx => {
    const s = await tx.get(ref);
    const d = s.exists ? s.data() : null;
    // "enviando" esquecido por uma chamada que caiu no meio volta a valer depois de 10 min
    const travado = d && d.emailAvisado === 'enviando' && Date.now() - new Date(d.emailAvisadoEm || 0).getTime() > 10 * 60000;
    if (!d || (d.emailAvisado && !travado)) return false;
    tx.update(ref, { emailAvisado: 'enviando', emailAvisadoEm: new Date().toISOString() });
    return true;
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }
  try {
    const db = getDb();
    const usuarios = (await db.collection('users').get()).docs.map(d => d.data());
    const para = DESTINATARIOS.map(u => usuarios.find(x => x.username === u)?.email).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim()));
    if (!para.length) { res.status(200).json({ ok: true, enviados: 0, motivo: 'sem destinatário com e-mail' }); return; }

    const pendentes = [];
    const movs = await db.collection('gdoc_movs').where('criadoEm', '>=', DESDE).get();
    movs.docs.forEach(d => { const m = d.data(); if (!m.emailAvisado) pendentes.push({ ref: d.ref, quando: m.criadoEm, mov: m }); });
    const caixa = await db.collection('gdoc_caixa').where('entrouEm', '>=', DESDE).get();
    caixa.docs.forEach(d => { const p = d.data(); if (!p.emailAvisado && p.presente) pendentes.push({ ref: d.ref, quando: p.entrouEm, caixa: p }); });
    pendentes.sort((a, b) => String(a.quando).localeCompare(String(b.quando)));

    let enviados = 0;
    for (const it of pendentes.slice(0, MAX_POR_VEZ)) {
      if (!(await reservar(db, it.ref))) continue;
      try {
        let assunto, corpo;
        if (it.mov) {
          const m = it.mov;
          assunto = assuntoMov(m);
          corpo = html(assunto, [
            ['Processo', esc(`GDoc ${m.gdoc}`)],
            ['Contrato', esc(m.contractNumber)],
            ['O que houve', esc(m.descricao)],
            ['Setor atual', esc(m.setor)],
            ['Anexo', esc(m.anexoNome)],
            ['Data do anexo', esc(m.dataAnexo)],
            ['No sistema', esc(m.resultado || (m.tipo === 'nf' || m.tipo === 'nl' ? 'O PDF será importado para a parcela quando o sistema estiver aberto.' : ''))],
          ], 'Aviso automático da varredura da extensão SGC ↔ GDoc.');
        } else {
          const p = it.caixa;
          assunto = assuntoCaixa(p);
          corpo = html(assunto, [
            ['Processo', esc(p.processo)],
            ['Tipo', esc(p.tipo)],
            ['Assunto', esc(curto(p.assunto, 300))],
            ['Origem', esc(p.setorOrigem)],
            ['Interessado', esc(p.interessado)],
            ['Recebido no setor', esc(String(p.recebimento || '').replace('T', ' ').slice(0, 16))],
            ['Prioridade no GDoc', p.prioridadeGdoc ? 'Sim' : ''],
          ], 'Aviso automático da caixa do setor (Gestão GDoc).');
        }
        for (const to of para) await sendEmail({ to, subject: assunto, html: corpo });
        await it.ref.update({ emailAvisado: true });
        enviados++;
      } catch (e) {
        console.error('avisos-gdoc: falha ao enviar', e);
        await it.ref.update({ emailAvisado: false }).catch(() => {});
      }
    }
    res.status(200).json({ ok: true, enviados, pendentes: Math.max(0, pendentes.length - MAX_POR_VEZ) });
  } catch (err) {
    console.error('Erro em /api/avisos-gdoc:', err);
    res.status(500).json({ error: 'não foi possível enviar os avisos: ' + err.message });
  }
};
