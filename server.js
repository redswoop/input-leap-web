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
    if (ws.readyState === 1) {
      try { ws.send(msg); } catch { /* client gone */ }
    }
  }
}

serverProc.on('log', (line) => {
  broadcast('log', line);
  // Parse structured events from log lines
  const event = parseLogEvent(line);
  if (event) broadcast('event', event);
});
serverProc.on('status', (status) => {
  broadcast('status', status);
  if (status.running) {
    broadcast('event', { kind: 'server-started', time: Date.now() });
  } else {
    broadcast('event', { kind: 'server-stopped', time: Date.now() });
  }
});

function parseLogEvent(line) {
  const time = Date.now();
  let m;

  // client "name" has connected
  m = line.match(/client "([^"]+)" has connected/);
  if (m) return { kind: 'client-connected', name: m[1], time };

  // disconnecting client "name"
  m = line.match(/disconnecting client "([^"]+)"/);
  if (m) return { kind: 'client-disconnected', name: m[1], time };

  // forced disconnection of client "name"
  m = line.match(/forced disconnection of client "([^"]+)"/);
  if (m) return { kind: 'client-disconnected', name: m[1], time };

  // switch from "x" to "y" at n,n
  m = line.match(/switch from "([^"]+)" to "([^"]+)" at (\d+),(\d+)/);
  if (m) return { kind: 'screen-switched', from: m[1], to: m[2], x: +m[3], y: +m[4], time };

  // unrecognised client
  m = line.match(/unrecognised client name "([^"]+)"/);
  if (m) return { kind: 'client-rejected', name: m[1], time };

  return null;
}

// ── Validation helpers ──

function isValidScreenName(name) {
  return typeof name === 'string' && /^[\w.-]{1,64}$/.test(name);
}

function isValidAddress(addr) {
  if (!addr) return true; // optional, has default
  return typeof addr === 'string' && /^[:\w.-]{1,128}$/.test(addr);
}

function validateConfig(body) {
  if (!body || typeof body !== 'object') return 'Request body must be a JSON object';
  if (body.screens && typeof body.screens !== 'object') return 'screens must be an object';
  if (body.links && typeof body.links !== 'object') return 'links must be an object';
  if (body.aliases && typeof body.aliases !== 'object') return 'aliases must be an object';
  if (body.options && typeof body.options !== 'object') return 'options must be an object';
  return null;
}

// ── API routes ──

app.get('/api/config', (req, res) => {
  try {
    const cfg = config.load(CONFIG_PATH);
    if (!cfg) return res.json({ screens: {}, links: {}, aliases: {}, options: {} });
    res.json(cfg);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load config', details: err.message });
  }
});

app.post('/api/config', (req, res) => {
  const err = validateConfig(req.body);
  if (err) return res.status(400).json({ error: err });

  try {
    config.save(CONFIG_PATH, req.body);
    const reloaded = serverProc.reload(CONFIG_PATH);
    res.json({ ok: true, reloaded: reloaded || false });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save config', details: err.message });
  }
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
  } catch (err) {
    res.status(500).json({ error: 'Failed to load layout', details: err.message });
  }
});

app.post('/api/layout', (req, res) => {
  try {
    fs.writeFileSync(LAYOUT_PATH, JSON.stringify(req.body, null, 2), 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save layout', details: err.message });
  }
});

app.get('/api/status', (req, res) => {
  res.json(serverProc.getStatus());
});

// Proxy to InputLeap's status endpoint (port 24803)
app.get('/api/il-status', async (req, res) => {
  try {
    const resp = await fetch('http://localhost:24803');
    if (resp.ok) {
      res.json(await resp.json());
    } else {
      res.json(null);
    }
  } catch {
    res.json(null);
  }
});

app.post('/api/server/start', (req, res) => {
  const { name, address, crypto, debugLevel, logFile, dragDrop } = req.body || {};

  if (name && !isValidScreenName(name)) {
    return res.status(400).json({ error: 'Invalid server name' });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  serverProc.start(CONFIG_PATH, { name, address, crypto, debugLevel, logFile, dragDrop });
  res.json({ ok: true });
});

app.post('/api/server/stop', (req, res) => {
  serverProc.stop();
  res.json({ ok: true });
});

app.post('/api/server/restart', (req, res) => {
  const { name, address, crypto, debugLevel, logFile, dragDrop } = req.body || {};

  if (name && !isValidScreenName(name)) {
    return res.status(400).json({ error: 'Invalid server name' });
  }
  if (!isValidAddress(address)) {
    return res.status(400).json({ error: 'Invalid address format' });
  }

  serverProc.restart(CONFIG_PATH, { name, address, crypto, debugLevel, logFile, dragDrop });
  res.json({ ok: true });
});

// Global error handler — catches unhandled errors in route handlers
app.use((err, req, res, _next) => {
  console.error('Unhandled route error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// WebSocket connection
wss.on('connection', (ws) => {
  try {
    ws.send(JSON.stringify({ type: 'status', data: serverProc.getStatus() }));
  } catch { /* client disconnected immediately */ }
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down...');
  serverProc.destroy();
  wss.close();
  server.close(() => {
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown stalls
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Only start listening when run directly (not when imported for tests)
if (require.main === module) {
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`InputLeap Web UI: http://localhost:${PORT}`);
  });
}

// Export for testing
module.exports = { app, server, wss, serverProc, parseLogEvent, isValidScreenName, isValidAddress, validateConfig, PORT };
