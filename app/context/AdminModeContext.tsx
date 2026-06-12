"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type AdminModeContextValue = {
  isAdminMode: boolean;
  /** False until the localStorage preference has been read on the client.
   *  Lets server-informed pages keep their SSR admin state until then. */
  hydrated: boolean;
  toggleAdminMode: () => void;
  welcomeMessage: string | null;
};

const AdminModeContext = createContext<AdminModeContextValue | undefined>(
  undefined
);

const STORAGE_KEY = "parkrating_admin_mode";

export const AdminModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState<string | null>(null);

  // Load persisted admin mode on mount, but only keep it if the server still
  // accepts our admin cookie — otherwise the UI would show admin controls
  // whose saves all get rejected with 401.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1") {
        setIsAdminMode(true);
        fetch("/api/authenticate")
          .then(r => r.json())
          .then(d => {
            if (!d.admin) {
              setIsAdminMode(false);
              window.localStorage.removeItem(STORAGE_KEY);
            }
          })
          .catch(() => { /* offline/transient: keep current state */ });
      }
    } catch {
    }
    setHydrated(true);
  }, []);

  // Persist changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (isAdminMode) {
        window.localStorage.setItem(STORAGE_KEY, "1");
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
    }
  }, [isAdminMode]);

  const toggleAdminMode = () => {
    setIsAdminMode((prev) => {
      const next = !prev;

      if (next) {
        // Turning ON → show rotating welcome message
        const messages = [
          "Welcome back, Vekoma fanboy #1 🎢😎",
          "Admin mode activated. Time to bully Vekoma again 🤓",
          "Back in the control booth — please keep hands inside the train 🫡",
          "Ah, another day, another Vekoma to fix 🛠️🎡",
          "Welcome to the dark side of ParkRating 🌑🎢",
          "Editing parks like a true coaster nerd 🛠️",
          "Back already? If you are going to add another vekoma please dont.🎡🔥",
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        setWelcomeMessage(msg);

        if (typeof window !== "undefined") {
          window.setTimeout(() => {
            setWelcomeMessage((current) =>
              current === msg ? null : current
            );
          }, 3200);
        }
      } else {
        // Turning OFF → clear message
        setWelcomeMessage(null);
      }

      return next;
    });
  };

  return (
    <AdminModeContext.Provider
      value={{ isAdminMode, hydrated, toggleAdminMode, welcomeMessage }}
    >
      {children}
    </AdminModeContext.Provider>
  );
};

export const useAdminMode = (): AdminModeContextValue => {
  const ctx = useContext(AdminModeContext);
  if (!ctx) {
    throw new Error("useAdminMode must be used within an AdminModeProvider");
  }
  return ctx;
};
