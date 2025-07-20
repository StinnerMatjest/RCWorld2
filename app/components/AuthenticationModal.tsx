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
    <div className="fixed inset-0 backdrop-blur-lg flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-2xl shadow-lg w-80 text-center space-y-4">
        <h2 className="text-xl font-bold">Enter Access Password</h2>
        <input
          type="password"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setError("");
            setJustUnlocked(false);
          }}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Password"
          disabled={isLocked}
        />

        {error && <p className="text-red-500 text-sm">{error}</p>}

        {isLocked && (
          <p className="text-sm text-gray-600">
            Try again in <span className="font-semibold">{timeLeft}</span>s
          </p>
        )}

        {justUnlocked && (
          <p className="text-green-600 text-sm font-semibold">
            You can now try again
          </p>
        )}

        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded-md w-full cursor-pointer disabled:opacity-50"
            disabled={isLocked}
          >
            Submit
          </button>
          <button
            onClick={onClose}
            className="bg-gray-300 px-4 py-2 rounded-md w-full cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthenticationModal;
