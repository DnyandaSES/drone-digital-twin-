import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { routes } from "./routes";
import { useTauriTelemetry } from "./hooks/useTauriTelemetry";

const router = createBrowserRouter(routes);

export default function App() {
  // Global telemetry
  useTauriTelemetry();

  return <RouterProvider router={router} />;
}