import React from "react";
import Navbar from "./Navbar";

const Header = () => {
  return (
    <header className="w-full bg-white py-4 px-6 flex items-center justify-between animate-fade-in">
      {/* Logo */}
      <img
        src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/Parkrating.png"
        alt="Logo"
        className="h-20 sm:h-24 md:h-32 lg:h-36 max-w-full object-contain"
      />

      {/* Navbar */}
      <Navbar />
    </header>
  );
};

export default Header;
