// What is on screen in the 39 s showreel, from research/hero/reel-credits.json (cut times from
// research/content/films-audit.md). Shots from projects we have no film for read "Selected work".
// Brand names need Adil's OK before launch; never name Marvel/Thunderbolts, the actor or sponsors.
export type ReelCredit = { from: number; to: number; title: string; kind?: string; slug?: string };

export const REEL_DURATION = 39;

export const REEL_CREDITS: ReelCredit[] = [
  { from: 0, to: 6.2, title: "Cupra", kind: "CGI film", slug: "cupra" },
  { from: 6.2, to: 9.3, title: "Audi Rebirth", kind: "CGI film", slug: "audi-rebirth" },
  { from: 9.3, to: 11.8, title: "Audi RS5 Estate", kind: "CGI film", slug: "audi-rs5-estate" },
  { from: 11.8, to: 12.9, title: "Audi F1", kind: "CGI film", slug: "audi-f1" },
  { from: 12.9, to: 17.7, title: "Selected work" },
  { from: 17.7, to: 20.4, title: "Audi RS5 Estate", kind: "CGI film", slug: "audi-rs5-estate" },
  { from: 20.4, to: 22.1, title: "Audi Rebirth", kind: "CGI film", slug: "audi-rebirth" },
  { from: 22.1, to: 23.4, title: "McLaren Endurance", kind: "CGI film", slug: "mclaren-endurance" },
  { from: 23.4, to: 31.0, title: "Selected work" },
  { from: 31.0, to: 39.1, title: "NASCAR", kind: "CGI + live action", slug: "nascar" },
];

export const creditAt = (t: number) => REEL_CREDITS.find((c) => t >= c.from && t < c.to) ?? REEL_CREDITS[0];
