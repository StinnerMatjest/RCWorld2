import React from "react";
import Link from "next/link";

interface ToParkButtonProps {
  parkSlug: string;
}

const ToParkButton: React.FC<ToParkButtonProps> = ({ parkSlug }) => {
  return (
    <div className="card-actions">
      <Link href={`/park/${parkSlug}`}>
        <button className="h-12 w-28 text-xl font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-800 transition duration-300 cursor-pointer">
          View Park
        </button>
      </Link>
    </div>
  );
};

export default ToParkButton;