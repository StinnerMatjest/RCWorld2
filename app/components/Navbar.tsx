// app/components/Navbar.tsx (or wherever your Navbar is located)
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
          <Link href="/coasterratings" className="hover:text-blue-500">Coaster Ratings</Link>
          <Link href="/lists" className="hover:text-blue-500">Lists</Link>
          <Link href="/games" className="hover:text-blue-500 font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-fuchsia-600">Games</Link>

          {/* Admin-only links */}
          {isAdminMode && (
            <>
              <Link href="/?modal=true" className="hover:text-blue-500">
                Rate a Park
              </Link>
              <Link href="/checklists" className="hover:text-blue-500">
                Checklists
              </Link>
              <Link href="/admin/social" className="hover:text-pink-500 font-semibold">
                SoMe
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Mobile */}
      <div className="relative md:hidden" ref={dropdownRef}>
        <button
          onClick={toggleDropdown}
          className="inline-flex items-center justify-center w-11 h-11 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white focus:outline-none transition"
        >
          {/* Icons */}
          <svg className={`w-6 h-6 transition-transform duration-200 ${isDropdownOpen ? "rotate-90 opacity-0" : "opacity-100"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          <svg className={`absolute w-6 h-6 transition-transform duration-200 ${isDropdownOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {isDropdownOpen && <button onClick={closeDropdown} className="fixed inset-0 z-[9998]" />}

        <div className={`fixed top-14 right-4 w-64 z-[9999] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl dark:shadow-black/40 transition-all duration-200 overflow-hidden ${isDropdownOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <SearchBar />
          </div>
          <ul className="py-1.5">
            {[
              { href: "/about", label: "About" },
              { href: "/info", label: "Rating Evaluation" },
              { href: "/coasterratings", label: "Coaster Ratings" },
              { href: "/lists", label: "Lists" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href}
                  className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  onClick={closeDropdown}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/games"
                className="flex items-center px-4 py-2.5 text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={closeDropdown}>
                Games
              </Link>
            </li>
            {isAdminMode && (
              <>
                <li className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                  <Link href="/?modal=true" className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={closeDropdown}>Rate a Park</Link>
                </li>
                <li>
                  <Link href="/checklists" className="flex items-center px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={closeDropdown}>Checklists</Link>
                </li>
                <li>
                  <Link href="/admin/social" className="flex items-center px-4 py-2.5 text-sm font-semibold text-pink-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" onClick={closeDropdown}>SoMe</Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Navbar;