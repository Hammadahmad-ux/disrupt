import type { StaticImageData } from "next/image";
import { MEDIA, PROJECTS, loopSources, still, type Project } from "@/content/projects";
import alpine from "@/components/brands/logos/alpine.webp";
import mclaren from "@/components/brands/logos/mclaren.webp";
import mcmurtry from "@/components/brands/logos/mcmurtry.webp";
import nascar from "@/components/brands/logos/nascar.webp";
import zeekr from "@/components/brands/logos/zeekr.webp";

// SHOWROOM (work concept A): one picture per project where the car's shape reads clearly, plus the
// car's own name, because people find a car by how it looks, not by the campaign title.
// Pictures: web/public/media/work-index/a/<slug>.{avif,webp} (1600x900), -960.webp, -thumb.webp (480).
// Car names come from the badges and shots listed in research/content/films-audit.md.
// CONFIRM WITH ADIL: car names, and whether the CUPRA (Marvel livery) and NASCAR frames may be shown.

export type ShowroomCar = Project & {
  brand: string;
  car: string; // the car itself, as people would say it
  logo?: StaticImageData; // client-supplied white brand mark (none for Audi and CUPRA: brand set as text)
  key: string; // ambient colour sampled from the picture
  image: string; // 1600w webp (texture)
  imageSm: string; // 960w webp (texture on small screens)
  avif: string; // 1600w avif (fallback <picture>)
  thumb: string; // 480w webp (filmstrip)
  hover: { kind: "loop"; sources: { src: string; type: string }[] } | { kind: "stills"; srcs: string[] };
};

const EXTRA: Record<string, { brand: string; car: string; logo?: StaticImageData; key: string }> = {
  "audi-rs5-estate": { brand: "Audi", car: "RS 5 Avant", key: "#d2381f" },
  "mclaren-endurance": { brand: "McLaren", car: "MCL-HY hypercar", logo: mclaren, key: "#ff7a1a" },
  "zeekr-launch": { brand: "Zeekr", car: "9X SUV", logo: zeekr, key: "#c96a35" },
  "audi-f1": { brand: "Audi", car: "Formula 1 car", key: "#e3202c" },
  cupra: { brand: "CUPRA", car: "Formula E car", key: "#b9c23e" },
  "audi-rebirth": { brand: "Audi", car: "RS e-tron GT", key: "#9c8f74" },
  mcmurtry: { brand: "McMurtry", car: "Spéirling Pure", logo: mcmurtry, key: "#3f8f78" },
  alpine: { brand: "Alpine", car: "A390", logo: alpine, key: "#6a5cf0" },
  nascar: { brand: "NASCAR", car: "Ford Mustang", logo: nascar, key: "#e8a443" },
};

const base = (slug: string) => `${MEDIA}/work-index/a/${slug}`;

export const CARS: ShowroomCar[] = PROJECTS.map((p) => {
  const x = EXTRA[p.slug];
  const b = base(p.slug);
  return {
    ...p,
    ...x,
    image: `${b}.webp`,
    imageSm: `${b}-960.webp`,
    avif: `${b}.avif`,
    thumb: `${b}-thumb.webp`,
    hover:
      p.type === "film"
        ? { kind: "loop", sources: loopSources(p.slug) }
        : { kind: "stills", srcs: Array.from({ length: p.stills ?? 1 }, (_, i) => still(p.slug, i + 1)) },
  };
});

export const pad2 = (n: number) => String(n).padStart(2, "0");
