const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const config = require('./lib/config');
const ServerProcess = require('./lib/process');

const fs = require('fs');

const PORT = process.env.PORT || 24802;
const CONFIG_PATH = process.env.CONFIG_PATH || path.join(__dirname, 'input-leap.conf');
const LAYOUT_PATH = path.join(__dirname, 'layout.json');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const serverProc = new ServerProcess();

// Broadcast to all WebSocket clients
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(msg);
  }
}

serverProc.on('log', (line) => broadcast('log', line));
serverProc.on('status', (status) => broadcast('status', status));

// API routes
app.get('/api/config', (req, res) => {
  const cfg = config.load(CONFIG_PATH);
  if (!cfg) return res.json({ screens: {}, links: {}, aliases: {}, options: {} });
  res.json(cfg);
});

app.post('/api/config', (req, res) => {
  config.save(CONFIG_PATH, req.body);
  res.json({ ok: true });
});

app.get('/api/hostname', (req, res) => {
  const platformMap = { darwin: 'macos', win32: 'windows', linux: 'linux' };
  res.json({
    hostname: os.hostname(),
    platform: platformMap[process.platform] || 'linux',
  });
});

app.get('/api/layout', (req, res) => {
  try {
    if (fs.existsSync(LAYOUT_PATH)) {
      res.json(JSON.parse(fs.readFileSync(LAYOUT_PATH, 'utf8')));
    } else {
      res.json(null);
    }
  } catch { res.json(null); }
});

app.post('/api/layout', (req, res) => {
  fs.writeFileSync(LAYOUT_PATH, JSON.stringify(req.body, null, 2), 'utf8');
  res.json({ ok: true });
});

app.get('/api/status', (req, res) => {
  res.json(serverProc.getStatus());
});

app.post('/api/server/start', (req, res) => {
  const { name, address, crypto } = req.body || {};
  serverProc.start(CONFIG_PATH, { name, address, crypto });
  res.json({ ok: true });
});

app.post('/api/server/stop', (req, res) => {
  serverProc.stop();
  res.json({ ok: true });
});

app.post('/api/server/restart', (req, res) => {
  const { name, address, crypto } = req.body || {};
  serverProc.restart(CONFIG_PATH, { name, address, crypto });
  res.json({ ok: true });
});

// WebSocket connection
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'status', data: serverProc.getStatus() }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`InputLeap Web UI: http://localhost:${PORT}`);
});
