// POST /api/agenda-convite — { passe, eventoId, acao: 'novo' | 'alterado' | 'cancelado' }
//
// Avisa por e-mail os participantes de um evento da Agenda, com convite de calendário
// (.ics) para o evento entrar direto no Google Agenda/Outlook de quem recebe.
// O evento e os e-mails de destino vêm do Firestore, nunca do navegador; só quem criou
// o evento ou participa dele (sessão assinada de /api/login) pode disparar o aviso.
const { getDb } = require('../lib/firebaseAdmin');
const { sendEmail } = require('../lib/email');
const { validarPasse } = require('../lib/baseIA');

const SISTEMA = {
  main: { nome: 'Belém Digital – Gestão de Contratos', url: 'https://belem-contratos.vercel.app', prefixo: '' },
  gcsp: { nome: 'GCSP – Contratos, Suprimentos e Patrimônio', url: 'https://belem-contratos.vercel.app/gcsp', prefixo: 'gcsp_' },
};
const TIPOS = { reuniao: 'Reunião', compromisso: 'Compromisso', tarefa: 'Tarefa', prazo: 'Prazo', lembrete: 'Lembrete' };
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const DIAS = ['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'];
const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const emailValido = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());

function quando(ev) {
  const d = new Date(ev.data + 'T12:00:00');
  const dia = `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return ev.diaInteiro ? `${dia} (dia inteiro)` : `${dia}, das ${ev.inicio}${ev.fim ? ` às ${ev.fim}` : ''}`;
}

// Belém não tem horário de verão: hora local + 3h = UTC
function utc(data, hora) {
  const [a, m, d] = data.split('-').map(Number);
  const [h, mi] = (hora || '00:00').split(':').map(Number);
  const t = new Date(Date.UTC(a, m - 1, d, h + 3, mi));
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
const icsTexto = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

function convite(ev, id, organizador, convidados, cancelado, sequencia) {
  const fimHora = ev.fim || (() => { const [h, m] = (ev.inicio || '09:00').split(':').map(Number); return `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`; })();
  const proxDia = (() => { const d = new Date(ev.data + 'T12:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ''); })();
  const linhas = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Belem Digital//Agenda SGC//PT-BR', 'CALSCALE:GREGORIAN',
    `METHOD:${cancelado ? 'CANCEL' : 'REQUEST'}`,
    'BEGIN:VEVENT',
    `UID:${id}@belem-contratos.vercel.app`,
    `SEQUENCE:${sequencia}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    ...(ev.diaInteiro
      ? [`DTSTART;VALUE=DATE:${ev.data.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${proxDia}`]
      : [`DTSTART:${utc(ev.data, ev.inicio)}`, `DTEND:${utc(ev.data, fimHora)}`]),
    `SUMMARY:${icsTexto(ev.titulo)}`,
    ...(ev.local ? [`LOCATION:${icsTexto(ev.local)}`] : []),
    ...(ev.descricao ? [`DESCRIPTION:${icsTexto(ev.descricao)}`] : []),
    `ORGANIZER;CN=${icsTexto(organizador.nome)}:mailto:${organizador.email}`,
    ...convidados.map(c => `ATTENDEE;CN=${icsTexto(c.nome || c.email)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${c.email}`),
    `STATUS:${cancelado ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return linhas.join('\r\n');
}

function corpo({ sistema, ev, acao, organizador, nomeDestino, participantes }) {
  const titulo = { novo: 'Você foi convidado', alterado: 'Evento alterado', cancelado: 'Evento cancelado' }[acao];
  const cor = acao === 'cancelado' ? '#B91C1C' : '#0B2B5E';
  const linha = (rot, val) => val ? `<tr><td style="padding:4px 12px 4px 0;font-size:12px;color:#64748b;white-space:nowrap;vertical-align:top">${rot}</td><td style="padding:4px 0;font-size:14px;color:#1e293b">${val}</td></tr>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F1F5F9;font-family:Arial,Helvetica,sans-serif;color:#1e293b">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border-radius:14px;overflow:hidden">
      <tr><td style="background:#0B2B5E;padding:20px;text-align:center">
        <img src="https://belem-contratos.vercel.app/belem-digital-branco.png" alt="Belém Digital" height="40" style="height:40px">
      </td></tr>
      <tr><td style="padding:24px 28px">
        <p style="margin:0 0 4px;font-size:13px;color:#64748b">Olá, ${esc(nomeDestino)}</p>
        <h1 style="margin:0 0 4px;font-size:19px;color:${cor}">${titulo}</h1>
        <p style="margin:0 0 18px;font-size:13px;color:#64748b">${esc(organizador.nome)} ${acao === 'cancelado' ? 'cancelou' : acao === 'alterado' ? 'alterou' : 'marcou'} ${acao === 'novo' ? 'com você' : 'este evento'}:</p>
        <p style="margin:0 0 12px;font-size:17px;font-weight:bold;${acao === 'cancelado' ? 'text-decoration:line-through;color:#94a3b8' : ''}">${esc(ev.titulo)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          ${linha('Tipo', esc(TIPOS[ev.tipo] || 'Evento'))}
          ${linha('Quando', esc(quando(ev)))}
          ${linha('Local', esc(ev.local))}
          ${linha('Participantes', esc(participantes.join(', ')))}
          ${linha('Descrição', esc(ev.descricao).replace(/\n/g, '<br>'))}
        </table>
        ${acao !== 'cancelado' ? `<p style="margin:22px 0 0"><a href="${sistema.url}" style="display:inline-block;background:#0B2B5E;color:#fff;text-decoration:none;font-weight:bold;font-size:14px;padding:10px 20px;border-radius:10px">Abrir a agenda</a></p>` : ''}
      </td></tr>
      <tr><td style="padding:14px 28px;background:#F8FAFC;font-size:12px;color:#64748b">O convite em anexo adiciona o evento ao seu calendário.<br>Agenda · ${esc(sistema.nome)}</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Método não permitido.' }); return; }
  try {
    const { passe, eventoId, acao } = req.body || {};
    if (!['novo', 'alterado', 'cancelado'].includes(acao) || !eventoId) { res.status(400).json({ error: 'Requisição inválida.' }); return; }
    let sessao = null;
    try { sessao = validarPasse(passe); } catch {}
    if (!sessao) { res.status(401).json({ error: 'sessão expirada: saia e entre de novo no sistema' }); return; }

    const sistema = SISTEMA[sessao.s] || SISTEMA.main;
    const db = getDb();
    const ref = db.collection(sistema.prefixo + 'agenda').doc(String(eventoId));
    const snap = await ref.get();
    if (!snap.exists) { res.status(404).json({ error: 'evento não encontrado' }); return; }
    const ev = snap.data();
    // Quem criou e os participantes do sistema podem avisar (o organizador continua sendo quem criou)
    if (ev.criadoPor !== sessao.u && !(ev.participantes || []).includes(sessao.u)) { res.status(403).json({ error: 'só quem criou ou participa do evento envia o aviso' }); return; }

    const usuarios = (await db.collection(sistema.prefixo + 'users').get()).docs.map(d => d.data());
    const pessoa = u => usuarios.find(x => x.username === u) || {};
    const org = pessoa(ev.criadoPor);
    const organizador = { nome: org.name || ev.criadoPor, email: emailValido(org.email) ? org.email.trim() : (process.env.GMAIL_USER || 'agenda@belemdigital') };
    const convidados = [
      ...(ev.participantes || []).map(u => ({ nome: pessoa(u).name || u, email: String(pessoa(u).email || '').trim() })),
      ...(ev.convidadosExternos || []).map(e => ({ nome: '', email: String(e).trim() })),
    ].filter(c => emailValido(c.email) && c.email.toLowerCase() !== organizador.email.toLowerCase());
    if (!convidados.length) { res.status(422).json({ error: 'nenhum participante com e-mail cadastrado' }); return; }

    // Sequência do convite: cada alteração aumenta, para o calendário substituir a versão anterior
    const sequencia = (ev.icsSequencia || 0) + (acao === 'novo' ? 0 : 1);
    if (acao !== 'cancelado') await ref.update({ icsSequencia: sequencia }).catch(() => {});

    const nomes = [organizador.nome, ...convidados.map(c => c.nome || c.email)];
    const ics = convite(ev, eventoId, organizador, convidados, acao === 'cancelado', sequencia);
    const assunto = { novo: 'Convite', alterado: 'Alterado', cancelado: 'Cancelado' }[acao] + `: ${ev.titulo} · ${quando(ev)}`;
    const enviados = [];
    for (const c of convidados) {
      await sendEmail({ to: c.email, subject: assunto, replyTo: organizador.email,
        html: corpo({ sistema, ev, acao, organizador, nomeDestino: c.nome || c.email, participantes: nomes }),
        ics, icsMetodo: acao === 'cancelado' ? 'CANCEL' : 'REQUEST' });
      enviados.push(c.email);
    }
    res.status(200).json({ ok: true, enviados });
  } catch (err) {
    console.error('Erro em /api/agenda-convite:', err);
    res.status(500).json({ error: 'não foi possível enviar: ' + err.message });
  }
};
