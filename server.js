// ===================================================
// Earthdance Radar - Servidor Local com suporte a /api Vercel
// Zero dependências externas (roda direto com Node.js nativo)
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
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json'
};

// State store for local dev testing (mirrors Vercel Serverless api/store.js)
const localState = {
  users: new Map(),
  tents: new Map()
};

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

function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  let bodyStr = '';
  req.on('data', chunk => { bodyStr += chunk; });
  req.on('end', () => {
    let body = {};
    if (bodyStr) {
      try { body = JSON.parse(bodyStr); } catch (e) {}
    }

    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const clientIp = typeof rawIp === 'string' ? rawIp.split(',')[0].trim() : '127.0.0.1';

    if (pathname === '/api/ping' && req.method === 'POST') {
      const { deviceId, nick, lat, lng, accuracy, heading, tent } = body;
      if (!deviceId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId is required' }));
        return;
      }

      const now = Date.now();
      localState.users.set(deviceId, {
        id: deviceId,
        ip: clientIp,
        nick: nick || 'Guerreiro da Paz',
        lat: typeof lat === 'number' ? lat : null,
        lng: typeof lng === 'number' ? lng : null,
        accuracy: typeof accuracy === 'number' ? accuracy : null,
        heading: typeof heading === 'number' ? heading : null,
        lastSeen: now
      });

      if (tent && typeof tent.lat === 'number' && typeof tent.lng === 'number') {
        localState.tents.set(deviceId, {
          deviceId,
          nick: nick || 'Amigo Earthdance',
          lat: tent.lat,
          lng: tent.lng,
          accuracy: tent.accuracy || 5,
          savedAt: tent.savedAt || now
        });
      }

      const friends = [];
      for (const [id, user] of localState.users.entries()) {
        if (id !== deviceId && now - user.lastSeen < 15 * 60 * 1000) {
          friends.push({
            ...user,
            tent: localState.tents.get(id) || null
          });
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        clientIp,
        serverTime: now,
        totalOnline: localState.users.size,
        friends,
        allTents: Array.from(localState.tents.values()),
        myTent: localState.tents.get(deviceId) || null
      }));
      return;
    }

    if (pathname === '/api/tent' && req.method === 'POST') {
      const { deviceId, nick, lat, lng, accuracy } = body;
      if (!deviceId || typeof lat !== 'number' || typeof lng !== 'number') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'deviceId, lat and lng are required' }));
        return;
      }

      const tentObj = {
        deviceId,
        nick: nick || 'Amigo Earthdance',
        lat,
        lng,
        accuracy: accuracy || 5,
        savedAt: Date.now()
      };
      localState.tents.set(deviceId, tentObj);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        tent: tentObj,
        allTents: Array.from(localState.tents.values())
      }));
      return;
    }

    if (pathname === '/api/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        allTents: Array.from(localState.tents.values()),
        users: Array.from(localState.users.values())
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Endpoint Not Found' }));
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    handleApiRequest(req, res);
    return;
  }

  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log('\n========================================================');
  console.log('       🌿 Earthdance Radar — Servidor Ativo! 🌿       ');
  console.log('========================================================\n');
  console.log(`  💻 No Computador: http://localhost:${PORT}`);
  console.log(`  📱 No Celular (mesmo Wi-Fi): http://${localIp}:${PORT}\n`);
  console.log('  Endpoints Vercel emulados localmente: /api/ping, /api/tent');
  console.log('========================================================\n');
});
