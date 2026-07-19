import { useEffect } from "react";
import type { Episode } from "../types";
import {
  METRICS,
  VERDICT_COLOR_HI,
  VERDICT_LABEL,
  thumbUrl,
} from "../lib/metrics";
import SeriesPanel from "./charts/SeriesPanel";
import DistributionRow from "./charts/DistributionRow";

const DETAIL_METRIC_KEYS = [
  "true_hz",
  "pct_dropped",
  "worst_gap_ms",
  "duration_s",
  "debris_end",
  "debris_trough_frac",
  "grip_cycles_right",
  "mean_grip_err",
  "peak_err_left_j4",
  "track_err_p99",
  "idle_frac",
  "frozen_frames",
];

interface EpisodeDetailProps {
  episode: Episode;
  corpus: ReadonlyMap<string, number[]>;
  tickMs: number;
  kept: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export default function EpisodeDetail({
  episode,
  corpus,
  tickMs,
  kept,
  onClose,
  onPrev,
  onNext,
}: EpisodeDetailProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const m = episode.metrics;
  const navBtn =
    "rounded-sm border border-line2 px-2.5 py-1 font-mono text-xs text-ink2 hover:border-amber hover:text-amberhi";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${episode.name} detail`}>
      <button
        type="button"
        aria-label="close detail"
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="slide-in absolute inset-y-0 right-0 w-full max-w-[880px] overflow-y-auto border-l border-line bg-panel">
        <div className="sticky top-0 z-10 border-b border-line bg-panel/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="font-mono text-2xl font-semibold tracking-tight text-ink">{episode.name}</h3>
            <span
              className="rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
              style={{ color: VERDICT_COLOR_HI[episode.labelled], borderColor: "var(--color-line2)" }}
            >
              human: {VERDICT_LABEL[episode.labelled]}
            </span>
            <span
              className={`rounded-full border border-line2 px-2.5 py-0.5 font-mono text-[11px] ${
                episode.detections.length ? "text-badhi" : "text-ink3"
              }`}
            >
              panel: {episode.detections.length ? `${episode.detections.length} fired` : "clear"}
            </span>
            {!episode.warmup && (
              <span
                className={`rounded-full border border-line2 px-2.5 py-0.5 font-mono text-[11px] ${
                  kept ? "text-goodhi" : "text-ink3"
                }`}
              >
                query: {kept ? "kept" : "rejected"}
              </span>
            )}
            <div className="ml-auto flex items-center gap-1.5">
              <button type="button" className={navBtn} onClick={onPrev} aria-label="previous episode">
                &#8592; prev
              </button>
              <button type="button" className={navBtn} onClick={onNext} aria-label="next episode">
                next &#8594;
              </button>
              <button type="button" className={navBtn} onClick={onClose} aria-label="close">
                esc
              </button>
            </div>
          </div>
          <p className="mt-2 font-mono text-xs text-ink2">
            {m.duration_s.toFixed(1)} s · {Math.round(m.n_frames).toLocaleString("en-US")} frames ·{" "}
            {m.true_hz.toFixed(2)} Hz true · {m.pct_dropped.toFixed(1)} % ticks dropped · worst gap{" "}
            {Math.round(m.worst_gap_ms)} ms
          </p>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section aria-label="filmstrip">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {episode.strip.picks.map((frame, i) => (
                <figure key={i}>
                  <img
                    src={thumbUrl(episode.name, i)}
                    alt={`${episode.name} frame ${frame}`}
                    loading="lazy"
                    className="aspect-4/3 w-full rounded-sm border border-line object-cover"
                  />
                  <figcaption className="mt-1 text-center font-mono text-[10px] text-ink3">
                    f{frame}
                  </figcaption>
                </figure>
              ))}
            </div>
          </section>

          <section aria-label="detections">
            <h4 className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              detector panel
            </h4>
            {episode.detections.length === 0 ? (
              <p className="text-sm text-ink3">No detector fired on this episode.</p>
            ) : (
              <ul className="space-y-2">
                {episode.detections.map((d, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-sm border border-bad/30 bg-bad/5 px-3 py-2.5"
                  >
                    <span className="font-mono text-xs font-semibold text-badhi">{d.detector}</span>
                    <span className="text-sm leading-snug text-ink">{d.why}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="series">
            <h4 className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              signals · shared time axis
            </h4>
            <div className="rounded-sm border border-line bg-inset px-3 pt-1 pb-2">
              <SeriesPanel episode={episode} tickMs={tickMs} />
            </div>
          </section>

          <section aria-label="metrics against the corpus">
            <h4 className="mb-1 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              against the corpus
            </h4>
            <p className="mb-3 text-xs text-ink3">
              each row is the full distribution across the other episodes; the marked value is this one
            </p>
            <div className="space-y-2.5">
              {DETAIL_METRIC_KEYS.map((key) => {
                const def = METRICS.find((d) => d.key === key);
                const values = corpus.get(key);
                if (!def || !values) return null;
                return (
                  <DistributionRow
                    key={key}
                    def={def}
                    corpus={values}
                    value={episode.features[key] ?? episode.metrics[key] ?? 0}
                    verdict={episode.labelled}
                  />
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
