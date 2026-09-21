// ===================================================
// Earthdance Radar — Servidor de Teste Local & Wi-Fi
// ===================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

const store = require('./api/store');

function getLocalIp() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Emulate Vercel Serverless Functions locally
  if (pathname.startsWith('/api/')) {
    let bodyStr = '';
    req.on('data', c => bodyStr += c);
    req.on('end', async () => {
      req.body = bodyStr ? JSON.parse(bodyStr) : {};
      req.query = Object.fromEntries(parsedUrl.searchParams);

      res.status = (code) => { res.statusCode = code; return res; };
      res.json = (data) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      if (pathname === '/api/ping') {
        const handler = require('./api/ping');
        await handler(req, res);
      } else if (pathname === '/api/tent') {
        const handler = require('./api/tent');
        await handler(req, res);
      } else if (pathname === '/api/state') {
        const handler = require('./api/state');
        await handler(req, res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    return;
  }

  // Static files
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIp();
  console.log('\n========================================================');
  console.log('       ☮️ EARTHDANCE RADAR — SERVIDOR LOCAL ☮️        ');
  console.log('========================================================\n');
  console.log(`  💻 No Computador: http://localhost:${PORT}`);
  console.log(`  📱 No Celular (mesmo Wi-Fi): http://${ip}:${PORT}\n`);
  console.log('========================================================\n');
});
