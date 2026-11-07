"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Flips the header to dark ink while a light section ([data-header="light"]) sits under it, and hides
// it over the footer ([data-header="hide"]), which carries its own links and CTA.
// Watches only a thin strip at the top of the viewport, where the header lives.
export default function HeaderTone() {
  // Re-scan on every route change: each page brings its own light sections.
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    const under = new Set<Element>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) under.add(e.target);
          else under.delete(e.target);
        }
        const els = [...under];
        if (els.some((el) => el.getAttribute("data-header") === "hide")) root.dataset.headerTone = "hide";
        else if (els.length) root.dataset.headerTone = "dark";
        else delete root.dataset.headerTone;
      },
      { rootMargin: "0px 0px -92% 0px" },
    );
    document.querySelectorAll('[data-header="light"], [data-header="hide"]').forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      delete root.dataset.headerTone;
    };
  }, [pathname]);

  return null;
}
