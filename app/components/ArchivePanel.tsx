"use client";

import { Rating } from "@/app/types";
import { useRouter } from "next/navigation";
import React from "react";

interface ArchivePanelProps {
  ratings: Rating[];
  parkId: number;
  currentRatingId?: number;
}

const ArchivePanel: React.FC<ArchivePanelProps> = ({
  ratings,
  currentRatingId,
}) => {
  const router = useRouter();

  const sortedByDate = [...ratings].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const go = (rating: Rating) => {
    router.push(`/park/${rating.parkId}?visit=${rating.id}`);
  };

  return (
    <div className="text-left">
      <h2 className="text-xl font-semibold mb-2 dark:text-white">Visit Archive</h2>
      <ul className="space-y-2">
        {sortedByDate.map((rating) => {
          const isCurrent = rating.id === currentRatingId;

          const base =
            "group flex items-center justify-between gap-3 p-3 rounded-xl transition-all duration-150 select-none";

          const currentLight = "bg-blue-300 border border-blue-300 cursor-default";
          const otherLight =
            "bg-white border border-gray-200 hover:bg-blue-100 cursor-pointer";

          const currentDark =
            "dark:bg-blue-500/30 dark:text-blue-200 dark:border dark:border-blue-400/40 dark:ring-1 dark:ring-blue-400/30";
          const otherDark =
            "dark:bg-gray-800 dark:text-gray-200 dark:border dark:border-white/10 dark:hover:bg-gray-700 dark:hover:border-blue-400/40 dark:shadow-md";

          const focus =
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900";

          const motion = isCurrent
            ? ""
            : "hover:translate-x-0.5 dark:hover:translate-x-0.5";

          const liClass = [
            base,
            focus,
            motion,
            isCurrent ? currentLight : otherLight,
            isCurrent ? currentDark : otherDark,
          ].join(" ");

          return (
            <li
              key={rating.id}
              className={liClass}
              role={isCurrent ? undefined : "button"}
              tabIndex={isCurrent ? -1 : 0}
              onClick={() => !isCurrent && go(rating)}
              onKeyDown={(e) => {
                if (isCurrent) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  go(rating);
                }
              }}
              aria-current={isCurrent ? "true" : undefined}
            >
              <div className="min-w-0">
                <div className="font-medium dark:text-white">
                  {new Date(rating.date).toLocaleDateString()}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Overall Score: {rating.overall}/5
                </div>
              </div>

              {/* Chevron affordance */}
              {!isCurrent && (
                <svg
                  className="w-4 h-4 flex-shrink-0 text-gray-400 dark:text-gray-300 opacity-80 translate-x-0 group-hover:translate-x-0.5 transition-transform"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ArchivePanel;
