import { Outlet, useLocation } from "react-router-dom";

import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

import styles from "./AppShell.module.css";

const pageTitles: Record<string, string> = {
  "/dashboard": "DASHBOARD",
  "/digital-twin": "DIGITAL TWIN",
  "/telemetry": "TELEMETRY",
  "/flight-log": "FLIGHT LOG",
  "/settings": "SETTINGS",
};

export default function AppShell() {
  const location = useLocation();

  const pageTitle = pageTitles[location.pathname] ?? "DASHBOARD";

  return (
    <div className={styles.shell}>
      <Sidebar />

      <main className={styles.main}>
        <TopBar pageTitle={pageTitle} />

        <div className={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
