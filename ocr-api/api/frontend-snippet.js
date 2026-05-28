/**
 * Snippet pronto para colar no `belem-digital-contratos/index.html`.
 *
 * Adiciona:
 *   1. Helper `extrairNF(file)` — chama a API e devolve a 1ª nota detectada.
 *   2. Componente React `<NFUploader onExtract={...}>` — botão que abre file
 *      picker, faz upload, mostra estado de loading e dispara `onExtract`
 *      com o objeto da NF preenchido.
 *
 * Onde colar:
 *   - O helper e o componente entram no bloco <script type="text/babel">
 *     (mesmo onde estão React, useState, etc.).
 *   - A constante NFO_API_URL pode ir no topo do <script>, junto com BLUE/GREEN.
 *   - Use o componente:
 *       a) No formulário de cadastro: ao lado dos campos NF nº / Data de
 *          Emissão / Cliente. `onExtract` faz `setForm(prev => ({...prev,
 *          nfNumber: nf.numero, nfDate: nf.data_emissao_iso, client: nf.cliente}))`.
 *       b) No card de parcela: ao lado do botão "Informar nº da NF".
 *          `onExtract` chama `commitNfNumber(contract.id, nf.numero)`.
 *
 * Sem dependências externas — usa fetch nativo e React do escopo global.
 */

// ============================================================================
// 1) URL da API
// ----------------------------------------------------------------------------
// Em produção: aponte para o domínio do Railway (ex.: https://nfo-prod.up.railway.app).
// Em dev local: http://localhost:8000.
const NFO_API_URL =
  (typeof window !== 'undefined' && window.NFO_API_URL) ||
  'https://nota-fiscal-ocr.up.railway.app';

// Se a API exigir API key, defina `window.NFO_API_KEY = "..."` antes de carregar.
const NFO_API_KEY =
  (typeof window !== 'undefined' && window.NFO_API_KEY) || null;


// ============================================================================
// 2) Helper — chama POST /v1/extrair e devolve { notas: [...] }
// ----------------------------------------------------------------------------
async function extrairNF(file) {
  const form = new FormData();
  form.append('arquivo', file, file.name);

  const headers = {};
  if (NFO_API_KEY) headers['X-API-Key'] = NFO_API_KEY;

  const resp = await fetch(`${NFO_API_URL}/v1/extrair`, {
    method: 'POST',
    body: form,
    headers,
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`Falha ao extrair (HTTP ${resp.status}): ${txt}`);
  }

  const data = await resp.json();
  // Adapta cada nota: data em DD/MM/YYYY → também devolve isoDate (YYYY-MM-DD),
  // que é o formato usado pelo nfDate do contrato.
  data.notas = (data.notas || []).map((nf) => ({
    ...nf,
    data_emissao_iso: nf.data_emissao ? brToIso(nf.data_emissao) : null,
  }));
  return data;
}

function brToIso(ddmmyyyy) {
  const [dd, mm, yyyy] = ddmmyyyy.split('/');
  if (!dd || !mm || !yyyy) return null;
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
}


// ============================================================================
// 3) Componente <NFUploader> — botão "📎 Extrair de NF"
// ----------------------------------------------------------------------------
function NFUploader({ onExtract, multiple = false, label = '📎 Extrair de NF' }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(null);
  const inputRef = React.useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const { notas } = await extrairNF(file);
      if (!notas.length) {
        setError('Nenhuma NF detectada no arquivo.');
        return;
      }
      // Se multiple=false, devolve apenas a 1ª (já em ordem cronológica).
      // Se multiple=true, devolve a lista inteira.
      onExtract(multiple ? notas : notas[0], notas);
    } catch (err) {
      setError(err.message || 'Erro ao extrair.');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="px-3 py-1.5 text-xs rounded-md border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-wait inline-flex items-center gap-1"
        title="Faz upload do PDF/imagem da NF e preenche os campos automaticamente."
      >
        {loading ? '⏳ Lendo...' : label}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.tif,.tiff,.bmp,.webp"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <span className="text-xs text-rose-600 max-w-xs truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
}


// ============================================================================
// 4) EXEMPLO de uso — adapte aos pontos do seu index.html
// ----------------------------------------------------------------------------
// (4.a) No formulário de cadastro de contrato (perto dos campos NF/data/cliente):
//
//     <NFUploader onExtract={(nf) => setForm(prev => ({
//       ...prev,
//       nfNumber: nf.numero || prev.nfNumber,
//       nfDate:   nf.data_emissao_iso || prev.nfDate,
//       client:   nf.cliente || prev.client,
//     }))} />
//
// (4.b) No card de parcela, ao lado de "Informar nº da NF":
//
//     <NFUploader
//       label="📎 Extrair nº da NF"
//       onExtract={(nf) => { if (nf.numero) commitNfNumber(contract.id, nf.numero); }}
//     />
//
// (4.c) Para processar um PDF com várias notas de uma vez (cadastro em lote):
//
//     <NFUploader multiple onExtract={(_first, todas) => {
//       todas.forEach(nf => criarContratoApartirDeNF(nf));
//     }} />
