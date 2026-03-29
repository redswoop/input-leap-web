const { spawn } = require('child_process');
const EventEmitter = require('events');

class ServerProcess extends EventEmitter {
  constructor() {
    super();
    this.proc = null;
    this.running = false;
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

    this.proc = spawn('input-leaps', args);
    this.running = true;
    this.emit('status', { running: true, pid: this.proc.pid });

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
      this.emit('status', { running: false, pid: null });
    }
  }

  restart(configPath, opts) {
    this.stop();
    setTimeout(() => this.start(configPath, opts), 500);
  }

  getStatus() {
    return { running: this.running, pid: this.proc?.pid || null };
  }
}

module.exports = ServerProcess;
