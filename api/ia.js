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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!apiKey && !geminiKey) {
    res.status(500).json({ error: { message: 'Nenhuma chave de IA configurada na Vercel: cadastre GEMINI_API_KEY (gratuita) ou ANTHROPIC_API_KEY.' } });
    return;
  }

  const { model, max_tokens, messages, system, temperature, tools, tool_choice } = req.body || {};
  if (typeof model !== 'string' || !model.startsWith('claude-') || !Array.isArray(messages)) {
    res.status(400).json({ error: { message: 'Requisição inválida.' } });
    return;
  }

  // Sem chave da Anthropic, responde pelo Gemini (faixa gratuita), no mesmo formato
  if (!apiKey) {
    try {
      const r = await chamarGemini({ apiKey: geminiKey, max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS),
                                     messages, system, temperature, tools });
      res.status(r.status).json(r.body);
    } catch (err) {
      console.error('Erro em /api/ia (Gemini):', err);
      res.status(502).json({ error: { message: 'Falha ao falar com o Gemini: ' + err.message } });
    }
    return;
  }
  const corpo = { model, max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS), messages };
  if (system) corpo.system = system;
  if (temperature !== undefined) corpo.temperature = temperature;
  // Ferramentas do Assistente de IA (o laço de execução roda no navegador)
  if (Array.isArray(tools) && tools.length) corpo.tools = tools;
  if (tool_choice) corpo.tool_choice = tool_choice;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(corpo),
    });
    const texto = await resp.text();
    res.status(resp.status).setHeader('Content-Type', 'application/json').send(texto);
  } catch (err) {
    console.error('Erro em /api/ia:', err);
    res.status(502).json({ error: { message: 'Falha ao falar com a IA: ' + err.message } });
  }
};
