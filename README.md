# DISRUPT website

Portfolio site for DISRUPT, a UK automotive CGI studio. Next.js 16 (App Router), React 19, three.js / react-three-fiber, GSAP, Lenis. Node 20+ (24 recommended).

## Run locally

```bash
npm ci
cp .env.example .env.local   # fill in the values you need
npm run dev                  # http://localhost:3000
npm run lint && npm run build
npm start                    # serve the production build
```

## Environment variables

See `.env.example`.

- `NEXT_PUBLIC_SITE_URL`: the final public address (https://...). It is baked in at **build time** (canonical URLs, share images, sitemap), so set it before `npm run build`.
- Contact form email (`src/app/api/contact/route.ts`): either `RESEND_API_KEY` + `CONTACT_FROM` (the sending domain must be verified in Resend), or the SMTP mailbox values (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`). `CONTACT_TO` is where enquiries go. Without either, the form shows an error with the studio email.

## Deploying

The build uses `output: "standalone"`.

- On a normal Node host (or Vercel): set the env vars, then `npm ci && npm run build && npm start`.
- If the host cannot run the Next 16 build (old glibc; the shared Hostinger plan failed with `GLIBC_2.29 not found`), build on a Mac or Linux machine and upload the prebuilt package:

```bash
deploy/make-prebuilt-zip.sh https://your-final-address
```

This writes `~/Desktop/disrupt-prebuilt.zip` (standalone server + static files + public media). Upload it as a Node.js app; the start command is `npm start`. Rebuild with the final address whenever the domain changes.

## Things to know

- Media lives in `public/media` and is served in production at `/m/<content hash>/...` with a one-year immutable cache (see `next.config.ts`). Always build media URLs from `MEDIA` in `src/content/projects.ts`, never hard-code `/media`.
- Pages can be switched on or off in `src/content/site.ts` (`LIVE`, `isOn(page)`). All pages are on now.
- Page copy and contact details are in `src/content/` and `src/components/contact/contact-details.ts`. Social links with no real URL are hidden.
- Video is HLS (hero, showreel, case films) with an MP4 fallback.
- The repo is about 320 MB because the optimised media is included.
