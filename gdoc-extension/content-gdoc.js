/* Automação do GDoc (JSF/PrimeFaces).
   Detecta em qual etapa do fluxo a página está e preenche os campos
   com o pacote enviado pelo Sistema de Gestão de Contratos. */

(() => {
  'use strict';

  /* ───────────── utilidades ───────────── */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const txt   = el => (el?.textContent || '').replace(/\s+/g, ' ').trim();
  const norm  = s => (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                      .replace(/\s+/g, ' ').trim().toUpperCase();

  async function esperar(fn, timeout = 15000, intervalo = 250) {
    const limite = Date.now() + timeout;
    while (Date.now() < limite) {
      const r = fn();
      if (r) return r;
      await sleep(intervalo);
    }
    return null;
  }

  // Aguarda o PrimeFaces terminar as requisições AJAX pendentes
  async function esperarAjax(timeout = 15000) {
    await sleep(300);
    const limite = Date.now() + timeout;
    while (Date.now() < limite) {
      const carregando = document.querySelector('.ui-blockui:not(.ui-helper-hidden), .ui-widget-overlay');
      const jq = window.jQuery;
      const ativo = jq && jq.active > 0;
      if (!carregando && !ativo) { await sleep(400); return true; }
      await sleep(200);
    }
    return false;
  }

  function porRotulo(rotulo) {
    const alvo = norm(rotulo);
    const tds = [...document.querySelectorAll('td, label, th, div')];
    for (const td of tds) {
      const t = norm(txt(td)).replace(/[:*]/g, '').trim();
      if (t === alvo) return td;
    }
    return null;
  }

  // Encontra o campo (input/textarea/select) associado a um rótulo
  function campoDe(rotulo, tag = 'input, textarea, select') {
    const lab = porRotulo(rotulo);
    if (!lab) return null;
    let n = lab;
    for (let i = 0; i < 4 && n; i++) {
      const linha = n.closest('tr') || n.parentElement;
      if (linha) {
        const c = linha.querySelector(tag);
        if (c && !c.closest('.ui-helper-hidden-accessible')) return c;
        const oculto = linha.querySelector(tag);
        if (oculto) return oculto;
      }
      n = n.parentElement;
    }
    return null;
  }

  function preencher(el, valor) {
    if (!el) return false;
    const proto = el instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    setter ? setter.call(el, valor) : (el.value = valor);
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
    return true;
  }

  /* ── seleção em dropdown PrimeFaces (várias estratégias) ── */
  async function selecionar(rotulo, textoOpcao) {
    const alvo = norm(textoOpcao);

    // 1) <select> nativo (inclusive o oculto do PrimeFaces)
    const sel = campoDe(rotulo, 'select');
    if (sel && sel.options) {
      const op = [...sel.options].find(o => norm(o.textContent) === alvo)
              || [...sel.options].find(o => norm(o.textContent).startsWith(alvo));
      if (op) {
        sel.value = op.value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        await esperarAjax(8000);
        if (norm(sel.selectedOptions?.[0]?.textContent) === norm(op.textContent)) return true;
      }
    }

    // 2) widget PrimeFaces: abre o painel e clica no item
    const lab = porRotulo(rotulo);
    const linha = lab?.closest('tr') || lab?.parentElement;
    const widget = linha?.querySelector('.ui-selectonemenu');
    if (widget) {
      (widget.querySelector('.ui-selectonemenu-trigger') || widget).click();
      await sleep(400);
      const painel = await esperar(() =>
        [...document.querySelectorAll('.ui-selectonemenu-panel')]
          .find(p => p.offsetParent !== null), 5000);
      if (painel) {
        const filtro = painel.querySelector('input.ui-selectonemenu-filter');
        if (filtro) { preencher(filtro, textoOpcao); await sleep(500); }
        const itens = [...painel.querySelectorAll('li.ui-selectonemenu-item')];
        const item = itens.find(i => norm(i.dataset.label || txt(i)) === alvo)
                  || itens.find(i => norm(i.dataset.label || txt(i)).startsWith(alvo));
        if (item) { item.click(); await esperarAjax(8000); return true; }
        painel.style.display = 'none';
      }
    }
    return false;
  }

  /* ── editor de texto rico (despacho) ── */
  function preencherDespacho(texto) {
    const html = texto.split('\n').map(l => l.trim() ? `<p>${l}</p>` : '<p><br></p>').join('');

    // Quill (p:textEditor)
    const ql = document.querySelector('.ql-editor');
    if (ql) {
      ql.innerHTML = html;
      ql.dispatchEvent(new Event('input', { bubbles: true }));
      const hidden = ql.closest('.ui-texteditor')?.querySelector('input[type=hidden]');
      if (hidden) preencher(hidden, html);
      return true;
    }
    // CKEditor em iframe
    const ifr = [...document.querySelectorAll('iframe')].find(f => {
      try { return f.contentDocument?.body?.isContentEditable; } catch (e) { return false; }
    });
    if (ifr) {
      ifr.contentDocument.body.innerHTML = html;
      ifr.contentDocument.body.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    }
    // contenteditable solto
    const ce = document.querySelector('[contenteditable=true]');
    if (ce) { ce.innerHTML = html; ce.dispatchEvent(new Event('input', { bubbles: true })); return true; }
    // textarea simples
    const ta = campoDe('Despacho', 'textarea') || document.querySelector('textarea');
    if (ta) return preencher(ta, texto);
    return false;
  }

  /* ── detecção da etapa ── */
  function etapaAtual() {
    const t = norm(document.body.innerText.slice(0, 4000));
    if (t.includes('PESQUISA DE INTERESSADO')) return 'interessado';
    if (t.includes('NOVO PROCESSO') && porRotulo('Instrução Inicial')) return 'processo';
    if (t.includes('ANEXO')) return 'anexo';
    if (t.includes('NOVO ENCAMINHAMENTO') || porRotulo('Despacho')) return 'encaminhamento';
    return 'desconhecida';
  }

  /* ───────────── etapas ───────────── */
  async function etapaInteressado(p, log) {
    log('Buscando interessado…');
    const nome = campoDe('Nome do Interessado', 'input');
    if (!nome) return log('✗ Campo "Nome do Interessado" não encontrado.', 'erro');
    preencher(nome, 'BELÉM DIGITAL');
    await sleep(200);

    const btn = [...document.querySelectorAll('button, input[type=submit], a')]
      .find(b => norm(txt(b) || b.value) === 'PESQUISAR');
    if (!btn) return log('✗ Botão "Pesquisar" não encontrado.', 'erro');
    btn.click();
    await esperarAjax();

    log('Abrindo processo para o interessado…');
    const abrir = await esperar(() =>
      [...document.querySelectorAll('button, input[type=submit], a')]
        .find(b => norm(txt(b) || b.value).includes('ABRIR PROCESSO')), 10000);
    if (!abrir) return log('✗ Nenhum interessado encontrado. Verifique manualmente.', 'erro');
    abrir.click();
    await esperarAjax();
    log('✓ Interessado selecionado.', 'ok');
  }

  async function etapaProcesso(p, log) {
    log('Preenchendo tipo de processo…');
    const okTipo = await selecionar('Tipo de Processo', p.tipoProcesso);
    log(okTipo ? '✓ Tipo: ' + p.tipoProcesso : '✗ Selecione o tipo manualmente.', okTipo ? 'ok' : 'erro');

    log('Preenchendo instrução inicial…');
    const ta = campoDe('Instrução Inicial', 'textarea');
    if (ta) {
      preencher(ta, p.instrucaoInicial.slice(0, 750));
      log('✓ Instrução inicial preenchida.', 'ok');
    } else {
      log('✗ Campo "Instrução Inicial" não encontrado.', 'erro');
    }
    log('Confira os dados e clique em Salvar.', 'aviso');
  }

  async function etapaAnexo(p, log) {
    const a = (p.anexos || []).find(x => x.chave === 'nf') || p.anexos?.[0];
    if (!a) return log('✗ Nenhum anexo definido.', 'erro');
    log('Preenchendo dados do anexo…');
    const desc = campoDe('Descrição do Documento', 'input');
    if (desc) preencher(desc, a.descricao);
    const ok = await selecionar('Tipo de Documento', a.tipo);
    log(ok ? `✓ Anexo "${a.descricao}" (${a.tipo})` : '✗ Selecione o tipo manualmente.', ok ? 'ok' : 'erro');
    log('Selecione o arquivo PDF e clique em Salvar.', 'aviso');
  }

  async function etapaEncaminhamento(p, log) {
    log('Escrevendo despacho…');
    const ok = preencherDespacho(p.despacho);
    log(ok ? '✓ Despacho preenchido.' : '✗ Cole o despacho manualmente.', ok ? 'ok' : 'erro');

    log('Definindo destino…');
    const okOrgao = await selecionar('Órgão', p.orgaoDestino);
    if (okOrgao) { await sleep(600); }
    const okSetor = await selecionar('Setor', p.setorDestino);
    log(okOrgao && okSetor
      ? `✓ Destino: ${p.orgaoDestino} / ${p.setorDestino}`
      : '✗ Selecione órgão/setor manualmente.', okOrgao && okSetor ? 'ok' : 'erro');
    log('Confira tudo e clique em Enviar.', 'aviso');
  }

  /* ───────────── painel flutuante ───────────── */
  let painelEl, logEl;

  function montarPainel(p) {
    if (painelEl) return;
    painelEl = document.createElement('div');
    painelEl.className = 'sgc-gdoc-panel';
    painelEl.innerHTML = `
      <div class="sgc-hd">
        <span class="sgc-badge">SGC</span>
        <span class="sgc-tit">Emissão automática</span>
        <button class="sgc-x" title="Fechar">×</button>
      </div>
      <div class="sgc-info">
        <div><b>Contrato</b><span>${p.contrato || '—'}</span></div>
        <div><b>Competência</b><span>${p.competencia?.caixaAlta || '—'}</span></div>
        <div><b>Valor</b><span>${p.valorFormatado || '—'}</span></div>
      </div>
      <button class="sgc-run">Preencher esta etapa</button>
      <div class="sgc-log"></div>
      <p class="sgc-hint">Preenche automaticamente a etapa aberta. Você confere e clica em Salvar/Enviar.</p>
    `;
    document.body.appendChild(painelEl);
    logEl = painelEl.querySelector('.sgc-log');

    painelEl.querySelector('.sgc-x').onclick = () => painelEl.remove();
    painelEl.querySelector('.sgc-run').onclick = async ev => {
      const b = ev.currentTarget;
      b.disabled = true; b.textContent = 'Preenchendo…';
      logEl.innerHTML = '';
      try { await executar(p); }
      catch (e) { log('✗ Erro: ' + e.message, 'erro'); }
      b.disabled = false; b.textContent = 'Preencher esta etapa';
    };
  }

  function log(msg, tipo) {
    if (!logEl) return;
    const d = document.createElement('div');
    d.className = 'sgc-l ' + (tipo || '');
    d.textContent = msg;
    logEl.appendChild(d);
    logEl.scrollTop = logEl.scrollHeight;
  }

  async function executar(p) {
    const etapa = etapaAtual();
    log('Etapa detectada: ' + etapa);
    if (etapa === 'interessado')         await etapaInteressado(p, log);
    else if (etapa === 'processo')       await etapaProcesso(p, log);
    else if (etapa === 'anexo')          await etapaAnexo(p, log);
    else if (etapa === 'encaminhamento') await etapaEncaminhamento(p, log);
    else log('✗ Etapa não reconhecida. Abra "Processo → Novo Processo".', 'erro');
  }

  /* ───────────── início ───────────── */
  chrome.runtime.sendMessage({ type: 'GDOC_GET_PAYLOAD' }, resp => {
    if (chrome.runtime.lastError || !resp?.payload) return;
    const p = resp.payload;
    // Ignora pacotes com mais de 12 horas
    if (p.salvoEm && Date.now() - p.salvoEm > 12 * 3600 * 1000) return;
    montarPainel(p);
  });
})();
