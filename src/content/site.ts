// Site-wide switches: which pages are on the live site.

/**
 * One switch per page (Hammad, 2026-10-27): he releases pages to the live site one at a time, when the client
 * asks. Localhost (dev server) always shows every page. Flip a page to true, build and deploy to publish it.
 * - services / about / contact: off = route 404s, menu/footer/"Let's talk" point to the home page sections.
 * - cases: the /work/<slug> case-study pages. Off = the Work grid and home project cards show the work
 *   without links (the pages still open by direct URL).
 * - privacy / terms: off = route 404s and the footer hides the link.
 */
const LIVE = {
  services: true,
  about: true,
  contact: true,
  cases: true,
  privacy: true,
  terms: true,
};

export const isOn = (page: keyof typeof LIVE) => LIVE[page] || process.env.NODE_ENV !== "production";

export const CASE_PAGES_LINKED = isOn("cases");
