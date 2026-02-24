"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import type { Park } from "@/app/types";
import ParkHeaderModal from "./parkpage/ParkHeaderModal";

interface ParkHeaderProps {
  park: Park;
  isAdminMode?: boolean;
  onUpdate?: () => void;
}

const ParkHeader: React.FC<ParkHeaderProps> = ({ park, isAdminMode, onUpdate }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showToast, setShowToast] = useState(false); 

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const handleSuccess = () => {
    setShowToast(true);
    if (onUpdate) onUpdate();
  };

  return (
    <>
      <div className="relative w-full aspect-[16/8] md:aspect-[16/4] max-h-screen overflow-hidden bg-gray-200 dark:bg-gray-800">
        
        {/* LAYER 1: The Clickable Background Image */}
        <div 
          className="absolute inset-0 cursor-pointer group"
          onClick={() => park.imagepath && window.open(park.imagepath, '_blank')}
        >
          <Image
            src={park.imagepath}
            alt={park.name}
            fill
            className={`object-cover transition-transform duration-750 group-hover:scale-105 ${
              imageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg"
            }`}
            priority
            unoptimized
            onLoad={() => setImageLoaded(true)}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-60" />
        </div>

        <h1 className="absolute bottom-6 left-6 text-4xl md:text-5xl font-bold text-white z-10 drop-shadow-lg pointer-events-none">
          {park.name}
        </h1>

        {/* LAYER 3: Admin UI */}
        {isAdminMode && (
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={(e) => { e.stopPropagation(); setShowModal(true); }}
              className="p-2 bg-black/60 hover:bg-blue-600 text-white border border-white/20 rounded-md transition-all backdrop-blur-md shadow-2xl cursor-pointer pointer-events-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </button>
          </div>
        )}

        {/* Success Toast Notification */}
        <div 
          className={`absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-full shadow-2xl transition-all duration-500 pointer-events-none ${
            showToast ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
          <span className="text-sm font-medium">Header updated successfully</span>
        </div>
      </div>

      {/* MODAL MOUNT */}
      {showModal && (
        <ParkHeaderModal 
          parkId={park.id} 
          parkName={park.name} 
          currentImagePath={park.imagepath}
          onClose={() => setShowModal(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
};

export default ParkHeader;