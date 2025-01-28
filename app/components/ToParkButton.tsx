import React from "react";
import Link from "next/link";

// parkId prop
interface ToParkButtonProps {
  parkId: number;
}

const ToParkButton: React.FC<ToParkButtonProps> = ({ parkId }) => {
  console.log("ToParkButton received parkId:", parkId);
  return (
    <div className="card-actions">
      <Link href={`/park/${parkId}`}>
        <button className="w-full py-2 px-4 text-xl font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300">
          View Park
        </button>
      </Link>
    </div>
  );
};

export default ToParkButton;
