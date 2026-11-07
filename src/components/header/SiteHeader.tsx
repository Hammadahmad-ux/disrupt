import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import MenuButton from "@/components/menu/MenuButton";
import SiteMenu from "@/components/menu/SiteMenu";
import TalkLink from "@/components/menu/TalkLink";
import HeaderTone from "./HeaderTone";
import styles from "./header.module.css";

// Simple, confident header (Lando-style layout): wordmark left, monogram centre, one CTA + menu button right.
// It slides in once the intro has opened (html loses .intro-active). The menu panel renders next to it.
export default function SiteHeader() {
  return (
    <>
      <header className={styles.header}>
        <HeaderTone />
        {/* data-cover (here, on TalkLink and on MenuButton): the menu panel turns each one paper as its edge passes it (SiteMenu). */}
        <Link href="/" className={styles.brand} aria-label="DISRUPT, home" data-cover="brand">
          <Logo className={styles.logo} />
        </Link>

        {/* Client: no centre monogram. The empty span keeps the three-column grid. */}
        <span aria-hidden="true" />

        <nav className={styles.actions} aria-label="Primary">
          <TalkLink className={styles.cta}>
            <span className={styles.ctaIcon} aria-hidden="true" />
            Let&apos;s talk
          </TalkLink>
          <MenuButton className={styles.menu} />
        </nav>
      </header>
      <SiteMenu />
    </>
  );
}
