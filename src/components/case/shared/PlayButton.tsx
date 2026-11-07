"use client";

import type { CaseData } from "@/content/cases";
import { openFilm, warmFilm } from "./film-player-store";
import styles from "./case.module.css";

type Props = {
  data: CaseData;
  /** Start the film here (seconds), e.g. from a shot card. */
  at?: number;
  label?: string;
  /** "glass": the hero pill. "line": a quiet text button for the page body. */
  variant?: "glass" | "line";
  className?: string;
};

/** "▷ Play film 0:32": opens the lights-down player (LightsDownPlayer) with sound. Films only. */
export function PlayButton({ data, at, label = "Play film", variant = "glass", className }: Props) {
  if (!data.film) return null;
  return (
    <button
      type="button"
      className={`${variant === "glass" ? styles.playGlass : styles.playLine} ${className ?? ""}`}
      onClick={() => openFilm({ at })}
      onPointerEnter={warmFilm}
      onFocus={warmFilm}
      aria-haspopup="dialog"
    >
      <span className={styles.playIcon} aria-hidden="true" />
      <span>{label}</span>
      <span className={styles.playDur}>{data.film.runtime}</span>
    </button>
  );
}
