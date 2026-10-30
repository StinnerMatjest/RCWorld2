"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { isFramingPreview } from "@/app/lib/framingPreview";

/**
 * Umami Cloud analytics. Loaded after hydration (as "afterInteractive" always
 * did), except inside the clean-up tool's preview iframes, which would count
 * every framing check as a page view.
 */
export default function Analytics() {
  const [load, setLoad] = useState(false);
  useEffect(() => { setLoad(!isFramingPreview()); }, []);
  if (!load) return null;
  return (
    <Script
      src="https://cloud.umami.is/script.js"
      data-website-id="acd51e6e-baaa-4194-aaf1-41851db17222"
      strategy="afterInteractive"
      defer
    />
  );
}
