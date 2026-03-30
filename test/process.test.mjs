import { createRequire } from 'module';
import EventEmitter from 'events';
import { vi } from 'vitest';

const require = createRequire(import.meta.url);
const ServerProcess = require('../lib/process');

const mockProc = () => {
  const proc = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  proc.pid = 12345;
  proc.kill = vi.fn();
  return proc;
};

describe('ServerProcess', () => {
  let server;

  beforeEach(() => {
    server = new ServerProcess();
    // Override binary to avoid real filesystem lookups
    server.binary = 'fake-binary';
  });

  afterEach(() => {
    server.destroy();
  });

  describe('constructor', () => {
    it('initializes with correct defaults', () => {
      expect(server.running).toBe(false);
      expect(server.proc).toBeNull();
      expect(server.startedAt).toBeNull();
      expect(server._pendingReload).toBeNull();
      expect(server._pendingStart).toBeNull();
    });
  });

  describe('getStatus', () => {
    it('returns not running when stopped', () => {
      expect(server.getStatus()).toEqual({ running: false, pid: null, startedAt: null });
    });

    it('returns running with pid when a process is set', () => {
      const proc = mockProc();
      server.proc = proc;
      server.running = true;
      server.startedAt = 1000;
      expect(server.getStatus()).toEqual({ running: true, pid: 12345, startedAt: 1000 });
    });
  });

  describe('stop', () => {
    it('is a no-op when no process is running', () => {
      expect(() => server.stop()).not.toThrow();
      expect(server.running).toBe(false);
    });

    it('kills process and resets state', () => {
      const proc = mockProc();
      server.proc = proc;
      server.running = true;
      server.startedAt = Date.now();

      const statuses = [];
      server.on('status', (s) => statuses.push(s));

      server.stop();

      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(server.running).toBe(false);
      expect(server.proc).toBeNull();
      expect(server.startedAt).toBeNull();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]).toMatchObject({ running: false, pid: null });
    });
  });

  describe('reload', () => {
    it('returns false when not running', () => {
      expect(server.reload('/tmp/config.conf')).toBe(false);
    });

    it('returns true when running', () => {
      const proc = mockProc();
      server.proc = proc;
      server.running = true;
      server._lastOpts = {};

      const result = server.reload('/tmp/config.conf');
      expect(result).toBe(true);
    });
  });

  describe('restart', () => {
    it('clears pending reload timer', () => {
      vi.useFakeTimers();
      const proc = mockProc();
      server.proc = proc;
      server.running = true;
      server._lastOpts = {};

      server._pendingReload = setTimeout(() => {}, 5000);
      server.restart('/tmp/config.conf', {});
      expect(server._pendingReload).toBeNull();
      vi.useRealTimers();
    });

    it('stops the running process', () => {
      vi.useFakeTimers();
      const proc = mockProc();
      server.proc = proc;
      server.running = true;

      server.restart('/tmp/config.conf', {});
      expect(proc.kill).toHaveBeenCalledWith('SIGTERM');
      expect(server.running).toBe(false);
      vi.useRealTimers();
    });

    it('schedules a new start after delay', () => {
      vi.useFakeTimers();
      server.restart('/tmp/config.conf', {});

      expect(server._pendingStart).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('destroy', () => {
    it('cleans up all timers and stops process', () => {
      vi.useFakeTimers();
      const proc = mockProc();
      server.proc = proc;
      server.running = true;
      server._pendingReload = setTimeout(() => {}, 5000);
      server._pendingStart = setTimeout(() => {}, 5000);

      server.destroy();

      expect(server.running).toBe(false);
      expect(server._pendingReload).toBeNull();
      expect(server._pendingStart).toBeNull();
      expect(proc.kill).toHaveBeenCalled();
      vi.useRealTimers();
    });

    it('removes all listeners', () => {
      server.on('log', () => {});
      server.on('status', () => {});
      expect(server.listenerCount('log')).toBeGreaterThan(0);

      server.destroy();
      expect(server.listenerCount('log')).toBe(0);
      expect(server.listenerCount('status')).toBe(0);
    });
  });

  describe('start (integration with real spawn)', () => {
    it('handles ENOENT when binary does not exist', async () => {
      const logs = [];
      const statuses = [];
      server.on('log', (l) => logs.push(l));
      server.on('status', (s) => statuses.push(s));

      server.start('/tmp/config.conf');

      // Wait for async error event
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(server.running).toBe(false);
      expect(logs.some(l => l.includes('error') || l.includes('Error') || l.includes('ENOENT'))).toBe(true);
    });
  });
});
