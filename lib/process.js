const { spawn, execSync } = require('child_process');
const fs = require('fs');
const EventEmitter = require('events');

function findBinary() {
  // Check known locations
  const candidates = [
    // Custom build (fork with status endpoint)
    require('path').join(__dirname, '..', '..', 'input-leap-fork', 'build2', 'bin', 'Release', 'input-leaps.exe'),
    // Custom build (macOS)
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
    this._pendingReload = null;
    this._pendingStart = null;
    this._lastOpts = null;
  }

  start(configPath, opts = {}) {
    if (this.proc) this.stop();
    const { name, address = ':24800', crypto = false, debugLevel = 'INFO', logFile, dragDrop = false } = opts;
    this._lastOpts = opts;

    const args = ['-f', '--no-tray', '--debug', debugLevel];
    if (name) args.push('--name', name);
    if (!crypto) args.push('--disable-crypto');
    if (dragDrop) args.push('--enable-drag-drop');
    if (logFile) args.push('--log', logFile);
    args.push('-c', configPath);
    args.push('--address', address);

    this.emit('log', `Starting: ${this.binary}\n`);

    try {
      this.proc = spawn(this.binary, args);
    } catch (err) {
      this.emit('log', `Failed to spawn server: ${err.message}\n`);
      this.emit('status', { running: false, pid: null });
      return;
    }

    // Attach event handlers before setting state flags so we catch
    // immediate exits
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

    // Set state after handlers are attached
    this.running = true;
    this.startedAt = Date.now();
    this.emit('status', { running: true, pid: this.proc.pid, startedAt: this.startedAt });
  }

  stop() {
    if (this.proc) {
      const proc = this.proc;
      this.proc = null;
      this.running = false;
      this.startedAt = null;
      proc.kill('SIGTERM');
      this.emit('status', { running: false, pid: null, startedAt: null });
    }
  }

  reload(configPath) {
    if (!this.proc || !this.running) return false;

    if (process.platform !== 'win32') {
      this.proc.kill('SIGHUP');
      this.emit('log', 'Config saved — reloading (SIGHUP)...\n');
      return true;
    } else {
      // Debounce: only one pending restart at a time
      if (this._pendingReload) {
        clearTimeout(this._pendingReload);
      }
      this.emit('log', 'Config saved — restarting server (Windows)...\n');
      this._pendingReload = setTimeout(() => {
        this._pendingReload = null;
        this.restart(configPath, this._lastOpts);
      }, 500);
      return true;
    }
  }

  restart(configPath, opts) {
    if (this._pendingReload) {
      clearTimeout(this._pendingReload);
      this._pendingReload = null;
    }
    if (this._pendingStart) {
      clearTimeout(this._pendingStart);
      this._pendingStart = null;
    }
    this.stop();
    this._pendingStart = setTimeout(() => {
      this._pendingStart = null;
      this.start(configPath, opts);
    }, 1000);
  }

  getStatus() {
    return { running: this.running, pid: this.proc?.pid || null, startedAt: this.startedAt };
  }

  /** Clean up timers and kill process. Call on shutdown. */
  destroy() {
    if (this._pendingReload) {
      clearTimeout(this._pendingReload);
      this._pendingReload = null;
    }
    if (this._pendingStart) {
      clearTimeout(this._pendingStart);
      this._pendingStart = null;
    }
    this.stop();
    this.removeAllListeners();
  }
}

module.exports = ServerProcess;
