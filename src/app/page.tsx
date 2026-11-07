import type { Metadata } from "next";
import HeroReel from "@/components/hero/HeroReel";
import BrandMarquee from "@/components/brands/BrandMarquee";
import DriveWork from "@/components/drive/DriveWork";
import StudioSection from "@/components/studio/StudioSection";
import ServicesSection from "@/components/services/ServicesSection";
import ContactSection from "@/components/contact/ContactSection";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";
import RacingLine from "@/components/fx/RacingLine";

// Title: the layout's default ("DISRUPT | Automotive CGI and VFX films").
export const metadata: Metadata = {
  description:
    "DISRUPT is an independent UK CGI and creative studio turning unconventional ideas into unforgettable visuals for car brands.",
  alternates: { canonical: "/" },
};

// Home page, top to bottom: showreel hero -> car brands -> selected work (the drive) -> showreel ->
// studio -> services -> contact. The alive background and racing line sit behind/through everything.
export default function Home() {
  return (
    <>
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <RacingLine />
        <HeroReel />
        <BrandMarquee />
        <DriveWork />
        <StudioSection />
        <ServicesSection />
        <ContactSection />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
