// Acesso às pastas de documentos dos projetos (módulo Relatórios de Execução).
// Usado só em código server-side — nunca importar a partir do index.html.
//
// Dois provedores:
//
//  • Google Drive — usa a MESMA conta de serviço do Firebase
//    (FIREBASE_SERVICE_ACCOUNT). Para o sistema enxergar uma pasta, ela precisa
//    ser compartilhada (como Leitor) com o e-mail "client_email" dessa conta,
//    e a Google Drive API precisa estar ativada no projeto belem-contratos.
//
//  • Zoho WorkDrive — OAuth com refresh token de um "Self Client" criado em
//    https://api-console.zoho.com. Env vars:
//      ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN  (obrigatórias)
//      ZOHO_ACCOUNTS_URL  (opcional, padrão https://accounts.zoho.com)
//      ZOHO_API_URL       (opcional, padrão https://www.zohoapis.com/workdrive/api/v1)
//      ZOHO_DOWNLOAD_URL  (opcional, padrão https://download.zoho.com/v1/workdrive/download)
//    Escopos do refresh token: WorkDrive.files.READ,WorkDrive.team.READ,ZohoFiles.files.READ
//
//    Links PÚBLICOS do WorkDrive (workdrive.zohoexternal.com/external/...) dispensam
//    tudo isso: o servidor abre o link como um visitante faria e usa a mesma API
//    pública que a página do Zoho usa. Essa API não é documentada pelo Zoho e
//    pode mudar sem aviso — se a sincronização desses links quebrar, é aqui.
const { GoogleAuth } = require('google-auth-library');

const MAX_ARQUIVOS = 2000;
const MAX_PROFUNDIDADE = 6;

/* ─── Identificação do provedor e da pasta a partir do link ─────────────── */
function detectarProvedor(link) {
  const s = String(link || '');
  if (/workdrive\.zoho|zoho\.(com|eu|in|com\.au)/i.test(s)) return 'zoho';
  return 'google';
}

