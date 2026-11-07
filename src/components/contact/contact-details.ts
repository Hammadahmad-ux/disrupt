// Studio contact details, shown in the contact section and the footer.
// Email and phone from the client (2026-10-21). CONFIRM WITH ADIL: location and social links.
export const CONTACT = {
  email: "contact@disruptstudio.co.uk",
  phone: "+44 7957 757451",
  phoneHref: "+447957757451",
  location: "United Kingdom",
  social: [
    { label: "Instagram", href: "#" },
    { label: "Vimeo", href: "#" },
  ],
} as const;

// Only links with a real address are shown (no dead "#" links); add the URLs above and they appear everywhere.
export const SOCIAL = CONTACT.social.filter((s) => s.href.startsWith("http"));
