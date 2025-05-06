"use client";
import React, { createContext, useState, useContext } from "react";
import type { Park } from "../types";



interface ParksContextType {
  parks: Park[];
  setParks: React.Dispatch<React.SetStateAction<Park[]>>;
}

// Create the context with default values
const ParksContext = createContext<ParksContextType | undefined>(undefined);

// Provider component
export const ParksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [parks, setParks] = useState<Park[]>([
  ]);

  return (
    <ParksContext.Provider value={{ parks, setParks }}>
      {children}
    </ParksContext.Provider>
  );
};

// Custom hook to use the ParksContext
export const useParks = () => {
  const context = useContext(ParksContext);
  if (!context) {
    throw new Error("useParks must be used within a ParksProvider");
  }
  return context;
};
