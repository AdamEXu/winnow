import type { Episode, Verdict } from "../types";

export interface MetricDef {
  key: string;
  label: string;
  unit: string;
  digits: number;
  /** Plain-language meaning, shown wherever the metric appears. */
  gloss: string;
}

/** Curated, ordered list of queryable per-episode metrics. */
export const METRICS: MetricDef[] = [
  { key: "true_hz", label: "measured frame rate", unit: "Hz", digits: 2, gloss: "frames per second, computed from the recorder's own timestamps" },
  { key: "pct_dropped", label: "dropped ticks", unit: "%", digits: 1, gloss: "share of camera clock ticks where no frame arrived" },
  { key: "worst_gap_ms", label: "longest gap", unit: "ms", digits: 0, gloss: "longest wait between two consecutive frames" },
  { key: "duration_s", label: "duration", unit: "s", digits: 1, gloss: "episode length in wall-clock seconds" },
  { key: "n_frames", label: "frames", unit: "", digits: 0, gloss: "frames recorded in the episode" },
  { key: "debris_end", label: "debris at end", unit: "", digits: 2, gloss: "pasta still on the table when the episode ends, as a fraction of the starting amount" },
  { key: "debris_trough_frac", label: "debris low point", unit: "", digits: 2, gloss: "the cleanest the table ever got during the episode" },
  { key: "grip_cycles_left", label: "grip cycles, left", unit: "", digits: 0, gloss: "open-close cycles of the left gripper" },
  { key: "grip_cycles_right", label: "grip cycles, right", unit: "", digits: 0, gloss: "open-close cycles of the right gripper" },
  { key: "mean_grip_err", label: "mean grip error", unit: "rad", digits: 3, gloss: "average gap between commanded and actual gripper position" },
  { key: "peak_err_left_j4", label: "peak error, left joint 4", unit: "rad", digits: 3, gloss: "worst tracking error on the left arm's fourth joint" },
  { key: "track_err_mean", label: "tracking error, mean", unit: "rad", digits: 3, gloss: "average gap between the leader arm and the follower arm" },
  { key: "track_err_p99", label: "tracking error, p99", unit: "rad", digits: 3, gloss: "the follower's worst 1% of tracking errors" },
  { key: "follower_lag", label: "follower lag", unit: "frames", digits: 0, gloss: "how many frames the follower arm trails the leader" },
  { key: "jerk", label: "jerk", unit: "", digits: 3, gloss: "roughness of the motion — high means shaky driving" },
  { key: "idle_frac", label: "idle time", unit: "", digits: 2, gloss: "share of the episode where nothing moves" },
  { key: "frozen_frames", label: "frozen frames", unit: "", digits: 0, gloss: "consecutive identical camera frames — a stalled capture" },
  { key: "wrist1_luma_min", label: "wrist cam 1, darkest", unit: "", digits: 0, gloss: "darkest moment in the first wrist camera (0 = black)" },
  { key: "wrist2_luma_min", label: "wrist cam 2, darkest", unit: "", digits: 0, gloss: "darkest moment in the second wrist camera (0 = black)" },
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

/** Human-facing identity for each detector — never show the snake_case key. */
export interface DetectorMeta {
  name: string;
  gloss: string;
}

export const DETECTORS: Record<string, DetectorMeta> = {
  debris_outside_basket: {
    name: "Debris left behind",
    gloss: "pasta still on the table or sitting in the pan when the episode ends",
  },
  task_not_completed: {
    name: "Task not completed",
    gloss: "the table never got clean",
  },
  truncated: {
    name: "Cut short",
    gloss: "the recording ends long before the task plausibly could",
  },
  capture_stall: {
    name: "Camera stall",
    gloss: "the recorder stopped delivering frames mid-episode",
  },
};

export function detectorName(key: string): string {
  return DETECTORS[key]?.name ?? key.replaceAll("_", " ");
}

/** How the hand label reads in the UI. */
export const VERDICT_LABEL: Record<Verdict, string> = {
  good: "good",
  bad: "bad",
};

export function thumbUrl(name: string, i: number): string {
  return `./thumbs/${name}/${i}.jpg`;
}

export interface EvidenceMark {
  /** Fraction of frame width/height. Detector coordinates live in a
   *  ~400x226 frame; thumbnails are the same view at 200x113. */
  fx: number;
  fy: number;
  label: string;
}

const COORD_FRAME_W = 400;
const COORD_FRAME_H = 226;

/** Pull "(x, y)" pixel claims out of a detector's why-sentence. */
export function parseEvidenceMarks(why: string): EvidenceMark[] {
  const marks: EvidenceMark[] = [];
  const seen = new Set<string>();
  for (const m of why.matchAll(/\((\d+),\s*(\d+)\)/g)) {
    const x = Number(m[1]);
    const y = Number(m[2]);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    marks.push({ fx: x / COORD_FRAME_W, fy: y / COORD_FRAME_H, label: `(${x}, ${y})` });
  }
  return marks;
}

/** Split a compound why-sentence into individual claims. */
export function splitWhy(why: string): string[] {
  return why.split(/;\s+/).map((s) => s.trim()).filter(Boolean);
}
