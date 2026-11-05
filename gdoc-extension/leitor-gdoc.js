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
  return { ok: true, situacao: dados.situacao, tipoProcesso: dados.tipoProcesso,
           setor: atual.setor || '', encaminhamentos, anexos };
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
