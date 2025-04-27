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
        <button className=" h-12 w-28 text-x1 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-800 transition duration-300 cursor-pointer">
          View Park
        </button>
      </Link>
    </div>
  );
};

export default ToParkButton;
