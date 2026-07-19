import { useState } from "react";
import type { Episode } from "../types";
import { METRICS, metricByKey } from "../lib/metrics";
import Scatter from "./charts/Scatter";
import SectionHeader from "./SectionHeader";

interface ScatterSectionProps {
  episodes: Episode[];
  keptIds: ReadonlySet<number>;
  onSelect: (episode: number) => void;
}

export default function ScatterSection({ episodes, keptIds, onSelect }: ScatterSectionProps) {
  const [xKey, setXKey] = useState("pct_dropped");
  const [yKey, setYKey] = useState("debris_end");
  const xDef = metricByKey.get(xKey) ?? METRICS[0];
  const yDef = metricByKey.get(yKey) ?? METRICS[1];

  const selectCls =
    "rounded-sm border border-line2 bg-panel2 px-2 py-1.5 font-mono text-xs text-ink focus:border-amber";

  const legend = [
    { label: "human: passed", color: "var(--color-goodhi)" },
    { label: "human: flagged", color: "var(--color-badhi)" },
    { label: "warm-up", color: "var(--color-batchhi)" },
  ];

  return (
    <section id="scatter" className="scroll-mt-20">
      <SectionHeader
        eyebrow="corpus — distributions"
        title="Any metric against any other"
        sub="Outliers are clickable. Episodes rejected by the current query fade to outlines; warm-up episodes are the hollow diamonds."
      />

      <div className="rounded-md border border-line bg-panel p-5">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2 text-xs text-ink3">
            <label htmlFor="scatter-x">x</label>
            <select id="scatter-x" className={selectCls} value={xKey} onChange={(ev) => setXKey(ev.target.value)}>
              {METRICS.map((mm) => (
                <option key={mm.key} value={mm.key}>
                  {mm.key}
                </option>
              ))}
            </select>
            <label htmlFor="scatter-y">y</label>
            <select id="scatter-y" className={selectCls} value={yKey} onChange={(ev) => setYKey(ev.target.value)}>
              {METRICS.map((mm) => (
                <option key={mm.key} value={mm.key}>
                  {mm.key}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-4 font-mono text-[11px] text-ink3">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full border border-ink3" />
              rejected by query
            </span>
          </div>
        </div>
        <Scatter episodes={episodes} xDef={xDef} yDef={yDef} keptIds={keptIds} onSelect={onSelect} />
      </div>
    </section>
  );
}
