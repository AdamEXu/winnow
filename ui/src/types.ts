export type Verdict = "good" | "bad";

export interface Summary {
  n_episodes: number;
  n_frames: number;
  wall_clock_min: number;
  claimed_fps: number;
  measured_hz: number;
  pct_double_gaps: number;
  video_min_at_claimed: number;
  gap_histogram: number[];
  gap_bin_edges: number[];
  detectors: string[];
  cameras: string[];
}

export interface Detection {
  detector: string;
  why: string;
}

/** [winner, reason] — a human re-watched the footage and ruled. */
export type Adjudication = [string, string];

export interface EpisodeSeries {
  debris: number[];
  dt_ms: number[];
  motion: number[];
  drift: number[];
}

export interface Episode {
  episode: number;
  name: string;
  labelled: Verdict;
  metrics: Record<string, number>;
  features: Record<string, number>;
  detections: Detection[];
  adjudicated: Adjudication | null;
  series: EpisodeSeries;
  strip: { picks: number[]; n_frames: number };
}

export interface Data {
  summary: Summary;
  episodes: Episode[];
}

/** A result set captured verbatim from a real run of the query. */
export interface QueryTable {
  columns: string[];
  rows: (string | number | null)[][];
}

export interface GapStats {
  min: number;
  max: number;
  sd: number;
  hz: number;
}

/** One step of winnow/querylog.py — the query, and what it actually returned. */
export interface QueryStep {
  id: "serve" | "inspect" | "align" | "filter" | "compare";
  verb: string;
  ms?: number;
  sql?: string;
  result?: QueryTable;
  /** serve */
  segments?: number;
  columns?: number;
  indexes?: string[];
  n_derived?: number;
  n_video?: number;
  sample_derived?: string[];
  /** inspect */
  rows_in?: number;
  rows_out?: number;
  claimed_hz?: number;
  measured_hz?: number;
  pct_dropped?: number;
  /** align */
  segment?: string;
  target_hz?: number;
  before?: GapStats;
  after?: GapStats;
  gaps_before?: number[];
  gaps_after?: number[];
  /** filter */
  where?: string;
  segments_in?: number;
  segments_out?: number;
  columns_in?: number;
  columns_out?: number;
  rejected?: string[];
}

export interface QueryLog {
  rerun_version: string;
  steps: QueryStep[];
}
