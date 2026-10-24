/* ────────────────────────────────────────────────────────
   AEROTWIN — useTheme
   Hook for theme preference: "system" | "dark" | "light".
   Persists to localStorage and sets data-theme on <html>.
   ──────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";

export type ThemeMode = "system" | "dark" | "light";

const STORAGE_KEY = "aerotwin-theme-preference";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    return saved === "dark" || saved === "light" || saved === "system" ? saved : "system";
  });

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore localStorage write failures
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else if (theme === "dark") {
      root.setAttribute("data-theme", "standard");
    } else if (theme === "light") {
      root.setAttribute("data-theme", "field");
    }
  }, [theme]);

  return { theme, setTheme };
}
