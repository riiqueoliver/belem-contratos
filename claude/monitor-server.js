const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5175;

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'monitor-ui', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`Monitor IA rodando em http://localhost:${PORT}`));
