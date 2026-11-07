"use client";

import { useEffect, useRef } from "react";
import { getLenis } from "@/components/providers/lenis-ref";
import { attachStream, type Stream } from "@/components/fx/hls";
import { MEDIA } from "@/content/projects";
import { useReelPlayer } from "./reel-player-store";
import styles from "./reel-player.module.css";

// Full-screen showreel with sound. Esc or the close button exits; focus returns to the opener.
// Music clearance for the reel's audio must be confirmed with Adil before launch.
// Loading: nothing until a "Showreel" control is hovered or focused (warm): then the poster (the hero's own
// AVIF poster, already in the cache on the home page) and the stream's playlists, so it opens on a picture.
// It streams (HLS): starts at low quality and steps up; reel-full.mp4 is the fallback.
export default function ReelPlayer() {
  const open = useReelPlayer((s) => s.open);
  const warm = useReelPlayer((s) => s.warm);
  const hide = useReelPlayer((s) => s.hide);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const opener = useRef<Element | null>(null);
  const stream = useRef<Stream | null>(null);

  useEffect(() => {
    if (!warm) return;
    const s = (stream.current = attachStream(videoRef.current!, "reel", `${MEDIA}/reel-full.mp4`));
    return () => {
      s.destroy();
      stream.current = null;
    };
  }, [warm]);

  useEffect(() => {
    const dialog = dialogRef.current!;
    const video = videoRef.current!;
    if (open) {
      opener.current = document.activeElement;
      dialog.showModal();
      getLenis()?.stop();
      video.currentTime = 0;
      video.muted = false;
      const play = () => video.play();
      (stream.current ? stream.current.ready.then(play) : play()).catch(() => {
        video.muted = true;
        video.play().catch(() => undefined);
      });
    } else if (dialog.open) {
      video.pause();
      dialog.close();
      getLenis()?.start();
      (opener.current as HTMLElement | null)?.focus?.();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-label="DISRUPT showreel"
      onCancel={(e) => {
        e.preventDefault();
        hide();
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) hide();
      }}
    >
      <video
        ref={videoRef}
        className={styles.video}
        controls
        playsInline
        preload={warm ? "metadata" : "none"}
        poster={warm ? `${MEDIA}/hero-poster.avif` : undefined}
      />
      <button type="button" className={styles.close} onClick={hide} aria-label="Close showreel">
        <span />
        <span />
      </button>
    </dialog>
  );
}
