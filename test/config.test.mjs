import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fs = require('fs');
const path = require('path');
const { parse, generate, load, save } = require('../lib/config');

describe('config.parse', () => {
  it('parses a minimal config with one screen', () => {
    const text = `section: screens
\tserver:
end`;
    const cfg = parse(text);
    expect(cfg.screens).toHaveProperty('server');
    expect(cfg.screens.server).toEqual({});
  });

  it('parses screen options correctly', () => {
    const text = `section: screens
\tserver:
\t\thalfDuplexCapsLock = true
\t\tshift = alt
end`;
    const cfg = parse(text);
    expect(cfg.screens.server).toEqual({
      halfDuplexCapsLock: 'true',
      shift: 'alt',
    });
  });

  it('parses multiple screens', () => {
    const text = `section: screens
\tserver:
\tlaptop:
\tdesktop:
end`;
    const cfg = parse(text);
    expect(Object.keys(cfg.screens)).toEqual(['server', 'laptop', 'desktop']);
  });

  it('parses aliases section', () => {
    const text = `section: aliases
\tserver:
\t\tserver.local
\t\t192.168.1.10
end`;
    const cfg = parse(text);
    expect(cfg.aliases.server).toEqual(['server.local', '192.168.1.10']);
  });

  it('parses simple link lines', () => {
    const text = `section: links
\tserver:
\t\tright = laptop
end`;
    const cfg = parse(text);
    expect(cfg.links.server).toHaveLength(1);
    expect(cfg.links.server[0]).toEqual({
      srcDir: 'right',
      srcStart: 0,
      srcEnd: 100,
      dstScreen: 'laptop',
      dstStart: 0,
      dstEnd: 100,
    });
  });

  it('parses range-based link lines', () => {
    const text = `section: links
\tserver:
\t\tdown(0,50) = laptop(25,75)
end`;
    const cfg = parse(text);
    expect(cfg.links.server[0]).toEqual({
      srcDir: 'bottom',
      srcStart: 0,
      srcEnd: 50,
      dstScreen: 'laptop',
      dstStart: 25,
      dstEnd: 75,
    });
  });

  it('normalizes up/down to top/bottom', () => {
    const text = `section: links
\tserver:
\t\tup = laptop
\t\tdown = desktop
end`;
    const cfg = parse(text);
    expect(cfg.links.server[0].srcDir).toBe('top');
    expect(cfg.links.server[1].srcDir).toBe('bottom');
  });

  it('parses options section', () => {
    const text = `section: options
\tswitchDelay = 250
\theartbeat = 5000
end`;
    const cfg = parse(text);
    expect(cfg.options).toEqual({
      switchDelay: '250',
      heartbeat: '5000',
    });
  });

  it('ignores comments and blank lines', () => {
    const text = `# this is a comment
section: screens
\tserver:

# another comment
end`;
    const cfg = parse(text);
    expect(cfg.screens).toHaveProperty('server');
  });

  it('handles screen options with = in value gracefully', () => {
    const text = `section: screens
\tserver:
\t\tsomeKey = value=with=equals
end`;
    const cfg = parse(text);
    expect(cfg.screens.server.someKey).toBe('value=with=equals');
  });

  it('skips malformed link lines without crashing', () => {
    const text = `section: links
\tserver:
\t\tthis is not a valid link
\t\tright = laptop
end`;
    const cfg = parse(text);
    expect(cfg.links.server).toHaveLength(1);
    expect(cfg.links.server[0].dstScreen).toBe('laptop');
  });

  it('returns empty config for empty input', () => {
    const cfg = parse('');
    expect(cfg).toEqual({ screens: {}, links: {}, aliases: {}, options: {} });
  });
});

