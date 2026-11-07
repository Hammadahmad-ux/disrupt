import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CASES, getCase } from "@/content/cases";
import { isOn } from "@/content/site";
import SimpleCase from "@/components/case/simple/SimpleCase";
import AliveBackground from "@/components/fx/AliveBackground";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";

type Props = { params: Promise<{ slug: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return CASES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getCase(slug);
  if (!c) return { title: "Work" };
  const image = { url: `/og/${c.slug}.jpg`, width: 1200, height: 630, alt: `${c.title}, ${c.kind} by DISRUPT` };
  return {
    title: c.title,
    description: `${c.title}: ${c.kind} by DISRUPT. ${c.blurb}`,
    alternates: { canonical: `/work/${c.slug}` },
    // Share picture: the project's Work-grid picture + wordmark (public/og, scripts/media/build-seo-images.mjs).
    openGraph: { siteName: "DISRUPT", type: "website", locale: "en_GB", images: [image] },
    // Case pages stay out of search while they are unlinked on the live site (content/site.ts).
    ...(!isOn("cases") && { robots: { index: false } }),
  };
}

// A case study, kept simple (client, 2026-10-24): title + intro, the film playing by itself, every picture in one
// grid, credits. Same moving contour background and footer as the rest of the site. (The earlier showpiece
// template, components/case/CaseShell.tsx, is kept unused.)
export default async function CasePage({ params }: Props) {
  const { slug } = await params;
  const data = getCase(slug);
  if (!data) notFound();
  return (
    <>
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <SimpleCase data={data} />
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
