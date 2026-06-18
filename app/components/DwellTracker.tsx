"use client";

import { useEffect } from "react";

// Measures how long the reader actively spends on this article (tab visible) and
// reports it via sendBeacon. This dwell time is what upranks popular articles.
export function DwellTracker({ slug }: { slug: string }) {
  useEffect(() => {
    let activeSince = performance.now();
    let pending = 0;

    const send = () => {
      if (document.visibilityState === "visible") {
        pending += performance.now() - activeSince;
        activeSince = performance.now();
      }
      const ms = Math.min(Math.round(pending), 10 * 60 * 1000); // cap at 10 min
      pending = 0;
      if (ms > 1500) {
        navigator.sendBeacon("/api/dwell", JSON.stringify({ slug, ms }));
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") send();
      else activeSince = performance.now();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", send);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", send);
    };
  }, [slug]);

  return null;
}
