import type { Metadata } from "next";
import WorkGrid from "@/components/work/WorkGrid";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

export const metadata: Metadata = {
  title: "Work",
  description: "Selected work: CGI films and stills for McLaren, Audi, Zeekr, CUPRA, McMurtry, Alpine and NASCAR.",
  alternates: { canonical: "/work" },
};

// Work index: a simple picture grid of every project (client feedback 2026-10-24), then the site footer.
// The footer's Showreel link opens the reel player, so the player is mounted here too.
// (The earlier PAINTWORK roster, components/work/WorkIndex.tsx, is kept unused for now.)
export default function WorkPage() {
  return (
    <>
      {/* The site's moving contour lines, same as the home page (Hammad: on every page). */}
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <WorkGrid />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
