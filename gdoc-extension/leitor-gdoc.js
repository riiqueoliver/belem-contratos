/* Leitor de processos do GDoc — injetado pela extensão numa aba da tela
   "Processo > Pesquisa" (/gdocprocessos/processos/pesquisa), já logada.
   Pesquisa o processo, abre o Detalhe e devolve setor atual, encaminhamentos
   e anexos. Só lê: não salva, não tramita, não anexa nada. */

window.__gdocLerProcesso = async function (numero, ano, origem) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  async function esperar(fn, timeout = 20000) {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) { const r = fn(); if (r) return r; await sleep(250); }
    return null;
  }
  async function esperarAjax(doc = document, win = window) {
    await sleep(300);
    await esperar(() => !(win.jQuery && win.jQuery.active > 0) &&
      !doc.querySelector('.ui-blockui:not(.ui-helper-hidden)'), 20000);
    await sleep(300);
  }

  if (/\/login/.test(location.pathname) || document.querySelector('input[type=password]'))
    return { erro: 'sessao' };

  // 1) Pesquisa simples: número e ano (origem filtra quando houver mais de um resultado)
  const fNum = await esperar(() => document.getElementById('tabview:tfProcesso'));
  if (!fNum) return { erro: 'tela', detalhe: 'Campo de pesquisa não encontrado.' };
  const preencher = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  preencher(fNum, String(numero));
  preencher(document.getElementById('tabview:tfAno'), String(ano));
  const listaAntes = document.getElementById('dataList');
  const marcador = listaAntes ? txt(listaAntes) : '';
  document.getElementById('tabview:pesProcesso').click();
  await esperarAjax();
  await esperar(() => { const l = document.getElementById('dataList'); return l && txt(l) !== marcador ? l : null; }, 8000);

  const alvo = norm(`${numero}/${ano} - ${origem || ''}`);
  const linhas = [...document.querySelectorAll('#dataList tbody tr, [id^="dataList"] tbody tr')];
  const linha = linhas.find(tr => norm(txt(tr)).startsWith(alvo)) ||
                linhas.find(tr => norm(txt(tr)).startsWith(norm(`${numero}/${ano} `)));
  if (!linha) return { erro: 'nao_encontrado' };
  const detalhar = [...linha.querySelectorAll('a')].find(a => /Detalhar/i.test(a.textContent) || /detalhes/i.test(a.title || ''));
  if (!detalhar) return { erro: 'tela', detalhe: 'Botão Detalhar não encontrado.' };
  const resumo = { tipo: txt(linha.cells[1]), instrucao: txt(linha.cells[5]) };

  return window.__gdocLerDetalhe(detalhar, resumo.tipo);
};

/* Abre o Detalhe de um processo (link "Detalhar" de uma linha de lista do GDoc) e lê
   situação, encaminhamentos com despacho e anexos. Usado pela pesquisa e pela caixa do setor. */
