"use client";

import { useEffect, useRef, useState } from "react";
import { attachStream, type Stream } from "@/components/fx/hls";
import s from "./simple.module.css";

// The project's film, playing by itself (muted, looping) whenever it is on screen. "Sound on" restarts it
// with sound and the browser's own controls. Reduced motion: it waits for the visitor to press play.
// It streams (HLS, media/hls/<stream>/): starts at low quality and steps up; `src` is the plain MP4 fallback.
export default function CaseFilm({
  src,
  stream: name,
  poster,
  lqip,
  width,
  height,
  title,
  runtime,
}: {
  src: string;
  stream: string;
  poster: string;
  lqip?: string;
  width: number;
  height: number;
  title: string;
  runtime: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<Stream | null>(null);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    const v = ref.current!;
    const stream = (streamRef.current = attachStream(v, name, src));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return stream.destroy;
    let visible = false;
    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible) stream.ready.then(() => (visible ? v.play() : undefined)).catch(() => undefined);
        else v.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => {
      io.disconnect();
      stream.destroy();
    };
  }, [name, src]);

  const soundOn = () => {
    const v = ref.current!;
    v.muted = false;
    v.loop = false;
    v.controls = true;
    v.currentTime = 0;
    streamRef.current?.ready.then(() => v.play()).catch(() => undefined);
    setSound(true);
  };

  return (
    <section className={s.film} aria-label={`${title} film`}>
      <div className={s.filmFrame} style={{ aspectRatio: `${width} / ${height}` }}>
        <video
          ref={ref}
          poster={poster}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`${title}, film, ${runtime}`}
          style={lqip ? { backgroundImage: `url("${lqip}")` } : undefined}
        />
        {!sound && (
          <button type="button" className={s.sound} onClick={soundOn}>
            <span className={s.play} aria-hidden="true" />
            Watch with sound <span className={s.time}>{runtime}</span>
          </button>
        )}
      </div>
    </section>
  );
}
