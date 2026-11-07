import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PitWall from "@/components/work-concepts/b/PitWall";

export const metadata: Metadata = {
  title: "Work, concept B: Pit Wall",
  robots: { index: false, follow: false },
};

// Dev-only preview of Work page concept B (PIT WALL). Hidden in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main>
      <PitWall />
    </main>
  );
}
