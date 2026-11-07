import { WORDMARK_HEIGHT as H, WORDMARK_LETTERS, WORDMARK_WIDTH as W } from "@/components/intro/wordmark-paths";

const GLYPH = `translate(0,${H}) scale(0.1,-0.1)`;

/** The DISRUPT wordmark as inline SVG (fills with currentColor). */
export function Logo({ className, title = "DISRUPT" }: { className?: string; title?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} fill="currentColor">
      {WORDMARK_LETTERS.map((l) => (
        <path key={l.name} transform={`translate(${l.x},0) ${GLYPH}`} d={l.d} />
      ))}
    </svg>
  );
}

/** The hairpin "D" from the wordmark, used as the monogram. */
export function Monogram({ className }: { className?: string }) {
  const d = WORDMARK_LETTERS[0];
  return (
    <svg className={className} viewBox={`0 0 ${d.width} ${H}`} aria-hidden="true" fill="currentColor">
      <path transform={GLYPH} d={d.d} />
    </svg>
  );
}