window.__gdocLerDetalhe = async function (detalhar, tipoFallback) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  async function esperar(fn, timeout = 20000) {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) { const r = fn(); if (r) return r; await sleep(250); }
    return null;
  }
  async function esperarAjax(doc = document, win = window) {
    await sleep(300);
    await esperar(() => !(win.jQuery && win.jQuery.active > 0) &&
      !doc.querySelector('.ui-blockui:not(.ui-helper-hidden)'), 20000);
    await sleep(300);
  }

  const resumo = { tipo: tipoFallback || '' };
  // 2) Detalhe abre num diálogo com iframe (mesma origem)
  detalhar.click();
  const frame = await esperar(() => {
    const f = [...document.querySelectorAll('iframe')].find(f => /detalheProcesso/.test(f.src));
    try { return f && f.contentDocument && f.contentDocument.getElementById('acordiao:tbAnexos') !== undefined && f.contentDocument.querySelector('.ui-accordion-header') ? f : null; } catch { return null; }
  });
  if (!frame) return { erro: 'tela', detalhe: 'Detalhe do processo não abriu.' };
  const d = frame.contentDocument, w = frame.contentWindow;
  await esperarAjax(d, w);

  const dados = {};
  const celulas = [...d.querySelectorAll('td, span, label, div')];
  const valorDe = rotulo => {
    const r = celulas.find(el => norm(txt(el)).replace(/:$/, '') === norm(rotulo) && el.children.length <= 1);
    if (!r) return '';
    const prox = r.nextElementSibling || r.parentElement?.nextElementSibling;
    return txt(prox);
  };
  dados.situacao = valorDe('Situação');
  dados.tipoProcesso = valorDe('Tipo de Processo') || resumo.tipo;
  // Dados do processo: assunto (Instrução Inicial), quem criou e onde
  const corpoTxt = txt(d.body);
  const campo = (rot, prox) => ((new RegExp(rot + ':\\s*(.*?)\\s*(?:' + prox + '|$)', 'i').exec(corpoTxt) || [])[1] || '').trim();
  dados.instrucao = campo('Instrução Inicial', 'Criado por:|Setor de Criação:|Data de Criação:') || valorDe('Instrução Inicial');
  dados.criadoPor = campo('Criado por', 'Setor de Criação:|Data de Criação:');
  dados.setorCriacao = campo('Setor de Criação', 'Data de Criação:|Nº do documento');
  dados.criadoEm = campo('Data de Criação', 'Nº do documento|Setor Origem|Endereço|Encaminhamentos');

  // 3) Encaminhamentos (o mais recente vem primeiro)
  const cabecalhos = [...d.querySelectorAll('.ui-accordion-header')];
  const abrir = async padrao => {
    const h = cabecalhos.find(h => padrao.test(txt(h)));
    if (h && h.getAttribute('aria-expanded') !== 'true') { h.click(); await esperarAjax(d, w); }
    return h;
  };
  // Cada encaminhamento é um cartão da grade: Setor, "n/total", Encaminhado por, data, hora e Despacho
  const hEnc = await abrir(/^Encaminhamentos/i);
  const encaminhamentos = [];
  const lerCartao = c => {
    const spans = [...c.querySelectorAll('span')];
    const exato = re => (spans.find(s => re.test(s.textContent.trim())) || {}).textContent?.trim() || '';
    const rotSetor = spans.find(s => s.textContent.trim() === 'Setor');
    const tdPor = [...c.querySelectorAll('td')].find(t => t.textContent.trim() === 'Encaminhado por');
    const fs = [...c.querySelectorAll('fieldset')].find(x => /Despacho/i.test(txt(x.querySelector('legend'))));
    return {
      ordem: exato(/^\d+\/\d+$/),
      setor: rotSetor ? txt(rotSetor.closest('td')?.nextElementSibling?.querySelector('span')) : '',
      por: tdPor ? txt(tdPor.nextElementSibling) : '',
      data: exato(/^\d{2}\/\d{2}\/\d{4}$/),
      hora: exato(/^\d{2}:\d{2}(:\d{2})?$/),
      despacho: (fs?.querySelector('.ui-fieldset-content')?.innerText || '').trim(),
    };
  };
  if (hEnc) {
    const painel = hEnc.nextElementSibling;
    const grade = () => painel.querySelector('.ui-datagrid-content > .ui-g');
    const inicioEnc = painel.querySelector('.ui-paginator-first:not(.ui-state-disabled)');
    if (inicioEnc) { inicioEnc.click(); await esperarAjax(d, w); }
    const vistos = new Set();
    for (let p = 0; p < 30 && grade(); p++) {
      for (const c of grade().children) {
        const e = lerCartao(c);
        if (!e.setor && !e.ordem) continue;   // cartão vazio no fim da grade
        const chave = e.ordem || `${e.setor}|${e.data}|${e.hora}`;
        if (!vistos.has(chave)) { vistos.add(chave); encaminhamentos.push(e); }
      }
      const nx = painel.querySelector('.ui-paginator-next');
      if (!nx || nx.classList.contains('ui-state-disabled')) break;
      const antes = txt(grade());
      nx.click();
      await esperarAjax(d, w);
      await esperar(() => grade() && txt(grade()) !== antes, 6000);
    }
  }

  // 4) Anexos: percorre todas as páginas da tabela
  await abrir(/^Anexos/i);
  const anexos = [];
  const tabela = () => d.getElementById('acordiao:tbAnexos');
  const primeira = tabela()?.querySelector('.ui-paginator-first:not(.ui-state-disabled)');
  if (primeira) { primeira.click(); await esperarAjax(d, w); }
  for (let p = 0; p < 30 && tabela(); p++) {
    for (const tr of tabela().querySelectorAll('tbody tr')) {
      const c = [...tr.cells].map(x => txt(x));
      const link = tr.querySelector('a[target=_blank][href*="anexo/visualizar"]');
      const id = link ? (link.getAttribute('href').match(/visualizar\/(\d+)/) || [])[1] : null;
      if (c[0]) anexos.push({ nome: c[0], tipo: c[1], data: c[3], id });
    }
    const nx = tabela().querySelector('.ui-paginator-next');
    if (!nx || nx.classList.contains('ui-state-disabled')) break;
    const antes = txt(tabela().querySelector('tbody'));
    nx.click();
    await esperarAjax(d, w);
    await esperar(() => txt(tabela()?.querySelector('tbody')) !== antes, 6000);
  }

  // Fecha o diálogo para a próxima pesquisa
  document.querySelector('.ui-dialog .ui-dialog-titlebar-close')?.click();

  const atual = encaminhamentos[0] || {};
  return { ok: true, situacao: dados.situacao, tipoProcesso: dados.tipoProcesso, instrucao: dados.instrucao,
           criadoPor: dados.criadoPor, setorCriacao: dados.setorCriacao, criadoEm: dados.criadoEm,
           setor: atual.setor || '', encaminhamentos, anexos };
};

