"use client";

/**
 * STILLS TEMPLATE BODY (Zeekr, McMurtry). PAINTWORK "Case template, stills":
 *   hero strobe (StillsHeroLayer → Strobe) → SpecSheet + intro → the sections in data.layout.order:
 *     "strip"  LightBoxStrip   every still at native aspect on a draggable light box, "03 / 07" counter
 *     "loupe"  HoldToInspect   one still full bleed, press and hold for a glass loupe on the 3200 px tile
 *     "grid"   StillsGrid      the rest of the set in a 1/2/1 rhythm with captions, primer-to-paint reveal
 *   → Credits → NextProject (CaseShell).
 * Pages differ by layout.order / strobe / loupe / accent / surface (content/cases.ts) and by the knobs in
 * stills-variants.ts (grid look, spec flip, where the strip opens). If the key still is still 01 (already
 * on the film stage when the visitor lands), the strobe runs as the first body section instead.
 * All visible copy beyond the facts is draft: // CONFIRM WITH ADIL.
 */
import type { CaseBodyProps } from "../shared/types";
import { SpecSheet } from "../shared/SpecSheet";
import { HoldToInspect } from "./HoldToInspect";
import { LightBoxStrip } from "./LightBoxStrip";
import { StillsGrid } from "./StillsGrid";
import { Strobe } from "./Strobe";
import { strobeFor, strobeInHero, variantFor } from "./stills-variants";

export default function StillsBody({ data }: CaseBodyProps) {
  const v = variantFor(data);
  const strobeHere = strobeFor(data).length > 0 && !strobeInHero(data);
  return (
    <>
      {strobeHere ? <Strobe data={data} mode="section" /> : null}
      <SpecSheet data={data} flip={v.flipSpec} showPlay={false} />
      {data.layout.order.map((sec) => {
        if (sec === "strip") return <LightBoxStrip key={sec} data={data} />;
        if (sec === "loupe") return <HoldToInspect key={sec} data={data} />;
        if (sec === "grid") return <StillsGrid key={sec} data={data} />;
        return null;
      })}
    </>
  );
}
