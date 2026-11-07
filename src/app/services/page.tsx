import { notFound } from "next/navigation";
import { isOn } from "@/content/site";
import type { Metadata } from "next";
import ServicesPage from "@/components/pages/services/ServicesPage";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

// CONFIRM WITH ADIL: page title and description.
export const metadata: Metadata = {
  title: "Services",
  description: "CGI films, CGI stills and retouching, VFX and compositing, direction and production for car brands.",
  alternates: { canonical: "/services" },
};

// Services: four service rows, how we work, the full list and a call to action, then the site footer.
// The footer's Showreel link opens the reel player, so the player is mounted here too.
export default function Services() {
  if (!isOn("services")) notFound();
  return (
    <>
      {/* The site's moving contour lines, same as the home page (Hammad: on every page). */}
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <ServicesPage />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
