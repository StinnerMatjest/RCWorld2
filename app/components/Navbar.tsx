import React, { useState } from "react";
import Link from "next/link";

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Show dropdown on hover
  const handleMouseEnter = () => {
    setIsDropdownOpen(true);
  };

  // Hide dropdown when mouse leaves
  const handleMouseLeave = () => {
    setIsDropdownOpen(false);
  };

  return (
    <nav className="bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Main Navbar Links */}
          <div className="hidden md:flex space-x-6">
            <Link href="/" className="text-white hover:text-blue-400">
              About
            </Link>
            <Link href="/info" className="text-white hover:text-blue-400">
              Rating Evaluation
            </Link>
            <Link
              href="https://rcdb.com/"
              className="text-white hover:text-blue-400"
            >
              Visit RCDB
            </Link>
          </div>

          {/* Dropdown Button (Mobile and Hover) */}
          <div
            className="relative md:hidden"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button className="text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none">
              Menu
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg">
                <ul className="py-2">
                  <li>
                    <Link
                      href="https://rcdb.com/"
                      className="block px-4 py-2 text-gray-800 hover:bg-blue-100"
                    >
                      Visit RCDB
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/info"
                      className="text-white hover:text-blue-400"
                    >
                      Rating Evaluation
                    </Link>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
