/* ────────────────────────────────────────────────────────
   AEROTWIN — EXPANDABLE SIDEBAR WITH FRAMER MOTION
   Silky 120fps hardware-accelerated liquid motion sidebar.
   ──────────────────────────────────────────────────────── */

import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Box,
  Clock3,
  Gauge,
  PanelLeftClose,
  Settings,
  Waypoints,
} from "lucide-react";
import { NavLink } from "react-router-dom";
import styles from "./Sidebar.module.css";

interface NavigationItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: boolean;
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: Gauge,
  },
  {
    label: "Digital Twin",
    path: "/digital-twin",
    icon: Box,
  },
  {
    label: "Telemetry",
    path: "/telemetry",
    icon: Waypoints,
  },
  {
    label: "Flight Log",
    path: "/flight-log",
    icon: Clock3,
  },
  {
    label: "Settings",
    path: "/settings",
    icon: Settings,
  },
];

const STORAGE_KEY = "aerotwin-sidebar-expanded";

// Apple macOS Liquid Ease Curve (zero-jitter 60/120fps hardware composite)
const liquidTransition = {
  duration: 0.36,
  ease: [0.16, 1, 0.3, 1] as const,
};

const textVariants: Variants = {
  collapsed: {
    opacity: 0,
    x: -10,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeOut" },
  },
  expanded: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.32,
      ease: [0.16, 1, 0.3, 1],
      delay: 0.04,
    },
  },
};

export default function Sidebar() {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "true";
  });

  const toggleSidebar = () => {
    setIsExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // Ignore localStorage write errors
      }
      return next;
    });
  };

  return (
    <motion.aside
      className={`${styles.sidebar} ${isExpanded ? styles.expanded : ""}`}
      initial={false}
      animate={{
        width: isExpanded ? 200 : 64,
      }}
      transition={liquidTransition}
      style={{ willChange: "width", transform: "translateZ(0)" }}
    >
      {/* Header / Brand */}
      <div className={styles.headerRow}>
        <motion.div
          className={styles.mark}
          aria-label="AeroTwin"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          AT
        </motion.div>

        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span
              key="brandText"
              className={styles.brandText}
              variants={textVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              AEROTWIN
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Main Navigation Items */}
      <nav className={styles.navigation} aria-label="Main navigation">
        {navigationItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ""}`
              }
            >
              <motion.div
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                <Icon size={20} strokeWidth={1.6} aria-hidden="true" />
              </motion.div>

              <AnimatePresence>
                {isExpanded ? (
                  <motion.span
                    key="inlineLabel"
                    className={styles.label}
                    variants={textVariants}
                    initial="collapsed"
                    animate="expanded"
                    exit="collapsed"
                  >
                    {item.label}
                  </motion.span>
                ) : (
                  <span key="tooltipLabel" className={styles.labelTooltip}>
                    {item.label}
                  </span>
                )}
              </AnimatePresence>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Toggle Expand / Collapse Button */}
      <motion.button
        type="button"
        className={styles.toggleBtn}
        onClick={toggleSidebar}
        whileHover={{ background: "var(--bg-panel-raised)" }}
        whileTap={{ scale: 0.96 }}
        title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        aria-label={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
      >
        <motion.div
          animate={{ rotate: isExpanded ? 0 : 180 }}
          transition={liquidTransition}
          style={{ display: "flex", alignItems: "center" }}
        >
          <PanelLeftClose size={20} strokeWidth={1.6} />
        </motion.div>

        <AnimatePresence mode="wait">
          {isExpanded && (
            <motion.span
              key="toggleText"
              className={styles.toggleLabel}
              variants={textVariants}
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
            >
              Collapse
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.aside>
  );
}
