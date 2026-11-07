import { notFound } from "next/navigation";
import { isOn } from "@/content/site";
import type { Metadata } from "next";
import AboutPage from "@/components/pages/about/AboutPage";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

// CONFIRM WITH ADIL: page title and description.
export const metadata: Metadata = {
  title: "About",
  description:
    "DISRUPT is a UK-based creative studio specialising in high-end automotive CGI, films and still imagery.",
  alternates: { canonical: "/about" },
};

// About: the studio's statement, who it is, how it works and the brands it has worked with, then the footer.
// The footer's Showreel link opens the reel player, so the player is mounted here too.
export default function About() {
  if (!isOn("about")) notFound();
  return (
    <>
      {/* The site's moving contour lines, same as every page (Hammad, 2026-10-24). */}
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <AboutPage />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
