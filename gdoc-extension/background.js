/* SGC ↔ GDoc — service worker da extensão.
   1) Ponte de emissão: o SGC envia o pacote; o GDoc consome quando o usuário manda preencher.
   2) Acompanhamento: varre os processos das parcelas no GDoc (ao iniciar o Chrome e em
      horários fixos), registra tramitação, NF e NL no sistema e avisa o usuário. */

importScripts('sgc-firestore.js');

/* ───────────── ponte de emissão (já existente) ───────────── */
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === 'GDOC_SET_PAYLOAD') {
    chrome.storage.local.set({ gdocPayload: msg.payload }, () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'GDOC_GET_PAYLOAD') {
    chrome.storage.local.get('gdocPayload', d => sendResponse({ payload: d.gdocPayload || null }));
    return true;
  }
  if (msg?.type === 'GDOC_CLEAR_PAYLOAD') {
    chrome.storage.local.remove('gdocPayload', () => sendResponse({ ok: true }));
    return true;
  }
  if (msg?.type === 'VARREDURA_AGORA') {
    varrer('manual').then(r => sendResponse(r)).catch(e => sendResponse({ erro: e.message }));
    return true;
  }
});

/* ───────────── agenda ───────────── */
const GDOC = 'https://gdoc.belem.pa.gov.br/gdocprocessos';
const SGC_URL = 'https://belem-contratos.vercel.app/';
const HORARIOS_PADRAO = [8, 12, 17];
const ORIGEM = 'BELÉM DIGITAL';

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create('relogio', { periodInMinutes: 30 });
  const { config } = await chrome.storage.local.get('config');
  if (!config?.matricula) chrome.runtime.openOptionsPage();
});
// Ao abrir o Chrome (inclusive quando ele inicia com o Windows): varre assim que houver internet
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('relogio', { periodInMinutes: 30 });
  chrome.alarms.create('inicio', { delayInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener(async alarme => {
  if (alarme.name === 'inicio') {
    if (!(await online())) { chrome.alarms.create('inicio', { delayInMinutes: 2 }); return; }
    return varrer('inicio');
  }
  if (alarme.name === 'relogio') {
    // Cobre os horários perdidos (PC desligado ou dormindo no horário marcado)
    const { config = {}, ultimaVarredura } = await chrome.storage.local.get(['config', 'ultimaVarredura']);
    const horarios = (config.horarios?.length ? config.horarios : HORARIOS_PADRAO).slice().sort((a, b) => a - b);
    const agora = new Date();
    const ultimoHorario = horarios.filter(h => agora.getHours() >= h).pop();
    if (ultimoHorario === undefined) return;
    const marco = new Date(agora); marco.setHours(ultimoHorario, 0, 0, 0);
    if (!ultimaVarredura || new Date(ultimaVarredura.fim || 0) < marco) {
      if (await online()) varrer('agenda');
    }
  }
});

async function online() {
  try { await fetch(GDOC + '/info/', { method: 'HEAD', cache: 'no-store' }); return true; }
  catch { return false; }
}

/* ───────────── aba de trabalho (janela minimizada) ───────────── */
function aguardarCarregar(tabId, timeout = 45000) {
  return new Promise(resolve => {
    const fim = setTimeout(() => { chrome.tabs.onUpdated.removeListener(ouvir); resolve(false); }, timeout);
    function ouvir(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(fim); chrome.tabs.onUpdated.removeListener(ouvir); resolve(true);
      }
    }
    chrome.tabs.onUpdated.addListener(ouvir);
  });
}
async function abrirEm(tabId, url) {
  await chrome.tabs.update(tabId, { url });
  await aguardarCarregar(tabId);
  return (await chrome.tabs.get(tabId)).url || '';
}
async function rodar(tabId, func, args = []) {
  await chrome.scripting.executeScript({ target: { tabId }, files: ['leitor-gdoc.js'], world: 'MAIN' });
  const [r] = await chrome.scripting.executeScript({ target: { tabId }, func, args, world: 'MAIN' });
  return r?.result;
}

/* Garante a sessão no GDoc: se cair na tela de login e houver login automático, entra sozinho. */
async function garantirSessao(tabId) {
  let url = await abrirEm(tabId, GDOC + '/processos/pesquisa');
  if (!/\/login/.test(url)) {
    const naTela = await rodar(tabId, () => !!document.getElementById('tabview:tfProcesso'));
    if (naTela) return true;
  }
  const { config = {} } = await chrome.storage.local.get('config');
  if (!config.autoLogin || !config.matricula || !config.senha) return false;
  url = await abrirEm(tabId, GDOC + '/login/');
  await chrome.scripting.executeScript({
    target: { tabId }, world: 'MAIN', args: [config.matricula, config.senha],
    func: (mat, sen) => {
      const set = (el, v) => { el.focus(); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })); };
      set(document.getElementById('matricula'), mat);
      set(document.getElementById('senha'), sen);
      document.getElementById('logarUsuario').click();
    },
  });
  await aguardarCarregar(tabId, 30000);
  await new Promise(r => setTimeout(r, 1500));
  url = await abrirEm(tabId, GDOC + '/processos/pesquisa');
  if (/\/login/.test(url)) return false;
  return !!(await rodar(tabId, () => !!document.getElementById('tabview:tfProcesso')));
}

