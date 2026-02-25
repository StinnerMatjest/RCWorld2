import React from "react";
import Link from "next/link";

const MainPageButton = () => {
  return (
    <div className="flex justify-center">
      <Link
        href="/"
        className="
          group
          inline-flex items-center justify-center gap-2
          rounded-xl
          px-6 py-3
          text-base font-semibold
          text-white
          bg-[#d8730c]
          transition-colors duration-200
          hover:bg-[#e9820e]
          active:scale-[0.98]
          focus:outline-none
          focus-visible:ring-2 focus-visible:ring-[#e9820e]/40
        "
      >
        <span className="transition-transform duration-200 group-hover:-translate-x-1">
          ←
        </span>
        Back
      </Link>
    </div>
  );
};

export default MainPageButton;