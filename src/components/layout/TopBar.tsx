/* ────────────────────────────────────────────────────────
   AEROTWIN — TOP BAR
   Persistent header: brand, page title, connection
   status, and mission clock.
   ──────────────────────────────────────────────────────── */

import { Radio, WifiOff, Sun, Moon, Monitor } from "lucide-react";

import { useTelemetryStore } from "../../store/telemetryStore";
import { useMissionClock } from "../../hooks/useMissionClock";
import { useTheme, type ThemeMode } from "../../hooks/useTheme";

import styles from "./TopBar.module.css";


interface TopBarProps {
  pageTitle?: string;
}

export default function TopBar({ pageTitle = "DASHBOARD" }: TopBarProps) {
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);
  const missionTime = useMissionClock();
  const { theme, setTheme } = useTheme();

  const connected = connectionStatus === "connected";
  const udpPort = 8888;

  const themeOptions: { mode: ThemeMode; label: string; icon: typeof Monitor }[] = [
    { mode: "system", label: "System", icon: Monitor },
    { mode: "dark", label: "Dark", icon: Moon },
    { mode: "light", label: "Light", icon: Sun },
  ];

  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <span className={styles.brand}>AEROTWIN</span>

        <span className={styles.pageTitle}>{pageTitle}</span>

        <div
          className={`${styles.connection} ${
            !connected ? styles.connectionLost : ""
          }`}
        >
          {connected ? (
            <Radio size={14} strokeWidth={1.6} aria-hidden="true" />
          ) : (
            <WifiOff size={14} strokeWidth={1.6} aria-hidden="true" />
          )}

          <span className={styles.statusDot} />

          <span className={styles.connectionText}>
            UDP :{udpPort} — {connected ? "LINK OK" : "NO SIGNAL"}
          </span>
        </div>
      </div>

      <div className={styles.right}>
        <div className={styles.themeSelector} role="radiogroup" aria-label="Theme mode switch">
          {themeOptions.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              className={`${styles.themeBtn} ${
                theme === mode ? styles.themeBtnActive : ""
              }`}
              onClick={() => setTheme(mode)}
              title={`${label} theme`}
              aria-label={`${label} theme`}
              aria-checked={theme === mode}
              role="radio"
            >
              <Icon size={12} strokeWidth={1.8} />
              <span className={styles.themeLabel}>{label}</span>
            </button>
          ))}
        </div>

        <span className={styles.divider} />

        <span className={styles.missionClock}>{missionTime}</span>
      </div>
    </header>
  );
}
