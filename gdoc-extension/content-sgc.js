/* Roda no Sistema de Gestão de Contratos.
   Observa o pacote de emissão gravado pelo sistema e repassa à extensão. */

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
