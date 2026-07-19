import type { Episode } from "../types";
import {
  DETECTORS,
  detectorName,
  parseEvidenceMarks,
  splitWhy,
  thumbUrl,
} from "../lib/metrics";
import EvidencePhoto from "./EvidencePhoto";
import FindingHead from "./FindingHead";
import Sparkline from "./charts/Sparkline";

interface DefectsSectionProps {
  episodes: Episode[];
  medianDuration: number;
  onSelect: (episode: number) => void;
}

function Dossier({
  e,
  medianDuration,
  onSelect,
}: {
  e: Episode;
  medianDuration: number;
  onSelect: () => void;
}) {
  const marks = e.detections.flatMap((d) => parseEvidenceMarks(d.why));
  const claims = e.detections.flatMap((d) => splitWhy(d.why));
  const detectorKeys = [...new Set(e.detections.map((d) => d.detector))];
  const hasStall = detectorKeys.includes("capture_stall");
  const isTruncated = detectorKeys.includes("truncated");
  const labelSaidGood = e.labelled === "good";

  return (
    <article className="flex flex-col border border-line2 bg-mount">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`open episode ${e.episode} record`}
        className="group block w-full text-left"
      >
        <EvidencePhoto
          src={thumbUrl(e.name, 5)}
          alt={`Final frame of episode ${e.episode}`}
          marks={marks}
          className="transition-opacity group-hover:opacity-90"
        />
      </button>
      <div className="flex grow flex-col p-3.5">
        <header className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span className="display text-lg leading-none font-black text-ink">
            EP {String(e.episode).padStart(2, "0")}
          </span>
          {detectorKeys.map((k) => (
            <span key={k} className="text-[13px] font-semibold text-flagdeep">
              {detectorName(k)}
            </span>
          ))}
        </header>

        <ul className="mt-2.5 space-y-2">
          {claims.map((c) => (
            <li key={c} className="testimony flex gap-2 text-[15px] leading-snug text-ink">
              <span aria-hidden="true" className="mt-[3px] shrink-0 not-italic">
                <svg viewBox="0 0 10 10" className="size-2.5">
                  <circle cx={5} cy={5} r={2.6} fill="none" stroke="var(--color-flag)" strokeWidth={1.6} />
                  <path d="M5 0v2M5 8v2M0 5h2M8 5h2" stroke="var(--color-flag)" strokeWidth={1.4} />
                </svg>
              </span>
              &ldquo;{c}&rdquo;
            </li>
          ))}
        </ul>

        {hasStall && (
          <figure className="mt-3 border-t border-line pt-2">
            <Sparkline
              values={e.series.dt_ms}
              width={280}
              height={30}
              color="var(--color-flag)"
              className="h-8 w-full"
            />
            <figcaption className="mt-0.5 flex justify-between font-mono text-[11px] text-ink2">
              <span>gap between frames, whole episode</span>
              <span className="font-medium text-flagdeep">
                worst: {Math.round(e.metrics.worst_gap_ms).toLocaleString("en-US")} ms
              </span>
            </figcaption>
          </figure>
        )}

        {isTruncated && (
          <p className="mt-3 border-t border-line pt-2 font-mono text-[11px] text-ink2">
            {e.metrics.duration_s.toFixed(1)} s recorded · corpus median{" "}
            {medianDuration.toFixed(1)} s
          </p>
        )}

        <footer className="mt-auto pt-3">
          <p className="font-mono text-[11px] text-ink3">
            hand label: {e.labelled}
            {labelSaidGood && (
              <span className="ml-1.5 font-medium text-amberdeep">
                — the label missed this. See Finding 03.
              </span>
            )}
          </p>
        </footer>
      </div>
    </article>
  );
}

/** Finding 02: nine defective episodes, each with checkable pixel evidence. */
export default function DefectsSection({ episodes, medianDuration, onSelect }: DefectsSectionProps) {
  const flagged = episodes.filter((e) => e.detections.length > 0);

  return (
    <section id="defects" className="scroll-mt-24" aria-labelledby="defects-head">
      <FindingHead
        n="02"
        topic="Defects"
        title={`${flagged.length === 9 ? "Nine" : String(flagged.length)} episodes are defective — and here is the pixel evidence for each.`}
        sub="Four detectors read every episode's own signals and, when one fires, it writes a sentence precise enough to check against the footage. The crosshairs below are the detector's claimed coordinates, plotted on the actual final frame."
      />

      <dl className="mb-8 grid gap-x-8 gap-y-2 border-y border-line py-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(DETECTORS).map(([key, d]) => (
          <div key={key} className="text-[13px] leading-snug">
            <dt className="inline font-semibold text-flagdeep">{d.name}</dt>
            <dd className="inline text-ink2"> — {d.gloss}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {flagged.map((e) => (
          <Dossier
            key={e.episode}
            e={e}
            medianDuration={medianDuration}
            onSelect={() => onSelect(e.episode)}
          />
        ))}
      </div>

      <p className="mt-8 border-y-2 border-ink py-3 text-center text-[15px] text-ink">
        A reviewer went back to the footage for all {flagged.length === 9 ? "nine" : flagged.length}.{" "}
        <span className="font-semibold">Every one is a real defect.</span>
      </p>
    </section>
  );
}