/* Caixa do setor: abre o Detalhe a partir da própria linha em Meus Processos > Neste Setor.
   Assim o processo é sempre o que está na caixa, inclusive os de outros órgãos (SEGOV, SEMIAC…),
   que a pesquisa geral do GDoc não encontra. */
window.__gdocLerDetalheCaixa = async function (processo) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  async function esperar(fn, timeout = 20000) {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) { const r = fn(); if (r) return r; await sleep(250); }
    return null;
  }
  async function esperarAjax(doc = document, win = window) {
    await sleep(300);
    await esperar(() => !(win.jQuery && win.jQuery.active > 0) &&
      !doc.querySelector('.ui-blockui:not(.ui-helper-hidden)'), 20000);
    await sleep(300);
  }

  if (/\/login/.test(location.pathname) || document.querySelector('input[type=password]')) return { erro: 'sessao' };
  document.querySelector('.ui-dialog .ui-dialog-titlebar-close')?.click();
  const corpoLista = () => document.getElementById('dataList_data');
  if (!(await esperar(corpoLista))) return { erro: 'tela', detalhe: 'Lista de processos não encontrada.' };
  const limpa = s => norm(s).replace(/\s+DIGITAL\b/g, '').replace(/\s+/g, ' ').trim();
  const alvo = limpa(processo);
  const primeira = document.querySelector('#dataList_paginator_top .ui-paginator-first:not(.ui-state-disabled)');
  if (primeira) { primeira.click(); await esperarAjax(); }
  for (let p = 0; p < 40 && corpoLista(); p++) {
    const linha = [...corpoLista().rows].find(tr => tr.cells[0] && limpa(txt(tr.cells[0])) === alvo);
    if (linha) {
      const detalhar = [...linha.querySelectorAll('a')].find(a => /Detalhar/i.test(a.textContent));
      if (!detalhar) return { erro: 'tela', detalhe: 'Botão Detalhar não encontrado.' };
      return window.__gdocLerDetalhe(detalhar, txt(linha.cells[4]));
    }
    const nx = document.querySelector('#dataList_paginator_top .ui-paginator-next');
    if (!nx || nx.classList.contains('ui-state-disabled')) break;
    const antes = txt(corpoLista());
    nx.click();
    await esperarAjax();
    await esperar(() => txt(corpoLista()) !== antes, 8000);
  }
  return { erro: 'nao_encontrado' };
};

/* Baixa o PDF de um anexo: a página "visualizar" traz um <object> com o arquivo. */
window.__gdocBaixarAnexo = async function (id) {
  const r = await fetch(`/gdocprocessos/processo/anexo/visualizar/${id}/false`, { credentials: 'include' });
  const html = await r.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const el = doc.querySelector('object[data], iframe[src], embed[src]');
  if (!el) return { erro: 'Visualizador do anexo sem arquivo.' };
  const url = new URL(el.getAttribute('data') || el.getAttribute('src'), location.href);
  const r2 = await fetch(url, { credentials: 'include' });
  const buf = new Uint8Array(await r2.arrayBuffer());
  if (String.fromCharCode(...buf.slice(0, 4)) !== '%PDF') return { erro: 'O anexo não é um PDF.' };
  let bin = '';
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { base64: btoa(bin), bytes: buf.length };
};

