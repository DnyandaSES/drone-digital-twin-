/* ────────────────────────────────────────────────────────
   AEROTWIN — useResolvedTheme
   Returns the current resolved theme ("dark" | "light")
   by watching the data-theme attribute on <html>.
   Works reactively — re-renders when theme changes.
   ──────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";


export type ResolvedTheme = "dark" | "light";


function getCurrentTheme(): ResolvedTheme {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "field") return "light";
  if (attr === "standard") return "dark";
  // "system" mode — no attribute set; check prefers-color-scheme
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}


export function useResolvedTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(getCurrentTheme);

  useEffect(() => {
    // Watch for attribute changes on <html>
    const observer = new MutationObserver(() => {
      setTheme(getCurrentTheme());
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // Also watch prefers-color-scheme for "system" mode
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setTheme(getCurrentTheme());
    mq.addEventListener("change", handler);

    return () => {
      observer.disconnect();
      mq.removeEventListener("change", handler);
    };
  }, []);

  return theme;
}
