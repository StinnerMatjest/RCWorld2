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
    <div className="navbar bg-base-100">
      {/* Dropdown Button */}
      <div
        className="flex-1 flex justify-end pr-6 relative"
        onMouseEnter={handleMouseEnter} // Show dropdown on hover
        onMouseLeave={handleMouseLeave} // Hide dropdown when mouse leaves
      >
        <button
          className="w-full py-1 px-6 text-l font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Menu
        </button>

        {/* Invisible Wrapper for Dropdown Menu */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-40">
            <ul className="py-2">
              <li>
                <Link
                  href="https://rcdb.com/"
                  className="block px-4 py-2 text-white"
                >
                  Visit RCDB
                </Link>
              </li>
              {/* Add other options here */}
              <li>

              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Navbar;
