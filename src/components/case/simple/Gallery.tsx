"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getLenis } from "@/components/providers/lenis-ref";
import { Picture } from "@/components/case/shared/Picture";
import { Chevron } from "@/components/work/Chevron";
import s from "./simple.module.css";

export type GalleryItem = {
  key: string;
  set: { avif: string; webp: string; src: string };
  /** Full-size file for the viewer. */
  full: string;
  w: number;
  h: number;
  alt: string;
  lqip?: string;
};

const SIZES = "(min-width: 1100px) 33vw, (min-width: 640px) 50vw, 100vw";

// Every picture from the project in one simple grid (columns, native aspect). A picture opens full size in a
// viewer: arrows / Esc / click outside to close.
export default function Gallery({ items, title }: { items: GalleryItem[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const show = (i: number) => (e: React.MouseEvent<HTMLButtonElement>) => {
    lastFocus.current = e.currentTarget;
    setOpen(i);
  };
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    const dlg = dialogRef.current!;
    if (open === null) {
      if (dlg.open) dlg.close();
      getLenis()?.start();
      lastFocus.current?.focus();
      return;
    }
    if (!dlg.open) dlg.showModal();
    getLenis()?.stop();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step]);

  const cur = open === null ? null : items[open];

  return (
    <section className={s.gallery} aria-label={`${title}: pictures`}>
      <ul className={s.grid}>
        {items.map((it, i) => (
          <li key={it.key} className={s.cell}>
            <button type="button" className={s.cellBtn} onClick={show(i)} aria-label={`Open picture ${i + 1} of ${items.length}`} data-no-roll>
              <Picture set={it.set} w={it.w} h={it.h} alt={it.alt} sizes={SIZES} priority={i < 3} lqip={it.lqip} imgClassName={s.cellImg} />
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className={s.viewer}
        aria-label={`${title}: picture viewer`}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
      >
        {cur ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-built full-size file */}
            <img
              key={cur.key}
              src={cur.full}
              alt={cur.alt}
              width={cur.w}
              height={cur.h}
              className={s.viewerImg}
              style={cur.lqip ? { backgroundImage: `url("${cur.lqip}")` } : undefined}
            />
            <p className={`t-label ${s.viewerCount}`}>
              {String((open ?? 0) + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </p>
            <button type="button" className={`${s.viewerBtn} ${s.viewerPrev}`} onClick={() => step(-1)} aria-label="Previous picture" data-no-roll>
              <Chevron back className={s.viewerChev} />
            </button>
            <button type="button" className={`${s.viewerBtn} ${s.viewerNext}`} onClick={() => step(1)} aria-label="Next picture" data-no-roll>
              <Chevron className={s.viewerChev} />
            </button>
            <button type="button" className={`t-label ${s.viewerClose}`} onClick={close}>
              Close <span aria-hidden="true">· Esc</span>
            </button>
          </>
        ) : null}
      </dialog>
    </section>
  );
}
