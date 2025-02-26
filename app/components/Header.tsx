import React from "react";
import Navbar from "./Navbar";

const Header = () => {
  return (
    <div className="flex justify-center items-center bg-gray-700">
      <img
        src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/RCWorld.PNG"
        alt="Logo"
        className="object-contain ml-auto mr-auto pl-20"
        height="425px"
        width="425px"
      />
      <div className="flex-shrink-0">
        <Navbar/>
      </div>
    </div>
  );
};

export default Header;
