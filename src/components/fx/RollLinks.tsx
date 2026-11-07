"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Site-wide hover (after the Lando reference): each letter of a link or button label rolls up in a
// quick wave and a copy rolls in from below. The real text node is kept (moved into a visually
// hidden span for screen readers); the rolling letters are an aria-hidden copy. Opt out with data-no-roll on the element or an ancestor.
export default function RollLinks() {
  const pathname = usePathname();
  useEffect(() => {
    const wrap = () => {
      document.querySelectorAll<HTMLElement>("a, button").forEach((el) => {
        if (el.dataset.roll || el.closest("[data-no-roll]")) return;
        // Skip media cards and long text links; roll short labels only.
        if (el.querySelector("img, video, picture, canvas") || (el.textContent || "").trim().length > 40) return;
        const texts: Text[] = [];
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) =>
            n.textContent!.trim() && !n.parentElement!.closest('[aria-hidden="true"], .sr-only, .roll, .roll-src, svg')
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT,
        });
        while (walker.nextNode()) texts.push(walker.currentNode as Text);
        if (!texts.length) return;
        el.dataset.roll = "";
        texts.forEach((t) => {
          // Screen readers keep the real text node; the letters are a visual copy that rolls.
          const src = document.createElement("span");
          src.className = "roll-src";
          const vis = document.createElement("span");
          vis.className = "roll";
          vis.setAttribute("aria-hidden", "true");
          [...t.textContent!].forEach((ch, i) => {
            const c = document.createElement("span");
            c.textContent = ch === " " ? "\u00a0" : ch;
            c.style.setProperty("--i", String(i));
            vis.appendChild(c);
          });
          const parent = t.parentNode!;
          parent.insertBefore(vis, t);
          parent.insertBefore(src, t);
          src.appendChild(t);
        });
      });
    };
    const id = requestAnimationFrame(wrap);
    const late = window.setTimeout(wrap, 1500); // sections that render client-side after mount
    return () => {
      cancelAnimationFrame(id);
      window.clearTimeout(late);
    };
  }, [pathname]);

  return null;
}
