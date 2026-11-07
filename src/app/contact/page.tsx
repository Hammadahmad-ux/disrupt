import { notFound } from "next/navigation";
import { isOn } from "@/content/site";
import type { Metadata } from "next";
import ContactPage from "@/components/pages/contact/ContactPage";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

export const metadata: Metadata = {
  title: "Contact",
  description: "Got a cool idea? Tell us more about it and let's bring it to life. Email, call or send DISRUPT a message.",
  alternates: { canonical: "/contact" },
};

// Contact page: the client's question, direct details, the enquiry form and what happens next, then the footer.
// The footer's Showreel link opens the reel player, so the player is mounted here too.
export default function Contact() {
  if (!isOn("contact")) notFound();
  return (
    <>
      {/* The site's moving contour lines, same as every page (Hammad, 2026-10-24). */}
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <ContactPage />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
