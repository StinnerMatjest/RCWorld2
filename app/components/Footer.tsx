"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const Footer = () => {
  const router = useRouter();
  const [isAtBottom, setIsAtBottom] = useState(false);

  const openModal = () => {
    router.push("?modal=true");
  };

  // Function to detect scroll position
  const handleScroll = () => {
    const isBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight;
    setIsAtBottom(isBottom);
  };

  // Add scroll event listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <footer
      className={`footer bg-gray-700 text-neutral-content p-2 flex justify-between items-center fixed bottom-0 w-full transition-all duration-300 ${
        isAtBottom
          ? "opacity-0 translate-y-20 pointer-events-none"
          : "opacity-100 translate-y-0"
      }`}
    >
      {/* Container for the centered "Submit Park" button */}
      <div className="flex justify-center flex-grow pl-10">
        <a
          href="#"
          className="w-60 py-6 px-5 text-3xl font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 flex justify-center items-center no-underline"
          onClick={openModal}
        >
          RATE A PARK!
        </a>
      </div>

      {/* RCDB link on the right */}
      <div className="ml-auto pr-6">
        <Link
          href="https://rcdb.com/"
          className="text-blue-600 hover:text-blue-800"
        >
          Visit RCDB
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
