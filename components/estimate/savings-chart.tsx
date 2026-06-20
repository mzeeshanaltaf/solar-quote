"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";

import { formatMoney } from "@/lib/solar-math";
import type { ProjectionPoint } from "@/lib/solar-math";

interface SavingsChartProps {
  projection: ProjectionPoint[];
  systemCost: number | null;
  currency: string | null;
}

// Hand-built SVG so the chart inherits the warm palette and we avoid a heavy
// charting dependency. It plots 25 years of cumulative savings as a filled area;
// when we have a cost estimate it overlays the system cost as a dashed line and
// marks the year the savings cross it (payback). Scales fluidly via viewBox.
const W = 720;
const H = 320;
const PAD = { top: 28, right: 24, bottom: 34, left: 24 };

export function SavingsChart({ projection, systemCost, currency }: SavingsChartProps) {
  const gradientId = useId();
  const reduce = useReducedMotion();

  const years = projection.length; // 25
  const lifetime = projection.at(-1)?.cumulativeSavings ?? 0;
  const maxY = Math.max(lifetime, systemCost ?? 0) * 1.08 || 1;

  const xFor = (year: number) =>
    PAD.left + (year / years) * (W - PAD.left - PAD.right);
  const yFor = (value: number) =>
    H - PAD.bottom - (value / maxY) * (H - PAD.top - PAD.bottom);

  // Start the area at today (year 0, nothing saved yet) so it grows from origin.
  const pts = [{ year: 0, cumulativeSavings: 0 }, ...projection];
  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.year)} ${yFor(p.cumulativeSavings)}`)
    .join(" ");
  const areaPath =
    `${linePath} L ${xFor(years)} ${yFor(0)} L ${xFor(0)} ${yFor(0)} Z`;

  const baselineY = yFor(0);

  // Payback crossing: first year cumulative savings >= cost, interpolated for a
  // smooth marker position between whole years.
  let paybackX: number | null = null;
  let paybackYearLabel: number | null = null;
  if (systemCost != null && lifetime >= systemCost) {
    for (let i = 0; i < pts.length; i++) {
      if (pts[i].cumulativeSavings >= systemCost) {
        const prev = pts[i - 1] ?? { year: 0, cumulativeSavings: 0 };
        const span = pts[i].cumulativeSavings - prev.cumulativeSavings || 1;
        const frac = (systemCost - prev.cumulativeSavings) / span;
        const year = prev.year + frac * (pts[i].year - prev.year);
        paybackX = xFor(year);
        paybackYearLabel = Math.round(year);
        break;
      }
    }
  }

  const costY = systemCost != null ? yFor(systemCost) : null;
  const xTicks = [5, 10, 15, 20, 25].filter((t) => t <= years);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Cumulative savings over ${years} years${
        systemCost != null ? ", compared with the estimated system cost" : ""
      }`}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.32" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* baseline */}
      <line
        x1={PAD.left}
        y1={baselineY}
        x2={W - PAD.right}
        y2={baselineY}
        stroke="var(--border)"
        strokeWidth="1"
      />

      {/* x-axis year ticks */}
      {xTicks.map((t) => (
        <text
          key={t}
          x={xFor(t)}
          y={H - 12}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: 22 }}
        >
          {t}y
        </text>
      ))}

      {/* cost line + label */}
      {costY != null && (
        <>
          <line
            x1={PAD.left}
            y1={costY}
            x2={W - PAD.right}
            y2={costY}
            stroke="var(--muted-foreground)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
          />
          <text
            x={W - PAD.right}
            y={costY - 11}
            textAnchor="end"
            className="fill-muted-foreground"
            style={{ fontSize: 21, fontWeight: 500 }}
          >
            System cost ≈ {formatMoney(systemCost!, currency)}
          </text>
        </>
      )}

      {/* area + line */}
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.15 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: "easeInOut" }}
      />

      {/* payback marker */}
      {paybackX != null && costY != null && (
        <>
          <line
            x1={paybackX}
            y1={baselineY}
            x2={paybackX}
            y2={costY}
            stroke="var(--primary)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
          <motion.circle
            cx={paybackX}
            cy={costY}
            r="7"
            fill="var(--primary)"
            stroke="var(--background)"
            strokeWidth="2.5"
            initial={reduce ? false : { scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 1, type: "spring", stiffness: 300, damping: 18 }}
          />
          <text
            x={paybackX}
            y={costY - 18}
            textAnchor={paybackX > W * 0.7 ? "end" : "middle"}
            className="fill-foreground"
            style={{ fontSize: 21, fontWeight: 600 }}
          >
            Pays for itself · year {paybackYearLabel}
          </text>
        </>
      )}

      {/* lifetime total at the end of the curve */}
      <text
        x={W - PAD.right}
        y={Math.max(yFor(lifetime) - 12, PAD.top + 4)}
        textAnchor="end"
        className="fill-primary"
        style={{ fontSize: 26, fontWeight: 700 }}
      >
        {formatMoney(lifetime, currency)}
      </text>
    </svg>
  );
}
