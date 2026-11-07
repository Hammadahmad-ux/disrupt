import { create } from "zustand";

// Real loading progress for the intro. Anything the first screen needs registers a task
// with a weight and reports 0..1; the loader shows the weighted total.
type Task = { weight: number; progress: number };

type IntroState = {
  tasks: Record<string, Task>;
  done: boolean;
  register: (id: string, weight: number) => void;
  report: (id: string, progress: number) => void;
  finish: () => void;
};

export const useIntro = create<IntroState>((set) => ({
  tasks: {},
  done: false,
  register: (id, weight) =>
    set((s) => (s.tasks[id] ? s : { tasks: { ...s.tasks, [id]: { weight, progress: 0 } } })),
  report: (id, progress) =>
    set((s) => {
      const t = s.tasks[id];
      if (!t || progress <= t.progress) return s;
      return { tasks: { ...s.tasks, [id]: { ...t, progress: Math.min(1, progress) } } };
    }),
  finish: () => set({ done: true }),
}));

export function totalProgress(tasks: Record<string, Task>) {
  let w = 0;
  let p = 0;
  for (const t of Object.values(tasks)) {
    w += t.weight;
    p += t.weight * t.progress;
  }
  return w === 0 ? 0 : p / w;
}

export const INTRO_DONE_EVENT = "disrupt:intro-done";
export const INTRO_SEEN_KEY = "disrupt:intro";