describe('config.generate', () => {
  it('generates screens section', () => {
    const cfg = {
      screens: { server: {}, laptop: { shift: 'alt' } },
      links: {},
      aliases: {},
      options: {},
    };
    const text = generate(cfg);
    expect(text).toContain('section: screens');
    expect(text).toContain('\tserver:');
    expect(text).toContain('\tlaptop:');
    expect(text).toContain('\t\tshift = alt');
  });

  it('generates aliases section when present', () => {
    const cfg = {
      screens: {},
      links: {},
      aliases: { server: ['server.local'] },
      options: {},
    };
    const text = generate(cfg);
    expect(text).toContain('section: aliases');
    expect(text).toContain('\tserver:');
    expect(text).toContain('\t\tserver.local');
  });

  it('omits aliases section when empty', () => {
    const cfg = {
      screens: {},
      links: {},
      aliases: {},
      options: {},
    };
    const text = generate(cfg);
    expect(text).not.toContain('section: aliases');
  });

  it('generates links with ranges', () => {
    const cfg = {
      screens: {},
      links: {
        server: [{
          srcDir: 'bottom',
          srcStart: 0,
          srcEnd: 50,
          dstScreen: 'laptop',
          dstStart: 25,
          dstEnd: 75,
        }],
      },
      aliases: {},
      options: {},
    };
    const text = generate(cfg);
    expect(text).toContain('\t\tdown(0,50) = laptop(25,75)');
  });

  it('omits ranges when 0-100 (full edge)', () => {
    const cfg = {
      screens: {},
      links: {
        server: [{
          srcDir: 'right',
          srcStart: 0,
          srcEnd: 100,
          dstScreen: 'laptop',
          dstStart: 0,
          dstEnd: 100,
        }],
      },
      aliases: {},
      options: {},
    };
    const text = generate(cfg);
    expect(text).toContain('\t\tright = laptop');
    expect(text).not.toContain('(0,100)');
  });

  it('converts top/bottom back to up/down', () => {
    const cfg = {
      screens: {},
      links: {
        server: [
          { srcDir: 'top', srcStart: 0, srcEnd: 100, dstScreen: 'a', dstStart: 0, dstEnd: 100 },
          { srcDir: 'bottom', srcStart: 0, srcEnd: 100, dstScreen: 'b', dstStart: 0, dstEnd: 100 },
        ],
      },
      aliases: {},
      options: {},
    };
    const text = generate(cfg);
    expect(text).toContain('\t\tup = a');
    expect(text).toContain('\t\tdown = b');
  });

  it('generates options section when present', () => {
    const cfg = {
      screens: {},
      links: {},
      aliases: {},
      options: { switchDelay: '250', heartbeat: '5000' },
    };
    const text = generate(cfg);
    expect(text).toContain('section: options');
    expect(text).toContain('\tswitchDelay = 250');
    expect(text).toContain('\theartbeat = 5000');
  });
});

describe('config round-trip', () => {
  it('parse → generate → parse produces same structure', () => {
    const original = `section: screens
\tserver:
\t\thalfDuplexCapsLock = true
\tlaptop:
end

section: aliases
\tserver:
\t\tserver.local
end

section: links
\tserver:
\t\tright = laptop
\tlaptop:
\t\tleft = server
end

section: options
\tswitchDelay = 250
end`;

    const cfg1 = parse(original);
    const generated = generate(cfg1);
    const cfg2 = parse(generated);
    expect(cfg2).toEqual(cfg1);
  });

  it('preserves range-based links through round-trip', () => {
    const original = `section: screens
\ta:
\tb:
end

section: links
\ta:
\t\tdown(10,90) = b(20,80)
end`;

    const cfg1 = parse(original);
    const generated = generate(cfg1);
    const cfg2 = parse(generated);
    expect(cfg2.links.a[0].srcStart).toBe(10);
    expect(cfg2.links.a[0].srcEnd).toBe(90);
    expect(cfg2.links.a[0].dstStart).toBe(20);
    expect(cfg2.links.a[0].dstEnd).toBe(80);
  });
});

describe('config.load / config.save', () => {
  const tmpFile = path.join(__dirname, '_test_config.tmp');

  afterEach(() => {
    try { fs.unlinkSync(tmpFile); } catch { /* ok */ }
  });

  it('returns null for non-existent file', () => {
    expect(load('/nonexistent/path/config.conf')).toBeNull();
  });

  it('save then load round-trips correctly', () => {
    const cfg = {
      screens: { server: {}, laptop: { shift: 'alt' } },
      links: { server: [{ srcDir: 'right', srcStart: 0, srcEnd: 100, dstScreen: 'laptop', dstStart: 0, dstEnd: 100 }] },
      aliases: {},
      options: { switchDelay: '250' },
    };
    save(tmpFile, cfg);
    const loaded = load(tmpFile);
    expect(loaded.screens).toEqual(cfg.screens);
    expect(loaded.links.server[0].dstScreen).toBe('laptop');
    expect(loaded.options.switchDelay).toBe('250');
  });

  it('throws descriptive error on unreadable file', () => {
    // Simulate by trying to load a directory
    expect(() => load(__dirname)).toThrow(/Failed to load config/);
  });
});
