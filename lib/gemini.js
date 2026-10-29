// Ponte para o Google Gemini (faixa gratuita do AI Studio), usada por /api/ia quando
// não há ANTHROPIC_API_KEY. Recebe o corpo no formato da API de mensagens da Anthropic
// e devolve a resposta no mesmo formato, então o navegador não precisa saber qual IA respondeu.
//
// Env: GEMINI_API_KEY (obrigatória) e GEMINI_MODEL (opcional).
// Faixa gratuita: poucas requisições por minuto — em 429 a ponte espera e tenta de novo.
// Rápido primeiro (~1 s): conversa, consultas e textos curtos. O completo fica para documentos
// técnicos (DFD, ETP, TR), quando o navegador pede qualidade 'alta'.
const MODELOS_RAPIDOS  = ['gemini-flash-lite-latest', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-2.5-flash'];
const MODELOS_COMPLETOS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite'];
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
const PRIMEIRO_TRECHO_MS = 25000;   // sem nenhum trecho nesse prazo, o modelo está travado: tenta outro

// Chama em fluxo (SSE) e junta os trechos numa resposta única do Gemini.
// Se o primeiro trecho não chegar a tempo, aborta e devolve status 504.
async function gerarEmFluxo(modelo, corpo, apiKey) {
  const ctrl = new AbortController();
  let timer = setTimeout(() => ctrl.abort(), PRIMEIRO_TRECHO_MS);
  let resp;
  try {
    resp = await fetch(`${BASE}${modelo}:streamGenerateContent?alt=sse`, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(corpo),
    });
  } catch (err) {
    clearTimeout(timer);
    return { status: 504, json: { error: { message: `O modelo ${modelo} não respondeu em ${PRIMEIRO_TRECHO_MS / 1000}s.` } } };
  }
  if (!resp.ok) {
    clearTimeout(timer);
    return { status: resp.status, json: await resp.json().catch(() => ({})) };
  }
  const parts = [];
  let finishReason, usageMetadata, promptFeedback;
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for await (const pedaco of resp.body) {
      if (timer) { clearTimeout(timer); timer = null; }
      buffer += decoder.decode(pedaco, { stream: true });
      let fim;
      while ((fim = buffer.indexOf('\n')) >= 0) {
        const linha = buffer.slice(0, fim).trim();
        buffer = buffer.slice(fim + 1);
        if (!linha.startsWith('data:')) continue;
        let ev;
        try { ev = JSON.parse(linha.slice(5)); } catch { continue; }
        const cand = (ev.candidates || [])[0] || {};
        for (const p of (cand.content && cand.content.parts) || []) {
          const ant = parts[parts.length - 1];
          // Texto chega picado: emenda no anterior quando os dois são texto comum
          if (p.text !== undefined && !p.thought && ant && ant.text !== undefined && !ant.thought && !ant.thoughtSignature) ant.text += p.text;
          else parts.push({ ...p });
        }
        if (cand.finishReason) finishReason = cand.finishReason;
        if (ev.usageMetadata) usageMetadata = ev.usageMetadata;
        if (ev.promptFeedback) promptFeedback = ev.promptFeedback;
      }
    }
  } catch (err) {
    if (timer) clearTimeout(timer);
    if (!parts.length) return { status: 504, json: { error: { message: `O modelo ${modelo} não respondeu em ${PRIMEIRO_TRECHO_MS / 1000}s.` } } };
    throw err;
  }
  if (timer) clearTimeout(timer);
  return { status: 200, json: { candidates: [{ content: { parts }, finishReason }], usageMetadata, promptFeedback } };
}

async function chamarGemini({ apiKey, max_tokens, messages, system, temperature, tools, qualidade }) {
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
  const base = qualidade === 'alta' ? MODELOS_COMPLETOS : MODELOS_RAPIDOS;
  const modelos = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...base.filter(m => m !== process.env.GEMINI_MODEL)] : base;
  const diag = [];
  let ultimo = { status: 502, message: 'Falha ao falar com o Gemini.' };
  let espera = 0;
  for (let rodada = 0; rodada < 3; rodada++) {
    if (rodada > 0) await esperar(Math.min(espera || 4000, 12000));
    espera = 0;
    for (const modelo of modelos) {
      const t0 = Date.now();
      const { status, json } = await gerarEmFluxo(modelo, corpo, apiKey);
      diag.push(`${modelo}:${status}:${Date.now() - t0}ms`);
      if (status === 200) return { status: 200, body: converterResposta(json, modelo), diag };
      const msg = (json.error && json.error.message) || `HTTP ${status}`;
      ultimo = { status, message: msg };
      const sugerido = /retry in ([\d.]+)s/i.exec(msg);
      if (sugerido) espera = Math.max(espera, Number(sugerido[1]) * 1000 + 500);
      if (![404, 429, 500, 503, 504].includes(status)) return erroGemini(ultimo, diag);
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
