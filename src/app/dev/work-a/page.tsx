import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Showroom from "@/components/work-concepts/a/Showroom";
import SiteFooter from "@/components/footer/SiteFooter";

export const metadata: Metadata = {
  title: "Work (concept A: Showroom)",
  robots: { index: false },
};

// Dev preview of work-page concept A, "SHOWROOM": the projects on a car turntable. Hidden in production.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main>
      <Showroom />
      <SiteFooter />
    </main>
  );
}