/* ───────────── regras de escolha dos anexos ───────────── */
const ehNF = a => /NOTA\s+FISCAL/i.test(a.tipo);
const ehNL = a => /LIQUIDA[ÇC][ÃA]O/i.test(a.tipo) || /^\s*NL\b/i.test(a.nome);
// NF: a mais recente que não seja a "atestada" (a atestada só entra se for a única)
function escolherNF(anexos) {
  const nfs = anexos.filter(a => ehNF(a) && a.id);
  return nfs.filter(a => !/ATESTAD/i.test(a.nome)).pop() || nfs.pop() || null;
}
// NL: a mais recente que não seja minuta "p/ assinatura"
function escolherNL(anexos) {
  const nls = anexos.filter(a => ehNL(a) && a.id);
  return nls.filter(a => !/P\/?\s*ASSINATURA|MINUTA/i.test(a.nome)).pop() || null;
}
function numeroAno(p) {
  const s = String(p.gdoc || '');
  const m = /(\d{1,8})\s*\/\s*(\d{4})/.exec(s);
  if (m) return { numero: +m[1], ano: +m[2] };
  const n = /^\s*(\d{1,8})\s*$/.exec(s);
  if (n) return { numero: +n[1], ano: +String(p.refMonth || p.nfDate || new Date().getFullYear()).slice(0, 4) };
  return null;
}

/* ───────────── varredura ───────────── */
async function varrer(motivo) {
  const { varrendo } = await chrome.storage.local.get('varrendo');
  if (varrendo && Date.now() - varrendo < 20 * 60000) return { erro: 'Já existe uma varredura em andamento.' };
  await chrome.storage.local.set({ varrendo: Date.now() });

  const inicio = new Date().toISOString();
  const resumo = { motivo, inicio, verificados: 0, movimentos: [], avisos: [] };
  let janela = null;
  try {
    const parcelas = (await SGC.listar('contracts'))
      // Só parcelas ainda não pagas (etapa 5 = fluxo concluído)
      .filter(p => p.gdoc && !/^https?:/i.test(p.gdoc) && !p.liquidacao && (p.currentStep || 1) <= 4 && numeroAno(p));
    if (!parcelas.length) { resumo.avisos.push('Nenhuma parcela com GDoc em aberto.'); return resumo; }

    janela = await chrome.windows.create({ url: 'about:blank', state: 'minimized', focused: false });
    const tabId = janela.tabs[0].id;

    if (!(await garantirSessao(tabId))) {
      resumo.erro = 'sessao';
      notificar('Entre no GDoc', 'A sessão do GDoc expirou e o login automático não está configurado ou falhou. Entre no GDoc e clique em "Verificar agora".', 'login');
      return resumo;
    }

    // Processos repetidos (mais de uma parcela no mesmo GDoc) são lidos uma vez só
    const cache = new Map();
    for (const p of parcelas) {
      const { numero, ano } = numeroAno(p);
      const chave = `${numero}/${ano}`;
      let r = cache.get(chave);
      if (!r) {
        r = await rodar(tabId, (n, a, o) => window.__gdocLerProcesso(n, a, o), [numero, ano, ORIGEM]);
        if (r?.erro === 'sessao' && await garantirSessao(tabId))
          r = await rodar(tabId, (n, a, o) => window.__gdocLerProcesso(n, a, o), [numero, ano, ORIGEM]);
        cache.set(chave, r);
        // volta à pesquisa limpa para o próximo processo
        await abrirEm(tabId, GDOC + '/processos/pesquisa');
      }
      resumo.verificados++;
      await registrar(tabId, p, chave, r, resumo);
    }
  } catch (e) {
    resumo.erro = e.message || String(e);
  } finally {
    if (janela) chrome.windows.remove(janela.id).catch(() => {});
    resumo.fim = new Date().toISOString();
    await chrome.storage.local.set({ varrendo: 0, ultimaVarredura: resumo });
    if (resumo.movimentos.length) {
      notificar(`GDoc: ${resumo.movimentos.length} movimentaç${resumo.movimentos.length > 1 ? 'ões' : 'ão'}`,
        resumo.movimentos.slice(0, 4).join('\n'), 'sgc');
    }
  }
  return resumo;
}

