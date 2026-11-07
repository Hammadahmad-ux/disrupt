import "server-only";
import type { CaseData } from "@/content/cases";
import table from "./lqip.json";

// Blurred stand-ins for the case pictures (lqip.json, built by build-lqip.mjs). Server only: CaseShell
// attaches each page's own entries to its CaseData, so the whole table never ships in the client bundle.
const IMAGES = (table as unknown as { images: Record<string, string> }).images;

/**
 * The project's data with its stand-ins attached (CaseData.lqip, read with lqipOf from content/cases).
 * `only`: keep just these keys (e.g. ["poster", "stills/01"] for a neighbour that only shows its cover).
 */
export function withLqip(d: CaseData, only?: string[]): CaseData {
  const pre = `${d.slug}/`;
  const lqip: Record<string, string> = {};
  for (const [k, v] of Object.entries(IMAGES)) {
    if (!k.startsWith(pre)) continue;
    const key = k.slice(pre.length);
    if (!only || only.includes(key)) lqip[key] = v;
  }
  return { ...d, lqip };
}
