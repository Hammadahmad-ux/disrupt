// Draws a roster name into an offscreen canvas exactly where the browser laid it out: the same web font
// (Zalando Sans at wdth 125 via fontStretch "expanded"), and every glyph placed at the x/y the DOM gave it
// (read with a Range per character), so kerning, letter-spacing and line wraps match to the pixel.
// White text on black: the red channel is the coverage the WebGL layer uses as the letter "window".

export type TextMask = {
  canvas: HTMLCanvasElement;
  pad: number; // css px of empty border around the name box
  w: number; // css px, name box + 2 * pad
  h: number;
  lineH: number; // css px, one line of the name
  fontSize: number;
  /** Deepest point inside a letter stroke (css px, mask space) and its distance to the edge. */
  pivot: { x: number; y: number; r: number };
};

export function buildMask(nameEl: HTMLElement, baseEl: HTMLElement, dpr: number): TextMask | null {
  const box = nameEl.getBoundingClientRect();
  if (box.width < 2 || box.height < 2) return null;
  const cs = getComputedStyle(nameEl);
  const fontSize = parseFloat(cs.fontSize);
  const lineH = parseFloat(cs.lineHeight) || fontSize;
  const pad = Math.ceil(fontSize * 0.14);
  const w = box.width + pad * 2;
  const h = box.height + pad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * dpr);
  canvas.height = Math.ceil(h * dpr);
  const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
  if (!ctx) return null;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);
  ctx.font = `${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
  if ("fontStretch" in ctx) ctx.fontStretch = "expanded";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";

  // Every text node of the name, minus the superscript number (the baseline probe is empty).
  const texts: Text[] = [];
  const walker = document.createTreeWalker(nameEl, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.parentElement?.closest("[data-skip]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (walker.nextNode()) texts.push(walker.currentNode as Text);

  const range = document.createRange();
  const glyphs: { ch: string; x: number; top: number }[] = [];
  for (const t of texts) {
    const s = t.data;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (/\s/.test(ch)) continue;
      range.setStart(t, i);
      range.setEnd(t, i + 1);
      const r = range.getBoundingClientRect();
      glyphs.push({ ch: cs.textTransform === "uppercase" ? ch.toUpperCase() : ch, x: r.left - box.left, top: r.top - box.top });
    }
  }
  range.detach();
  if (!glyphs.length) return null;

  // Baseline: the probe sits on the last line's baseline; every line shares the same ascent.
  const probe = baseEl.getBoundingClientRect();
  const last = glyphs[glyphs.length - 1];
  const ascent = probe.top - box.top - last.top;
  for (const g of glyphs) ctx.fillText(g.ch, g.x + pad, g.top + ascent + pad);

  return { canvas, pad, w, h, lineH, fontSize, pivot: deepestPoint(ctx, canvas.width, canvas.height, dpr) };
}

// Chamfer distance transform on a quarter-resolution copy of the mask: the point farthest from any edge
// is where the fly-through zooms in (the camera pushes into the thickest stroke, like the loader's "I").
function deepestPoint(ctx: CanvasRenderingContext2D, cw: number, ch: number, dpr: number) {
  const step = 4;
  const gw = Math.floor(cw / step);
  const gh = Math.floor(ch / step);
  const data = ctx.getImageData(0, 0, cw, ch).data;
  const INF = 1e9;
  const d = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = ((y * step + 2) * cw + (x * step + 2)) * 4;
      d[y * gw + x] = data[i] > 127 ? INF : 0;
    }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= gw || y >= gh ? 0 : d[y * gw + x]);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const k = y * gw + x;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
    }
  }
  let best = 0;
  let bx = gw / 2;
  let by = gh / 2;
  for (let y = gh - 1; y >= 0; y--) {
    for (let x = gw - 1; x >= 0; x--) {
      const k = y * gw + x;
      if (!d[k]) continue;
      d[k] = Math.min(d[k], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
      if (d[k] >= best) {
        best = d[k];
        bx = x;
        by = y;
      }
    }
  }
  return { x: ((bx + 0.5) * step) / dpr, y: ((by + 0.5) * step) / dpr, r: Math.max(1, ((best / 3) * step) / dpr) };
}
