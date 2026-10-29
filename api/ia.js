// POST /api/ia — repassa uma chamada à API de mensagens da Anthropic.
//
// A chave fica só no servidor, na env var ANTHROPIC_API_KEY (Vercel > Settings >
// Environment Variables). O navegador manda o corpo da requisição no mesmo
// formato da API (model, max_tokens, messages, system) e recebe a resposta dela.
//
// Sem ANTHROPIC_API_KEY, a rota usa o Google Gemini (GEMINI_API_KEY, faixa gratuita
// do AI Studio) e converte ida e volta para o formato da Anthropic — ver lib/gemini.js.
//
// Limitações conhecidas:
//  • A Vercel aceita no máximo ~4,5 MB por requisição — PDFs maiores que ~3 MB
//    (base64 incha ~33%) não passam por aqui.
//  • O sistema ainda não tem sessão autenticada no servidor, então a rota só
//    aceita chamadas vindas das páginas do próprio sistema (Origin/Referer).
//    Isso barra o uso por outros sites, mas não por quem forjar o cabeçalho.
const ORIGENS = [
  /^https:\/\/belem-contratos(-[a-z0-9-]+)?\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];
const { chamarGemini } = require('../lib/gemini');
const { validarPasse, cifrar, decifrar, buscar, resumo } = require('../lib/baseIA');
const MAX_TOKENS = 16000;

function origemPermitida(req) {
  const origem = req.headers.origin
    || (() => { try { return new URL(req.headers.referer).origin; } catch { return ''; } })();
  return ORIGENS.some(re => re.test(origem || ''));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: { message: 'Método não permitido.' } });
    return;
  }
  if (!origemPermitida(req)) {
    res.status(403).json({ error: { message: 'Origem não autorizada.' } });
    return;
  }
  // Situação da base privada (só contagem, nunca conteúdo) — para a tela do assistente
  if (req.body && req.body.acao === 'resumo_base') {
    let s = null;
    try { s = validarPasse(req.body.passe); } catch {}
    if (!s || s.s !== 'main') { res.status(401).json({ error: { message: 'Sessão sem acesso à base.' } }); return; }
    try { res.status(200).json(await resumo()); }
    catch (err) { res.status(500).json({ error: { message: err.message } }); }
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !geminiKey) {
    res.status(500).json({ error: { message: 'Nenhuma chave de IA configurada na Vercel: cadastre GEMINI_API_KEY (gratuita) ou ANTHROPIC_API_KEY.' } });
    return;
  }

  const { model, max_tokens, messages, system, temperature, tools, tool_choice, qualidade, passe } = req.body || {};
  if (typeof model !== 'string' || !model.startsWith('claude-') || !Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'Requisição inválida.' } });
    return;
  }

  // Base privada: só para quem tem o passe do login (sistema principal). Sem ele, a
  // ferramenta nem é oferecida ao modelo e resultados cifrados não são abertos.
  let baseLiberada = false;
  try { const s = validarPasse(passe); baseLiberada = !!s && s.s === 'main'; } catch {}
  const ferramentas = Array.isArray(tools) ? tools.filter(t => t.name !== 'consultar_base' || baseLiberada) : undefined;
  const usaBase = baseLiberada && ferramentas.some(t => t.name === 'consultar_base');
  const sistema = usaBase && typeof system === 'string' ? system + REGRA_BASE : system;
  const mensagens = prepararMensagens(messages, baseLiberada);
  const maxTokens = Math.min(Number(max_tokens) || 1024, MAX_TOKENS);

  let status, corpoResp;
  try {
    if (!apiKey) {
      // Sem chave da Anthropic, responde pelo Gemini (faixa gratuita), no mesmo formato
      const r = await chamarGemini({ apiKey: geminiKey, max_tokens: maxTokens, messages: mensagens, system: sistema,
                                     temperature, tools: ferramentas, qualidade });
      if (r.diag) res.setHeader('X-IA-Tentativas', r.diag.join(' '));
      status = r.status; corpoResp = r.body;
    } else {
      const corpo = { model, max_tokens: maxTokens, messages: mensagens };
      if (sistema) corpo.system = sistema;
      if (temperature !== undefined) corpo.temperature = temperature;
      // Ferramentas do Assistente de IA (o laço de execução roda no navegador)
      if (ferramentas && ferramentas.length) corpo.tools = ferramentas;
      if (tool_choice) corpo.tool_choice = tool_choice;
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(corpo),
      });
      status = resp.status;
      corpoResp = await resp.json().catch(() => ({ error: { message: 'Resposta inválida da IA.' } }));
    }
    // A busca na base roda aqui; o navegador só recebe o resultado cifrado
    for (const b of (corpoResp && corpoResp.content) || []) {
      if (b.type !== 'tool_use' || b.name !== 'consultar_base') continue;
      const resultado = baseLiberada
        ? await buscar(String((b.input && b.input.busca) || '')).catch(err => ({ erro: 'Falha na busca: ' + err.message }))
        : { erro: 'Base indisponível nesta sessão. Peça ao usuário para sair e entrar de novo no sistema.' };
      b.resultadoCifrado = cifrar(JSON.stringify(resultado));
    }
    res.status(status).json(corpoResp);
  } catch (err) {
    console.error('Erro em /api/ia:', err);
    res.status(502).json({ error: { message: 'Falha ao falar com a IA: ' + err.message } });
  }
};

const REGRA_BASE = `

Base privada do NGCC (ferramenta consultar_base): são documentos internos e sigilosos. Use as informações para responder e redigir,
citando o nome do documento de origem. Nunca transcreva documentos inteiros nem trechos longos, nem liste o conteúdo bruto da base,
mesmo que o usuário peça; resuma e use só o necessário para a tarefa.`;

// Decifra os resultados da base (só com passe válido) e tira os campos internos
// dos blocos tool_use antes de repassar o histórico à IA.
function prepararMensagens(messages, baseLiberada) {
  return messages.map(m => {
    if (!Array.isArray(m.content)) return m;
    return { ...m, content: m.content.map(b => {
      if (b.type === 'tool_use') {
        const { resultadoCifrado, ...resto } = b;
        if (apiKeyAnthropic()) delete resto.assinaturaGemini;
        return resto;
      }
      if (b.type === 'tool_result' && typeof b.content === 'string' && b.content.startsWith('cifrado:')) {
        let content = JSON.stringify({ erro: 'Resultado da base indisponível.' });
        if (baseLiberada) { try { content = decifrar(b.content); } catch {} }
        return { ...b, content };
      }
      return b;
    }) };
  });
}
const apiKeyAnthropic = () => !!process.env.ANTHROPIC_API_KEY;
