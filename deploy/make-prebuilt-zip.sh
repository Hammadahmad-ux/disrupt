#!/bin/sh
# Builds the site on this Mac and zips the PREBUILT app for the Node.js host upload.
# Why: the host server (glibc 2.28) cannot run Next 16's build tool, so it must not build.
# Usage: deploy/make-prebuilt-zip.sh https://the-final-address   (NEXT_PUBLIC_SITE_URL is baked in at build time)
set -e
URL="${1:?usage: deploy/make-prebuilt-zip.sh https://site-address}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$HOME/Desktop/disrupt-prebuilt.zip"
TMP="$(mktemp -d)"
cd "$ROOT"
NEXT_PUBLIC_SITE_URL="$URL" npm run build
mkdir -p "$TMP/.next"
cp -R .next/standalone "$TMP/.next/standalone"
cp -R .next/static "$TMP/.next/static"
cp -R public "$TMP/public"
cat > "$TMP/package.json" <<'JSON'
{
  "name": "disrupt-site",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "node -e \"console.log('prebuilt: nothing to build')\"",
    "start": "node .next/standalone/server.js"
  },
  "dependencies": { "next": "16.4.2", "react": "19.3.1", "react-dom": "19.3.1" }
}
JSON
find "$TMP" -name ".DS_Store" -delete
rm -f "$OUT"
(cd "$TMP" && zip -qry "$OUT" .)
rm -rf "$TMP"
ls -lh "$OUT"
echo "Upload this zip as a Node.js app (start command: npm start)."
