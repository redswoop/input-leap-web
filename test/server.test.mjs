import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const { parseLogEvent, isValidScreenName, isValidAddress, validateConfig } = require('../server');

describe('parseLogEvent', () => {
  it('parses client connected events', () => {
    const ev = parseLogEvent('client "laptop" has connected');
    expect(ev).toMatchObject({ kind: 'client-connected', name: 'laptop' });
    expect(ev.time).toBeTypeOf('number');
  });

  it('parses client disconnected events', () => {
    const ev = parseLogEvent('disconnecting client "laptop"');
    expect(ev).toMatchObject({ kind: 'client-disconnected', name: 'laptop' });
  });

  it('parses forced disconnection events', () => {
    const ev = parseLogEvent('forced disconnection of client "laptop"');
    expect(ev).toMatchObject({ kind: 'client-disconnected', name: 'laptop' });
  });

  it('parses screen switch events', () => {
    const ev = parseLogEvent('switch from "server" to "laptop" at 1920,540');
    expect(ev).toMatchObject({
      kind: 'screen-switched',
      from: 'server',
      to: 'laptop',
      x: 1920,
      y: 540,
    });
  });

  it('parses client rejected events', () => {
    const ev = parseLogEvent('unrecognised client name "unknown"');
    expect(ev).toMatchObject({ kind: 'client-rejected', name: 'unknown' });
  });

  it('returns null for unrecognized log lines', () => {
    expect(parseLogEvent('INFO: starting server')).toBeNull();
    expect(parseLogEvent('')).toBeNull();
    expect(parseLogEvent('some random text')).toBeNull();
  });
});

describe('isValidScreenName', () => {
  it('accepts valid names', () => {
    expect(isValidScreenName('server')).toBe(true);
    expect(isValidScreenName('my-laptop')).toBe(true);
    expect(isValidScreenName('desk.local')).toBe(true);
    expect(isValidScreenName('PC_01')).toBe(true);
  });

  it('rejects invalid names', () => {
    expect(isValidScreenName('')).toBe(false);
    expect(isValidScreenName(null)).toBe(false);
    expect(isValidScreenName(123)).toBe(false);
    expect(isValidScreenName('a'.repeat(65))).toBe(false);
    expect(isValidScreenName('name with spaces')).toBe(false);
    expect(isValidScreenName('name;injection')).toBe(false);
    expect(isValidScreenName('$(command)')).toBe(false);
  });
});

describe('isValidAddress', () => {
  it('accepts valid addresses', () => {
    expect(isValidAddress(':24800')).toBe(true);
    expect(isValidAddress('192.168.1.10:24800')).toBe(true);
    expect(isValidAddress('localhost:24800')).toBe(true);
    expect(isValidAddress(undefined)).toBe(true); // optional
    expect(isValidAddress('')).toBe(true); // empty is ok
  });

  it('rejects invalid addresses', () => {
    expect(isValidAddress('$(evil command)')).toBe(false);
    expect(isValidAddress('addr;rm -rf /')).toBe(false);
  });
});

describe('validateConfig', () => {
  it('accepts valid config objects', () => {
    expect(validateConfig({ screens: {}, links: {}, aliases: {}, options: {} })).toBeNull();
    expect(validateConfig({})).toBeNull();
  });

  it('rejects non-object bodies', () => {
    expect(validateConfig(null)).toBeTypeOf('string');
    expect(validateConfig('string')).toBeTypeOf('string');
    expect(validateConfig(42)).toBeTypeOf('string');
  });

  it('rejects invalid field types', () => {
    expect(validateConfig({ screens: 'not an object' })).toBeTypeOf('string');
    expect(validateConfig({ links: 123 })).toBeTypeOf('string');
  });
});
