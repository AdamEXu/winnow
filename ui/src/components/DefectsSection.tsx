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
  frameTotal: number;
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
                — the label missed this. See Finding 02.
              </span>
            )}
          </p>
        </footer>
      </div>
    </article>
  );
}

/** Finding 01, and the whole point: every episode is machine-graded, and the
 *  grade is a checkable claim. Exhibit A leads; the other eight follow. */
export default function DefectsSection({
  episodes,
  frameTotal,
  medianDuration,
  onSelect,
}: DefectsSectionProps) {
  const flagged = episodes.filter((e) => e.detections.length > 0);
  const lead = flagged[0];
  const rest = flagged.slice(1);
  const leadMarks = lead ? lead.detections.flatMap((d) => parseEvidenceMarks(d.why)) : [];
  const leadClaim = lead ? splitWhy(lead.detections[0].why)[0] : "";
  const leadCoord = leadMarks[0]?.label;

  return (
    <section id="defects" className="scroll-mt-24" aria-labelledby="defects-head">
      <FindingHead
        n="01"
        topic="Defects"
        title={`${flagged.length === 9 ? "Nine" : String(flagged.length)} episodes are defective — and the machine can point to the pixel.`}
        sub="Four detectors read each episode's own footage and signals. When one fires it does not output a score — it writes a claim you can check against the video: coordinates, frame counts, durations. Every crosshair below is a detector's claim, plotted on the episode's actual final frame."
      />

      {lead && (
        <div className="mb-10 grid items-center gap-x-10 gap-y-6 lg:grid-cols-[1.15fr_1fr]">
          <button
            type="button"
            onClick={() => onSelect(lead.episode)}
            aria-label={`open episode ${lead.episode} record`}
            className="group block w-full self-start text-left"
          >
            <EvidencePhoto
              src={thumbUrl(lead.name, 5)}
              alt={`Final frame of episode ${lead.episode}, with the detector's claimed coordinates marked`}
              marks={leadMarks}
              className="transition-opacity group-hover:opacity-90"
            />
            <span className="mt-1.5 block text-[13px] text-ink2">
              {lead.name}, top camera, final frame &mdash; click to open the full record
            </span>
          </button>

          <div>
            <p className="font-mono text-[11px] tracking-wide text-ink3 uppercase">
              Exhibit A · episode {lead.episode} ·{" "}
              {[...new Set(lead.detections.map((d) => d.detector))].map(detectorName).join(", ")}
            </p>
            <blockquote className="testimony mt-3 text-2xl leading-snug text-ink md:text-[1.75rem]">
              &ldquo;{leadClaim}&rdquo;
            </blockquote>
            <p className="mt-4 text-sm leading-relaxed text-ink2">
              That sentence was written by a detector, not a person.
              {leadCoord && (
                <>
                  {" "}
                  Open the video, look at <span className="font-mono text-ink">{leadCoord}</span>,
                  and the piece is there &mdash; a reviewer checked.
                </>
              )}
            </p>
            <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink2">
              For scale: that piece of pasta is roughly{" "}
              <span className="font-semibold text-ink">20 pixels</span> wide, and the corpus is{" "}
              <span className="font-semibold text-ink">
                {frameTotal.toLocaleString("en-US")} frames
              </span>
              . No one watches for that. The panel reads every frame of every episode.
            </p>
          </div>
        </div>
      )}

      <dl className="mb-8 grid gap-x-8 gap-y-2 border-y border-line py-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(DETECTORS).map(([key, d]) => (
          <div key={key} className="text-[13px] leading-snug">
            <dt className="inline font-semibold text-flagdeep">{d.name}</dt>
            <dd className="inline text-ink2"> — {d.gloss}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((e) => (
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
