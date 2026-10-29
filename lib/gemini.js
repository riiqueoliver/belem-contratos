// Ponte para o Google Gemini (faixa gratuita do AI Studio), usada por /api/ia quando
// não há ANTHROPIC_API_KEY. Recebe o corpo no formato da API de mensagens da Anthropic
// e devolve a resposta no mesmo formato, então o navegador não precisa saber qual IA respondeu.
//
// Env: GEMINI_API_KEY (obrigatória) e GEMINI_MODEL (opcional).
// Faixa gratuita: poucas requisições por minuto — em 429 a ponte espera e tenta de novo.
const MODELOS_PADRAO = ['gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

function textoDoSystem(system) {
  if (!system) return '';
  if (typeof system === 'string') return system;
  if (Array.isArray(system)) return system.map(b => b.text || '').join('\n\n');
  return '';
}

function respostaDaFerramenta(conteudo) {
  const texto = Array.isArray(conteudo) ? conteudo.map(b => b.text || '').join('\n') : String(conteudo ?? '');
  try {
    const obj = JSON.parse(texto);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : { resultado: obj };
  } catch { return { resultado: texto }; }
}

// Converte as mensagens da Anthropic em "contents" do Gemini
function converterMensagens(messages) {
  const nomePorId = {};
  const contents = [];
  for (const m of messages) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const blocos = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : (m.content || []);
    const parts = [];
    for (const b of blocos) {
      if (b.type === 'text' && b.text) parts.push({ text: b.text });
      else if ((b.type === 'image' || b.type === 'document') && b.source) {
        if (b.source.type === 'base64') parts.push({ inlineData: { mimeType: b.source.media_type, data: b.source.data } });
        else if (b.source.type === 'text') parts.push({ text: b.source.data });
        else if (b.source.type === 'url') parts.push({ fileData: { fileUri: b.source.url } });
      } else if (b.type === 'tool_use') {
        nomePorId[b.id] = b.name;
        const p = { functionCall: { name: b.name, args: b.input || {} } };
        if (b.assinaturaGemini) p.thoughtSignature = b.assinaturaGemini;
        parts.push(p);
      } else if (b.type === 'tool_result') {
        parts.push({ functionResponse: { name: nomePorId[b.tool_use_id] || 'ferramenta', response: respostaDaFerramenta(b.content) } });
      }
    }
    if (!parts.length) continue;
    const ultimo = contents[contents.length - 1];
    if (ultimo && ultimo.role === role) ultimo.parts.push(...parts);
    else contents.push({ role, parts });
  }
  return contents;
}

function converterFerramentas(tools) {
  if (!Array.isArray(tools) || !tools.length) return undefined;
  return [{ functionDeclarations: tools.map(t => ({
    name: t.name, description: t.description || '', parametersJsonSchema: t.input_schema || { type: 'object', properties: {} },
  })) }];
}

// Converte a resposta do Gemini no formato da Anthropic
function converterResposta(json, modelo) {
  const cand = (json.candidates || [])[0] || {};
  const content = [];
  let n = 0;
  for (const p of (cand.content && cand.content.parts) || []) {
    if (p.thought) continue;
    if (p.text) content.push({ type: 'text', text: p.text });
    else if (p.functionCall) {
      const bloco = { type: 'tool_use', id: `gm_${Date.now()}_${n++}`, name: p.functionCall.name, input: p.functionCall.args || {} };
      if (p.thoughtSignature) bloco.assinaturaGemini = p.thoughtSignature;
      content.push(bloco);
    }
  }
  if (!content.length) {
    const motivo = cand.finishReason || (json.promptFeedback && json.promptFeedback.blockReason) || 'desconhecido';
    content.push({ type: 'text', text: `(A IA não devolveu texto — motivo: ${motivo}. Tente reformular o pedido.)` });
  }
  const stop_reason = content.some(b => b.type === 'tool_use') ? 'tool_use'
    : cand.finishReason === 'MAX_TOKENS' ? 'max_tokens' : 'end_turn';
  const u = json.usageMetadata || {};
  return { id: 'gm_' + Date.now(), type: 'message', role: 'assistant', model: modelo, content, stop_reason,
           usage: { input_tokens: u.promptTokenCount || 0, output_tokens: u.candidatesTokenCount || 0 } };
}

const esperar = ms => new Promise(r => setTimeout(r, ms));

async function chamarGemini({ apiKey, max_tokens, messages, system, temperature, tools }) {
  const corpo = {
    contents: converterMensagens(messages),
    // O Gemini gasta parte do limite "pensando": pedidos curtos (ex.: 512) voltariam vazios
    generationConfig: { maxOutputTokens: Math.max(Number(max_tokens) || 0, 8192) },
  };
  const sys = textoDoSystem(system);
  if (sys) corpo.systemInstruction = { parts: [{ text: sys }] };
  if (temperature !== undefined) corpo.generationConfig.temperature = temperature;
  const ferramentas = converterFerramentas(tools);
  if (ferramentas) corpo.tools = ferramentas;

  // Cada modelo tem a própria cota gratuita: no limite (429) ou sobrecarga (503) passa logo
  // para o próximo, e só espera quando todos falharam na rodada.
  const modelos = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...MODELOS_PADRAO.filter(m => m !== process.env.GEMINI_MODEL)] : MODELOS_PADRAO;
  const diag = [];
  let ultimo = { status: 502, message: 'Falha ao falar com o Gemini.' };
  let espera = 0;
  for (let rodada = 0; rodada < 3; rodada++) {
    if (rodada > 0) await esperar(Math.min(espera || 4000, 12000));
    espera = 0;
    for (const modelo of modelos) {
      const t0 = Date.now();
      const resp = await fetch(`${BASE}${modelo}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(corpo),
      });
      const json = await resp.json().catch(() => ({}));
      diag.push(`${modelo}:${resp.status}:${Date.now() - t0}ms`);
      if (resp.ok) return { status: 200, body: converterResposta(json, modelo), diag };
      const msg = (json.error && json.error.message) || `HTTP ${resp.status}`;
      ultimo = { status: resp.status, message: msg };
      const sugerido = /retry in ([\d.]+)s/i.exec(msg);
      if (sugerido) espera = Math.max(espera, Number(sugerido[1]) * 1000 + 500);
      if (![404, 429, 500, 503].includes(resp.status)) return erroGemini(ultimo, diag);
    }
  }
  return erroGemini(ultimo, diag);
}

function erroGemini(ultimo, diag) {
  const message = ultimo.status === 429
    ? 'Limite gratuito do Gemini atingido. Aguarde um minuto e tente de novo. (' + ultimo.message + ')'
    : ultimo.message;
  return { status: ultimo.status, body: { type: 'error', error: { type: 'api_error', message } }, diag };
}

module.exports = { chamarGemini, converterMensagens, converterResposta, converterFerramentas };
