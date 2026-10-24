/* ────────────────────────────────────────────────────────
   AEROTWIN — BUS VOLTAGE GAUGE
   Configures the generic Gauge for DC Bus Voltage.
   ──────────────────────────────────────────────────────── */

import { useTelemetryStore } from "../../store/telemetryStore";
import { BUS_VOLTAGE_RANGE } from "../../lib/thresholds";
import Gauge from "../../charts/Gauge";


export default function BusVoltageGauge() {
  const voltage = useTelemetryStore((s) => s.current.dcBus.voltage);

  const status =
    voltage < 44 ? "caution" : voltage > 58 ? "caution" : "nominal";

  return (
    <Gauge
      value={voltage}
      min={BUS_VOLTAGE_RANGE.min}
      max={BUS_VOLTAGE_RANGE.max}
      unit="V"
      color="var(--chart-dc-bus)"
      status={status}
    />
  );
}
