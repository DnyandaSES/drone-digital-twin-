/* ────────────────────────────────────────────────────────
   AEROTWIN — BUS CURRENT GAUGE
   Configures the generic Gauge for DC Bus Current.
   ──────────────────────────────────────────────────────── */

import { useTelemetryStore } from "../../store/telemetryStore";
import { BUS_CURRENT_RANGE, DC_BUS_THRESHOLDS, getSeverityAbove } from "../../lib/thresholds";
import Gauge from "../../charts/Gauge";


export default function BusCurrentGauge() {
  const current = useTelemetryStore((s) => s.current.dcBus.current);

  const status = getSeverityAbove(
    current,
    DC_BUS_THRESHOLDS.current.caution,
    DC_BUS_THRESHOLDS.current.critical,
  );

  return (
    <Gauge
      value={current}
      min={BUS_CURRENT_RANGE.min}
      max={BUS_CURRENT_RANGE.max}
      unit="A"
      color="var(--chart-dc-bus)"
      status={status}
    />
  );
}
