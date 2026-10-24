/* ────────────────────────────────────────────────────────
   AEROTWIN — VIEW CONTROLS
   Camera preset buttons + view mode selector + exploded
   slider + label toggle overlaid on the 3D viewport.
   ──────────────────────────────────────────────────────── */

import {
  Eye, RotateCcw, Layers, Box, Flame, Zap, AlertTriangle,
  Tag,
} from "lucide-react";
import { useTwinViewStore, type ViewMode } from "../../store/twinViewStore";
import styles from "./ViewControls.module.css";


interface ViewControlsProps {
  onPreset: (preset: string) => void;
  onReset: () => void;
}

const cameraPresets = [
  { key: "perspective", label: "3D" },
  { key: "top",         label: "TOP" },
  { key: "bottom",      label: "BTM" },
  { key: "front",       label: "FWD" },
  { key: "side",        label: "SIDE" },
  { key: "rear",        label: "REAR" },
];

const viewModes: { mode: ViewMode; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }[] = [
  { mode: "external",    label: "EXT",  icon: Eye },
  { mode: "translucent", label: "TWIN", icon: Layers },
  { mode: "internal",    label: "INT",  icon: Box },
  { mode: "hydrogen",    label: "H₂",   icon: Flame },
  { mode: "electrical",  label: "ELEC", icon: Zap },
  { mode: "fault",       label: "FAULT",icon: AlertTriangle },
];


export default function ViewControls({ onPreset, onReset }: ViewControlsProps) {
  const viewMode = useTwinViewStore((s) => s.viewMode);
  const setViewMode = useTwinViewStore((s) => s.setViewMode);
  const shellOpacity = useTwinViewStore((s) => s.shellOpacity);
  const setShellOpacity = useTwinViewStore((s) => s.setShellOpacity);
  const showLabels = useTwinViewStore((s) => s.showLabels);
  const toggleLabels = useTwinViewStore((s) => s.toggleLabels);

  return (
    <div className={styles.bar}>
      {/* ── View Mode Selector ──────────────────────────── */}
      <div className={styles.group}>
        {viewModes.map((vm) => {
          const Icon = vm.icon;
          const active = viewMode === vm.mode;
          return (
            <button
              key={vm.mode}
              className={`${styles.btn} ${active ? styles.active : ""}`}
              onClick={() => setViewMode(vm.mode)}
              title={`${vm.label} View`}
            >
              <Icon size={12} strokeWidth={1.6} />
              <span className={styles.btnLabel}>{vm.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Divider ─────────────────────────────────────── */}
      <div className={styles.divider} />

      {/* ── Camera Presets ──────────────────────────────── */}
      <div className={styles.group}>
        <Eye size={14} strokeWidth={1.6} className={styles.icon} />
        {cameraPresets.map((p) => (
          <button
            key={p.key}
            className={styles.btn}
            onClick={() => onPreset(p.key)}
            title={`${p.label} View`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Divider ─────────────────────────────────────── */}
      <div className={styles.divider} />

      {/* ── Label Toggle ───────────────────────────────── */}
      <button
        className={`${styles.btn} ${showLabels ? styles.active : ""}`}
        onClick={toggleLabels}
        title="Toggle Labels"
      >
        <Tag size={13} strokeWidth={1.6} />
      </button>

      {/* ── Reset ──────────────────────────────────────── */}
      <button
        className={`${styles.btn} ${styles.reset}`}
        onClick={onReset}
        title="Reset View"
      >
        <RotateCcw size={13} strokeWidth={1.8} />
      </button>

      {/* ── Sliders (conditional) ──────────────────────── */}
      {(viewMode === "translucent" || viewMode === "internal") && (
        <div className={styles.sliderGroup}>
          <span className={styles.sliderLabel}>SHELL</span>
          <input
            type="range"
            min={0} max={100}
            value={Math.round(shellOpacity * 100)}
            onChange={(e) => setShellOpacity(Number(e.target.value) / 100)}
            className={styles.slider}
          />
        </div>
      )}
    </div>
  );
}
