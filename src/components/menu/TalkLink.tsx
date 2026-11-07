"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import { useMenu } from "./menu-store";
import { isOn } from "@/content/site";

/**
 * The header's "Let's talk" link: opens the Contact page (SiteMenu runs the page change with its short wipe).
 */
export default function TalkLink({ className, children }: { className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    useMenu.getState().request(isOn("contact") ? "/contact" : "/#contact");
  };

  return (
    <Link href={isOn("contact") ? "/contact" : "/#contact"} className={className} onClick={onClick} scroll={false} data-cover="talk">
      {children}
    </Link>
  );
}
