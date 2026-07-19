import type { Episode } from "../types";
import { detectorName, parseEvidenceMarks, splitWhy, thumbUrl } from "../lib/metrics";
import EvidencePhoto from "./EvidencePhoto";
import FindingHead from "./FindingHead";

interface AdjudicationSectionProps {
  episodes: Episode[];
  onSelect: (episode: number) => void;
}

function Case({ e, onSelect }: { e: Episode; onSelect: () => void }) {
  const marks = e.detections.flatMap((d) => parseEvidenceMarks(d.why));
  const panelFired = e.detections.length > 0;
  const verdict = e.adjudicated?.[1] ?? "";

  return (
    <article className="grid items-stretch gap-x-6 gap-y-3 border-b border-line py-5 last:border-b-0 md:grid-cols-[13rem_1fr_1fr_1.2fr]">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`open episode ${e.episode} record`}
        className="group block self-start text-left"
      >
        <EvidencePhoto
          src={thumbUrl(e.name, 5)}
          alt={`Final frame of episode ${e.episode}`}
          marks={marks}
          labelled={false}
          className="transition-opacity group-hover:opacity-90"
        />
        <span className="display mt-1.5 block text-base font-black text-ink">
          EP {String(e.episode).padStart(2, "0")}
        </span>
      </button>

      <div>
        <h4 className="font-mono text-[11px] tracking-wide text-ink3 uppercase">the hand label said</h4>
        <p className="mt-1 text-xl font-semibold text-ink3 line-through decoration-flag decoration-2">
          {e.labelled}
        </p>
      </div>

      <div>
        <h4 className="font-mono text-[11px] tracking-wide text-ink3 uppercase">the panel said</h4>
        {panelFired ? (
          <div className="mt-1">
            <p className="text-[15px] font-semibold text-flagdeep">
              {[...new Set(e.detections.map((d) => d.detector))].map(detectorName).join(", ")}
            </p>
            <p className="testimony mt-1 text-sm leading-snug text-ink2">
              &ldquo;{splitWhy(e.detections[0].why)[0]}&rdquo;
            </p>
          </div>
        ) : (
          <p className="mt-1 text-[15px] font-semibold text-ink">
            nothing <span className="font-normal text-ink2">— no detector fired</span>
          </p>
        )}
      </div>

      <div>
        <h4 className="font-mono text-[11px] tracking-wide text-ink3 uppercase">the footage shows</h4>
        <p className="mt-1 text-[15px] leading-snug text-ink">{verdict}</p>
        <p className="mt-2 inline-block border-2 border-keep px-2 py-0.5 text-[12px] font-bold tracking-wide text-keep uppercase">
          panel was right
        </p>
      </div>
    </article>
  );
}

/** Finding 02: every human-vs-machine disagreement, re-watched and ruled on. */
export default function AdjudicationSection({ episodes, onSelect }: AdjudicationSectionProps) {
  const cases = episodes.filter((e) => e.adjudicated !== null);

  return (
    <section id="adjudication" className="scroll-mt-24" aria-labelledby="adjudication-head">
      <FindingHead
        n="02"
        topic="Disagreements"
        title="Where the labels and the panel disagreed, the panel went three for three."
        sub={`On ${cases.length} episodes the hand label and the detector panel contradicted each other. A reviewer re-watched each one and ruled. The score:`}
      />

      <div className="mb-4 flex flex-wrap items-end gap-x-10 gap-y-4">
        <p className="display-tight text-[7rem] leading-[0.85] font-black text-ink md:text-[9rem]">
          {cases.length}<span className="mx-2 text-ink3">&ndash;</span>0
        </p>
        <div className="pb-3 text-sm leading-snug text-ink2">
          <p>
            <span className="font-semibold text-ink">panel {cases.length}, hand labels 0.</span> Twice
            the panel caught a defect the label passed;
          </p>
          <p>once it refused to flag an episode the label had condemned.</p>
        </div>
      </div>

      <div className="border-t-2 border-ink">
        {cases.map((e) => (
          <Case key={e.episode} e={e} onSelect={() => onSelect(e.episode)} />
        ))}
      </div>
    </section>
  );
}
