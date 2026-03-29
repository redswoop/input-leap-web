// Compute links between adjacent screen edges.
// Each screen: { name, x, y, w, h } (canvas units)
// Returns array of link objects for the config.

const SNAP_THRESHOLD = 14;

export function detectEdges(screens) {
  const allLinks = {};

  for (const a of screens) {
    allLinks[a.name] = [];
  }

  for (let i = 0; i < screens.length; i++) {
    for (let j = i + 1; j < screens.length; j++) {
      const a = screens[i];
      const b = screens[j];
      const pairs = findAdjacentEdges(a, b);
      for (const { srcScreen, srcDir, srcStart, srcEnd, dstScreen, dstStart, dstEnd } of pairs) {
        allLinks[srcScreen].push({
          srcDir, srcStart, srcEnd,
          dstScreen, dstStart, dstEnd,
        });
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
      results.push(makeLink(a, 'right', b, 'left', overlap, 'vertical'));
      results.push(makeLink(b, 'left', a, 'right', overlap, 'vertical'));
    }
  }

  // b's right edge == a's left edge
  if (Math.abs((b.x + b.w) - a.x) < SNAP_THRESHOLD) {
    const overlap = verticalOverlap(b, a);
    if (overlap) {
      results.push(makeLink(b, 'right', a, 'left', overlap, 'vertical'));
      results.push(makeLink(a, 'left', b, 'right', overlap, 'vertical'));
    }
  }

  // a's bottom edge == b's top edge
  if (Math.abs((a.y + a.h) - b.y) < SNAP_THRESHOLD) {
    const overlap = horizontalOverlap(a, b);
    if (overlap) {
      results.push(makeLink(a, 'bottom', b, 'top', overlap, 'horizontal'));
      results.push(makeLink(b, 'top', a, 'bottom', overlap, 'horizontal'));
    }
  }

  // b's bottom edge == a's top edge
  if (Math.abs((b.y + b.h) - a.y) < SNAP_THRESHOLD) {
    const overlap = horizontalOverlap(b, a);
    if (overlap) {
      results.push(makeLink(b, 'bottom', a, 'top', overlap, 'horizontal'));
      results.push(makeLink(a, 'top', b, 'bottom', overlap, 'horizontal'));
    }
  }

  return results;
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

function makeLink(src, srcDir, dst, dstDir, overlap, axis) {
  let srcStart, srcEnd, dstStart, dstEnd;

  if (axis === 'vertical') {
    srcStart = Math.round(((overlap.top - src.y) / src.h) * 100);
    srcEnd = Math.round(((overlap.bot - src.y) / src.h) * 100);
    dstStart = Math.round(((overlap.top - dst.y) / dst.h) * 100);
    dstEnd = Math.round(((overlap.bot - dst.y) / dst.h) * 100);
  } else {
    srcStart = Math.round(((overlap.left - src.x) / src.w) * 100);
    srcEnd = Math.round(((overlap.right - src.x) / src.w) * 100);
    dstStart = Math.round(((overlap.left - dst.x) / dst.w) * 100);
    dstEnd = Math.round(((overlap.right - dst.x) / dst.w) * 100);
  }

  return {
    srcScreen: src.name, srcDir, srcStart, srcEnd,
    dstScreen: dst.name, dstStart, dstEnd,
  };
}
