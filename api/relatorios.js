// /api/relatorios — módulo Relatórios de Execução (Belém Digital)
//
//   GET  ?acao=info                                   → e-mail da conta de serviço (para compartilhar pastas do Drive)
//   POST ?acao=sincronizar   { projetoId, usuario }   → lista a pasta do projeto e grava a listagem no Firestore
//   GET  ?acao=baixar&projetoId=&arquivoId=&inicio=  → devolve um pedaço (até CHUNK bytes) do arquivo
//
// O download é feito em pedaços porque a Vercel limita a resposta de uma função
// a ~4,5 MB. O navegador repete a chamada avançando `inicio` até completar o
// total informado no cabeçalho X-Total-Size.
//
// Só são servidos arquivos que constam da última sincronização de um projeto
// cadastrado — a função não aceita IDs arbitrários do Drive/WorkDrive.
const { getDb } = require('../lib/firebaseAdmin');
const { listarPasta, baixarArquivo, emailContaServico } = require('../lib/repositorios');

const COLECAO = 'relatorio_projetos';
const CHUNK = 3.8 * 1024 * 1024;

// Exportações do Google (Docs/Planilhas → PDF) não aceitam Range: o arquivo
// inteiro é gerado a cada chamada. Mantém em memória enquanto a instância
// estiver quente para não exportar de novo a cada pedaço.
const cacheExportacoes = new Map();

async function carregarProjeto(projetoId) {
  if (!projetoId) throw Object.assign(new Error('projetoId é obrigatório.'), { status: 400 });
  const snap = await getDb().collection(COLECAO).doc(String(projetoId)).get();
  if (!snap.exists) throw Object.assign(new Error('Projeto não encontrado.'), { status: 404 });
  return { ref: snap.ref, dados: snap.data() };
}

async function sincronizar(req, res) {
  const { projetoId, usuario } = req.body || {};
  const { ref, dados } = await carregarProjeto(projetoId);
  if (!dados.link) throw Object.assign(new Error('O projeto não tem link de pasta cadastrado.'), { status: 400 });

  const provedor = dados.provedor === 'zoho' ? 'zoho' : 'google';
  const { nomePasta, arquivos, pastas } = await listarPasta(provedor, dados.link);
  const ultimaSync = new Date().toISOString();
  await ref.set({ arquivos, pastas, nomePasta, ultimaSync, ultimaSyncPor: usuario || null }, { merge: true });
  res.status(200).json({ nomePasta, arquivos, pastas, ultimaSync });
}

async function baixar(req, res) {
  const { projetoId, arquivoId } = req.query;
  const inicio = Math.max(0, parseInt(req.query.inicio, 10) || 0);
  const { dados } = await carregarProjeto(projetoId);
  const arquivo = (dados.arquivos || []).find(a => a.id === arquivoId);
  if (!arquivo) throw Object.assign(new Error('Arquivo não pertence a este projeto. Sincronize novamente.'), { status: 404 });

  const provedor = dados.provedor === 'zoho' ? 'zoho' : 'google';
  const fim = inicio + CHUNK - 1;

  let corpo, total;
  const chave = `${provedor}:${arquivo.id}`;
  const emCache = cacheExportacoes.get(chave);
  if (emCache && Date.now() - emCache.em < 5 * 60 * 1000) {
    corpo = emCache.buf.subarray(inicio, fim + 1);
    total = emCache.buf.length;
  } else {
    const resp = await baixarArquivo(provedor, arquivo, `${inicio}-${fim}`);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      if (resp.status === 416) { corpo = Buffer.alloc(0); total = inicio; }
      else throw Object.assign(new Error(`Falha ao baixar "${arquivo.nome}" (${resp.status}): ${txt.slice(0, 200)}`), { status: 502 });
    } else if (resp.status === 206) {
      corpo = Buffer.from(await resp.arrayBuffer());
      const m = (resp.headers.get('content-range') || '').match(/\/(\d+)$/);
      total = m ? Number(m[1]) : inicio + corpo.length;
    } else {
      // O provedor ignorou o Range e mandou o arquivo inteiro
      const buf = Buffer.from(await resp.arrayBuffer());
      if (buf.length > CHUNK) {
        cacheExportacoes.set(chave, { buf, em: Date.now() });
        for (const [k, v] of cacheExportacoes) if (Date.now() - v.em > 5 * 60 * 1000) cacheExportacoes.delete(k);
      }
      corpo = buf.subarray(inicio, fim + 1);
      total = buf.length;
    }
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Total-Size', String(total));
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(corpo);
}

module.exports = async (req, res) => {
  try {
    const acao = req.query.acao;
    if (acao === 'info' && req.method === 'GET') {
      res.status(200).json({ emailContaServico: emailContaServico() });
    } else if (acao === 'sincronizar' && req.method === 'POST') {
      await sincronizar(req, res);
    } else if (acao === 'baixar' && req.method === 'GET') {
      await baixar(req, res);
    } else {
      res.status(400).json({ error: 'Ação inválida.' });
    }
  } catch (err) {
    console.error('Erro em /api/relatorios:', err);
    res.status(err.status || 500).json({ error: err.message || 'Erro interno.' });
  }
};
