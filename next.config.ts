import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

// Media cache key: a short hash of every file in public/media (names + contents, ~0.5 s for ~220 MB).
// Production media URLs carry it (/m/<hash>/..., see MEDIA in src/content/projects.ts), so browsers and the
// CDN may keep them for a year. Replace or add any media file and the next build gets a new hash, so every
// URL changes and visitors fetch the new files instead of a stale cached copy.
function mediaVersion(): string {
  if (process.env.MEDIA_VERSION) return process.env.MEDIA_VERSION; // already worked out (build workers)
  const root = path.join(import.meta.dirname, "public", "media");
  if (!existsSync(root)) return "";
  const hash = createHash("sha1");
  const walk = (dir: string) => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      if (e.name.startsWith(".")) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        hash.update(path.relative(root, p) + "\0");
        hash.update(readFileSync(p));
      }
    }
  };
  walk(root);
  return (process.env.MEDIA_VERSION = hash.digest("hex").slice(0, 10));
}

export default function config(phase: string): NextConfig {
  // Dev keeps plain /media URLs (always revalidated) so edited files show up on reload.
  const v = phase === PHASE_DEVELOPMENT_SERVER ? "" : mediaVersion();
  return {
    // Self-contained server so the site can move from Vercel to Adil's UK VPS unchanged.
    output: "standalone",
    reactCompiler: true,
    // Off for v1: with Cache Components, visited pages stay mounted (hidden) and would
    // keep decoding video and running GSAP. Revisit once every page cleans up on hide.
    cacheComponents: false,
    env: { MEDIA_VERSION: v },
    // /m/<hash>/<file> is served from public/media/<file>. Works on Vercel and on the standalone server.
    async rewrites() {
      return [{ source: "/m/:v/:path*", destination: "/media/:path*" }];
    },
    async headers() {
      return [
        // Versioned media never change under the same URL (see mediaVersion above).
        { source: "/m/:v/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
      ];
    },
    turbopack: {
      root: import.meta.dirname,
      rules: {
        // Import shaders as strings: import frag from "./shader.frag"
        "*.{glsl,vert,frag}": {
          type: "raw",
        },
      },
    },
  };
}
