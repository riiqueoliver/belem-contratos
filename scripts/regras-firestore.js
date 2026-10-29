// Publica as regras do Firestore usando a conta de serviço local.
// Uso: node scripts/regras-firestore.js [arquivo.rules]   (padrão: firestore.rules)
// Guarda o ruleset anterior em scripts/regras-anteriores/ antes de trocar.
const fs = require('fs');
const path = require('path');
const { cert } = require('firebase-admin/app');

const sa = require(path.join(__dirname, '..', 'serviceAccountKey.json.json'));
const arquivo = process.argv[2] || path.join(__dirname, '..', 'firestore.rules');
const API = 'https://firebaserules.googleapis.com/v1/projects/' + sa.project_id;

(async () => {
  const { access_token } = await cert(sa).getAccessToken();
  const H = { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' };
  const chamar = async (url, opt = {}) => {
    const r = await fetch(url, { ...opt, headers: H });
    const j = await r.json();
    if (!r.ok) throw new Error(JSON.stringify(j.error || j));
    return j;
  };

  const release = await chamar(`${API}/releases/cloud.firestore`);
  const anterior = await chamar(`https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const dirBkp = path.join(__dirname, 'regras-anteriores');
  fs.mkdirSync(dirBkp, { recursive: true });
  const bkp = path.join(dirBkp, `${new Date().toISOString().replace(/[:.]/g, '-')}.rules`);
  fs.writeFileSync(bkp, anterior.source.files.map(f => f.content).join('\n'));
  console.log('Regras anteriores guardadas em', bkp);

  const novo = await chamar(`${API}/rulesets`, {
    method: 'POST',
    body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: fs.readFileSync(arquivo, 'utf8') }] } }),
  });
  await chamar(`${API}/releases/cloud.firestore`, {
    method: 'PATCH',
    body: JSON.stringify({ release: { name: `projects/${sa.project_id}/releases/cloud.firestore`, rulesetName: novo.name } }),
  });
  console.log('Regras publicadas:', novo.name.split('/').pop());
})().catch(e => { console.error('Erro:', e.message); process.exit(1); });