/* Compara com o último estado salvo na parcela e grava o que mudou. */
async function registrar(tabId, p, chave, r, resumo) {
  const antes = p.gdocStatus || {};
  const base = { parcelaId: p.__id, contractNumber: p.contractNumber || '', gdoc: chave,
                 criadoEm: new Date().toISOString(), lido: false };
  const novoStatus = { ...antes, verificadoEm: new Date().toISOString() };

  if (!r || r.erro) {
    const msg = r?.erro === 'nao_encontrado' ? `Processo ${chave} não encontrado no GDoc.`
      : `Não foi possível ler o processo ${chave}${r?.detalhe ? ': ' + r.detalhe : '.'}`;
    if (antes.erro !== msg) {
      await SGC.criar('gdoc_movs', { ...base, tipo: 'aviso', descricao: msg, aplicado: true });
      resumo.movimentos.push(msg);
    }
    novoStatus.erro = msg;
    await SGC.atualizar('contracts', p.__id, { gdocStatus: novoStatus });
    return;
  }
  delete novoStatus.erro;
  Object.assign(novoStatus, { setor: r.setor, situacao: r.situacao || '', tipoProcesso: r.tipoProcesso || '',
    ultimoEncaminhamento: r.encaminhamentos[0] || null, totalAnexos: r.anexos.length });

  // Tramitação
  if (r.setor && r.setor !== antes.setor) {
    const e = r.encaminhamentos[0] || {};
    const descricao = antes.setor
      ? `Processo saiu de ${antes.setor} e foi para ${r.setor}${e.data ? ` em ${e.data}${e.hora ? ' ' + e.hora.slice(0, 5) : ''}` : ''}.`
      : `Acompanhamento iniciado: processo está em ${r.setor}${e.data ? ` desde ${e.data}` : ''}.`;
    await SGC.criar('gdoc_movs', { ...base, tipo: 'tramitacao', descricao, setor: r.setor, aplicado: true });
    resumo.movimentos.push(`${chave}: ${descricao}`);
  }

  // Nota fiscal e nota de liquidação: baixa o PDF e deixa para o sistema aplicar na parcela
  for (const [tipo, anexo, campo, prefixo] of [
    ['nf', escolherNF(r.anexos), 'nfAnexoId', 'gdocnf_'],
    ['nl', escolherNL(r.anexos), 'nlAnexoId', 'gdocnl_'],
  ]) {
    if (!anexo || antes[campo] === anexo.id) continue;
    const pdf = await rodar(tabId, id => window.__gdocBaixarAnexo(id), [anexo.id]);
    if (!pdf?.base64) {
      await SGC.criar('gdoc_movs', { ...base, tipo: 'aviso', aplicado: true,
        descricao: `${anexo.nome}: não foi possível baixar o PDF (${pdf?.erro || 'erro'}).` });
      continue;
    }
    if (pdf.base64.length > 1000000) {
      await SGC.criar('gdoc_movs', { ...base, tipo: 'aviso', aplicado: true,
        descricao: `${anexo.nome} anexada no GDoc em ${anexo.data}, mas o PDF passa de 700 KB e não cabe no sistema. Anexe manualmente.` });
      novoStatus[campo] = anexo.id;
      continue;
    }
    const pdfDoc = prefixo + p.__id;
    await SGC.gravar('pdfs', pdfDoc, { data: pdf.base64 });
    const descricao = tipo === 'nf'
      ? `${anexo.nome} anexada no GDoc em ${anexo.data}.`
      : `Nota de liquidação (${anexo.nome}) anexada no GDoc em ${anexo.data}.`;
    await SGC.criar('gdoc_movs', { ...base, tipo, descricao, pdfDoc, aplicado: false,
      dataAnexo: (anexo.data || '').slice(0, 10), anexoNome: anexo.nome });
    resumo.movimentos.push(`${chave}: ${descricao}`);
    novoStatus[campo] = anexo.id;
  }

  await SGC.atualizar('contracts', p.__id, { gdocStatus: novoStatus });
}

/* ───────────── avisos do Windows ───────────── */
function notificar(titulo, mensagem, destino) {
  chrome.notifications.create('gdoc-' + destino + '-' + Date.now(), {
    type: 'basic', iconUrl: 'icone.png', title: titulo, message: mensagem, priority: 2,
  });
}
chrome.notifications.onClicked.addListener(id => {
  chrome.tabs.create({ url: id.startsWith('gdoc-login') ? GDOC + '/login/' : SGC_URL });
  chrome.notifications.clear(id);
});
