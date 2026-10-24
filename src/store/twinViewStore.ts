/* ────────────────────────────────────────────────────────
   AEROTWIN — TWIN VIEW STORE  (Zustand)
   Manages Digital Twin visualization modes, exploded view,
   component highlights, and fault visualization state.
   ──────────────────────────────────────────────────────── */

import { create } from "zustand";

export type ViewMode =
  | "external"      // Mode 1: Opaque outer shell
  | "translucent"   // Mode 2: Semi-transparent shell (default)
  | "internal"      // Mode 3: Shell nearly invisible
  | "hydrogen"      // Mode 4: H₂ system highlighted
  | "electrical"    // Mode 5: Electrical system highlighted
  | "fault";        // Mode 6: Fault detection view

export type FaultLevel = "normal" | "warning" | "fault" | "disconnected" | "nodata";

export interface TwinViewState {
  /** Current visualization mode. */
  viewMode: ViewMode;

  /** Outer shell opacity override (0 = invisible, 1 = opaque). */
  shellOpacity: number;

  /** Exploded view factor (0 = assembled, 1 = fully exploded). */
  explodedFactor: number;

  /** Whether to show engineering component labels. */
  showLabels: boolean;

  /** Currently highlighted component (null = none). */
  highlightedComponent: string | null;

  /** Fault overrides for demo/testing (component id → fault level). */
  faultOverrides: Record<string, FaultLevel>;

  /* ── Actions ─────────────────────────────────────────── */

  setViewMode: (mode: ViewMode) => void;
  setShellOpacity: (opacity: number) => void;
  setExplodedFactor: (factor: number) => void;
  setShowLabels: (show: boolean) => void;
  toggleLabels: () => void;
  setHighlightedComponent: (id: string | null) => void;
  setFaultOverride: (componentId: string, level: FaultLevel) => void;
  clearFaultOverrides: () => void;
}

/** Shell opacity defaults for each view mode. */
export const MODE_SHELL_OPACITY: Record<ViewMode, number> = {
  external: 1.0,
  translucent: 0.3,
  internal: 0.05,
  hydrogen: 0.15,
  electrical: 0.15,
  fault: 0.25,
};

export const useTwinViewStore = create<TwinViewState>((set) => ({
  viewMode: "translucent",
  shellOpacity: MODE_SHELL_OPACITY.translucent,
  explodedFactor: 0,
  showLabels: false,
  highlightedComponent: null,
  faultOverrides: {},

  setViewMode: (mode) =>
    set({
      viewMode: mode,
      shellOpacity: MODE_SHELL_OPACITY[mode],
      explodedFactor: 0,
    }),

  setShellOpacity: (opacity) =>
    set({ shellOpacity: Math.max(0, Math.min(1, opacity)) }),

  setExplodedFactor: (factor) =>
    set({ explodedFactor: Math.max(0, Math.min(1, factor)) }),

  setShowLabels: (show) => set({ showLabels: show }),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),

  setHighlightedComponent: (id) => set({ highlightedComponent: id }),

  setFaultOverride: (componentId, level) =>
    set((s) => ({
      faultOverrides: { ...s.faultOverrides, [componentId]: level },
    })),

  clearFaultOverrides: () => set({ faultOverrides: {} }),
}));
