const { spawn, execSync } = require('child_process');
const fs = require('fs');
const EventEmitter = require('events');

function findBinary() {
  // Check known locations
  const candidates = [
    // Custom build
    require('path').join(__dirname, '..', '..', 'input-leap-3.0.3', 'build', 'bin', 'input-leaps'),
    // Homebrew
    '/opt/homebrew/bin/input-leaps',
    '/usr/local/bin/input-leaps',
    // macOS app bundle
    '/Applications/InputLeap.app/Contents/MacOS/input-leaps',
    // Windows
    'C:\\Program Files\\InputLeap\\input-leaps.exe',
  ];

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // Fall back to PATH
  try {
    const which = execSync('which input-leaps 2>/dev/null', { encoding: 'utf8' }).trim();
    if (which) return which;
  } catch { /* not on PATH */ }

  return 'input-leaps'; // last resort, will fail with ENOENT
}

class ServerProcess extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.running = false;
    this.startedAt = null;
    this.binary = findBinary();
  }

  start(configPath, { name, address = ':24800', crypto = false, debugLevel = 'INFO', logFile, dragDrop = false } = {}) {
    if (this.proc) this.stop();

    const args = ['-f', '--no-tray', '--debug', debugLevel];
    if (name) args.push('--name', name);
    if (!crypto) args.push('--disable-crypto');
    if (dragDrop) args.push('--enable-drag-drop');
    if (logFile) args.push('--log', logFile);
    args.push('-c', configPath);
    args.push('--address', address);

    this.emit('log', `Starting: ${this.binary}\n`);
    this.proc = spawn(this.binary, args);
    this.running = true;
    this.startedAt = Date.now();
    this.emit('status', { running: true, pid: this.proc.pid, startedAt: this.startedAt });

    this.proc.stdout.on('data', (data) => {
      this.emit('log', data.toString());
    });

    this.proc.stderr.on('data', (data) => {
      this.emit('log', data.toString());
    });

    this.proc.on('close', (code) => {
      this.running = false;
      this.proc = null;
      this.emit('log', `Server exited with code ${code}\n`);
      this.emit('status', { running: false, pid: null });
    });

    this.proc.on('error', (err) => {
      this.running = false;
      this.proc = null;
      this.emit('log', `Server error: ${err.message}\n`);
      this.emit('status', { running: false, pid: null });
    });
  }

  stop() {
    if (this.proc) {
      this.proc.kill('SIGTERM');
      this.proc = null;
      this.running = false;
      this.startedAt = null;
      this.emit('status', { running: false, pid: null, startedAt: null });
    }
  }

  restart(configPath, opts) {
    this.stop();
    setTimeout(() => this.start(configPath, opts), 500);
  }

  getStatus() {
    return { running: this.running, pid: this.proc?.pid || null, startedAt: this.startedAt };
  }
}

module.exports = ServerProcess;
