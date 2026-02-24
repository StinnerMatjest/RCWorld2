import { RollerCoaster, ApiCoaster } from "@/app/types";

const getRideCount = (c: any): number => c.rideCount ?? c.ridecount ?? 0;
const getIsBest = (c: any): boolean => !!(c.isBestCoaster ?? c.isbestcoaster);
const getRating = (c: any): number => {
  const r = typeof c.rating === 'string' ? parseFloat(c.rating) : c.rating;
  return r ?? 0;
};

export const sortCoastersByRank = (coasters: (RollerCoaster | ApiCoaster)[]) => {
  return [...coasters]
    .filter((c) => getRating(c) > 0)
    .sort((a: any, b: any) => {
      // 1. Rating (Highest first)
      const ratingA = getRating(a);
      const ratingB = getRating(b);
      if (ratingA !== ratingB) return ratingB - ratingA;

      // 2. Is Best Coaster (Tiebreaker ONLY if in the same park)
      if (a.parkId === b.parkId) {
        const bestA = getIsBest(a);
        const bestB = getIsBest(b);
        if (bestA !== bestB) return bestA ? -1 : 1;
      }

      // 3. Ride Count (Highest first)
      const countA = getRideCount(a);
      const countB = getRideCount(b);
      if (countA !== countB) return countB - countA;

      // 4. Last Ridden Date (Newest first)
      const dateA = a.lastVisitDate ? new Date(a.lastVisitDate).getTime() : 0;
      const dateB = b.lastVisitDate ? new Date(b.lastVisitDate).getTime() : 0;
      return dateB - dateA;
    });
};

export const getCoasterRankInList = (list: (RollerCoaster | ApiCoaster)[], targetId: string | number) => {
  const sorted = sortCoastersByRank(list);
  const index = sorted.findIndex((c) => String(c.id) === String(targetId));
  
  return {
    rank: index !== -1 ? index + 1 : null,
    total: sorted.length
  };
};