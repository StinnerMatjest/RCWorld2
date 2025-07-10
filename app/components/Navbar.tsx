"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null); //FOR MOBILE

  const toggleDropdown = () => {
    setIsDropdownOpen((prev) => !prev);
  };

  const closeDropdown = () => {
    setIsDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen]);

  return (
    <nav>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 text-lg font-medium">

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex space-x-6">
            <Link href="/about" className="text-black hover:text-blue-400">
              About
            </Link>
            <Link href="/info" className="text-black hover:text-blue-400">
              Rating Evaluation
            </Link>
            <Link href="https://rcdb.com/" className="text-black hover:text-blue-400">
              Visit RCDB
            </Link>
            <Link href="/?modal=true" className="text-black hover:text-blue-400">
              Rate a Park
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="relative md:hidden" ref={dropdownRef}>
            <button
              onClick={toggleDropdown}
              className="flex items-center gap-2 px-4 py-2 border border-gray-400 rounded-full bg-white text-black hover:bg-gray-100 focus:outline-none shadow-sm transition"
            >
              {isDropdownOpen ? "✖️ Close" : "☰ Menu"}
            </button>

            {/* Mobile Dropdown Menu */}
            <div
              className={`absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg z-50 transform transition-all duration-300 ease-out ${
                isDropdownOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
              }`}
            >
              <ul className="py-2">
                <li>
                  <Link href="/about" className="block px-4 py-2 text-gray-800 hover:bg-blue-100" onClick={closeDropdown}>
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/info" className="block px-4 py-2 text-gray-800 hover:bg-blue-100" onClick={closeDropdown}>
                    Rating Evaluation
                  </Link>
                </li>
                <li>
                  <Link href="https://rcdb.com/" className="block px-4 py-2 text-gray-800 hover:bg-blue-100" onClick={closeDropdown}>
                    Visit RCDB
                  </Link>
                </li>
                <li>
                  <Link href="/?modal=true" className="block px-4 py-2 text-gray-800 hover:bg-blue-100" onClick={closeDropdown}>
                    Rate a Park
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
