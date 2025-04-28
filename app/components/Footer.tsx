"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SearchBar from "./SearchBar";

const Footer = ({ onSearch }: { onSearch: (query: string) => void }) => {
  const router = useRouter();
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

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

  const shouldFooterBeVisible = searchQuery.trim() !== "" || !isAtBottom;

  return (
    <footer
      className={`footer text-neutral-content p-2 flex items-center fixed bottom-0 w-full transition-all duration-300 custom-bg ${shouldFooterBeVisible
        ? "opacity-100 translate-y-0"
        : "opacity-0 translate-y-20 pointer-events-none"
        }`}
    >
      {/* Balances the layout */}
      <div className="flex-1"></div>

      {/* Removed the "Rate a Park" button */}

      <div className="flex-1 flex justify-end items-center pr-6">
        <SearchBar
          onSearch={(query: string) => {
            setSearchQuery(query);
            onSearch(query);
          }}
        />
      </div>
    </footer>
  );
};

export default Footer;
