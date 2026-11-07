// Media are pre-built AVIF/WebP sets (scripts/media/build-case-media.mjs), so a plain <picture>, not next/image.
import type { CSSProperties } from "react";

type Props = {
  /** From frameSet() / stillSet() in content/cases.ts. */
  set: { avif: string; webp: string; src: string };
  w: number;
  h: number;
  alt: string;
  /** Layout width hint, e.g. "(max-width: 760px) 100vw, 58vw". */
  sizes?: string;
  className?: string;
  imgClassName?: string;
  style?: CSSProperties;
  /** true for the first, above-the-fold image only. */
  priority?: boolean;
  /** Blurred stand-in (data URI, lqipOf in content/cases): painted under the picture until it arrives. */
  lqip?: string;
};

/**
 * A pre-built frame or still as <picture> (AVIF, WebP fallback), lazy by default. With `lqip` the <img> carries
 * its blurred stand-in as a background (same cover crop), so the box shows the picture, soft, from the first
 * paint and the real file simply lands on top of it. Sections that move pictures in sideways or by transform
 * switch their lazy images to eager a little before they arrive (useEagerNear, shared/preload.ts).
 */
export function Picture({ set, w, h, alt, sizes = "100vw", className, imgClassName, style, priority = false, lqip }: Props) {
  return (
    <picture className={className} style={style}>
      <source type="image/avif" srcSet={set.avif} sizes={sizes} />
      <img
        className={imgClassName}
        src={set.src}
        srcSet={set.webp}
        sizes={sizes}
        width={w}
        height={h}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={priority ? "high" : undefined}
        style={lqip ? { backgroundImage: `url("${lqip}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
    </picture>
  );
}
