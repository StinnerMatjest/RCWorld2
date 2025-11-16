"use client";

import React, { useState } from "react";
import { useAdminMode } from "../context/AdminModeContext";
import AuthenticationModal from "./AuthenticationModal";

const AdminToggle = () => {
  const { isAdminMode, toggleAdminMode, welcomeMessage } = useAdminMode();

  const [unlocked, setUnlocked] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  const label = isAdminMode ? "Admin mode: ON" : "Admin mode: OFF";

  const handleClick = () => {
    if (isAdminMode) {
      toggleAdminMode();
      return;
    }

    if (unlocked) {
      toggleAdminMode();
      return;
    }

    setShowAuth(true);
  };

  const handleAuthenticated = () => {
    setUnlocked(true);
    setShowAuth(false);
    toggleAdminMode();
  };

  return (
    <>
      {welcomeMessage && (
        <div
          className="
            fixed
            bottom-14 right-2
            sm:bottom-16 sm:right-4
            z-[60]
            max-w-xs
            rounded-lg
            bg-gray-900/95
            text-white text-xs sm:text-sm
            px-3 py-2
            shadow-lg
            border border-white/10
          "
        >
          {welcomeMessage}
        </div>
      )}

      <button
        type="button"
        onClick={handleClick}
        aria-pressed={isAdminMode}
        aria-label={label}
        title={label}
        className={`
          fixed
          bottom-2 right-2
          sm:bottom-4 sm:right-4
          z-50
          inline-flex items-center gap-1.5 sm:gap-2
          rounded-full
          border
          px-2.5 py-1.5
          sm:px-4 sm:py-2
          text-[11px] sm:text-sm
          font-medium
          shadow-lg shadow-black/25
          backdrop-blur-md
          transition-all
          cursor-pointer

          ${
            isAdminMode
              ? "opacity-100"
              : "opacity-50 sm:opacity-15 hover:opacity-100 focus-visible:opacity-100"
          }

          ${
            isAdminMode
              ? "border-amber-400 bg-amber-500/95 text-black hover:bg-amber-400"
              : "border-gray-300 bg-white/90 text-gray-800 hover:bg-white dark:border-white/20 dark:bg-gray-900/90 dark:text-gray-100 dark:hover:bg-gray-800"
          }
        `}
      >
        {/* Status dot */}
        <span
          className={`h-2.5 w-2.5 rounded-full transition-all
            ${
              isAdminMode
                ? "bg-lime-300 shadow-[0_0_6px_2px_rgba(163,255,91,0.6)]"
                : "bg-gray-400"
            }
          `}
        />

        <span className="hidden sm:inline">
          {isAdminMode ? "Admin mode" : "Viewer mode"}
        </span>
        <span className="sm:hidden">
          {isAdminMode ? "Admin" : ""}
        </span>

        <span aria-hidden className="text-base leading-none">
          {isAdminMode ? "🛠" : "🧩"}
        </span>
      </button>

      {/* Authentication Check */}
      {showAuth && (
        <AuthenticationModal
          onClose={() => setShowAuth(false)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  );
}

export default AdminToggle;
