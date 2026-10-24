import { Navigate, type RouteObject } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import Dashboard from "./pages/Dashboard";
import DigitalTwin from "./pages/DigitalTwin";
import Telemetry from "./pages/Telemetry";
import FlightLog from "./pages/FlightLog";
import Settings from "./pages/Settings";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "digital-twin",
        element: <DigitalTwin />,
      },
      {
        path: "telemetry",
        element: <Telemetry />,
      },
      {
        path: "flight-log",
        element: <FlightLog />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
];