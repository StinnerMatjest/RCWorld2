"use client";

import React, { useState, useEffect } from "react";

interface AuthenticationModalProps {
  onClose: () => void;
  onAuthenticated: () => void;
}

const LOCK_KEY = "auth_lockUntil";

const AuthenticationModal: React.FC<AuthenticationModalProps> = ({
  onClose,
  onAuthenticated,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockUntil, setLockUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [justUnlocked, setJustUnlocked] = useState(false);

  // Load persisted lockUntil on mount
  useEffect(() => {
    const stored = localStorage.getItem(LOCK_KEY);
    if (stored) {
      const lockTime = parseInt(stored, 10);
      if (Date.now() < lockTime) {
        setLockUntil(lockTime);
        setTimeLeft(Math.ceil((lockTime - Date.now()) / 1000));
        setError("You're currently locked out. Try again later.");
      } else {
        localStorage.removeItem(LOCK_KEY);
      }
    }
  }, []);

  // Countdown timer while locked
  useEffect(() => {
    if (!lockUntil) return;

    const interval = setInterval(() => {
      const now = Date.now();
      if (now >= lockUntil) {
        clearInterval(interval);
        setLockUntil(null);
        setTimeLeft(0);
        setError("");
        setJustUnlocked(true);
        localStorage.removeItem(LOCK_KEY);
      } else {
        setTimeLeft(Math.ceil((lockUntil - now) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockUntil]);

  const handleSubmit = async () => {
    if (lockUntil && Date.now() < lockUntil) {
      setError("Too many attempts. Please wait a few seconds.");
      return;
    }

    try {
      const res = await fetch("/api/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: input }),
      });

      if (res.ok) {
        onAuthenticated();
        setFailedAttempts(0);
        setLockUntil(null);
        localStorage.removeItem(LOCK_KEY);
        setJustUnlocked(false);
      } else {
        const data = await res.json();
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 3) {
          const lockTime = Date.now() + 30_000;
          setLockUntil(lockTime);
          setTimeLeft(30);
          setError("Too many failed attempts. Try again later.");
          localStorage.setItem(LOCK_KEY, lockTime.toString());
          setJustUnlocked(false);
        } else {
          setError(data.error || "Authentication failed");
        }
      }
    } catch {
      setError("Server error. Please try again.");
    }
  };

  const isLocked = !!(lockUntil && Date.now() < lockUntil);

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 dark:text-gray-100 border border-transparent dark:border-white/10 p-6 rounded-lg shadow-lg w-80 text-center space-y-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Enter Access Password
        </h2>

        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
            setJustUnlocked(false);
          }}
          className="w-full p-2 rounded-md border border-gray-300 bg-white text-gray-900 placeholder-gray-400
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                     dark:bg-gray-900 dark:text-gray-100 dark:border-white/10 dark:placeholder-gray-500 dark:focus-visible:ring-offset-gray-800 disabled:opacity-60"
          placeholder="Password"
          disabled={isLocked}
        />

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {isLocked && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Try again in <span className="font-semibold">{timeLeft}</span>s
          </p>
        )}

        {justUnlocked && (
          <p className="text-sm font-semibold text-green-600 dark:text-green-400">
            You can now try again
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleSubmit}
            className="w-full px-4 py-2 rounded-md text-white cursor-pointer transition
                       bg-blue-600 hover:bg-blue-700
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       dark:bg-blue-500 dark:hover:bg-blue-400 dark:focus-visible:ring-offset-gray-800 disabled:opacity-50"
            disabled={isLocked}
          >
            Submit
          </button>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 rounded-md cursor-pointer transition
                       border border-gray-300 text-gray-800 hover:bg-gray-100
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white
                       dark:border-white/10 dark:text-gray-100 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus-visible:ring-offset-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationModal;
