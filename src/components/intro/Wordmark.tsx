import { WORDMARK_HEIGHT as H, WORDMARK_LETTERS, WORDMARK_WIDTH as W } from "./wordmark-paths";
import { STROKE_WIDTH, WORDMARK_STROKES } from "./wordmark-strokes";
import styles from "./intro.module.css";

const GLYPH = `translate(0,${H}) scale(0.1,-0.1)`;

// The logo writes itself: each letter is a thick centre-line stroke (dash-animated in CSS, so it starts on
// first paint) clipped by the real glyph outline.
export function WordmarkDraw() {
  return (
    <svg className={styles.draw} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false" data-draw>
      <defs>
        {WORDMARK_LETTERS.map((l) => (
          <clipPath key={l.name} id={`wm-clip-${l.name}`} clipPathUnits="userSpaceOnUse">
            <path transform={GLYPH} d={l.d} />
          </clipPath>
        ))}
      </defs>
      {WORDMARK_LETTERS.map((l, i) => (
        <g key={l.name} transform={`translate(${l.x},0)`} clipPath={`url(#wm-clip-${l.name})`}>
          <path
            className={styles.stroke}
            d={WORDMARK_STROKES[l.name]}
            pathLength={1}
            strokeWidth={STROKE_WIDTH}
            style={{ "--i": i } as React.CSSProperties}
            data-stroke
          />
        </g>
      ))}
    </svg>
  );
}

// The same logo as filled glyphs, for the reveal window (used inside an SVG mask, in logo units).
export function WordmarkGlyphs({ fill }: { fill: string }) {
  return (
    <>
      {WORDMARK_LETTERS.map((l) => (
        <path key={l.name} transform={`translate(${l.x},0) ${GLYPH}`} d={l.d} fill={fill} />
      ))}
    </>
  );
}

/** Centre of the "I" in logo units: the reveal zooms into it. */
export const I_CENTER = (() => {
  const i = WORDMARK_LETTERS.find((l) => l.name === "I")!;
  return { x: i.x + i.width / 2, y: H / 2, width: i.width, height: H };
})();
