"use client";

/**
 * Stills hero layer: the studio strobe (Strobe.tsx, mode "hero"). Sits between the work layout's film stage
 * (which shows still 01 after the roster's fly-through) and the CaseHero title, and paints the title with
 * the key still. When the key still IS still 01 (already on the stage), the strobe moves into the body as
 * its first section instead (StillsBody).
 */
import type { CaseBodyProps } from "../shared/types";
import { Strobe } from "./Strobe";
import { strobeInHero } from "./stills-variants";

export default function StillsHeroLayer({ data }: CaseBodyProps) {
  if (!strobeInHero(data)) return null;
  return <Strobe data={data} mode="hero" />;
}
