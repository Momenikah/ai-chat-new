"use client";

import { useEffect, useRef, useState } from "react";
import { useIsFetching, useIsMutating } from "@tanstack/react-query";

/**
 * Thin top-of-viewport progress bar driven by React Query.
 *
 * Shows whenever any query is fetching or any mutation is in flight, with a
 * short trailing fade so very-fast requests still feel acknowledged. Sits
 * above the dashboard topbar (z-50) and doesn't intercept any clicks.
 */
export function TopProgressBar() {
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const busy = fetching > 0 || mutating > 0;

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (busy) {
      // Start a new run: cancel any pending hide, jump to a visible level,
      // then ease toward 90% so we never look "done" while still loading.
      if (hideRef.current) clearTimeout(hideRef.current);
      setVisible(true);
      setProgress((p) => (p < 8 ? 8 : p));
      if (!tickRef.current) {
        tickRef.current = setInterval(() => {
          setProgress((p) => {
            const headroom = 90 - p;
            if (headroom <= 0) return p;
            // Diminishing-returns climb: fast at first, slow near 90.
            return p + Math.max(0.5, headroom * 0.08);
          });
        }, 180);
      }
      return;
    }

    // No active work: snap to 100%, then fade out and reset.
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    setProgress(100);
    hideRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }, [busy]);

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (hideRef.current) clearTimeout(hideRef.current);
    },
    [],
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5"
    >
      <div
        className="h-full bg-zinc-900 shadow-[0_0_8px_rgba(24,24,27,0.4)] transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: visible ? 1 : 0,
        }}
      />
    </div>
  );
}
