"use client";

import React, { useState } from "react";

interface AuthenticationModalProps {
  onClose: () => void;
  onAuthenticated: () => void;
}

const AuthenticationModal: React.FC<AuthenticationModalProps> = ({
  onClose,
  onAuthenticated,
}) => {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (input === "gerstlaurisking42069") {
      onAuthenticated();
    } else {
      setError("Incorrect password");
    }
  };

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
          }}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="Password"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex space-x-2">
          <button
            onClick={handleSubmit}
            className="bg-blue-600 text-white px-4 py-2 rounded-md w-full cursor-pointer"
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
