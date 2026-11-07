import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isOn } from "@/content/site";
import { CONTACT } from "@/components/contact/contact-details";
import LegalPage from "@/components/pages/legal/LegalPage";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

export const metadata: Metadata = {
  title: "Terms of website use",
  description: "The terms for using the DISRUPT website and the work shown on it.",
};

// Terms of website use in plain English (England and Wales).
export default function Terms() {
  if (!isOn("terms")) notFound();
  return (
    <>
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <LegalPage eyebrow="Legal · Terms" title="Terms of use.">
          {/* CONFIRM WITH ADIL: legal company name, company number, registered address, retention period */}
          <h2>Using this website</h2>
          <p>
            This website is run by DISRUPT, a CGI and motion studio based in the United Kingdom. By using it, you
            accept these terms. If you do not agree with them, please do not use the site.
          </p>
          <p>
            You may view the site and share links to its pages. Please do not try to break, overload or get
            unauthorised access to the site or the systems behind it.
          </p>

          <h2>Our work</h2>
          <p>
            All films, stills, CGI and other work shown on this site belong to DISRUPT or to our clients. They are
            shown here as examples of our work. You may not copy, download, edit, reuse or publish any of it, in
            whole or in part, without our written permission.
          </p>

          <h2>Brand names and logos</h2>
          <p>
            Car brand names, logos and models shown on this site belong to their owners. They appear only to show
            work we have made for, or with, those brands. Their use does not mean that any brand endorses this
            website.
          </p>

          <h2>No promises about the site</h2>
          <p>
            We work to keep the site accurate and running, but it is provided as it is. We cannot promise that it
            will always be available, free from errors or suitable for any particular purpose, and the information
            on it is not advice.
          </p>
          <p>
            As far as the law allows, we are not responsible for any loss or damage that comes from using, or not
            being able to use, this site. Nothing in these terms limits our liability where the law does not allow
            it to be limited, for example for death or personal injury caused by negligence, or for fraud.
          </p>

          <h2>Links to other sites</h2>
          <p>
            Where this site links to other websites, we do so for your convenience. We do not control those sites and
            are not responsible for their content or how they use your information.
          </p>

          <h2>Law</h2>
          <p>
            These terms are governed by the law of England and Wales, and the courts of England and Wales deal with
            any dispute about them.
          </p>

          <h2>Changes to these terms</h2>
          <p>
            We may update these terms from time to time. The latest version is always on this page, with the date it
            was last updated at the top.
          </p>

          <h2>Contact</h2>
          <p>
            Questions about these terms? Email us at <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.
          </p>
        </LegalPage>
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
