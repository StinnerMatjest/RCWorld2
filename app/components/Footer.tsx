"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      className={`footer bg-gray-100 text-neutral-content p-2 flex justify-center items-center fixed bottom-0 w-full transition-all duration-300 ${
        isAtBottom ? "opacity-0" : "opacity-100"
      }`}
    >
      <a
        href="#"
        className="w-60 py-6 px-6 text-3xl font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 flex justify-center items-center"
        onClick={openModal}
        aria-disabled={isAtBottom ? "true" : "false"}
        tabIndex={isAtBottom ? -1 : 0}
        style={{ pointerEvents: isAtBottom ? "none" : "auto" }}
      >
        RATE A PARK
      </a>
    </footer>
  );
};

export default Footer;
