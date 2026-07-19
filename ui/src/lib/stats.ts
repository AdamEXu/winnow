import type { Data, Episode } from "../types";

export interface Extent {
  min: number;
  max: number;
}

export function extentOf(values: number[]): Extent {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min)) return { min: 0, max: 1 };
  if (min === max) return { min: min - 0.5, max: max + 0.5 };
  return { min, max };
}

/** Round-numbered tick positions covering [min, max]. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min;
  if (span <= 0) return [min];
  const rawStep = span / target;
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const norm = rawStep / mag;
  const step = (norm >= 5 ? 5 : norm >= 2 ? 2 : 1) * mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 1e-6; v += step) {
    ticks.push(+v.toFixed(10));
  }
  return ticks;
}

export interface Agreement {
  candidates: Episode[];
  humanFlagged: Episode[];
  panelFlagged: Episode[];
  both: Episode[];
  humanOnly: Episode[];
  panelOnly: Episode[];
}

/** Two-way comparison between the human label and the detector panel,
 *  computed over non-warm-up episodes only. */
export function computeAgreement(data: Data): Agreement {
  const candidates = data.episodes.filter((e) => !e.warmup);
  const humanFlagged = candidates.filter((e) => e.labelled === "bad");
  const panelFlagged = candidates.filter((e) => e.detections.length > 0);
  const panelSet = new Set(panelFlagged.map((e) => e.episode));
  const humanSet = new Set(humanFlagged.map((e) => e.episode));
  return {
    candidates,
    humanFlagged,
    panelFlagged,
    both: humanFlagged.filter((e) => panelSet.has(e.episode)),
    humanOnly: humanFlagged.filter((e) => !panelSet.has(e.episode)),
    panelOnly: panelFlagged.filter((e) => !humanSet.has(e.episode)),
  };
}
