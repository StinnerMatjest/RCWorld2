import React from "react";
import Navbar from "./Navbar";

const Header = () => {
  return (
    <div className="relative w-full bg-white">
      <div className="absolute top-4 right-6">
        <Navbar />
      </div>

      <div className="flex justify-center items-center py-10">
        <img
          src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/Parkrating.png"
          alt="Logo"
          className="max-w-full h-auto"
          style={{ height: "400px"}}
        />
      </div>
    </div>
  );
};

export default Header;
