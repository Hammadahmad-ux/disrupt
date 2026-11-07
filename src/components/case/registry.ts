import type { ComponentType } from "react";
import type { CaseData } from "@/content/cases";
import type { CaseBodyProps } from "./shared/types";
import FilmBody from "./film/FilmBody";
import FilmHeroLayer from "./film/FilmHeroLayer";
import StillsBody from "./stills/StillsBody";
import StillsHeroLayer from "./stills/StillsHeroLayer";

/**
 * Case templates by project type. CaseShell renders: CaseHero (+ HeroLayer) → Body → Credits → NextProject.
 * Body and HeroLayer receive CaseBodyProps ({ data, prev, next }).
 */
export type CaseTemplate = {
  Body: ComponentType<CaseBodyProps>;
  HeroLayer?: ComponentType<CaseBodyProps>;
};

export const TEMPLATES: Record<CaseData["type"], CaseTemplate> = {
  film: { Body: FilmBody, HeroLayer: FilmHeroLayer },
  stills: { Body: StillsBody, HeroLayer: StillsHeroLayer },
};
