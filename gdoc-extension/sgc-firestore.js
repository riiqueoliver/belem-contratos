/* Acesso ao Firestore do SGC pela API REST (a mesma chave web do index.html).
   Só as operações que a varredura do GDoc precisa: listar, criar, gravar e atualizar campos. */

const SGC = (() => {
  const API_KEY = 'AIzaSyAiGdqFzw3xeW9SBMcT_LwAAS7bY29k-9k';
  const BASE = 'https://firestore.googleapis.com/v1/projects/belem-contratos/databases/(default)/documents';

  function dec(v) {
    if (!v) return null;
    if ('stringValue' in v) return v.stringValue;
    if ('integerValue' in v) return Number(v.integerValue);
    if ('doubleValue' in v) return v.doubleValue;
    if ('booleanValue' in v) return v.booleanValue;
    if ('timestampValue' in v) return v.timestampValue;
    if ('nullValue' in v) return null;
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(dec);
    if ('mapValue' in v) return decMapa(v.mapValue.fields);
    return null;
  }
  const decMapa = f => Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, dec(v)]));
  function enc(v) {
    if (v === null || v === undefined) return { nullValue: null };
    if (typeof v === 'boolean') return { booleanValue: v };
    if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    if (Array.isArray(v)) return { arrayValue: { values: v.map(enc) } };
    if (typeof v === 'object') return { mapValue: { fields: encMapa(v) } };
    return { stringValue: String(v) };
  }
  const encMapa = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined).map(([k, v]) => [k, enc(v)]));

  async function req(url, opcoes = {}) {
    const r = await fetch(url, { ...opcoes, headers: { 'Content-Type': 'application/json' } });
    if (!r.ok) throw new Error(`Firestore ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }

  return {
    // Todos os documentos da coleção (com o id em __id)
    async listar(colecao) {
      const docs = [];
      let token = '';
      do {
        const j = await req(`${BASE}/${colecao}?pageSize=300&key=${API_KEY}${token ? '&pageToken=' + encodeURIComponent(token) : ''}`);
        for (const d of j.documents || []) docs.push({ ...decMapa(d.fields), __id: d.name.split('/').pop() });
        token = j.nextPageToken || '';
      } while (token);
      return docs;
    },
    async criar(colecao, dados) {
      const j = await req(`${BASE}/${colecao}?key=${API_KEY}`, { method: 'POST', body: JSON.stringify({ fields: encMapa(dados) }) });
      return j.name.split('/').pop();
    },
    // Cria ou substitui o documento inteiro
    gravar(colecao, id, dados) {
      return req(`${BASE}/${colecao}/${encodeURIComponent(id)}?key=${API_KEY}`, { method: 'PATCH', body: JSON.stringify({ fields: encMapa(dados) }) });
    },
    // Atualiza só os campos informados
    atualizar(colecao, id, campos) {
      const mascara = Object.keys(campos).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
      return req(`${BASE}/${colecao}/${encodeURIComponent(id)}?${mascara}&currentDocument.exists=true&key=${API_KEY}`,
        { method: 'PATCH', body: JSON.stringify({ fields: encMapa(campos) }) });
    },
  };
})();
