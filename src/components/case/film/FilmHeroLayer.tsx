"use client";

/**
 * FILM HERO LAYER: intentionally empty. On film cases the hero IS the work layout's film stage: the loop
 * the roster's fly-through lands on keeps playing untouched under CaseHero's title and "Play film".
 * Anything drawn here would sit over that shot, so the film template keeps its life in the body
 * (ShotsChapter, FramesRhythm, FilmStills). Kept so registry.ts can wire a layer later.
 */
import type { CaseBodyProps } from "../shared/types";

export default function FilmHeroLayer(_: CaseBodyProps) {
  void _;
  return null;
}
