import { useEffect } from "react";
import type { Episode } from "../types";
import {
  METRICS,
  detectorName,
  parseEvidenceMarks,
  splitWhy,
  thumbUrl,
} from "../lib/metrics";
import EvidencePhoto from "./EvidencePhoto";
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
  const marks = episode.detections.flatMap((d) => parseEvidenceMarks(d.why));
  const navBtn =
    "border border-line2 px-2.5 py-1 font-mono text-xs text-ink2 hover:border-ink hover:text-ink";
  const chip = "border px-2.5 py-0.5 font-mono text-[11px]";

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${episode.name} record`}>
      <button
        type="button"
        aria-label="close record"
        className="absolute inset-0 cursor-default bg-ink/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="slide-in absolute inset-y-0 right-0 w-full max-w-[880px] overflow-y-auto border-l-4 border-ink bg-paper">
        <div className="sticky top-0 z-10 border-b border-line bg-paper/95 px-6 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="display text-2xl font-black tracking-tight text-ink">
              EP {String(episode.episode).padStart(2, "0")}
            </h3>
            <span className={`${chip} border-line2 text-ink2`}>hand label: {episode.labelled}</span>
            <span
              className={`${chip} ${episode.detections.length ? "border-flag font-medium text-flagdeep" : "border-line2 text-ink3"}`}
            >
              panel: {episode.detections.length ? `${episode.detections.length} fired` : "clear"}
            </span>
            <span className={`${chip} ${kept ? "border-keep text-keep" : "border-line2 text-ink3"}`}>
              query: {kept ? "kept" : "cut"}
            </span>
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
            {m.true_hz.toFixed(2)} Hz measured · {m.pct_dropped.toFixed(1)} % ticks dropped · longest
            gap {Math.round(m.worst_gap_ms)} ms
          </p>
        </div>

        <div className="space-y-8 px-6 py-6">
          <section aria-label="filmstrip">
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {episode.strip.picks.map((frame, i) => {
                const isLast = i === episode.strip.picks.length - 1;
                return (
                  <figure key={i}>
                    <EvidencePhoto
                      src={thumbUrl(episode.name, i)}
                      alt={`${episode.name} frame ${frame}`}
                      marks={isLast ? marks : []}
                      labelled={false}
                    />
                    <figcaption className="mt-1 text-center font-mono text-[10px] text-ink3">
                      f{frame}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
            {marks.length > 0 && (
              <p className="mt-1.5 text-[12px] text-ink3">
                crosshairs on the final frame: the detector&rsquo;s claimed coordinates
              </p>
            )}
          </section>

          {episode.adjudicated && (
            <section aria-label="adjudication" className="border-2 border-keep px-4 py-3">
              <h4 className="text-[12px] font-bold tracking-wide text-keep uppercase">
                Adjudicated — panel was right
              </h4>
              <p className="mt-1 text-sm leading-snug text-ink">
                The hand label and the panel disagreed here. On re-watching the footage:{" "}
                {episode.adjudicated[1]}.
              </p>
            </section>
          )}

          <section aria-label="detections">
            <h4 className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              detector panel
            </h4>
            {episode.detections.length === 0 ? (
              <p className="text-sm text-ink3">No detector fired on this episode.</p>
            ) : (
              <ul className="space-y-3">
                {episode.detections.map((d, i) => (
                  <li key={i} className="border-l-4 border-flag pl-4">
                    <span className="text-[13px] font-semibold text-flagdeep">
                      {detectorName(d.detector)}
                    </span>
                    <ul className="mt-1 space-y-1">
                      {splitWhy(d.why).map((c) => (
                        <li key={c} className="testimony text-[15px] leading-snug text-ink">
                          &ldquo;{c}&rdquo;
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="series">
            <h4 className="mb-3 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              signals · shared time axis
            </h4>
            <div className="border border-line bg-mount px-3 pt-1 pb-2">
              <SeriesPanel episode={episode} tickMs={tickMs} />
            </div>
          </section>

          <section aria-label="metrics against the corpus">
            <h4 className="mb-1 font-mono text-xs font-semibold tracking-[0.2em] text-ink2 uppercase">
              against the corpus
            </h4>
            <p className="mb-3 text-xs text-ink3">
              each row: the other 57 episodes as faint ticks, this one as the dot &mdash; hover a
              name for what it means
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
