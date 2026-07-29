/* Ponte entre o Sistema de Gestão de Contratos e o GDoc.
   O SGC envia o pacote de emissão; o GDoc consome quando o usuário manda executar. */

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
});
