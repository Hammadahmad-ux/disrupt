"use client";

/**
 * FILM TEMPLATE BODY (PAINTWORK "Case template, film").
 * Rendered by CaseShell between CaseHero and Credits, inside the opaque body (var(--surface)).
 *  1. SpecSheet: intro text box + spec list (flipped on pages whose shots sit on the right).
 *  2. The sections in data.layout.order, exactly as given (that order is what keeps pages apart):
 *     "shots"  → ShotsChapter: "In this shot", pinned viewer + shot cards (shot-viewer-gl.ts).
 *     "frames" → FramesRhythm: frames by layout.framesPreset (full / two-up / offset).
 *     "stills" → FilmStills: the stills strip (McLaren).
 * Per-page variation also comes from layout.shotsSide (viewer left/right), layout.accent (where the key
 * colour shows), layout.surface, and the film's own aspect (5:2 gets letterbox mattes).
 * Draft copy is marked // CONFIRM WITH ADIL in each section.
 */
import type { CaseBodyProps } from "../shared/types";
import { SpecSheet } from "../shared/SpecSheet";
import { ShotsChapter } from "./ShotsChapter";
import { FramesRhythm } from "./FramesRhythm";
import { FilmStills } from "./FilmStills";
import f from "./film.module.css";

export default function FilmBody({ data }: CaseBodyProps) {
  const { order, shotsSide } = data.layout;
  return (
    // Keyed by project: moving to the next case starts every section fresh.
    <div key={data.slug} className={f.body}>
      <SpecSheet data={data} flip={shotsSide === "right"} />
      {order.map((sec) => {
        if (sec === "shots" && data.film && data.shots.length) return <ShotsChapter key={sec} data={data} />;
        if (sec === "frames" && data.shots.length) return <FramesRhythm key={sec} data={data} />;
        if (sec === "stills" && data.stills.length) return <FilmStills key={sec} data={data} />;
        return null;
      })}
    </div>
  );
}
