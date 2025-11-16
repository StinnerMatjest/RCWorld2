"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SearchBar from "./SearchBar";
import { useAdminMode } from "../context/AdminModeContext";

const Navbar: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const toggleDropdown = () => setIsDropdownOpen((prev) => !prev);
  const closeDropdown = () => setIsDropdownOpen(false);
  const { isAdminMode } = useAdminMode();
  const [showRate, setShowRate] = useState(false);

  // Auto-disable when leaving admin mode
  useEffect(() => {
    if (!isAdminMode) setShowRate(false);
  }, [isAdminMode]);


  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };
    if (isDropdownOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isDropdownOpen]);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeDropdown();
    };
    if (isDropdownOpen) document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDropdownOpen]);

  return (
    <div>
      {/* Desktop */}
      <div className="hidden md:flex justify-between items-center w-full space-x-6">
        <div className="w-auto max-w-xs">
          <SearchBar />
        </div>
        <div className="flex space-x-6 text-lg text-slate-900 dark:text-slate-100">
          <Link href="/about" className="hover:text-blue-500">About</Link>
          <Link href="/info" className="hover:text-blue-500">Rating Evaluation</Link>
          {/* RCDB link removed */}
          <Link href="/coasterratings" className="hover:text-blue-500">Coaster Ratings</Link>
          {isAdminMode && showRate && (
            <Link href="/?modal=true" className="hover:text-blue-500">
              Rate a Park
            </Link>
          )}

        </div>
      </div>

      {/* Mobile */}
      <div className="relative md:hidden" ref={dropdownRef}>
        {/* Icon button */}
        <button
          onClick={toggleDropdown}
          aria-label={isDropdownOpen ? "Close menu" : "Open menu"}
          aria-expanded={isDropdownOpen}
          aria-controls="mobile-menu"
          className="inline-flex items-center justify-center w-11 h-11 rounded-md border
                     border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800
                     text-slate-800 dark:text-slate-100 shadow-sm
                     hover:bg-slate-100 dark:hover:bg-slate-700
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500
                     transition"
        >
          {/* Hamburger */}
          <svg
            className={`w-6 h-6 transition-transform duration-200 ${isDropdownOpen ? "rotate-90 opacity-0" : "opacity-100"}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg
            className={`absolute w-6 h-6 transition-transform duration-200 ${isDropdownOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"}`}
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Backdrop */}
        {isDropdownOpen && (
          <button
            onClick={closeDropdown}
            className="fixed inset-0 bg-black/30 backdrop-blur-[1px] z-[998]"
            aria-hidden="true"
            tabIndex={-1}
          />
        )}

        {/* Dropdown */}
        <div
          id="mobile-menu"
          className={`fixed top-14 right-4 w-72 z-[999] rounded-lg border
             border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
             shadow-xl transition-all duration-200
             ${isDropdownOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}
        >
          <div className="p-3 border-b border-slate-200 dark:border-slate-700">
            <SearchBar />
          </div>
          <ul className="py-2 text-slate-900 dark:text-slate-100">
            <li>
              <Link href="/about" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={closeDropdown}>
                About
              </Link>
            </li>
            <li>
              <Link href="/info" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={closeDropdown}>
                Rating Evaluation
              </Link>
            </li>
            {/* RCDB link removed */}
            <li>
              <Link href="/coasterratings" className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" onClick={closeDropdown}>
                Coaster Ratings
              </Link>
            </li>
            {isAdminMode && showRate && (
              <li>
                <Link
                  href="/?modal=true"
                  className="block px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700"
                  onClick={closeDropdown}
                >
                  Rate a Park
                </Link>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;
