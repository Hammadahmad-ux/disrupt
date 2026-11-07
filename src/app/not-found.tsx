import type { Metadata } from "next";
import Link from "next/link";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";
import s from "./not-found.module.css";

// 404: calm message over the moving contour lines, two ways back, then the footer (its Showreel link opens the reel player). The header comes from
// the root layout; Next adds noindex to this page by itself.
export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default function NotFound() {
  return (
    <>
      <AliveBackground />
      <main id="main" tabIndex={-1} className={s.page}>
        <p className={`t-label ${s.eyebrow}`}>Error · 404</p>
        <h1 className={s.title}>Wrong turn.</h1>
        <p className={s.sub}>This page does not exist, or it has moved. Let&apos;s get you back on the road.</p>
        <nav className={s.links} aria-label="Back to the site">
          <Link href="/" className={s.primary}>
            Home
          </Link>
          <Link href="/work" className={s.secondary}>
            See the work
          </Link>
        </nav>
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
