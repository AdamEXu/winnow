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
