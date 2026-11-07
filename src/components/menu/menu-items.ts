import type { ServiceMediaSpec } from "@/components/services/ServiceMedia";
import { MEDIA } from "@/content/projects";
import { isOn } from "@/content/site";

export type MenuItem = {
  label: string;
  href: string;
  /** Short line shown with the preview. */
  note: string;
  /** Muted loop or still that plays in the preview screen while the link is hovered. */
  media: ServiceMediaSpec;
  /** Who the preview shot is from (brand names need Adil's OK before launch, same as the rest of the site). */
  credit: string;
};

export const MENU_ITEMS: MenuItem[] = [
  { label: "Home", href: "/", note: "Showreel", media: { kind: "video", slug: "cupra" }, credit: "CUPRA · CGI film" },
  { label: "Work", href: "/work", note: "09 projects", media: { kind: "video", slug: "mclaren-endurance" }, credit: "McLaren Endurance · CGI film" },
  { label: "Services", href: isOn("services") ? "/services" : "/#services", note: "CGI · VFX · Stills", media: { kind: "video", slug: "audi-rs5-estate" }, credit: "Audi RS5 Estate · CGI film" },
  { label: "About", href: isOn("about") ? "/about" : "/#studio", note: "The studio", media: { kind: "image", slug: "zeekr-launch", n: 2 }, credit: "Zeekr · CGI stills" },
  { label: "Contact", href: isOn("contact") ? "/contact" : "/#contact", note: "Start a project", media: { kind: "video", slug: "nascar" }, credit: "NASCAR · CGI + live action" },
];

/**
 * Small image for the soft light the preview throws on the panel: the same AVIF files the preview screen
 * (ServiceMedia) and the home page cards load, so the glow costs no extra download.
 */
export const glowSrc = (m: ServiceMediaSpec) =>
  m.kind === "video" ? `${MEDIA}/work/${m.slug}/poster.avif` : `${MEDIA}/work/${m.slug}/stills/${String(m.n).padStart(2, "0")}-800.avif`;

/** Which menu item is the page we are on (sections of the home page never count as "here"). */
export function currentIndex(pathname: string) {
  if (pathname === "/") return 0;
  if (pathname === "/work" || pathname.startsWith("/work/")) return 1;
  if (pathname === "/services") return 2;
  if (pathname === "/about") return 3;
  if (pathname === "/contact") return 4;
  return -1;
}
