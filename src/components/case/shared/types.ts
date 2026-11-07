import type { CaseData } from "@/content/cases";

/**
 * Props every case template receives (components/case/film/FilmBody.tsx, components/case/stills/StillsBody.tsx
 * and their optional hero layers). All plain data, so a server component can pass it.
 *  - data: this project (content/cases.ts)
 *  - prev / next: the neighbouring projects in PROJECTS order (for "more from", tints, preloads)
 */
export type CaseBodyProps = {
  data: CaseData;
  prev: CaseData;
  next: CaseData;
};
