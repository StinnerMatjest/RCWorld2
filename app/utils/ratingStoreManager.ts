// app/utils/ratingsStore.ts
export type Ratings = Record<string, number>;

let ratings: Ratings = {};
const listeners = new Set<() => void>();

export const ratingsStore = {
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  getSnapshot(): Ratings {
    return ratings;
  },
  // helpful for SSR typing (and React's overload); also used by our hook
  getServerSnapshot(): Ratings {
    return ratings;
  },
  get(cat: string): number | undefined {
    return ratings[cat];
  },
  set(cat: string, value: number) {
    if (ratings[cat] === value) return;
    ratings = { ...ratings, [cat]: value };
    listeners.forEach((l) => l());
  },
  all(): Ratings {
    return ratings;
  },
  reset() {
    ratings = {};
    listeners.forEach((l) => l());
  },
};
