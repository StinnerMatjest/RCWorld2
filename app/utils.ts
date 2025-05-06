// app/utils.ts
export const getRatingColor = (rating: number): string => {
    if (rating >= 10) return "rainbow-animation";
    if (rating >= 9)  return "text-blue-700 dark:text-blue-400";
    if (rating >= 7.5) return "text-green-600 dark:text-green-400";
    if (rating >= 6.5) return "text-green-400 dark:text-green-300";
    if (rating >= 5.5) return "text-yellow-400 dark:text-yellow-300";
    if (rating >= 4.5) return "text-yellow-600 dark:text-yellow-500";
    if (rating >= 3)   return "text-red-400 dark:text-red-300";
    return "text-red-600 dark:text-red-500";
  };
  