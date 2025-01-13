"use client";
import React from 'react';
import { useRouter } from 'next/navigation'; // Updated import

const Footer = () => {
  const router = useRouter();

  const openModal = () => {
    router.push('?modal=true'); // Add modal=true to the query string without shallow
  };

  return (
    <footer className="footer bg-neutral text-neutral-content p-10 flex justify-center items-center">
      <a
        href="#"
        className="w-72 py-4 px-8 text-2xl font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition duration-300 flex justify-center items-center"
        onClick={openModal} // Open the modal
      >
        RATE A PARK
      </a>
    </footer>
  );
};

export default Footer;
