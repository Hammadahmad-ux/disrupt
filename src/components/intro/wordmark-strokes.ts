// Hand-measured centre lines of each DISRUPT glyph, in the glyph's own units (height 697, y down), in the
// order a pen would write them. Drawn with a thick stroke and clipped by the real glyph outline
// (wordmark-paths.ts), so the finished frame is the exact logo. Ends overshoot on purpose; the clip trims them.
export const STROKE_WIDTH = 176;

export const WORDMARK_STROKES: Record<string, string> = {
  D: "M-30,70 H400 A278.5 278.5 0 0 1 400,627 H-30",
  I: "M72.5,-20 V717",
  S: "M700,74 H210 A136.5 136.5 0 0 0 210,347 H520 A139.5 139.5 0 0 1 520,626 H-20",
  R: "M-40,74 H500 A140 172.5 0 0 1 500,419 H-40 M420,455 L700,760",
  U: "M70,-20 V481 A140 140 0 0 0 210,621 H465 A140 140 0 0 0 605,481 V-20",
  P: "M70,717 V74 H460 A140 172.5 0 0 1 460,419 H40",
  T: "M-20,74 H682 M327,74 V717",
};
