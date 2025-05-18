"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "./Navbar";

const Header = () => {
  return (
    <header className="w-full bg-white py-4 px-6 flex items-center justify-between animate-fade-in">
<div className="relative h-50 w-100 sm:h-24 md:h-32 lg:h-36">
  <Link href="/">
    <Image
      src="https://pub-ea1e61b5d5614f95909efeacb8943e78.r2.dev/Parkrating.png"
      alt="Parkrating Logo"
      fill
      className="object-contain cursor-pointer"
      unoptimized
    />
  </Link>
</div>

      <Navbar/>
    </header>
  );
};

export default Header;
