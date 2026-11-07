import { create } from "zustand";

export const MENU_ID = "site-menu";

type MenuState = {
  /** The menu panel is wanted open (drives the button's X and aria-expanded). */
  open: boolean;
  /** Media in the panel may start loading (set on first intent: hover, focus or click on the button). */
  armed: boolean;
  /** Posters only: the panel's previews show a picture at once even when opened without a hover (touch). Set when the page is idle. */
  warm: boolean;
  /** A navigation request from outside the panel (the header CTA); `n` makes repeat requests distinct. */
  go: { href: string; n: number } | null;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  arm: () => void;
  prewarm: () => void;
  request: (href: string) => void;
};

export const useMenu = create<MenuState>((set) => ({
  open: false,
  armed: false,
  warm: false,
  go: null,
  setOpen: (open) => set(open ? { open, armed: true } : { open }),
  toggle: () => set((s) => ({ open: !s.open, armed: true })),
  arm: () => set((s) => (s.armed ? s : { armed: true })),
  prewarm: () => set((s) => (s.warm ? s : { warm: true })),
  request: (href) => set((s) => ({ go: { href, n: (s.go?.n ?? 0) + 1 } })),
}));
