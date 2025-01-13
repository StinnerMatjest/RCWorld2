"use client";
import React, { createContext, useState, useContext } from "react";
import { Park } from "../park/[id]/page";

interface ParksContextType {
  parks: Park[];
  setParks: React.Dispatch<React.SetStateAction<Park[]>>;
}

// Create the context with default values
const ParksContext = createContext<ParksContextType | undefined>(undefined);

// Provider component
export const ParksProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [parks, setParks] = useState<Park[]>([
    {
      id: 1,
      name: 'Toverland',
      continent: 'Europe',
      country: 'Netherlands',
      city: 'Sevenum',
      imagePath: '/images/parks/Toverland.PNG',
    },
    {
      id: 2,
      name: 'Walibi Belgium',
      continent: 'Europe',
      country: 'Belgium',
      city: 'Wavre',
      imagePath: '/images/parks/Walibi Belgium.PNG',
    },
    {
      id: 3,
      name: 'Phantasialand',
      continent: 'Europe',
      country: 'Germany',
      city: 'Brühl',
      imagePath: '/images/parks/Phantasialand.PNG',
    },
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
