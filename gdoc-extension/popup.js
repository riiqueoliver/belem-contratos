const st = document.getElementById('st');
function mostrar() {
  chrome.storage.local.get(['ultimaVarredura', 'varrendo', 'config'], ({ ultimaVarredura: u, varrendo, config = {} }) => {
    const linhas = [];
    if (varrendo) linhas.push('⏳ Varredura em andamento…');
    if (!config.autoLogin) linhas.push('Login automático desligado.');
    if (u) {
      linhas.push(`Última: ${new Date(u.fim || u.inicio).toLocaleString('pt-BR')}`);
      linhas.push(u.erro ? `Erro: ${u.erro === 'sessao' ? 'sessão do GDoc expirada' : u.erro}`
        : `${u.verificados || 0} parcela(s) · ${(u.movimentos || []).length} movimentação(ões)`);
    } else linhas.push('Nenhuma varredura ainda.');
    st.textContent = linhas.join('\n');
  });
}
mostrar();
document.getElementById('agora').onclick = () => {
  st.textContent = '⏳ Verificando os processos no GDoc…';
  chrome.runtime.sendMessage({ type: 'VARREDURA_AGORA' }, () => mostrar());
};
document.getElementById('cfg').onclick = () => chrome.runtime.openOptionsPage();
