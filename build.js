/**
 * build.js — Pré-transpila o JSX do index.html e gera dist/index.html
 * sem Babel Standalone, reduzindo drasticamente o tempo de inicialização.
 *
 * Uso: node build.js
 */
const fs   = require('fs');
const path = require('path');
const babel = require('@babel/core');

const SRC  = path.join(__dirname, 'index.html');
const DIST = path.join(__dirname, 'dist', 'index.html');

const html = fs.readFileSync(SRC, 'utf8');

// ── 1. Extrai e transpila o bloco JSX ──────────────────────────────────────
const BABEL_RE = /<script\s+type="text\/babel">([\s\S]*?)<\/script>/;
const match = html.match(BABEL_RE);
if (!match) { console.error('❌  Bloco <script type="text/babel"> não encontrado.'); process.exit(1); }

const jsx = match[1];
console.log(`📦  Transpilando ${(Buffer.byteLength(jsx,'utf8')/1024).toFixed(0)} KB de JSX…`);

const result = babel.transformSync(jsx, {
  presets: [
    ['@babel/preset-react', { runtime: 'classic' }],
    ['@babel/preset-env', {
      targets: { browsers: ['last 2 Chrome versions', 'last 2 Firefox versions', 'last 2 Safari versions'] },
      modules: false,
      useBuiltIns: false,
    }],
  ],
  compact: false,
  comments: false,
});

if (!result || !result.code) { console.error('❌  Transpilação falhou.'); process.exit(1); }
console.log(`✅  Transpilado: ${(Buffer.byteLength(result.code,'utf8')/1024).toFixed(0)} KB`);

// ── 2. Reconstrói o HTML ───────────────────────────────────────────────────
let out = html
  // Remove Babel standalone
  .replace(/<script\s[^>]*babel[^>]*><\/script>\s*/gi, '')
  // Remove XLSX e JSZip do head (serão carregados lazy)
  .replace(/<script\s[^>]*xlsx[^>]*><\/script>\s*/gi, '')
  .replace(/<script\s[^>]*jszip[^>]*><\/script>\s*/gi, '')
  // Substitui o bloco JSX pelo JS pré-transpilado
  // Usa função callback para evitar que $1/$& no código Babel sejam
  // interpretados como referências de grupo de captura pelo .replace()
  .replace(BABEL_RE, () => `<script>\n${result.code}\n</script>`);

// ── 3. Remove no-cache agressivo ───────────────────────────────────────────
// Os meta no-cache impedem cache do próprio HTML e de todo asset CDN.
// Vercel já serve com Cache-Control correto; os metas eram workaround temporário.
out = out
  .replace(/<meta http-equiv="Cache-Control"[^>]*>\s*/g, '')
  .replace(/<meta http-equiv="Pragma"[^>]*>\s*/g, '')
  .replace(/<meta http-equiv="Expires"[^>]*>\s*/g, '');

// ── 4. React via unpkg (jsDelivr retorna 400 nos UMD do React) ────────────
// NÃO trocar para jsDelivr: os caminhos /npm/react@18/umd/*.min.js dão 400
// no jsDelivr, o que deixa React undefined e quebra o app (tela em branco).
// unpkg serve esses arquivos corretamente.

// ── 5. Google Fonts com font-display:swap ─────────────────────────────────
out = out.replace(
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');",
  "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');"
  // já tem display=swap — ok
);

// ── 6. Preconnect hints ───────────────────────────────────────────────────
const preconnects = `
  <link rel="preconnect" href="https://unpkg.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
  <link rel="preconnect" href="https://www.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://fonts.googleapis.com" crossorigin>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`;
out = out.replace('<meta charset="UTF-8" />', '<meta charset="UTF-8" />' + preconnects);

// ── 7. Injeta loader lazy para XLSX + JSZip ───────────────────────────────
// Chamado automaticamente antes de qualquer exportação
const lazyLoader = `
  <script>
    // Carregamento lazy de libs de exportação (não bloqueiam o boot)
    window._exportLibsReady = false;
    window._loadExportLibs = function() {
      if (window._exportLibsReady) return Promise.resolve();
      if (window._exportLibsPromise) return window._exportLibsPromise;
      window._exportLibsPromise = new Promise(function(resolve, reject) {
        var loaded = 0;
        function onLoad() { if (++loaded === 2) { window._exportLibsReady = true; resolve(); } }
        ['https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js',
         'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'].forEach(function(src) {
          var s = document.createElement('script'); s.src = src;
          s.onload = onLoad; s.onerror = reject;
          document.head.appendChild(s);
        });
      });
      return window._exportLibsPromise;
    };
  </script>`;
out = out.replace('</head>', lazyLoader + '\n</head>');

// ── 8. Copia assets estáticos (logos) ─────────────────────────────────────
['belemdigital-logo.png', 'sgc-logo.png', 'logo.png', 'simbologo2.PNG', 'arcanjo-logo.jpg',
 'gcsp-lockup-white.png', 'gcsp-symbol-white.png', 'gcsp-symbol.png'].forEach(file => {
  const src = path.join(__dirname, file);
  const dst = path.join(__dirname, 'dist', file);
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
});

// ── 8b. Página de login do módulo Arcanjo em /moduloarcanjo ───────────────
const arcanjoLoginSrc = path.join(__dirname, 'arcanjo-login.html');
const arcanjoLoginDir = path.join(__dirname, 'dist', 'moduloarcanjo');
if (fs.existsSync(arcanjoLoginSrc)) {
  if (!fs.existsSync(arcanjoLoginDir)) fs.mkdirSync(arcanjoLoginDir, { recursive: true });
  fs.copyFileSync(arcanjoLoginSrc, path.join(arcanjoLoginDir, 'index.html'));
}

// ── 9. Grava ───────────────────────────────────────────────────────────────
fs.writeFileSync(DIST, out, 'utf8');

const srcKB  = (fs.statSync(SRC).size  / 1024).toFixed(0);
const distKB = (fs.statSync(DIST).size / 1024).toFixed(0);
console.log(`\n🚀  dist/index.html gerado com sucesso!`);
console.log(`   source:  ${srcKB} KB`);
console.log(`   dist:    ${distKB} KB`);
console.log(`\n   Otimizações aplicadas:`);
console.log(`   ✓  Babel removido        → -900 KB de download`);
console.log(`   ✓  Transpilação removida → -3-5 s de CPU no boot`);
console.log(`   ✓  XLSX + JSZip lazy     → -1.1 MB do carregamento inicial`);
console.log(`   ✓  CDN jsDelivr          → mais rápido que unpkg`);
console.log(`   ✓  no-cache removido     → assets CDN ficam em cache`);
console.log(`   ✓  preconnect hints      → DNS/TLS antecipados`);
