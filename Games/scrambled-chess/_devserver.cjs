const http = require('http');
const fs = require('fs');
const path = require('path');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

http.createServer((req, res) => {
  // Dev-only debug endpoint: lets the browser POST a rendered PNG straight to
  // disk for visual review, instead of transcribing a huge base64 string by
  // hand. Not part of the shipped game.
  if (req.method === 'POST' && req.url === '/__save-preview') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync('C:\\Users\\harsh\\AppData\\Local\\Temp\\claude\\C--Users-harsh-OneDrive-Desktop-Agentic-Workflow\\71b799ca-f186-4fe0-b377-053951bdf3bb\\scratchpad\\piece-preview.png', Buffer.concat(chunks));
      res.writeHead(200); res.end('ok');
    });
    return;
  }
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.endsWith('/')) urlPath += 'index.html';
  const filePath = path.join(__dirname, urlPath);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found: ' + filePath); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(5173, () => console.log('serving on 5173'));
