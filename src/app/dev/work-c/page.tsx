import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Lineup from "@/components/work-concepts/c/Lineup";

export const metadata: Metadata = {
  title: "Work (concept C: Lineup)",
  robots: { index: false },
};

// Dev-only preview of work-page concept C ("LINEUP": a car park of the projects). Hidden in production builds.
export default function Page() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Lineup />;
}
