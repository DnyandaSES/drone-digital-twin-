/* ────────────────────────────────────────────────────────
   AEROTWIN — TELEMETRY LINE CHART (60 FPS HARDWARE ACCELERATED)
   High-performance HTML5 Canvas real-time rolling telemetry
   graph. Uses continuous requestAnimationFrame time interpolation
   for silky-smooth oscilloscope motion, smooth Catmull-Rom cubic
   splines, glowing telemetry fills, and zero-overhead rendering.
   ──────────────────────────────────────────────────────── */

import { memo, useEffect, useRef, useCallback } from "react";
import type { TelemetryPoint } from "../types/telemetry";
import chartStyles from "./TelemetryLineChart.module.css";

interface TelemetryLineChartProps {
  /** Array of { time, value } points. */
  data: TelemetryPoint[];

  /** Line color — defaults to live cyan. */
  color?: string;

  /** Y-axis domain [min, max]. */
  yDomain?: [number | "auto", number | "auto"];

  /** Unit label for the Y-axis and tooltip. */
  unit?: string;

  /** Chart height in px. */
  height?: number;

  /** Show grid lines. */
  showGrid?: boolean;

  /** Show hover tooltip. */
  showTooltip?: boolean;

  /** Label for the chart legend. */
  label?: string;
}

// Convert CSS color / var to RGBA with specified alpha
function parseColorWithAlpha(ctx: CanvasRenderingContext2D, colorStr: string, alpha: number): string {
  ctx.save();
  ctx.fillStyle = colorStr;
  const computed = ctx.fillStyle;
  ctx.restore();

  if (computed.startsWith("#")) {
    const hex = computed.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } else if (computed.startsWith("rgb")) {
    const parts = computed.match(/[\d.]+/g);
    if (parts && parts.length >= 3) {
      return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
    }
  }
  return colorStr;
}

