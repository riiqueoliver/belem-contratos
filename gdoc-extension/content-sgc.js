/* Roda no Sistema de Gestão de Contratos.
   1) Observa o pacote de emissão gravado pelo sistema e repassa à extensão.
   2) Atende o botão "Verificar no GDoc" da parcela: pede a varredura do processo
      e devolve o resumo para a página. */

const KEY = 'gdoc-payload';
let ultimoEnviado = null;

function repassar() {
  let raw;
  try { raw = localStorage.getItem(KEY); } catch (e) { return; }
  if (!raw || raw === ultimoEnviado) return;
  let payload;
  try { payload = JSON.parse(raw); } catch (e) { return; }
  ultimoEnviado = raw;
  chrome.runtime.sendMessage({ type: 'GDOC_SET_PAYLOAD', payload }, () => {
    if (chrome.runtime.lastError) { /* extensão recarregada — ignora */ }
  });
}

// Verifica ao carregar e periodicamente (o SGC grava no clique de "Abrir GDoc")
repassar();
setInterval(repassar, 1000);

window.addEventListener('message', e => {
  if (e.source !== window || e.data?.type !== 'SGC_GDOC_VERIFICAR') return;
  const parcelaId = String(e.data.parcelaId || '');
  document.documentElement.setAttribute('data-sgc-gdoc-ack', '1');   // "a extensão está aqui"
  chrome.runtime.sendMessage({ type: 'VARREDURA_PARCELA', parcelaId }, resumo => {
    if (chrome.runtime.lastError) resumo = { erro: 'A extensão foi recarregada. Atualize a página e tente de novo.' };
    window.postMessage({ type: 'SGC_GDOC_RESULTADO', parcelaId, resumo }, location.origin);
  });
});

// Módulo Gestão do GDoc: "Atualizar agora" lê a caixa do setor
window.addEventListener('message', e => {
  if (e.source !== window || e.data?.type !== 'SGC_GDOC_CAIXA') return;
  document.documentElement.setAttribute('data-sgc-gdoc-ack', '1');
  chrome.runtime.sendMessage({ type: 'VARREDURA_CAIXA' }, resumo => {
    if (chrome.runtime.lastError) resumo = { erro: 'A extensão foi recarregada. Atualize a página e tente de novo.' };
    window.postMessage({ type: 'SGC_GDOC_CAIXA_RESULTADO', resumo }, location.origin);
  });
});
