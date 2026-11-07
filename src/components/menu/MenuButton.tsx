"use client";

import { MENU_ID, useMenu } from "./menu-store";

/** The header's square menu button. Its two bars turn into an X while the menu is open. */
export default function MenuButton({ className }: { className?: string }) {
  const open = useMenu((s) => s.open);
  const arm = useMenu((s) => s.arm);
  const toggle = useMenu((s) => s.toggle);

  return (
    <button
      type="button"
      className={className}
      aria-label="Menu"
      aria-expanded={open}
      aria-controls={MENU_ID}
      data-menu-button
      data-cover="button"
      onPointerEnter={arm}
      onFocus={arm}
      onClick={toggle}
    >
      <span />
      <span />
    </button>
  );
}
