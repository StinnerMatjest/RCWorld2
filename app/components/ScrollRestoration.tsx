"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function ScrollRestoration() {
  const pathname = usePathname();

  useEffect(() => {
    const saveScroll = () => {
      sessionStorage.setItem(`scrollPos:${pathname}`, window.scrollY.toString());
    };
    
    window.addEventListener("beforeunload", saveScroll);
    
    const savedScroll = sessionStorage.getItem(`scrollPos:${pathname}`);
    if (savedScroll) {
      // A small timeout ensures dynamic content has had a moment to render
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo(0, parseInt(savedScroll, 10));
        }, 100);
      });
    }

    return () => window.removeEventListener("beforeunload", saveScroll);
  }, [pathname]);

  return null;
}