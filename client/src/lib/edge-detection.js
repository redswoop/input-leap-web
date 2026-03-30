// Compute links between adjacent screen edges.
// Each screen: { name, x, y, w, h } (canvas units)
// Returns object keyed by screen name → array of link objects for the config.

// Max gap (px) between edges that still counts as "adjacent".
// Tuned for typical canvas scale where screens are ~200-400px wide.
const SNAP_THRESHOLD = 14;

export function detectEdges(screens) {
  if (!Array.isArray(screens) || screens.length === 0) return {};

  const allLinks = {};

  for (const a of screens) {
    if (!a || !a.name) continue;
    allLinks[a.name] = [];
  }

  for (let i = 0; i < screens.length; i++) {
    for (let j = i + 1; j < screens.length; j++) {
      const a = screens[i];
      const b = screens[j];
      if (!a || !b || !a.name || !b.name) continue;
      if (!isFinite(a.w) || !isFinite(a.h) || a.w <= 0 || a.h <= 0) continue;
      if (!isFinite(b.w) || !isFinite(b.h) || b.w <= 0 || b.h <= 0) continue;

      const pairs = findAdjacentEdges(a, b);
      for (const { srcScreen, srcDir, srcStart, srcEnd, dstScreen, dstStart, dstEnd } of pairs) {
        if (allLinks[srcScreen]) {
          allLinks[srcScreen].push({
            srcDir, srcStart, srcEnd,
            dstScreen, dstStart, dstEnd,
          });
        }
      }
    }
  }

  return allLinks;
}

function findAdjacentEdges(a, b) {
  const results = [];

  // a's right edge == b's left edge
  if (Math.abs((a.x + a.w) - b.x) < SNAP_THRESHOLD) {
    const overlap = verticalOverlap(a, b);
    if (overlap) {
      results.push(makeLink(a, 'right', b, overlap, 'vertical'));
      results.push(makeLink(b, 'left', a, overlap, 'vertical'));
    }
  }

  // b's right edge == a's left edge
  if (Math.abs((b.x + b.w) - a.x) < SNAP_THRESHOLD) {
    const overlap = verticalOverlap(b, a);
    if (overlap) {
      results.push(makeLink(b, 'right', a, overlap, 'vertical'));
      results.push(makeLink(a, 'left', b, overlap, 'vertical'));
    }
  }

  // a's bottom edge == b's top edge
  if (Math.abs((a.y + a.h) - b.y) < SNAP_THRESHOLD) {
    const overlap = horizontalOverlap(a, b);
    if (overlap) {
      results.push(makeLink(a, 'bottom', b, overlap, 'horizontal'));
      results.push(makeLink(b, 'top', a, overlap, 'horizontal'));
    }
  }

  // b's bottom edge == a's top edge
  if (Math.abs((b.y + b.h) - a.y) < SNAP_THRESHOLD) {
    const overlap = horizontalOverlap(b, a);
    if (overlap) {
      results.push(makeLink(b, 'bottom', a, overlap, 'horizontal'));
      results.push(makeLink(a, 'top', b, overlap, 'horizontal'));
    }
  }

  return results.filter(r => r !== null);
}

function verticalOverlap(a, b) {
  const top = Math.max(a.y, b.y);
  const bot = Math.min(a.y + a.h, b.y + b.h);
  if (bot - top < 1) return null;
  return { top, bot, aTop: a.y, aH: a.h, bTop: b.y, bH: b.h };
}

function horizontalOverlap(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.w, b.x + b.w);
  if (right - left < 1) return null;
  return { left, right, aLeft: a.x, aW: a.w, bLeft: b.x, bW: b.w };
}

function makeLink(src, srcDir, dst, overlap, axis) {
  let srcStart, srcEnd, dstStart, dstEnd;

  if (axis === 'vertical') {
    srcStart = Math.ceil(((overlap.top - src.y) / src.h) * 100);
    srcEnd = Math.floor(((overlap.bot - src.y) / src.h) * 100);
    dstStart = Math.ceil(((overlap.top - dst.y) / dst.h) * 100);
    dstEnd = Math.floor(((overlap.bot - dst.y) / dst.h) * 100);
  } else {
    srcStart = Math.ceil(((overlap.left - src.x) / src.w) * 100);
    srcEnd = Math.floor(((overlap.right - src.x) / src.w) * 100);
    dstStart = Math.ceil(((overlap.left - dst.x) / dst.w) * 100);
    dstEnd = Math.floor(((overlap.right - dst.x) / dst.w) * 100);
  }
  // Clamp to valid range
  srcStart = Math.max(0, srcStart);
  srcEnd = Math.min(100, srcEnd);
  dstStart = Math.max(0, dstStart);
  dstEnd = Math.min(100, dstEnd);
  // Skip degenerate ranges
  if (srcEnd <= srcStart || dstEnd <= dstStart) return null;

  return {
    srcScreen: src.name, srcDir, srcStart, srcEnd,
    dstScreen: dst.name, dstStart, dstEnd,
  };
}
