import type Hls from "hls.js";
import { MEDIA } from "@/content/projects";

// Adaptive streaming for the long films (built by scripts/media/build-hls.mjs into media/hls/<name>/).
// Safari (and any browser that plays HLS itself) gets the playlist as the video's src; everywhere else hls.js,
// loaded only when a film needs it. Playback starts on a rung chosen for a fast connection (the 720p rung is
// listed first in each master for Safari) and steps down if the connection is slow, never above the player's size. If streaming fails, the video falls back to the plain MP4 (the top rung's own file).
// hls.js downloads nothing but the playlists until the video plays or its preload is "auto".

export const hlsSrc = (name: string) => `${MEDIA}/hls/${name}/master.m3u8`;

export type Stream = { ready: Promise<void>; destroy: () => void };

const live = new Set<() => void>();

// Stops every stream at once (SiteMenu calls it before a page change, so nothing keeps downloading).
export const stopAllStreams = () => live.forEach((stop) => stop());

export function attachStream(video: HTMLVideoElement, name: string, fallback: string): Stream {
  let hls: Hls | null = null;
  let dead = false;
  let resolve = () => {};
  const ready = new Promise<void>((r) => (resolve = r));

  const useFallback = () => {
    hls?.destroy();
    hls = null;
    if (dead) return;
    const wasPlaying = !video.paused;
    video.removeEventListener("error", useFallback);
    video.src = fallback;
    if (wasPlaying) video.play().catch(() => undefined);
    resolve();
  };
  const start = () => hls?.startLoad();

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.addEventListener("error", useFallback);
    video.src = hlsSrc(name);
    resolve();
  } else {
    import("hls.js")
      .then(({ default: Hls }) => {
        if (dead) return;
        if (!Hls.isSupported()) return useFallback();
        // Start on the biggest rung that fits the player (360p looked blurry); ABR steps down if the connection is slow.
        // Every ladder is 640 / 1280 / 1920 wide, except NASCAR (no 1920 rung).
        const px = Math.max(video.clientWidth, 640) * Math.min(window.devicePixelRatio || 1, 2);
        const startLevel = Math.min(px >= 1900 ? 2 : px >= 1270 ? 1 : 0, name === "nascar" ? 1 : 2);
        hls = new Hls({ startLevel, capLevelToPlayerSize: true, autoStartLoad: false });
        hls.on(Hls.Events.ERROR, (_, d) => d.fatal && useFallback());
        hls.on(Hls.Events.MEDIA_ATTACHED, () => resolve());
        hls.loadSource(hlsSrc(name));
        hls.attachMedia(video);
        if (video.preload === "auto" || !video.paused) start();
        else video.addEventListener("play", start, { once: true });
      })
      .catch(useFallback);
  }

  const destroy = () => {
    dead = true;
    live.delete(destroy);
    video.removeEventListener("error", useFallback);
    video.removeEventListener("play", start);
    hls?.destroy();
    hls = null;
  };
  live.add(destroy);
  return { ready, destroy };
}
