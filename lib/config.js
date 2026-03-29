const fs = require('fs');

// Parse InputLeap config file into JSON
function parse(text) {
  const config = { screens: {}, links: {}, aliases: {}, options: {} };
  let section = null;
  let currentScreen = null;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('section:')) {
      section = line.split(':')[1].trim();
      continue;
    }
    if (line === 'end') {
      section = null;
      currentScreen = null;
      continue;
    }

    if (section === 'screens') {
      if (line.endsWith(':')) {
        currentScreen = line.slice(0, -1).trim();
        config.screens[currentScreen] = {};
      } else if (currentScreen) {
        const [key, val] = line.split('=').map(s => s.trim());
        config.screens[currentScreen][key] = val;
      }
    }

    if (section === 'aliases') {
      if (line.endsWith(':')) {
        currentScreen = line.slice(0, -1).trim();
        config.aliases[currentScreen] = [];
      } else if (currentScreen) {
        config.aliases[currentScreen].push(line);
      }
    }

    if (section === 'links') {
      if (line.endsWith(':')) {
        currentScreen = line.slice(0, -1).trim();
        if (!config.links[currentScreen]) config.links[currentScreen] = [];
      } else if (currentScreen) {
        const link = parseLinkLine(line);
        if (link) config.links[currentScreen].push(link);
      }
    }

    if (section === 'options') {
      const eq = line.indexOf('=');
      if (eq !== -1) {
        config.options[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
      }
    }
  }

  return config;
}

// Parse a link line like: "down(0,50) = laptop-left" or "right = server(25,75)"
function parseLinkLine(line) {
  const m = line.match(
    /^(\w+)(?:\((\d+)\s*,\s*(\d+)\))?\s*=\s*(\S+?)(?:\((\d+)\s*,\s*(\d+)\))?$/
  );
  if (!m) return null;
  return {
    srcDir: normalizeDir(m[1]),
    srcStart: m[2] ? parseInt(m[2]) : 0,
    srcEnd: m[3] ? parseInt(m[3]) : 100,
    dstScreen: m[4],
    dstStart: m[5] ? parseInt(m[5]) : 0,
    dstEnd: m[6] ? parseInt(m[6]) : 100,
  };
}

function normalizeDir(d) {
  if (d === 'up') return 'top';
  if (d === 'down') return 'bottom';
  return d;
}

function dirToConfig(d) {
  if (d === 'top') return 'up';
  if (d === 'bottom') return 'down';
  return d;
}

// Generate InputLeap config text from JSON
function generate(config) {
  const lines = [];

  // Screens
  lines.push('section: screens');
  for (const [name, opts] of Object.entries(config.screens)) {
    lines.push(`\t${name}:`);
    for (const [k, v] of Object.entries(opts)) {
      lines.push(`\t\t${k} = ${v}`);
    }
  }
  lines.push('end');
  lines.push('');

  // Aliases
  if (Object.keys(config.aliases).length > 0) {
    lines.push('section: aliases');
    for (const [name, aliasList] of Object.entries(config.aliases)) {
      lines.push(`\t${name}:`);
      for (const a of aliasList) {
        lines.push(`\t\t${a}`);
      }
    }
    lines.push('end');
    lines.push('');
  }

  // Links
  lines.push('section: links');
  for (const [name, linkList] of Object.entries(config.links)) {
    lines.push(`\t${name}:`);
    for (const link of linkList) {
      const srcDir = dirToConfig(link.srcDir);
      const srcInterval = (link.srcStart === 0 && link.srcEnd === 100)
        ? '' : `(${link.srcStart},${link.srcEnd})`;
      const dstInterval = (link.dstStart === 0 && link.dstEnd === 100)
        ? '' : `(${link.dstStart},${link.dstEnd})`;
      lines.push(`\t\t${srcDir}${srcInterval} = ${link.dstScreen}${dstInterval}`);
    }
  }
  lines.push('end');
  lines.push('');

  // Options
  if (Object.keys(config.options).length > 0) {
    lines.push('section: options');
    for (const [k, v] of Object.entries(config.options)) {
      lines.push(`\t${k} = ${v}`);
    }
    lines.push('end');
    lines.push('');
  }

  return lines.join('\n');
}

function load(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return parse(fs.readFileSync(filePath, 'utf8'));
}

function save(filePath, config) {
  fs.writeFileSync(filePath, generate(config), 'utf8');
}

module.exports = { parse, generate, load, save };
