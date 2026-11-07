import { INTRO_DONE_EVENT, useIntro } from "@/components/intro/intro-store";

// Small helpers for loading media ahead of need without getting in the way of what is on screen.

/** Data saver or a very slow connection: load only what is on screen, never ahead. */
export function frugal() {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!c && (c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? ""));
}

/**
 * Runs `fn` once the page has loaded, the intro is done and the browser is idle (plus `delay` ms), so
 * prefetching never competes with the first screen. Skipped on data saver / 2G unless `always` (for
 * loading that the design needs, only delayed). Returns a cancel function.
 */
export function afterSettle(fn: () => void, delay = 0, always = false): () => void {
  if (!always && frugal()) return () => {};
  let dead = false;
  let timer = 0;
  let idle = 0;
  const run = () => {
    if (dead) return;
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(() => !dead && fn(), { timeout: 3000 });
    else timer = window.setTimeout(() => !dead && fn(), 200);
  };
  const intro = () => {
    window.clearTimeout(timer);
    if (useIntro.getState().done) timer = window.setTimeout(run, delay);
    else {
      window.addEventListener(INTRO_DONE_EVENT, intro, { once: true });
      timer = window.setTimeout(() => (window.removeEventListener(INTRO_DONE_EVENT, intro), run()), 8000);
    }
  };
  if (document.readyState === "complete") intro();
  else window.addEventListener("load", intro, { once: true });
  return () => {
    dead = true;
    window.removeEventListener("load", intro);
    window.removeEventListener(INTRO_DONE_EVENT, intro);
    window.clearTimeout(timer);
    if (idle) window.cancelIdleCallback?.(idle);
  };
}
