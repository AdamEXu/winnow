import type { Data, Episode } from "../types";
import { computeAgreement } from "../lib/stats";
import { thumbUrl } from "../lib/metrics";
import SectionHeader from "./SectionHeader";

interface AdjudicationProps {
  data: Data;
  onSelect: (episode: number) => void;
}

function Row({ e, note, onSelect }: { e: Episode; note: string; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start gap-3 rounded-sm border border-line bg-panel2 p-2.5 text-left transition-colors hover:border-line2"
      >
        <img
          src={thumbUrl(e.name, 2)}
          alt=""
          loading="lazy"
          className="mt-0.5 w-16 shrink-0 rounded-sm border border-line object-cover"
        />
        <span className="min-w-0">
          <span className="font-mono text-sm text-ink">{e.name}</span>
          <span className="mt-1 block text-xs leading-snug text-ink2">{note}</span>
        </span>
      </button>
    </li>
  );
}

/** Finding three: the human watched the video; the panel read the data.
 *  Neither is the ground truth — the disagreements are the work queue. */
export default function Adjudication({ data, onSelect }: AdjudicationProps) {
  const a = computeAgreement(data);

  const whys = (e: Episode) => e.detections.map((d) => d.why).join(" — ");

  const columns: { title: string; accent: string; sub: string; rows: React.ReactNode }[] = [
    {
      title: `both flagged · ${a.both.length}`,
      accent: "var(--color-goodhi)",
      sub: "the human and the panel independently reached the same verdict",
      rows: a.both.map((e) => <Row key={e.episode} e={e} note={whys(e)} onSelect={() => onSelect(e.episode)} />),
    },
    {
      title: `human flagged, panel silent · ${a.humanOnly.length}`,
      accent: "var(--color-badhi)",
      sub: "something visible in the video that no detector measures yet",
      rows: a.humanOnly.map((e) => (
        <Row
          key={e.episode}
          e={e}
          note="no detector fired — whatever the human saw is not in the feature set yet"
          onSelect={() => onSelect(e.episode)}
        />
      )),
    },
    {
      title: `panel flagged, human passed · ${a.panelOnly.length}`,
      accent: "var(--color-amberhi)",
      sub: "defects in the numbers that are easy to miss at watch speed",
      rows: a.panelOnly.map((e) => <Row key={e.episode} e={e} note={whys(e)} onSelect={() => onSelect(e.episode)} />),
    },
  ];

  return (
    <section id="adjudication" className="scroll-mt-20">
      <SectionHeader
        eyebrow="finding — disagreement"
        title="The human and the panel disagree in both directions"
        sub={`Across ${a.candidates.length} usable episodes, the human flagged ${a.humanFlagged.length} from watching video and the detector panel flagged ${a.panelFlagged.length} from the data. They agree on ${a.both.length}. The other ${a.humanOnly.length + a.panelOnly.length} are not errors on either side — they are the adjudication queue.`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title} className="rounded-md border border-line bg-panel p-4">
            <h3 className="font-mono text-xs font-semibold tracking-wide" style={{ color: col.accent }}>
              {col.title}
            </h3>
            <p className="mt-1 mb-3 text-xs leading-snug text-ink3">{col.sub}</p>
            <ul className="space-y-2">{col.rows}</ul>
          </div>
        ))}
      </div>
    </section>
  );
}
