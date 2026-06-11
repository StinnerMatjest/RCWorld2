"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import SearchBar from "./SearchBar";
import { useAdminMode } from "../context/AdminModeContext";

const Navbar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminDropOpen, setAdminDropOpen] = useState(false);
  const mobileRef = useRef<HTMLDivElement>(null);
  const adminDropRef = useRef<HTMLDivElement>(null);
  const { isAdminMode } = useAdminMode();

  // Close mobile on outside click
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: MouseEvent) => {
      if (mobileRef.current && !mobileRef.current.contains(e.target as Node)) setMobileOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [mobileOpen]);

  // Close admin dropdown on outside click
  useEffect(() => {
    if (!adminDropOpen) return;
    const handler = (e: MouseEvent) => {
      if (adminDropRef.current && !adminDropRef.current.contains(e.target as Node)) setAdminDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [adminDropOpen]);

  // Close both on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setMobileOpen(false); setAdminDropOpen(false); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const linkCls = "hover:text-blue-500 transition-colors";
  const mobileItemCls = "flex items-center px-4 py-2.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors";

  return (
    <div>
      {/* ── Desktop ─────────────────────────────────────────────────────── */}
      <div className="hidden md:flex justify-between items-center w-full space-x-6">
        <div className="w-[220px]">
          <SearchBar />
        </div>
        <div className="flex items-center space-x-6 text-lg text-slate-100">
          <Link href="/about" className={linkCls}>About</Link>
          <Link href="/info" className={linkCls}>Ratings</Link>
          <Link href="/parks" className={linkCls}>Parks</Link>
          <Link href="/coasterratings" className={linkCls}>Coasters</Link>
          <Link href="/games" className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-fuchsia-600">Games</Link>

          {/* Admin Tools dropdown */}
          {isAdminMode && (
            <div className="relative" ref={adminDropRef}>
              <button
                onClick={() => setAdminDropOpen(v => !v)}
                className="flex items-center gap-1 hover:text-blue-500 transition-colors cursor-pointer"
              >
                Admin Tools
                <svg className={`w-4 h-4 transition-transform ${adminDropOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {adminDropOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-44 rounded-xl border border-slate-700 bg-slate-900 shadow-xl overflow-hidden z-[200]">
                  <Link href="/?modal=true" className={mobileItemCls} onClick={() => setAdminDropOpen(false)}>Rate a Park</Link>
                  <Link href="/checklists" className={mobileItemCls} onClick={() => setAdminDropOpen(false)}>Checklists</Link>
                  <Link href="/admin/social" className="flex items-center px-4 py-2.5 text-sm font-semibold text-pink-500 hover:bg-slate-800 transition-colors" onClick={() => setAdminDropOpen(false)}>SoMe</Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Mobile ──────────────────────────────────────────────────────── */}
      <div className="relative md:hidden" ref={mobileRef}>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="inline-flex items-center justify-center w-11 h-11 text-slate-300 hover:text-white focus:outline-none transition"
        >
          <svg className={`w-6 h-6 transition-transform duration-200 ${mobileOpen ? "rotate-90 opacity-0" : "opacity-100"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          <svg className={`absolute w-6 h-6 transition-transform duration-200 ${mobileOpen ? "opacity-100 rotate-0" : "opacity-0 -rotate-90"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {mobileOpen && <button onClick={() => setMobileOpen(false)} className="fixed inset-0 z-[9998]" />}

        <div className={`fixed top-14 right-4 w-64 z-[9999] rounded-2xl border border-slate-800 bg-slate-900 shadow-black/40 transition-all duration-200 overflow-hidden ${mobileOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
          <div className="p-3 border-b border-slate-800">
            <SearchBar />
          </div>
          <ul className="py-1.5">
            {[
              { href: "/about", label: "About" },
              { href: "/info", label: "Ratings" },
              { href: "/parks", label: "Parks" },
              { href: "/coasterratings", label: "Coasters" },
            ].map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={mobileItemCls} onClick={() => setMobileOpen(false)}>
                  {label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/games"
                className="flex items-center px-4 py-2.5 text-sm font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:bg-slate-800 transition-colors"
                onClick={() => setMobileOpen(false)}>
                Games
              </Link>
            </li>
            {isAdminMode && (
              <>
                <li className="border-t border-slate-800 mt-1 pt-1 px-4 py-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Admin Tools</span>
                </li>
                <li>
                  <Link href="/?modal=true" className={mobileItemCls} onClick={() => setMobileOpen(false)}>Rate a Park</Link>
                </li>
                <li>
                  <Link href="/checklists" className={mobileItemCls} onClick={() => setMobileOpen(false)}>Checklists</Link>
                </li>
                <li>
                  <Link href="/admin/social" className="flex items-center px-4 py-2.5 text-sm font-semibold text-pink-500 hover:bg-slate-800 transition-colors" onClick={() => setMobileOpen(false)}>SoMe</Link>
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