const $ = id => document.getElementById(id);

function mostrarUltima(u) {
  if (!u) { $('ultima').textContent = 'Nenhuma varredura ainda.'; return; }
  const quando = new Date(u.fim || u.inicio).toLocaleString('pt-BR');
  const linhas = [`${quando} (${u.motivo}) · ${u.verificados || 0} parcela(s) verificada(s)`];
  if (u.erro) linhas.push('Erro: ' + (u.erro === 'sessao' ? 'sessão do GDoc expirada e sem login automático.' : u.erro));
  (u.avisos || []).forEach(a => linhas.push(a));
  (u.movimentos || []).forEach(m => linhas.push('• ' + m));
  if (!u.erro && !(u.movimentos || []).length) linhas.push('Nenhuma movimentação nova.');
  $('ultima').textContent = linhas.join('\n');
}

chrome.storage.local.get(['config', 'ultimaVarredura'], ({ config = {}, ultimaVarredura }) => {
  $('autoLogin').checked = !!config.autoLogin;
  $('matricula').value = config.matricula || '';
  $('senha').value = config.senha || '';
  $('horarios').value = (config.horarios || [8, 12, 17]).join(', ');
  mostrarUltima(ultimaVarredura);
});

$('salvar').onclick = () => {
  const horarios = $('horarios').value.split(/[,;\s]+/).map(Number).filter(h => Number.isInteger(h) && h >= 0 && h <= 23);
  const config = { autoLogin: $('autoLogin').checked, matricula: $('matricula').value.trim(),
                   senha: $('senha').value, horarios: horarios.length ? horarios : [8, 12, 17] };
  chrome.storage.local.set({ config }, () => { $('msg').textContent = '✅ Configurações salvas.'; });
};

$('agora').onclick = () => {
  $('msg').textContent = '⏳ Verificando os processos no GDoc… (pode levar alguns minutos)';
  chrome.runtime.sendMessage({ type: 'VARREDURA_AGORA' }, r => {
    $('msg').textContent = r?.erro && r.erro !== 'sessao' ? '❌ ' + r.erro
      : r?.erro === 'sessao' ? '⚠️ Não consegui entrar no GDoc. Confira o login automático.'
      : `✅ Concluído: ${r?.verificados || 0} parcela(s), ${(r?.movimentos || []).length} movimentação(ões).`;
    chrome.storage.local.get('ultimaVarredura', d => mostrarUltima(d.ultimaVarredura));
  });
};
