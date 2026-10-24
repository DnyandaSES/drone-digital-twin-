/* ────────────────────────────────────────────────────────
   AEROTWIN — SMOOTH NUMBER INTERPOLATION HOOK & COMPONENT
   Provides 60 FPS requestAnimationFrame easing for numerical
   telemetry values so instrument readouts glide smoothly
   instead of jumping instantaneously.
   ──────────────────────────────────────────────────────── */

import { useState, useEffect, useRef } from "react";

export interface SmoothNumberOptions {
  /** Animation duration in milliseconds (default: 250ms). */
  duration?: number;
  /** Number of decimal places to format to (default: 1). */
  decimals?: number;
}

/**
 * Returns a smoothly animated string representation of targetValue.
 */
export function useSmoothNumber(
  targetValue: number,
  options: SmoothNumberOptions = {}
): string {
  const { duration = 240, decimals = 1 } = options;

  const [displayValue, setDisplayValue] = useState<number>(targetValue);
  const currentRef = useRef<number>(targetValue);
  const targetRef = useRef<number>(targetValue);
  const startRef = useRef<number>(targetValue);
  const startTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    // If not a valid finite number, update immediately
    if (typeof targetValue !== "number" || isNaN(targetValue) || !isFinite(targetValue)) {
      setDisplayValue(0);
      return;
    }

    startRef.current = currentRef.current;
    targetRef.current = targetValue;
    startTimeRef.current = performance.now();

    // If change is tiny (< 0.001), skip animation
    if (Math.abs(startRef.current - targetRef.current) < 0.001) {
      currentRef.current = targetValue;
      setDisplayValue(targetValue);
      return;
    }

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / duration);

      // Smooth cubic ease-out curve: 1 - (1 - t)^3
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const nextVal = startRef.current + (targetRef.current - startRef.current) * easeOut;

      currentRef.current = nextVal;
      setDisplayValue(nextVal);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = targetRef.current;
        setDisplayValue(targetRef.current);
        rafRef.current = null;
      }
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [targetValue, duration]);

  return displayValue.toFixed(decimals);
}

/**
 * Visual component that renders an animated numeric readout.
 */
export function SmoothNumber({
  value,
  decimals = 1,
  duration = 240,
  unit = "",
  className,
}: {
  value: number;
  decimals?: number;
  duration?: number;
  unit?: string;
  className?: string;
}) {
  const formatted = useSmoothNumber(value, { decimals, duration });
  return (
    <span className={className}>
      {formatted}
      {unit ? ` ${unit}` : ""}
    </span>
  );
}
