import { useState } from "react";
import type { Episode } from "../../types";
import { niceTicks } from "../../lib/stats";

const W = 800;
const ROW_H = 56;

interface RowSpec {
  key: keyof Episode["series"];
  label: string;
  unit: string;
  digits: number;
  color: string;
  refs?: number[];
}

const ROWS: RowSpec[] = [
  { key: "debris", label: "debris remaining", unit: "fraction", digits: 2, color: "var(--color-datahi)" },
  { key: "dt_ms", label: "inter-frame gap", unit: "ms", digits: 1, color: "var(--color-amberhi)" },
  { key: "motion", label: "motion energy", unit: "", digits: 2, color: "var(--color-datahi)" },
  { key: "drift", label: "leader-follower drift", unit: "", digits: 2, color: "var(--color-datahi)" },
];

/** The four per-episode series stacked on a shared time axis,
 *  with a shared crosshair and per-row readouts. */
export default function SeriesPanel({ episode, tickMs }: { episode: Episode; tickMs: number }) {
  const [frac, setFrac] = useState<number | null>(null);
  const duration = episode.metrics.duration_s;
  const n = episode.series.debris.length;
  const idx = frac === null ? null : Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));

  const onMove = (ev: React.MouseEvent<HTMLDivElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    setFrac(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)));
  };

  const xTicks = niceTicks(0, duration, 8).filter((t) => t <= duration);

  return (
    <div onMouseMove={onMove} onMouseLeave={() => setFrac(null)} className="select-none">
      {ROWS.map((row) => {
        const values = episode.series[row.key];
        const refs = row.key === "dt_ms" ? [tickMs, tickMs * 2] : [];
        let min = Infinity;
        let max = -Infinity;
        for (const v of values) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
        for (const r of refs) {
          if (r < min) min = r;
          if (r > max) max = r;
        }
        const pad = (max - min || 1) * 0.12;
        min -= pad;
        max += pad;
        const span = max - min;
        const yOf = (v: number) => ROW_H - ((v - min) / span) * ROW_H;
        const pts = values
          .map((v, i) => `${((i / (n - 1)) * W).toFixed(1)},${yOf(v).toFixed(1)}`)
          .join(" ");
        const hoverVal = idx === null ? null : values[idx];

        return (
          <div key={row.key} className="border-b border-line py-1.5 last:border-b-0">
            <div className="flex items-baseline justify-between px-0.5 pb-1">
              <span className="text-xs text-ink2">
                {row.label}
                {row.unit && <span className="text-ink3"> · {row.unit}</span>}
              </span>
              <span className="font-mono text-xs" style={{ color: hoverVal === null ? "var(--color-ink3)" : row.color }}>
                {hoverVal === null
                  ? `${values[values.length - 1].toFixed(row.digits)} at end`
                  : hoverVal.toFixed(row.digits)}
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${ROW_H}`} className="block h-14 w-full" preserveAspectRatio="none" aria-hidden="true">
              {refs.map((r) => (
                <line
                  key={r}
                  x1={0}
                  y1={yOf(r)}
                  x2={W}
                  y2={yOf(r)}
                  stroke="var(--color-amber)"
                  strokeWidth={1}
                  strokeDasharray="3 5"
                  opacity={0.55}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <polyline
                points={pts}
                fill="none"
                stroke={row.color}
                strokeWidth={1.4}
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
              {frac !== null && (
                <line
                  x1={frac * W}
                  y1={0}
                  x2={frac * W}
                  y2={ROW_H}
                  stroke="var(--color-ink2)"
                  strokeWidth={1}
                  opacity={0.6}
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
          </div>
        );
      })}

      <div className="relative h-6">
        {xTicks.map((t) => (
          <span
            key={t}
            className="absolute top-1 -translate-x-1/2 font-mono text-[10px] text-ink3"
            style={{ left: `${(t / duration) * 100}%` }}
          >
            {t}s
          </span>
        ))}
        {frac !== null && (
          <span
            className="absolute top-1 -translate-x-1/2 rounded-sm bg-panel2 px-1 font-mono text-[10px] text-ink"
            style={{ left: `${frac * 100}%` }}
          >
            {(frac * duration).toFixed(1)}s
          </span>
        )}
      </div>
    </div>
  );
}
