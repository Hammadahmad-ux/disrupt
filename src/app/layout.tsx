import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Geist_Mono, Zalando_Sans } from "next/font/google";
import IntroLoader from "@/components/intro/IntroLoader";
import SiteHeader from "@/components/header/SiteHeader";
import SmoothScroll from "@/components/providers/SmoothScroll";
import RollLinks from "@/components/fx/RollLinks";
import { CONTACT } from "@/components/contact/contact-details";
import { SITE_URL } from "@/content/seo";
import "./globals.css";

// Zalando Sans (OFL) has a width axis: expanded (wdth 125) for display type, normal (100) for text.
const sans = Zalando_Sans({ subsets: ["latin"], axes: ["wdth"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap", preload: false });

const DESCRIPTION = "DISRUPT is an independent UK studio making CGI films and stills for car brands.";

// Pages set their own title, description and canonical; the share image (opengraph-image.jpg) and icons
// (favicon.ico, icon.png, apple-icon.png) are files in this folder, built by scripts/media/build-seo-images.mjs.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "DISRUPT | Automotive CGI and VFX films", template: "%s | DISRUPT" },
  description: DESCRIPTION,
  applicationName: "DISRUPT",
  openGraph: { siteName: "DISRUPT", type: "website", locale: "en_GB" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#0c0c0f" };

// Organization facts already on the site (contact-details.ts); social links only once they are real URLs.
const orgJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "DISRUPT",
  url: SITE_URL,
  logo: `${SITE_URL}/brand/disrupt-wordmark.png`,
  description: DESCRIPTION,
  email: CONTACT.email,
  telephone: CONTACT.phone,
  address: { "@type": "PostalAddress", addressCountry: "GB" },
  sameAs: CONTACT.social.map((s) => s.href).filter((h) => h.startsWith("http")),
}).replace(/</g, "\\u003c");

// Runs before first paint: locks scroll during the intro and marks repeat visits (short intro).
const introFlags = `(function(){var d=document.documentElement;d.classList.add('intro-active');setTimeout(function(){d.classList.remove('intro-active')},9000);try{if(sessionStorage.getItem('disrupt:intro')==='1')d.classList.add('intro-repeat')}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} antialiased`} suppressHydrationWarning>
      <body>
        <Script id="intro-flags" strategy="beforeInteractive">
          {introFlags}
        </Script>
        <noscript>
          <style>{`[data-intro]{display:none!important}html.intro-active{overflow:auto!important}`}</style>
        </noscript>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: orgJsonLd }} />
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <IntroLoader />
        <SmoothScroll />
        <RollLinks />
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
