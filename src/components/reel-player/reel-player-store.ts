import { create } from "zustand";

// Opens the full-screen showreel player (with sound) from anywhere: hero button, reel section, etc.
// `warm` is set on the first sign of intent (hover or focus on a "Showreel" control): the player then loads
// its poster and the start of the film, so it opens on a picture and starts playing straight away.
type ReelPlayerState = { open: boolean; warm: boolean; show: () => void; hide: () => void; prepare: () => void };

export const useReelPlayer = create<ReelPlayerState>((set) => ({
  open: false,
  warm: false,
  show: () => set({ open: true, warm: true }),
  hide: () => set({ open: false }),
  prepare: () => set((s) => (s.warm ? s : { warm: true })),
}));

export const openReel = () => useReelPlayer.getState().show();
export const warmReel = () => useReelPlayer.getState().prepare();