function TelemetryLineChart({
  data,
  color = "var(--accent-cyan)",
  yDomain,
  unit = "",
  height = 140,
  showGrid = true,
  showTooltip = true,
  label,
}: TelemetryLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keep latest props in refs to avoid restarting RAF loop
  const dataRef = useRef<TelemetryPoint[]>(data);
  dataRef.current = data;

  const colorRef = useRef<string>(color);
  colorRef.current = color;

  const yDomainRef = useRef(yDomain);
  yDomainRef.current = yDomain;

  const unitRef = useRef(unit);
  unitRef.current = unit;

  const showGridRef = useRef(showGrid);
  showGridRef.current = showGrid;

  const showTooltipRef = useRef(showTooltip);
  showTooltipRef.current = showTooltip;

  // Hover state
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);

  // Smooth Y-axis bounds state
  const hasInitYRef = useRef<boolean>(false);
  const renderedYMinRef = useRef<number>(0);
  const renderedYMaxRef = useRef<number>(10);

  // Smooth continuous time state
  const displayTimeRef = useRef<number>(0);
  const lastRafTimeRef = useRef<number>(performance.now());

  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePosRef.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;
    let isMounted = true;

    const render = (now: number) => {
      if (!isMounted) return;

      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = rect.width;
      const h = height;

      if (width <= 0 || h <= 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      // Resize canvas buffer if dimensions changed
      const targetCanvasWidth = Math.round(width * dpr);
      const targetCanvasHeight = Math.round(h * dpr);
      if (canvas.width !== targetCanvasWidth || canvas.height !== targetCanvasHeight) {
        canvas.width = targetCanvasWidth;
        canvas.height = targetCanvasHeight;
      }

      const ctx = canvas.getContext("2d", { alpha: true });
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, h);

      // Resolve dynamic CSS variable colors
      const computedStyle = getComputedStyle(container);
      const resolveCss = (v: string) => {
        if (v.startsWith("var(")) {
          const varName = v.slice(4, -1).trim();
          return computedStyle.getPropertyValue(varName).trim() || "#4FD8E0";
        }
        return v;
      };

      const strokeColor = resolveCss(colorRef.current);
      const rivetColor = resolveCss("var(--line-rivet)") || "rgba(255, 255, 255, 0.08)";
      const textInstrumentColor = resolveCss("var(--text-instrument)") || "#94A3B8";

      // ── TIME ADVANCEMENT (60 FPS SMOOTH GLIDE) ─────────────
      const dt = Math.min((now - lastRafTimeRef.current) / 1000, 0.1);
      lastRafTimeRef.current = now;

      const currentData = dataRef.current;
      const latestDataTime = currentData.length > 0 ? currentData[currentData.length - 1].time : 0;

      if (displayTimeRef.current === 0) {
        displayTimeRef.current = latestDataTime;
      } else if (latestDataTime > 0) {
        const delta = latestDataTime - displayTimeRef.current;
        if (delta > 3) {
          // Large gap / tab switch: jump to latest
          displayTimeRef.current = latestDataTime;
        } else if (delta > 0) {
          // Smoothly glide forward, slightly adjusting speed to track stream
          displayTimeRef.current += dt * (1 + Math.min(delta * 1.5, 0.8));
        } else {
          // Stream temporarily paused: advance at partial rate
          displayTimeRef.current += dt * 0.3;
        }
      }

      const displayTime = displayTimeRef.current;
      const windowDuration = 30; // 30-second rolling window
      const timeMin = displayTime - windowDuration;
      const timeMax = displayTime;

      // ── MARGINS & PLOT RECTANGLE ───────────────────────────
      const marginLeft = 38;
      const marginRight = 10;
      const marginTop = 18;
      const marginBottom = 20;

      const plotX = marginLeft;
      const plotY = marginTop;
      const plotW = Math.max(10, width - marginLeft - marginRight);
      const plotH = Math.max(10, h - marginTop - marginBottom);

      // ── FILTER POINTS WITHIN ROLLING WINDOW ────────────────
      const visiblePoints: Array<{ x: number; yVal: number; time: number }> = [];

      let rawMin = Infinity;
      let rawMax = -Infinity;

      for (let i = 0; i < currentData.length; i++) {
        const pt = currentData[i];
        if (pt.time >= timeMin - 1.5 && pt.time <= timeMax + 1.5) {
          const x = plotX + ((pt.time - timeMin) / windowDuration) * plotW;
          visiblePoints.push({ x, yVal: pt.value, time: pt.time });
          if (pt.value < rawMin) rawMin = pt.value;
          if (pt.value > rawMax) rawMax = pt.value;
        }
      }

      // ── Y-AXIS AUTO SCALING WITH SMOOTH INTERPOLATION ──────
      const yDomainCfg = yDomainRef.current;
      let targetMin = 0;
      let targetMax = 10;

      if (yDomainCfg && typeof yDomainCfg[0] === "number" && typeof yDomainCfg[1] === "number") {
        targetMin = yDomainCfg[0];
        targetMax = yDomainCfg[1];
      } else if (rawMin !== Infinity && rawMax !== -Infinity) {
        if (rawMin === rawMax) {
          targetMin = rawMin - 1;
          targetMax = rawMax + 1;
        } else {
          const span = rawMax - rawMin;
          targetMin = rawMin - span * 0.12;
          targetMax = rawMax + span * 0.12;
        }
      }

      if (!hasInitYRef.current) {
        hasInitYRef.current = true;
        renderedYMinRef.current = targetMin;
        renderedYMaxRef.current = targetMax;
      } else {
        // Smoothly interpolate vertical scale to prevent abrupt jerking
        renderedYMinRef.current += (targetMin - renderedYMinRef.current) * 0.1;
        renderedYMaxRef.current += (targetMax - renderedYMaxRef.current) * 0.1;
      }

      const yMin = renderedYMinRef.current;
      const yMax = renderedYMaxRef.current;
      const ySpan = Math.max(0.001, yMax - yMin);

      const getYPixel = (val: number) => {
        return plotY + plotH - ((val - yMin) / ySpan) * plotH;
      };

      // ── DRAW GRID & AXIS TICKS ─────────────────────────────
      if (showGridRef.current) {
        ctx.strokeStyle = rivetColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        // Horizontal grid lines (3 intermediate divisions)
        const yTicks = [yMin, yMin + ySpan * 0.333, yMin + ySpan * 0.666, yMax];
        for (let i = 0; i < yTicks.length; i++) {
          const tickVal = yTicks[i];
          const y = getYPixel(tickVal);

          ctx.beginPath();
          ctx.moveTo(plotX, y);
          ctx.lineTo(plotX + plotW, y);
          ctx.stroke();

          // Y-axis label
          ctx.fillStyle = textInstrumentColor;
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          ctx.fillText(tickVal.toFixed(0), plotX - 5, y);
        }

        // Vertical grid lines & X-axis time ticks
        const xTicks = [
          { rel: -30, label: "-30s", align: "left" as const, xPct: 0 },
          { rel: -20, label: "-20s", align: "center" as const, xPct: 10 / 30 },
          { rel: -10, label: "-10s", align: "center" as const, xPct: 20 / 30 },
          { rel: 0, label: "Now", align: "right" as const, xPct: 1 },
        ];

        for (const t of xTicks) {
          const x = plotX + t.xPct * plotW;

          ctx.beginPath();
          ctx.moveTo(x, plotY);
          ctx.lineTo(x, plotY + plotH);
          ctx.stroke();

          // X label
          ctx.fillStyle = textInstrumentColor;
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.textAlign = t.align;
          ctx.textBaseline = "top";
          ctx.fillText(t.label, x, plotY + plotH + 5);
        }
      }

      // ── DRAW SPLINE CURVE ──────────────────────────────────
      if (visiblePoints.length >= 2) {
        // Compute pixel points
        const pts = visiblePoints.map((p) => ({
          x: p.x,
          y: getYPixel(p.yVal),
          time: p.time,
          rawVal: p.yVal,
        }));

        // Clip to plot area so lines don't bleed into axis margins
        ctx.save();
        ctx.beginPath();
        ctx.rect(plotX - 1, plotY - 2, plotW + 2, plotH + 4);
        ctx.clip();

        // 1. Draw glowing gradient area fill under the line
        ctx.beginPath();
        ctx.moveTo(pts[0].x, plotY + plotH);
        ctx.lineTo(pts[0].x, pts[0].y);

        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = i > 0 ? pts[i - 1] : pts[i];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

          if (p2.time - p1.time > 3.0) {
            ctx.lineTo(p1.x, plotY + plotH);
            ctx.lineTo(p2.x, plotY + plotH);
            ctx.lineTo(p2.x, p2.y);
            continue;
          }

          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x + (p3.x - p1.x) / 6;
          const cp2y = p2.y + (p3.y - p1.y) / 6;

          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        ctx.lineTo(pts[pts.length - 1].x, plotY + plotH);
        ctx.closePath();

        const areaGrad = ctx.createLinearGradient(0, plotY, 0, plotY + plotH);
        areaGrad.addColorStop(0, parseColorWithAlpha(ctx, strokeColor, 0.16));
        areaGrad.addColorStop(1, parseColorWithAlpha(ctx, strokeColor, 0.0));
        ctx.fillStyle = areaGrad;
        ctx.fill();

        // 2. Draw smooth stroke line
        ctx.beginPath();
        let inSubpath = false;

        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = i > 0 ? pts[i - 1] : pts[i];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

          if (p2.time - p1.time > 3.0) {
            inSubpath = false;
            continue;
          }

          if (!inSubpath) {
            ctx.moveTo(p1.x, p1.y);
            inSubpath = true;
          }

          const cp1x = p1.x + (p2.x - p0.x) / 6;
          const cp1y = p1.y + (p2.y - p0.y) / 6;
          const cp2x = p2.x + (p3.x - p1.x) / 6;
          const cp2y = p2.y + (p3.y - p1.y) / 6;

          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.75;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.stroke();

        ctx.restore(); // Restore clip

        // ── HOVER TOOLTIP & TRACKING CROSSHAIR ───────────────
        const mouse = mousePosRef.current;
        if (showTooltipRef.current && mouse && mouse.x >= plotX && mouse.x <= plotX + plotW && mouse.y >= plotY && mouse.y <= plotY + plotH) {
          // Find closest point to mouse X
          let closestPt = pts[0];
          let minDist = Math.abs(pts[0].x - mouse.x);
          for (let i = 1; i < pts.length; i++) {
            const dist = Math.abs(pts[i].x - mouse.x);
            if (dist < minDist) {
              minDist = dist;
              closestPt = pts[i];
            }
          }

          if (minDist < 40) {
            // Vertical crosshair
            ctx.save();
            ctx.strokeStyle = textInstrumentColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(closestPt.x, plotY);
            ctx.lineTo(closestPt.x, plotY + plotH);
            ctx.stroke();
            ctx.restore();

            // Glowing indicator dot
            ctx.beginPath();
            ctx.arc(closestPt.x, closestPt.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = strokeColor;
            ctx.fill();
            ctx.strokeStyle = "#0B0F19";
            ctx.lineWidth = 2;
            ctx.stroke();

            // Tooltip Pill
            const unitSuffix = unitRef.current ? ` ${unitRef.current}` : "";
            const tipText = `${closestPt.rawVal.toFixed(1)}${unitSuffix}`;
            ctx.font = '11px "JetBrains Mono", monospace';
            const textWidth = ctx.measureText(tipText).width;
            const padX = 8;
            const boxW = textWidth + padX * 2;
            const boxH = 22;

            let tipX = closestPt.x - boxW / 2;
            let tipY = closestPt.y - 28;

            // Keep within chart bounds
            if (tipX < plotX) tipX = plotX + 4;
            if (tipX + boxW > plotX + plotW) tipX = plotX + plotW - boxW - 4;
            if (tipY < plotY) tipY = closestPt.y + 12;

            // Pill background
            ctx.fillStyle = "rgba(15, 23, 42, 0.92)";
            ctx.strokeStyle = rivetColor;
            ctx.lineWidth = 1;

            ctx.beginPath();
            if (typeof (ctx as unknown as { roundRect?: Function }).roundRect === "function") {
              (ctx as unknown as { roundRect: Function }).roundRect(tipX, tipY, boxW, boxH, 4);
            } else {
              ctx.rect(tipX, tipY, boxW, boxH);
            }
            ctx.fill();
            ctx.stroke();

            // Pill text
            ctx.fillStyle = "#F8FAFC";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(tipText, tipX + boxW / 2, tipY + boxH / 2);
          }
        }
      } else if (visiblePoints.length === 1) {
        // Single point baseline
        const y = getYPixel(visiblePoints[0].yVal);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(plotX, y);
        ctx.lineTo(plotX + plotW, y);
        ctx.stroke();
      }

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, [height]);

  return (
    <div ref={containerRef} className={chartStyles.wrap} style={{ height }}>
      {label && <span className={chartStyles.label}>{label}</span>}
      <canvas
        ref={canvasRef}
        className={chartStyles.canvas}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  );
}

export default memo(TelemetryLineChart);
