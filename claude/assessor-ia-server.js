const http = require('http')
const fs = require('fs')
const path = require('path')

const DIST = 'C:\\Users\\Henrique\\OneDrive\\Documentos\\GitHub\\assessor-ia\\dist'
const PORT = 5176

const mime = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.webmanifest': 'application/manifest+json',
}

http.createServer((req, res) => {
  let filePath = path.join(DIST, req.url.split('?')[0])

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  res.setHeader('Content-Type', mime[ext] || 'application/octet-stream')
  res.setHeader('Cache-Control', 'no-cache')
  fs.createReadStream(filePath).pipe(res)
}).listen(PORT, () => console.log(`AssessorIA running on http://localhost:${PORT}`))
