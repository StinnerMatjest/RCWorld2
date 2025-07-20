"use client";

import React, { useState, useEffect } from "react";

const Footer = () => {
  const [isAtBottom, setIsAtBottom] = useState(false);

  const handleScroll = () => {
    const isBottom =
      window.innerHeight + window.scrollY >=
      document.documentElement.scrollHeight;
    setIsAtBottom(isBottom);
  };

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const shouldFooterBeVisible = !isAtBottom;

  return (
    <footer
      className={`footer text-neutral-content p-2 flex items-center fixed bottom-0 w-full transition-all duration-300 custom-bg ${
        shouldFooterBeVisible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-20 pointer-events-none"
      }`}
    >
      <div className="flex-1 flex justify-end items-center pr-6">
        {/* Footer content here (currently empty) */}
      </div>
    </footer>
  );
};

export default Footer;
