"use client";

import { useRef } from "react";
import ContourField from "@/components/studio/ContourField";
import c from "./case.module.css";

type RGB = [number, number, number];

// The site's moving contour lines behind the case body. The body has to stay opaque (the film stage
// plays behind the hero), so the lines are drawn inside it: a sticky viewport-sized canvas under the copy.
const SURFACES: Record<"ink" | "ink-2", { paper: RGB; line: RGB }> = {
  ink: { paper: [5 / 255, 5 / 255, 6 / 255], line: [25 / 255, 25 / 255, 29 / 255] },
  "ink-2": { paper: [13 / 255, 13 / 255, 16 / 255], line: [31 / 255, 31 / 255, 36 / 255] },
};

export default function CaseBackdrop({ surface }: { surface: "ink" | "ink-2" }) {
  const ref = useRef<HTMLDivElement>(null);
  const s = SURFACES[surface] ?? SURFACES.ink;
  return (
    <div ref={ref} className={c.backdrop} aria-hidden="true">
      <ContourField sheetRef={ref} paper={s.paper} line={s.line} />
    </div>
  );
}
