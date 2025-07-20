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

  return (
    <div className="text-left">
      <h2 className="text-xl font-semibold mb-2">Visit Archive</h2>
      <ul className="space-y-2">
        {sortedByDate.map((rating) => {
          const isCurrent = rating.id === currentRatingId;
          return (
            <li
              key={rating.id}
              className={`
                p-3 rounded-xl shadow transition-colors
                ${isCurrent ? "bg-blue-300 cursor-default" : "bg-white hover:bg-blue-100 cursor-pointer"}
              `}
              onClick={() => {
                if (!isCurrent) {
                  router.push(`/park/${rating.parkId}?visit=${rating.id}`);
                }
              }}
              aria-current={isCurrent ? "true" : undefined}
            >
              <div className="font-medium">{new Date(rating.date).toLocaleDateString()}</div>
              <div className="text-sm text-gray-600">Overall Score: {rating.overall}/5</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ArchivePanel;
