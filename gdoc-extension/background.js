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
  // Botão "Atualizar agora" do módulo Gestão do GDoc, no SGC: só a caixa do setor
  if (msg?.type === 'VARREDURA_CAIXA') {
    varrer('caixa').then(r => sendResponse(r)).catch(e => sendResponse({ erro: e.message }));
    return true;
  }
  // Botão "Verificar no GDoc" da parcela, no SGC
  if (msg?.type === 'VARREDURA_PARCELA') {
    varrer('parcela', String(msg.parcelaId || '')).then(r => sendResponse(r)).catch(e => sendResponse({ erro: e.message }));
    return true;
  }
});

/* ───────────── agenda ───────────── */
const GDOC = 'https://gdoc.belem.pa.gov.br/gdocprocessos';
const SGC_URL = 'https://belem-contratos.vercel.app/';
const HORARIOS_PADRAO = [8, 12, 17];
const ORIGEM = 'BELÉM DIGITAL';
const INICIO_ACOMPANHAMENTO = new Date('2026-11-05T00:00:00-03:00').getTime();

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
// Regra 1 – classificação (coluna "Tipo de documento" do GDoc)
const tipoNF = a => /NOTA\s+FISCAL/i.test(a.tipo);
const tipoNL = a => /LIQUIDA[ÇC][ÃA]O/i.test(a.tipo);
// Regra 2 – só se nenhum anexo tiver a classificação: o nome escrito na coluna "Documento"
// (anexo com tipo errado, ex.: "OUTROS" ou "DOCUMENTOS")
const nomeNF = a => /NOTA\s+FISCAL|\bNFS?-?E?\b/i.test(a.nome);
const nomeNL = a => /LIQUIDA[ÇC][ÃA]O|\bNL\b/i.test(a.nome);
// "27/10/2026 15:53" → número comparável (anexos sem data ficam no começo)
const quandoAnexo = a => { const m = /(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(a.data || ''); return m ? +`${m[3]}${m[2]}${m[1]}${m[4] || '00'}${m[5] || '00'}` : 0; };
const MESES = { JAN:1, FEV:2, MAR:3, ABR:4, MAI:5, JUN:6, JUL:7, AGO:8, SET:9, OUT:10, NOV:11, DEZ:12 };
// Competência escrita no nome do anexo: "ABRIL 2026", "DEZ 2025", "ABR/26", "03/2026"
function competenciaDoNome(nome) {
  const s = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const m = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*\.?\s*(?:DE\s*|\/\s*|-\s*)?(\d{4}|\d{2})?\b/.exec(s);
  if (m) return { mes: MESES[m[1]], ano: m[2] ? (m[2].length === 2 ? 2000 + +m[2] : +m[2]) : null };
  const n = /\b(0?[1-9]|1[0-2])\s*\/\s*(20\d{2})\b/.exec(s);
  if (n) return { mes: +n[1], ano: +n[2] };
  return null;
}
function confere(p, comp) {
  const [a, m] = String(p.refMonth || '').split('-').map(Number);
  return !!comp && comp.mes === m && (!comp.ano || comp.ano === a);
}
// NF e NL: entre os anexos classificados como NOTA FISCAL / NOTA DE LIQUIDAÇÃO, o mais
// recente (data e hora do anexo). Se nenhum tiver essa classificação, procura pelo nome do
// documento. NL em minuta "p/ assinatura" não conta.
// Processo compartilhado por várias parcelas: só vale o anexo cuja competência no nome
// bate com a da parcela — sem isso, a NL de um mês marcaria as outras parcelas como pagas.
function escolher(tipo, anexos, p, compartilhado) {
  let base = anexos.filter(a => a.id);
  if (tipo === 'nl') base = base.filter(a => !/P\/?\s*ASSINATURA|MINUTA/i.test(a.nome));
  if (compartilhado) base = base.filter(a => confere(p, competenciaDoNome(a.nome)));
  const [porTipo, porNome] = tipo === 'nf' ? [tipoNF, nomeNF] : [tipoNL, nomeNL];
  let lista = base.filter(porTipo);
  if (!lista.length) lista = base.filter(a => porNome(a) && !(tipo === 'nl' ? tipoNF(a) : tipoNL(a)));
  // O mais recente vence; empate de data/hora fica com o último da lista do GDoc
  lista = lista.map((a, i) => ({ a, i })).sort((x, y) => quandoAnexo(x.a) - quandoAnexo(y.a) || x.i - y.i).map(x => x.a);
  return lista.pop() || null;
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
async function varrer(motivo, soParcela) {
  const { varrendo } = await chrome.storage.local.get('varrendo');
  if (varrendo && Date.now() - varrendo < 20 * 60000) return { erro: 'Já existe uma varredura em andamento.' };
  await chrome.storage.local.set({ varrendo: Date.now() });

  const inicio = new Date().toISOString();
  const resumo = { motivo, inicio, verificados: 0, movimentos: [], avisos: [] };
  let janela = null;
  try {
    const todas = await SGC.listar('contracts');
    // Quantas parcelas ainda não pagas usam cada processo (as já pagas não disputam a NF/NL)
    const porProcesso = new Map();
    for (const p of todas) {
      if (p.liquidacao || (p.currentStep || 1) > 4) continue;
      const na = !/^https?:/i.test(p.gdoc || '') && numeroAno(p);
      if (na) { const k = `${na.numero}/${na.ano}`; porProcesso.set(k, (porProcesso.get(k) || 0) + 1); }
    }
    // Só parcelas cadastradas a partir da implantação do acompanhamento (o id é o
    // instante do cadastro) e ainda não pagas (etapa 5 = fluxo concluído).
    // As parcelas antigas ficam como estão, sem exceção (nem pelo botão da parcela).
    const nova = p => Number(p.__id) >= INICIO_ACOMPANHAMENTO;
    const parcelas = motivo === 'caixa' ? [] : soParcela
      ? todas.filter(p => p.__id === soParcela && nova(p) && p.gdoc && !/^https?:/i.test(p.gdoc) && numeroAno(p))
      : todas.filter(p => p.gdoc && !/^https?:/i.test(p.gdoc) && !p.liquidacao
          && (p.currentStep || 1) <= 4 && numeroAno(p) && nova(p));
    if (!parcelas.length) {
      if (soParcela) resumo.erro = todas.some(p => p.__id === soParcela && !nova(p))
        ? 'O acompanhamento pelo GDoc vale só para parcelas cadastradas a partir de 05/11/2026.'
        : 'Parcela sem número de GDoc válido (ex.: 983/2026).';
      if (soParcela) return resumo;
      if (motivo !== 'caixa') resumo.avisos.push('Nenhuma parcela com GDoc em aberto.');
    }

    janela = await chrome.windows.create({ url: 'about:blank', state: 'minimized', focused: false });
    const tabId = janela.tabs[0].id;

    if (!(await garantirSessao(tabId))) {
      resumo.erro = 'sessao';
      notificar('Entre no GDoc', 'A sessão do GDoc expirou e o login automático não está configurado ou falhou. Entre no GDoc e clique em "Verificar agora".', 'login');
      return resumo;
    }

    // Caixa do setor (Meus Processos > Neste Setor) — módulo Gestão do GDoc no SGC
    if (!soParcela) {
      try { await varrerCaixa(tabId, resumo); }
      catch (e) { resumo.avisos.push('Caixa do setor: ' + (e.message || e)); }
      await abrirEm(tabId, GDOC + '/processos/pesquisa');
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
      await registrar(tabId, p, chave, r, resumo, (porProcesso.get(chave) || 1) > 1);
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

/* ───────────── caixa do setor ─────────────
   Lê todos os processos parados no setor e grava em gdoc_caixa (um documento por processo).
   Os campos do GDoc são atualizados a cada varredura; os do SGC (prioridade, responsável,
   anotações) nunca são tocados aqui. Processo que sai do setor fica com presente = false. */
const chaveCaixa = i => `${i.numero}-${i.ano}-${String(i.orgao || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '').toUpperCase()}`;
async function varrerCaixa(tabId, resumo) {
  await abrirEm(tabId, GDOC + '/processos/meusprocessos');
  let r = await rodar(tabId, () => window.__gdocLerCaixa());
  if (r?.erro === 'sessao' && await garantirSessao(tabId)) {
    await abrirEm(tabId, GDOC + '/processos/meusprocessos');
    r = await rodar(tabId, () => window.__gdocLerCaixa());
  }
  if (!r?.ok) throw new Error(r?.detalhe || r?.erro || 'leitura falhou');

  const agora = new Date().toISOString();
  const antes = new Map((await SGC.listar('gdoc_caixa')).map(d => [d.__id, d]));
  const presentes = new Set();
  const novos = [];
  for (const i of r.itens) {
    if (!i.numero) continue;
    const id = chaveCaixa(i);
    presentes.add(id);
    const velho = antes.get(id);
    const doGdoc = { processo: i.processo, numero: i.numero, ano: i.ano, orgao: i.orgao, setor: r.setor,
      setorOrigem: i.setorOrigem, ultimoEncaminhamento: i.ultimoEncaminhamento, recebimento: i.recebimento,
      tipo: i.tipo, interessado: i.interessado, status: i.status, encaminhadoPara: i.encaminhadoPara,
      diasNoSetor: i.diasNoSetor, prioridadeGdoc: i.prioridadeGdoc, confidencial: i.confidencial,
      juntado: i.juntado, presente: true, vistoEm: agora };
    // Despacho e histórico: lidos quando o processo chega (ou volta) ao setor
    const chegou = !velho || !velho.presente || velho.recebimento !== i.recebimento || !velho.detalheEm;
    if (chegou) {
      await abrirEm(tabId, GDOC + '/processos/pesquisa');
      const det = await rodar(tabId, (n, a, o) => window.__gdocLerProcesso(n, a, o), [i.numero, i.ano, i.orgao]);
      if (det?.ok) {
        const enc = det.encaminhamentos || [];
        Object.assign(doGdoc, {
          situacao: det.situacao || '', detalheEm: agora,
          ultimoDespacho: enc[0] ? { ...enc[0], despacho: String(enc[0].despacho || '').slice(0, 4000) } : null,
          historico: enc.slice(0, 25).map(e => ({ ...e, despacho: String(e.despacho || '').slice(0, 1500) })),
          anexos: (det.anexos || []).slice(-40).map(a => ({ nome: a.nome, tipo: a.tipo, data: a.data })),
        });
      }
    }
    if (velho) {
      if (!velho.presente) Object.assign(doGdoc, { entrouEm: agora, saiuEm: null });
      await SGC.atualizar('gdoc_caixa', id, doGdoc);
      if (!velho.presente) novos.push(i.processo);
    } else {
      await SGC.gravar('gdoc_caixa', id, { ...doGdoc, entrouEm: agora, prioridade: '', atribuidoA: '', anotacoes: [] });
      novos.push(i.processo);
    }
  }
  for (const [id, d] of antes) {
    if (d.presente && !presentes.has(id)) await SGC.atualizar('gdoc_caixa', id, { presente: false, saiuEm: agora });
  }
  await SGC.gravar('gdoc_caixa_meta', 'status', { setor: r.setor, total: r.itens.length, verificadoEm: agora });
  resumo.caixa = { total: r.itens.length, novos: novos.length };
  if (novos.length && antes.size) {
    notificar(`GDoc: ${novos.length} processo${novos.length > 1 ? 's' : ''} novo${novos.length > 1 ? 's' : ''} no setor`, novos.slice(0, 5).join('\n'), 'sgc');
  }
}

/* Compara com o último estado salvo na parcela e grava o que mudou. */
async function registrar(tabId, p, chave, r, resumo, compartilhado) {
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
  // Histórico completo (mais recente primeiro); despachos limitados para caber no documento da parcela
  const historico = r.encaminhamentos.slice(0, 100).map(e => ({ ...e, despacho: (e.despacho || '').slice(0, 4000) }));
  Object.assign(novoStatus, { setor: r.setor, situacao: r.situacao || '', tipoProcesso: r.tipoProcesso || '',
    ultimoEncaminhamento: historico[0] || null, historico, totalAnexos: r.anexos.length,
    anexos: r.anexos.slice(-60).map(a => ({ nome: a.nome, tipo: a.tipo, data: a.data })) });

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
    ['nf', escolher('nf', r.anexos, p, compartilhado), 'nfAnexoId', 'gdocnf_'],
    ['nl', escolher('nl', r.anexos, p, compartilhado), 'nlAnexoId', 'gdocnl_'],
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