/* Caixa do setor: "Processo > Meus Processos > Neste Setor" (/gdocprocessos/processos/meusprocessos).
   Lê todos os processos parados no setor (de todas as páginas) e devolve uma linha por processo.
   Só lê: não recebe, não encaminha, não altera nada. */
window.__gdocLerCaixa = async function () {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt = el => (el?.innerText || el?.textContent || '').replace(/\s+/g, ' ').trim();
  async function esperar(fn, timeout = 20000) {
    const fim = Date.now() + timeout;
    while (Date.now() < fim) { const r = fn(); if (r) return r; await sleep(250); }
    return null;
  }
  async function esperarAjax() {
    await sleep(300);
    await esperar(() => !(window.jQuery && window.jQuery.active > 0) &&
      !document.querySelector('.ui-blockui:not(.ui-helper-hidden)'), 20000);
    await sleep(300);
  }
  if (/\/login/.test(location.pathname) || document.querySelector('input[type=password]')) return { erro: 'sessao' };
  const corpo = () => document.getElementById('dataList_data');
  if (!(await esperar(corpo))) return { erro: 'tela', detalhe: 'Lista de processos não encontrada.' };

  // Aba "Neste Setor" (é a padrão; garante caso o GDoc abra em outra)
  const aba = [...document.querySelectorAll('.ui-tabmenuitem')].find(li => /Neste Setor/i.test(txt(li)));
  if (aba && !aba.classList.contains('ui-state-active')) { aba.querySelector('a')?.click(); await esperarAjax(); }
  const setor = (document.body.innerText.match(/Neste Setor \(([^)]+)\)/) || [])[1] || '';

  // 30 por página e volta para a primeira
  const rpp = document.querySelector('#dataList_paginator_top select.ui-paginator-rpp-options');
  if (rpp && rpp.value !== '30') {
    rpp.value = '30'; rpp.dispatchEvent(new Event('change', { bubbles: true }));
    await esperarAjax();
  }
  const primeira = document.querySelector('#dataList_paginator_top .ui-paginator-first:not(.ui-state-disabled)');
  if (primeira) { primeira.click(); await esperarAjax(); }

  const iso = s => { const m = /(\d{2})\/(\d{2})\/(\d{4})\s*(\d{2}:\d{2}(?::\d{2})?)?/.exec(s || ''); return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4] || '00:00'}` : ''; };
  const itens = [];
  const vistos = new Set();
  for (let p = 0; p < 40 && corpo(); p++) {
    for (const tr of corpo().rows) {
      const c = [...tr.cells].map(x => txt(x));
      if (c.length < 10 || !/\d+\/\d{4}/.test(c[0])) continue;
      const m = /(\d+)\/(\d{4})\s*-\s*(.+)/.exec(c[0]);
      // o GDoc acrescenta a etiqueta "DIGITAL" (processo digital) ao fim do órgão
      const orgao = m ? m[3].replace(/\s+DIGITAL$/i, '').trim() : '';
      const processo = m ? `${m[1]}/${m[2]} - ${orgao}` : c[0];
      if (vistos.has(processo)) continue;
      vistos.add(processo);
      const cls = tr.className;
      itens.push({
        processo, numero: m ? +m[1] : null, ano: m ? +m[2] : null, orgao,
        setorOrigem: c[1], ultimoEncaminhamento: iso(c[2]), recebimento: iso(c[3]),
        tipo: c[4], interessado: c[5], status: c[6], encaminhadoPara: c[7],
        diasNoSetor: +((/(\d+)\s*DIA/i.exec(c[9]) || [])[1] || 0),
        prioridadeGdoc: /prioridade/i.test(cls), confidencial: /confidencial/i.test(cls),
        minhaResponsabilidade: /responsabilidade/i.test(cls),
        juntado: !!tr.cells[0].querySelector('img[src*="junt" i], .fa-link, [class*="link" i], svg'),
      });
    }
    const nx = document.querySelector('#dataList_paginator_top .ui-paginator-next');
    if (!nx || nx.classList.contains('ui-state-disabled')) break;
    const antes = txt(corpo());
    nx.click();
    await esperarAjax();
    await esperar(() => txt(corpo()) !== antes, 8000);
  }
  const total = +((document.querySelector('#dataList_paginator_top .ui-paginator-current')?.textContent || '').match(/registros\s*(\d+)/i) || [])[1] || itens.length;
  return { ok: true, setor, total, itens };
};
