import type { MetadataRoute } from "next";
import { isOn } from "@/content/site";
import { CASES } from "@/content/cases";
import { SITE_URL } from "@/content/seo";

// Only pages that are on (content/site.ts). /dev/* is never listed.
export default function sitemap(): MetadataRoute.Sitemap {
  const pages = [
    "/",
    "/work",
    ...(["services", "about", "contact", "privacy", "terms"] as const).filter((p) => isOn(p)).map((p) => `/${p}`),
    ...(isOn("cases") ? CASES.map((c) => `/work/${c.slug}`) : []),
  ];
  return pages.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}` }));
}