function extrairIdPasta(provedor, link) {
  const s = String(link || '').trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) return s; // colou o ID direto
  if (provedor === 'google') {
    const m = s.match(/\/folders\/([A-Za-z0-9_-]+)/) || s.match(/[?&]id=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }
  // Zoho: .../folder/<id>  ou  .../folders/<id>  (o ID é o último segmento)
  const m = s.match(/\/folders?\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  const partes = s.split(/[?#]/)[0].split('/').filter(Boolean);
  return partes.length ? partes[partes.length - 1] : null;
}

/* ─── Google Drive ──────────────────────────────────────────────────────── */
const GOOGLE_API = 'https://www.googleapis.com/drive/v3';
// Tipos nativos do Google que o Drive exporta para PDF
const GOOGLE_EXPORTAVEIS = new Set([
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.google-apps.presentation',
  'application/vnd.google-apps.drawing',
]);
const GOOGLE_PASTA = 'application/vnd.google-apps.folder';

let googleAuth = null;
async function googleToken() {
  if (!googleAuth) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT não configurada nas variáveis de ambiente.');
    googleAuth = new GoogleAuth({
      credentials: JSON.parse(raw),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  }
  const client = await googleAuth.getClient();
  const { token } = await client.getAccessToken();
  return token;
}

function emailContaServico() {
  try { return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}').client_email || null; }
  catch { return null; }
}

async function googleGet(url, token) {
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    if (resp.status === 404) {
      throw new Error(`Pasta não encontrada ou não compartilhada com ${emailContaServico() || 'a conta de serviço'}.`);
    }
    if (resp.status === 403 && /accessNotConfigured|has not been used|is disabled/i.test(txt)) {
      throw new Error('A Google Drive API não está ativada no projeto belem-contratos (Google Cloud Console > APIs e serviços).');
    }
    throw new Error(`Google Drive respondeu ${resp.status}: ${txt.slice(0, 300)}`);
  }
  return resp.json();
}

async function listarGoogle(pastaId) {
  const token = await googleToken();
  // Confirma que a pasta existe e está acessível
  const raiz = await googleGet(`${GOOGLE_API}/files/${pastaId}?fields=id,name,mimeType&supportsAllDrives=true`, token);
  if (raiz.mimeType !== GOOGLE_PASTA) throw new Error('O link informado não é de uma pasta do Google Drive.');

  const arquivos = [];
  const pastas = [];
  async function percorrer(id, caminho, nivel) {
    let pageToken = '';
    do {
      const q = encodeURIComponent(`'${id}' in parents and trashed = false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,size,createdTime,modifiedTime,webViewLink,fileExtension)');
      const url = `${GOOGLE_API}/files?q=${q}&fields=${fields}&pageSize=1000&supportsAllDrives=true&includeItemsFromAllDrives=true&orderBy=name`
        + (pageToken ? `&pageToken=${pageToken}` : '');
      const data = await googleGet(url, token);
      for (const f of data.files || []) {
        if (f.mimeType === GOOGLE_PASTA) {
          const sub = caminho ? `${caminho}/${f.name}` : f.name;
          pastas.push(sub);
          if (nivel < MAX_PROFUNDIDADE) await percorrer(f.id, sub, nivel + 1);
        } else if (arquivos.length < MAX_ARQUIVOS) {
          arquivos.push({
            id: f.id,
            nome: f.name,
            mime: f.mimeType,
            ext: (f.fileExtension || (f.name.includes('.') ? f.name.split('.').pop() : '')).toLowerCase(),
            tamanho: f.size ? Number(f.size) : null,
            criadoEm: f.createdTime || null,
            modificadoEm: f.modifiedTime || null,
            pasta: caminho,
            url: f.webViewLink || null,
            nativo: GOOGLE_EXPORTAVEIS.has(f.mimeType),
          });
        }
      }
      pageToken = data.nextPageToken || '';
    } while (pageToken);
  }
  await percorrer(pastaId, '', 1);
  return { nomePasta: raiz.name, arquivos, pastas };
}

async function baixarGoogle(arquivo, range) {
  const token = await googleToken();
  const url = arquivo.nativo
    ? `${GOOGLE_API}/files/${arquivo.id}/export?mimeType=application/pdf`
    : `${GOOGLE_API}/files/${arquivo.id}?alt=media&supportsAllDrives=true`;
  const headers = { Authorization: `Bearer ${token}` };
  if (range && !arquivo.nativo) headers.Range = `bytes=${range}`;
  return fetch(url, { headers });
}

/* ─── Zoho WorkDrive ────────────────────────────────────────────────────── */
let zohoCache = { token: null, expira: 0 };
async function zohoToken() {
  if (zohoCache.token && Date.now() < zohoCache.expira) return zohoCache.token;
  const { ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN } = process.env;
  if (!ZOHO_CLIENT_ID || !ZOHO_CLIENT_SECRET || !ZOHO_REFRESH_TOKEN) {
    throw new Error('Integração com o Zoho WorkDrive não configurada (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN).');
  }
  const base = process.env.ZOHO_ACCOUNTS_URL || 'https://accounts.zoho.com';
  const params = new URLSearchParams({
    refresh_token: ZOHO_REFRESH_TOKEN,
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    grant_type: 'refresh_token',
  });
  const resp = await fetch(`${base}/oauth/v2/token?${params}`, { method: 'POST' });
  const data = await resp.json().catch(() => ({}));
  if (!data.access_token) throw new Error(`Falha ao autenticar no Zoho: ${data.error || resp.status}`);
  zohoCache = { token: data.access_token, expira: Date.now() + ((data.expires_in || 3600) - 120) * 1000 };
  return zohoCache.token;
}

async function zohoGet(caminho, token) {
  const base = process.env.ZOHO_API_URL || 'https://www.zohoapis.com/workdrive/api/v1';
  const resp = await fetch(`${base}${caminho}`, {
    headers: { Authorization: `Zoho-oauthtoken ${token}`, Accept: 'application/vnd.api+json' },
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    if (resp.status === 404) throw new Error('Pasta não encontrada no Zoho WorkDrive (verifique o link e se a conta integrada tem acesso).');
    throw new Error(`Zoho WorkDrive respondeu ${resp.status}: ${txt.slice(0, 300)}`);
  }
  return resp.json();
}

/* Link público: abre a página como visitante para obter os cookies e o
   "x-cli-msg" que a API pública e o download exigem. Cache de 10 min. */
const ZOHO_EXTERNO_RE = /^https?:\/\/workdrive\.zohoexternal\.([a-z.]+)\/external\/([A-Za-z0-9]+)/i;
const sessoesPublicas = new Map();
const NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
async function abrirLinkPublicoZoho(link) {
  const m = String(link).match(ZOHO_EXTERNO_RE);
  const chave = m[2];
  const emCache = sessoesPublicas.get(chave);
  if (emCache && Date.now() - emCache.em < 10 * 60 * 1000) return emCache;

  const resp = await fetch(`https://workdrive.zohoexternal.${m[1]}/external/${m[2]}`, { headers: { 'User-Agent': NAVEGADOR } });
  if (!resp.ok) throw new Error(`O Zoho recusou o link público (${resp.status}). Verifique se ele não expirou.`);
  const html = await resp.text();
  const cm = html.match(/"URL_ENC_CLI_MSG":"([^"]+)"/);
  if (!cm) throw new Error('Não foi possível abrir o link público do Zoho — ele pode ter expirado ou estar protegido por senha.');
  const cli = JSON.parse(decodeURIComponent(cm[1]));
  const raizId = Object.keys(cli).find(k => !k.endsWith('_user_uuid'));
  const sessao = {
    em: Date.now(),
    raizId,
    cliMsg: cm[1],
    cookie: (resp.headers.getSetCookie?.() || []).map(c => c.split(';')[0]).join('; '),
    api: `https://workdrive.zohoexternal.${m[1]}/public/api/v1`,
    paginaLink: `https://workdrive.zohoexternal.${m[1]}/external/${m[2]}`,
    // dois servidores de download do Zoho; se um recusar, tenta o outro
    downloads: [`https://download.zoho.${m[1]}/public/workdrive-external/download`,
                `https://download-accl.zoho.${m[1]}/public/workdrive-external/download`],
  };
  sessoesPublicas.set(chave, sessao);
  return sessao;
}

function zohoPublicoGet(sessao) {
  return async caminho => {
    const resp = await fetch(`${sessao.api}${caminho}`, {
      headers: { Cookie: sessao.cookie, Accept: 'application/vnd.api+json', 'User-Agent': NAVEGADOR, Referer: sessao.paginaLink },
    });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Zoho WorkDrive (link público) respondeu ${resp.status}: ${txt.slice(0, 200)}`);
    }
    return resp.json();
  };
}

async function listarZoho(link) {
  let get, pastaId;
  if (ZOHO_EXTERNO_RE.test(link)) {
    const sessao = await abrirLinkPublicoZoho(link);
    get = zohoPublicoGet(sessao);
    pastaId = sessao.raizId;
  } else {
    pastaId = extrairIdPasta('zoho', link);
    if (!pastaId) throw new Error('Não foi possível identificar a pasta no link informado.');
    const token = await zohoToken();
    get = caminho => zohoGet(caminho, token);
  }
  const raiz = await get(`/files/${pastaId}`);
  const nomePasta = raiz?.data?.attributes?.name || 'Pasta';

  const arquivos = [];
  const pastas = [];
  async function percorrer(id, caminho, nivel) {
    const LIMITE = 50;
    for (let offset = 0; ; offset += LIMITE) {
      const data = await get(`/files/${id}/files?sort=name&page%5Blimit%5D=${LIMITE}&page%5Boffset%5D=${offset}`);
      const itens = data.data || [];
      for (const it of itens) {
        const a = it.attributes || {};
        if (a.is_folder || a.type === 'folder') {
          const sub = caminho ? `${caminho}/${a.name}` : a.name;
          pastas.push(sub);
          if (nivel < MAX_PROFUNDIDADE) await percorrer(it.id, sub, nivel + 1);
        } else if (arquivos.length < MAX_ARQUIVOS) {
          // Documentos nativos do Zoho (Writer, Sheet, Show) são baixados no formato Office
          const nativoExt = { writer: 'docx', zohosheet: 'xlsx', zohoshow: 'pptx' }[a.type];
          const ext = (a.extn || nativoExt || (a.name.includes('.') ? a.name.split('.').pop() : '')).toLowerCase();
          arquivos.push({
            id: it.id,
            nome: a.name,
            mime: a.type || '',
            ext,
            tamanho: a.storage_info?.size_in_bytes ?? null,
            criadoEm: a.created_time_in_millisecond ? new Date(Number(a.created_time_in_millisecond)).toISOString() : null,
            modificadoEm: a.modified_time_in_millisecond ? new Date(Number(a.modified_time_in_millisecond)).toISOString() : null,
            pasta: caminho,
            url: a.permalink || null,
            nativo: !!nativoExt,
          });
        }
      }
      if (itens.length < LIMITE) break;
    }
  }
  await percorrer(pastaId, '', 1);
  return { nomePasta, arquivos, pastas };
}

async function baixarZoho(arquivo, range, link) {
  if (ZOHO_EXTERNO_RE.test(link)) {
    let sessao = await abrirLinkPublicoZoho(link);
    const headers = { Cookie: sessao.cookie, 'User-Agent': NAVEGADOR, Referer: sessao.paginaLink };
    if (range) headers.Range = `bytes=${range}`;
    let resp;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      for (const base of sessao.downloads) {
        resp = await fetch(`${base}/${arquivo.id}?x-cli-msg=${sessao.cliMsg}`, { headers });
        if (resp.ok) return resp;
        console.warn('[Zoho público] download', base, resp.status);
      }
      // sessão pode ter vencido: abre o link de novo e tenta mais uma vez
      sessoesPublicas.delete(String(link).match(ZOHO_EXTERNO_RE)[2]);
      sessao = await abrirLinkPublicoZoho(link);
      headers.Cookie = sessao.cookie;
    }
    return resp;
  }
  const token = await zohoToken();
  const base = process.env.ZOHO_DOWNLOAD_URL || 'https://download.zoho.com/v1/workdrive/download';
  const headers = { Authorization: `Zoho-oauthtoken ${token}` };
  if (range) headers.Range = `bytes=${range}`;
  return fetch(`${base}/${arquivo.id}`, { headers });
}

/* ─── Interface comum ───────────────────────────────────────────────────── */
async function listarPasta(provedor, link) {
  if (provedor === 'zoho') return listarZoho(link);
  const pastaId = extrairIdPasta(provedor, link);
  if (!pastaId) throw new Error('Não foi possível identificar a pasta no link informado.');
  return listarGoogle(pastaId);
}

function baixarArquivo(provedor, arquivo, range, link) {
  return provedor === 'zoho' ? baixarZoho(arquivo, range, link) : baixarGoogle(arquivo, range);
}

/* O Zoho recusa (403) downloads de links públicos feitos a partir dos servidores
   da Vercel, mas libera o domínio do sistema por CORS. Então o servidor só abre o
   link e devolve o necessário para o NAVEGADOR baixar direto do Zoho. */
async function acessoPublicoZoho(link) {
  if (!ZOHO_EXTERNO_RE.test(String(link || ''))) return null;
  const sessao = await abrirLinkPublicoZoho(link);
  return { downloads: sessao.downloads, cliMsg: sessao.cliMsg };
}

module.exports = { detectarProvedor, extrairIdPasta, listarPasta, baixarArquivo, acessoPublicoZoho, emailContaServico };
