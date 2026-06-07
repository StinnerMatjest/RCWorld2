import { useEffect } from "react";

// Module-level counter so multiple simultaneous locks work correctly.
// Scroll is locked when count > 0, restored only when the last holder releases.
let lockCount = 0;
let savedOverflow = "";

export function useScrollLock(isOpen = true) {
  useEffect(() => {
    if (!isOpen) return;

    if (lockCount === 0) {
      savedOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = savedOverflow;
        savedOverflow = "";
      }
    };
  }, [isOpen]);
}
