import { PROJECTS, poster, still, type Project } from "@/content/projects";

// Work-page extras on top of content/projects.ts: a key colour per project (sampled from its own footage,
// see research/work-page/WORK-RESEARCH.md §2.3), the film runtime (films-audit.md) and the format label.
export type WorkMeta = {
  key: string; // hex, tints the ambient light behind the roster
  runtime?: string; // full film length, "m:ss"
};

export const WORK_META: Record<string, WorkMeta> = {
  "audi-rs5-estate": { key: "#d2381f", runtime: "0:32" },
  "mclaren-endurance": { key: "#ff7a1a", runtime: "1:11" },
  "zeekr-launch": { key: "#c08454" },
  "audi-f1": { key: "#e3202c", runtime: "0:50" },
  cupra: { key: "#c9c23e", runtime: "0:56" },
  "audi-rebirth": { key: "#2fc8dc", runtime: "1:08" },
  mcmurtry: { key: "#3f8f78" },
  alpine: { key: "#7486e8", runtime: "0:15" },
  nascar: { key: "#e8a443", runtime: "2:09" },
};

export const aspectLabel = (a: number) => {
  if (Math.abs(a - 16 / 9) < 0.01) return "16:9";
  if (Math.abs(a - 5 / 2) < 0.01) return "5:2";
  if (Math.abs(a - 8 / 5) < 0.01) return "8:5";
  return `${a.toFixed(2)}:1`;
};

/** "CGI film · 16:9" style label for the roster rows. */
export const rowLabel = (p: Project) => `${p.kind} · ${aspectLabel(p.aspect)}`;

/** "16:9 · 0:32" for films, "16:9 · 7 stills" for stills. */
export const formatLabel = (p: Project) => {
  const m = WORK_META[p.slug];
  const tail = p.type === "film" ? m?.runtime : p.stills ? `${p.stills} stills` : undefined;
  return tail ? `${aspectLabel(p.aspect)} · ${tail}` : aspectLabel(p.aspect);
};

/** The image shown before a loop plays (and the stills projects' only picture). */
export const stagePoster = (p: Project) => (p.type === "film" ? poster(p.slug) : still(p.slug, 1));

export const indexOf = (slug: string) => PROJECTS.findIndex((p) => p.slug === slug);
export const pad2 = (n: number) => String(n).padStart(2, "0");
