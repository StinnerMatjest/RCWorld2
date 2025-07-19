import React from "react";
import { getRatingColor } from "@/app/utils/design";
import type { Rating } from "@/app/types";

interface RatingsPanelProps {
  ratings: Rating[];
}

const RatingsPanel: React.FC<RatingsPanelProps> = ({ ratings }) => {
  if (ratings.length === 0) {
    return <p>No ratings available yet.</p>;
  }

  return (
    <div className="space-y-10">
      {ratings.map((r) => (
        <div key={r.id}>
          {/* Overall Rating */}
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold mb-2">Overall</h3>
            <p className={`text-5xl font-bold ${getRatingColor(r.overall)}`}>
              {r.overall.toFixed(2)}
            </p>
          </div>

          {/* Individual Ratings Grid */}
          <div className="grid grid-cols-3 gap-4 max-w-[380px] mx-auto">
            {Object.entries({
              "Appearance": r.parkAppearance,
              "Best Coaster": r.bestCoaster,
              "Water Rides": r.waterRides,
              "Ride Lineup": r.flatridesAndDarkrides,
              Food: r.food,
              "Snacks/Drinks": r.snacksAndDrinks,
              "Park Practicality": r.parkPracticality,
              "Ride Operations": r.rideOperations,
              "Management": r.parkManagement,
            }).map(([label, value]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="text-sm font-medium">{label}</span>
                <span
                  className={`text-xl font-semibold ${getRatingColor(value as number)}`}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RatingsPanel;
