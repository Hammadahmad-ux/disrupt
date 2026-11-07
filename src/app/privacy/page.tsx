import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isOn } from "@/content/site";
import { CONTACT } from "@/components/contact/contact-details";
import LegalPage from "@/components/pages/legal/LegalPage";
import SiteFooter from "@/components/footer/SiteFooter";
import ReelPlayer from "@/components/reel-player/ReelPlayer";
import AliveBackground from "@/components/fx/AliveBackground";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How DISRUPT uses the details you send us through this website.",
};

const mail = <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>;

// Privacy notice in plain English (UK GDPR). Only the contact form and email collect personal data;
// the site has no analytics or advertising cookies.
export default function Privacy() {
  if (!isOn("privacy")) notFound();
  return (
    <>
      <AliveBackground />
      <main id="main" tabIndex={-1} style={{ position: "relative" }}>
        <LegalPage eyebrow="Legal · Privacy" title="Privacy notice.">
          {/* CONFIRM WITH ADIL: legal company name, company number, registered address, retention period */}
          <h2>Who we are</h2>
          <p>
            DISRUPT is a CGI and motion studio based in the United Kingdom. We are responsible for the personal
            details you send us through this website. If you have any question about this notice or your details,
            email us at {mail}.
          </p>

          <h2>What we collect</h2>
          <p>We only collect what you choose to send us:</p>
          <ul>
            <li>
              <strong>Through the contact form:</strong> your name, email address, company, the type of project and
              your message.
            </li>
            <li>
              <strong>If you email us:</strong> your email address and whatever you write in the email.
            </li>
          </ul>
          <p>We do not ask for, and do not want, any sensitive information about you.</p>

          <h2>Why we use it</h2>
          <p>
            We use your details to reply to your enquiry and, if you want to work with us, to talk through and plan
            the project. Our lawful basis is our legitimate interest in answering messages sent to us, and, where you
            ask about a project, taking steps at your request before entering into a contract.
          </p>

          <h2>Who handles it for us</h2>
          <p>A small number of service providers process your details on our behalf, only to run this website and our email:</p>
          <ul>
            <li>the company that hosts this website;</li>
            <li>the service that delivers contact form messages to our inbox;</li>
            <li>our email provider.</li>
          </ul>
          <p>
            They may only use your details to provide their service to us. Some of them may store data outside the
            UK; where they do, we rely on the safeguards UK law requires, such as approved contract terms.
          </p>

          <h2>How long we keep it</h2>
          <p>
            We keep enquiries for up to 24 months after our last contact with you, so we can follow up on the same
            conversation. If we go on to work together, we keep project records for as long as the law requires
            for business and tax records. After that we delete them.
          </p>

          <h2>What we never do</h2>
          <p>We never sell your details, and we never share them with anyone for their own marketing.</p>

          <h2>Cookies and browser storage</h2>
          <p>
            This website does not use analytics, tracking or advertising cookies. It stores one small note in your
            browser&rsquo;s session storage to remember that you have already seen the opening animation, so it
            plays shorter on your next page. It holds no personal information and is cleared when you close the
            browser tab.
          </p>

          <h2>Your rights</h2>
          <p>Under UK data protection law (the UK GDPR) you have the right to:</p>
          <ul>
            <li>ask for a copy of the details we hold about you;</li>
            <li>ask us to correct details that are wrong or incomplete;</li>
            <li>ask us to delete your details;</li>
            <li>object to, or ask us to limit, how we use them;</li>
            <li>ask for your details in a format you can take elsewhere, where that applies.</li>
          </ul>
          <p>To use any of these rights, email us at {mail}. We will reply within one month.</p>

          <h2>Complaints</h2>
          <p>
            If you are unhappy with how we have handled your details, please tell us first so we can put it right.
            You can also complain to the Information Commissioner&rsquo;s Office (ICO), the UK data protection
            regulator, at <a href="https://ico.org.uk" rel="noopener noreferrer" target="_blank">ico.org.uk</a>.
          </p>

          <h2>Changes to this notice</h2>
          <p>
            We may update this notice from time to time. The latest version is always on this page, with the date it
            was last updated at the top.
          </p>
        </LegalPage>
      </main>
      <SiteFooter />
      <ReelPlayer />
    </>
  );
}
