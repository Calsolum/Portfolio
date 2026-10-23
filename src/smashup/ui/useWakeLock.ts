"use client";

import { useEffect, useState } from "react";

/** Whether this browser can keep the screen on; false until hydration. */
export function useWakeLockSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator exists only in the browser
    setSupported("wakeLock" in navigator);
  }, []);
  return supported;
}

/**
 * Keeps the screen from sleeping while `enabled`, so the board stays up on the
 * table. Browsers drop the lock when the tab is hidden, so it is asked for again
 * on return.
 */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = () => {
      navigator.wakeLock
        .request("screen")
        .then((sentinel) => {
          if (active) lock = sentinel;
          else void sentinel.release();
        })
        .catch(() => {
          // Refused (battery saver, say): the screen just sleeps as usual.
        });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void lock?.release();
    };
  }, [enabled]);
}
