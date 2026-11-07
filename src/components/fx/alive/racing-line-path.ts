// Geometry for the racing line: a smooth path that runs down the page, holds a "lane" along one
// side inside each section and sweeps across to the other side between sections, like a racing line
// taking corners. Every waypoint has a vertical tangent and each cubic keeps its control points
// between its end points, so y only ever increases. That lets us map "how far down the page" to
// "how much line is drawn" with one lookup table.

export const SECTION_IDS = ["brands", "work", "reel", "studio", "services", "contact"] as const;

export type SectionBox = {
  id: string;
  top: number;
  bottom: number;
  /** Offset (px from the section top) of the first text in the left / right part of the section. */
  textTop?: { left: number; right: number };
};

type Waypoint = { x: number; y: number; k1?: number; k2?: number };

export type Lut = {
  s: Float64Array; // cumulative length
  x: Float64Array;
  y: Float64Array;
  length: number;
};

export type RacingGeometry = {
  d: string;
  lut: Lut;
  /** y (px from the top of the SVG) where the line ends. */
  endY: number;
};

// Which side each section's straight runs on (0 = left, 1 = right). The straights sit in the outer
// margin, outside the content column, so the line never runs through copy; it only sweeps across the
// page between sections, which is where the "corners" are.
const SIDES: Record<string, 0 | 1> = { brands: 1, work: 0, reel: 1, studio: 1, services: 0, contact: 0 };

export function buildRacingLine(opts: {
  width: number;
  height: number;
  vh: number;
  boxes: SectionBox[];
  compact: boolean;
  /** Where the line leaves the hero (the hero's scroll cue), px from the left. */
  startX?: number;
}): RacingGeometry {
  const { width: W, height: H, vh, compact } = opts;
  const boxes = opts.boxes.filter((b) => b.bottom > b.top + 4).sort((a, b) => a.top - b.top);
  // Half the page gutter (--gutter is clamp(16px, 2.8vw, 40px)), so the line runs beside the content.
  const edge = compact ? 9 : Math.min(24, Math.max(12, W * 0.014));
  const sideOf = (id: string, i: number) => SIDES[id] ?? (i % 2 ? 0 : 1);

  const pts: Waypoint[] = [{ x: opts.startX ?? W * 0.5, y: 0 }];

  if (boxes.length === 0) {
    // Nothing measured yet: a calm weave so the line still reads.
    const n = Math.max(2, Math.round(H / vh));
    for (let i = 1; i <= n; i++) pts.push({ x: i % 2 ? W - edge : edge, y: (H * i) / n });
  } else {
    boxes.forEach((b, i) => {
      const h = b.bottom - b.top;
      const side = sideOf(b.id, i);
      const lane = side === 1 ? W - edge : edge;
      const margin = Math.min(vh * (compact ? 0.26 : 0.36), h * 0.3);
      const first = i === 0;
      const last = i === boxes.length - 1;
      // The first bend leaves the hero from its scroll cue, so give it more room.
      let entryY = Math.max(0, b.top) + (first ? Math.min(h * 0.55, vh * 0.62) : margin);
      // Finish the crossing above the section's first label or heading on the lane side, so the
      // line never cuts through copy on its way into the lane (the first bend too: it cut through
      // the brands label "07 marques").
      const textTop = b.textTop ? (side === 1 ? b.textTop.right : b.textTop.left) : Infinity;
      if (Number.isFinite(textTop)) {
        entryY = Math.min(entryY, Math.max(b.top + (compact ? 40 : 56), b.top + textTop - (compact ? 20 : 28)));
      }

      // Crossing into this section: stays wide, then commits (a late apex).
      pts.push({ x: lane, y: entryY, k1: 0.6, k2: 0.46 });

      if (last) {
        // Finish: the line rests part way down the contact section and the tip idles there.
        const endY = Math.min(b.bottom - 8, b.top + Math.max(h * 0.5, margin + vh * 0.25));
        pts.push({ x: lane, y: endY });
        return;
      }
      pts.push({ x: lane, y: b.bottom - margin });
    });
  }

  // Keep y strictly increasing (tiny sections can make waypoints collide).
  const clean: Waypoint[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p.y > clean[clean.length - 1].y + 12) clean.push(p);
  }

  const r = (n: number) => Math.round(n * 10) / 10;
  let d = `M${r(clean[0].x)} ${r(clean[0].y)}`;
  const segs: number[][] = [];
  for (let i = 1; i < clean.length; i++) {
    const a = clean[i - 1];
    const b = clean[i];
    const dy = b.y - a.y;
    const k1 = b.k1 ?? 0.5;
    const k2 = b.k2 ?? 0.5;
    const seg = [a.x, a.y, a.x, a.y + k1 * dy, b.x, b.y - k2 * dy, b.x, b.y];
    segs.push(seg);
    d += ` C${r(seg[2])} ${r(seg[3])} ${r(seg[4])} ${r(seg[5])} ${r(seg[6])} ${r(seg[7])}`;
  }

  return { d, lut: buildLut(segs), endY: clean[clean.length - 1].y };
}

function buildLut(segs: number[][]): Lut {
  const s: number[] = [0];
  const x: number[] = [];
  const y: number[] = [];
  if (segs.length === 0) return { s: new Float64Array([0]), x: new Float64Array([0]), y: new Float64Array([0]), length: 0 };
  x.push(segs[0][0]);
  y.push(segs[0][1]);
  let total = 0;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segs) {
    const net = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const n = Math.max(8, Math.ceil(net / 5));
    let px = x0;
    let py = y0;
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const mt = 1 - t;
      const a = mt * mt * mt;
      const b = 3 * mt * mt * t;
      const c = 3 * mt * t * t;
      const e = t * t * t;
      const qx = a * x0 + b * x1 + c * x2 + e * x3;
      const qy = a * y0 + b * y1 + c * y2 + e * y3;
      total += Math.hypot(qx - px, qy - py);
      s.push(total);
      x.push(qx);
      y.push(qy);
      px = qx;
      py = qy;
    }
  }
  return { s: new Float64Array(s), x: new Float64Array(x), y: new Float64Array(y), length: total };
}

/** Length of line needed to reach a given y (px from the SVG top). */
export function lengthAtY(lut: Lut, yy: number) {
  const { y, s } = lut;
  const n = y.length;
  if (n < 2 || yy <= y[0]) return 0;
  if (yy >= y[n - 1]) return lut.length;
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (y[mid] < yy) lo = mid;
    else hi = mid;
  }
  const span = y[hi] - y[lo];
  const t = span > 1e-6 ? (yy - y[lo]) / span : 1;
  return s[lo] + (s[hi] - s[lo]) * t;
}

/** Point on the line at a given length. */
export function pointAt(lut: Lut, ss: number) {
  const { s, x, y } = lut;
  const n = s.length;
  if (n < 2 || ss <= 0) return { x: x[0] ?? 0, y: y[0] ?? 0 };
  if (ss >= s[n - 1]) return { x: x[n - 1], y: y[n - 1] };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid] < ss) lo = mid;
    else hi = mid;
  }
  const t = (ss - s[lo]) / (s[hi] - s[lo] || 1);
  return { x: x[lo] + (x[hi] - x[lo]) * t, y: y[lo] + (y[hi] - y[lo]) * t };
}
