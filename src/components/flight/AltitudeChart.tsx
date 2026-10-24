/* ────────────────────────────────────────────────────────
   AEROTWIN — ALTITUDE CHART
   Configures TelemetryLineChart for altitude data.
   ──────────────────────────────────────────────────────── */

import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import TelemetryLineChart from "../../charts/TelemetryLineChart";


function AltitudeChart() {
  const altitudeData = useTelemetryStore((s) => s.history.altitude);

  return (
    <TelemetryLineChart
      data={altitudeData}
      color="var(--chart-live)"
      unit="m"
      height={180}
      showGrid
      showTooltip
    />
  );
}

export default memo(AltitudeChart);
