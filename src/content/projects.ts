// Home page projects. Titles, kinds and copy are placeholders until Adil confirms names, rights and text
// (see research/hero/hero-copy.md and research/content/films-audit.md). Media is built by
// scripts/media/build-site-media.mjs into web/public/media/work/<slug>/.
// Production builds serve media from /m/<content hash>/ (cached for a year, see next.config.ts); dev uses /media.
export const MEDIA = process.env.NEXT_PUBLIC_MEDIA_URL ?? (process.env.MEDIA_VERSION ? `/m/${process.env.MEDIA_VERSION}` : "/media");

export type Project = {
  slug: string;
  title: string;
  kind: string; // what DISRUPT did
  type: "film" | "stills";
  blurb: string; // short line for cards; [CONFIRM WITH ADIL]
  aspect: number; // media width / height
  stills?: number; // number of stills in media/work/<slug>/stills
};

export const PROJECTS: Project[] = [
  { slug: "audi-rs5-estate", title: "Audi RS5 Estate", kind: "CGI film", type: "film", aspect: 16 / 9, blurb: "A red estate car, from studio light to cliff roads." },
  { slug: "mclaren-endurance", title: "McLaren Endurance", kind: "CGI stills + film", type: "film", aspect: 16 / 9, stills: 4, blurb: "MCL-HY launch campaign. Full CGI stills and film." },
  { slug: "zeekr-launch", title: "Zeekr", kind: "CGI stills", type: "stills", aspect: 16 / 9, stills: 7, blurb: "Pan-European launch campaign." },
  { slug: "audi-f1", title: "Audi F1", kind: "CGI film", type: "film", aspect: 16 / 9, blurb: "Team introduction." },
  { slug: "cupra", title: "CUPRA", kind: "CGI film", type: "film", aspect: 16 / 9, blurb: "Marvel x CUPRA collaboration livery reveal." },
  { slug: "audi-rebirth", title: "Audi Rebirth", kind: "CGI film", type: "film", aspect: 16 / 9, blurb: "Drones, a dark hangar and a car reborn." },
  { slug: "mcmurtry", title: "McMurtry", kind: "CGI stills", type: "stills", aspect: 8 / 5, stills: 5, blurb: "McMurtry Spéirling Pure launch imagery." },
  { slug: "alpine", title: "Alpine", kind: "CGI film", type: "film", aspect: 5 / 2, blurb: "A526 launch film." },
  { slug: "nascar", title: "NASCAR", kind: "CGI + live action", type: "film", aspect: 16 / 9, blurb: "Super Bowl Sunday commercial." },
];

export const loopSources = (slug: string) => [
  { src: `${MEDIA}/work/${slug}/loop.av1.mp4`, type: 'video/mp4; codecs="av01.0.05M.10"' },
  { src: `${MEDIA}/work/${slug}/loop.h264.mp4`, type: "video/mp4" },
];

export const poster = (slug: string) => `${MEDIA}/work/${slug}/poster.webp`;
export const still = (slug: string, n: number, w: 800 | 1600 = 1600) =>
  `${MEDIA}/work/${slug}/stills/${String(n).padStart(2, "0")}-${w}.webp`;

/** Cover image for any project: the loop poster for films, the first still otherwise. */
export const cover = (p: Project) => (p.type === "film" ? poster(p.slug) : still(p.slug, 1));
