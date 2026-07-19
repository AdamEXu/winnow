import type { Episode, Verdict } from "../types";

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  digits: number;
}

/** Curated, ordered list of queryable per-episode metrics. */
export const METRICS: MetricDef[] = [
  { key: "true_hz", label: "true rate", unit: "Hz", digits: 2 },
  { key: "pct_dropped", label: "dropped ticks", unit: "%", digits: 1 },
  { key: "worst_gap_ms", label: "worst gap", unit: "ms", digits: 0 },
  { key: "duration_s", label: "duration", unit: "s", digits: 1 },
  { key: "n_frames", label: "frames", unit: "", digits: 0 },
  { key: "debris_end", label: "debris at end", unit: "", digits: 2 },
  { key: "debris_trough_frac", label: "debris trough", unit: "", digits: 2 },
  { key: "grip_cycles_left", label: "grip cycles L", unit: "", digits: 0 },
  { key: "grip_cycles_right", label: "grip cycles R", unit: "", digits: 0 },
  { key: "mean_grip_err", label: "mean grip error", unit: "rad", digits: 3 },
  { key: "peak_err_left_j4", label: "peak error L j4", unit: "rad", digits: 3 },
  { key: "track_err_mean", label: "track error mean", unit: "rad", digits: 3 },
  { key: "track_err_p99", label: "track error p99", unit: "rad", digits: 3 },
  { key: "follower_lag", label: "follower lag", unit: "frames", digits: 0 },
  { key: "jerk", label: "jerk", unit: "", digits: 3 },
  { key: "idle_frac", label: "idle fraction", unit: "", digits: 2 },
  { key: "frozen_frames", label: "frozen frames", unit: "", digits: 0 },
  { key: "wrist1_luma_min", label: "wrist 1 min luma", unit: "", digits: 0 },
  { key: "wrist2_luma_min", label: "wrist 2 min luma", unit: "", digits: 0 },
];

export const metricByKey: ReadonlyMap<string, MetricDef> = new Map(
  METRICS.map((m) => [m.key, m]),
);

export function metricValue(e: Episode, key: string): number {
  return e.features[key] ?? e.metrics[key] ?? 0;
}

export function fmtValue(v: number, digits: number): string {
  if (digits === 0) return Math.round(v).toLocaleString("en-US");
  return v.toFixed(digits);
}

export function fmtWithUnit(v: number, def: MetricDef): string {
  const s = fmtValue(v, def.digits);
  return def.unit ? `${s} ${def.unit}` : s;
}

export const VERDICT_COLOR: Record<Verdict, string> = {
  good: "var(--color-good)",
  bad: "var(--color-bad)",
  batch: "var(--color-batch)",
};

export const VERDICT_COLOR_HI: Record<Verdict, string> = {
  good: "var(--color-goodhi)",
  bad: "var(--color-badhi)",
  batch: "var(--color-batchhi)",
};

/** How the human's label reads in the UI. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  good: "passed",
  bad: "flagged",
  batch: "warm-up",
};

export function thumbUrl(name: string, i: number): string {
  return `./thumbs/${name}/${i}.jpg`;
}
