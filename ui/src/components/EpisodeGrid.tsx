import { useState } from "react";
import type { Episode } from "../types";
import type { MetricDef } from "../lib/metrics";
import {
  METRICS,
  VERDICT_COLOR,
  VERDICT_COLOR_HI,
  VERDICT_LABEL,
  fmtWithUnit,
  metricValue,
} from "../lib/metrics";
import Sparkline from "./charts/Sparkline";

export type GridFilter = "all" | "good" | "bad" | "panel";

interface EpisodeGridProps {
  ordered: Episode[];
  warmups: Episode[];
  sortDef: MetricDef;
  sortDir: "asc" | "desc";
  onSortKey: (key: string) => void;
  onSortDir: () => void;
  filter: GridFilter;
  onFilter: (f: GridFilter) => void;
  keptIds: ReadonlySet<number>;
  selected: number | null;
  onSelect: (episode: number) => void;
}

interface Popover {
  e: Episode;
  x: number;
  y: number;
  above: boolean;
}

const FILTERS: { id: GridFilter; label: string }[] = [
  { id: "all", label: "all" },
  { id: "good", label: "human: passed" },
  { id: "bad", label: "human: flagged" },
  { id: "panel", label: "panel: flagged" },
];

function Card({
  e,
  sortDef,
  rejected,
  selected,
  onSelect,
  onHover,
  onLeave,
}: {
  e: Episode;
  sortDef: MetricDef;
  rejected: boolean;
  selected: boolean;
  onSelect: () => void;
  onHover: (ev: React.MouseEvent<HTMLButtonElement>) => void;
  onLeave: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={`group relative block w-full rounded-sm border border-line bg-panel2 px-1.5 pt-1 pb-1.5 text-left transition-opacity hover:border-line2 ${
        rejected ? "opacity-30 saturate-50" : ""
      } ${selected ? "border-amberhi" : ""}`}
      style={{ borderLeftWidth: 3, borderLeftColor: VERDICT_COLOR[e.labelled] }}
      aria-label={`${e.name}, ${VERDICT_LABEL[e.labelled]}${e.detections.length ? `, ${e.detections.length} detections` : ""}`}
    >
      <span className="flex items-center justify-between">
        <span className="font-mono text-[11px] leading-5 text-ink2 group-hover:text-ink">
          {String(e.episode).padStart(4, "0")}
        </span>
        {e.detections.length > 0 && (
          <span className="flex gap-0.5" title={`${e.detections.length} detections`}>
            {e.detections.map((_, i) => (
              <svg key={i} viewBox="0 0 6 6" className="size-1.5" aria-hidden="true">
                <rect x={0.6} y={0.6} width={4.8} height={4.8} transform="rotate(45 3 3)" fill="var(--color-badhi)" />
              </svg>
            ))}
          </span>
        )}
      </span>
      <Sparkline
        values={e.series.debris}
        width={100}
        height={20}
        color={VERDICT_COLOR_HI[e.labelled]}
        className="h-5 w-full"
      />
      <span className="mt-0.5 block truncate font-mono text-[10px] text-ink3">
        {fmtWithUnit(metricValue(e, sortDef.key), sortDef)}
      </span>
    </button>
  );
}

export default function EpisodeGrid({
  ordered,
  warmups,
  sortDef,
  sortDir,
  onSortKey,
  onSortDir,
  filter,
  onFilter,
  keptIds,
  selected,
  onSelect,
}: EpisodeGridProps) {
  const [pop, setPop] = useState<Popover | null>(null);

  const hover = (e: Episode) => (ev: React.MouseEvent<HTMLButtonElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const above = r.top > 240;
    setPop({
      e,
      x: Math.max(8, Math.min(r.left + r.width / 2 - 130, window.innerWidth - 280)),
      y: above ? r.top - 8 : r.bottom + 8,
      above,
    });
  };

  const gridCls = "grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-1.5";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onFilter(f.id)}
              className={`rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors ${
                filter === f.id
                  ? "border-amber text-amberhi"
                  : "border-line2 text-ink3 hover:text-ink2"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-ink3">
          <label htmlFor="grid-sort">sort by</label>
          <select
            id="grid-sort"
            className="rounded-sm border border-line2 bg-panel2 px-2 py-1 font-mono text-[11px] text-ink"
            value={sortDef.key}
            onChange={(ev) => onSortKey(ev.target.value)}
          >
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.key}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={onSortDir}
            className="rounded-sm border border-line2 px-2 py-1 font-mono text-[11px] text-ink2 hover:text-ink"
            aria-label={`sorted ${sortDir === "asc" ? "ascending" : "descending"}`}
          >
            {sortDir === "asc" ? "low to high" : "high to low"}
          </button>
        </div>
        <div className="ml-auto flex items-center gap-4 font-mono text-[11px] text-ink3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5" style={{ background: "var(--color-goodhi)" }} />
            passed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-0.5" style={{ background: "var(--color-badhi)" }} />
            flagged
          </span>
          <span className="flex items-center gap-1.5">
            <svg viewBox="0 0 6 6" className="size-1.5" aria-hidden="true">
              <rect x={0.6} y={0.6} width={4.8} height={4.8} transform="rotate(45 3 3)" fill="var(--color-badhi)" />
            </svg>
            detector fired
          </span>
        </div>
      </div>

      <div className="hatch mb-2 rounded-sm border border-batch/30 p-2">
        <p className="mb-1.5 px-0.5 font-mono text-[11px] tracking-wide text-batchhi">
          warm-up batch · {warmups.length} episodes recorded with wrong settings · excluded from the
          training pool
        </p>
        <div className={gridCls}>
          {warmups.map((e) => (
            <Card
              key={e.episode}
              e={e}
              sortDef={sortDef}
              rejected={false}
              selected={selected === e.episode}
              onSelect={() => onSelect(e.episode)}
              onHover={hover(e)}
              onLeave={() => setPop(null)}
            />
          ))}
        </div>
      </div>

      <div className={gridCls}>
        {ordered.map((e) => (
          <Card
            key={e.episode}
            e={e}
            sortDef={sortDef}
            rejected={!keptIds.has(e.episode)}
            selected={selected === e.episode}
            onSelect={() => onSelect(e.episode)}
            onHover={hover(e)}
            onLeave={() => setPop(null)}
          />
        ))}
      </div>

      {pop && (
        <div
          className="pointer-events-none fixed z-40 w-[260px] rounded-sm border border-line2 bg-panel2 p-3 shadow-xl"
          style={{
            left: pop.x,
            top: pop.y,
            transform: pop.above ? "translateY(-100%)" : undefined,
          }}
        >
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-sm text-ink">{pop.e.name}</span>
            <span className="font-mono text-[11px]" style={{ color: VERDICT_COLOR_HI[pop.e.labelled] }}>
              {VERDICT_LABEL[pop.e.labelled]}
            </span>
          </div>
          <Sparkline
            values={pop.e.series.debris}
            width={236}
            height={36}
            color={VERDICT_COLOR_HI[pop.e.labelled]}
            area
            className="mt-2 h-9 w-full"
          />
          <p className="mt-0.5 text-right font-mono text-[10px] text-ink3">debris remaining over time</p>
          <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div>
              <p className="text-ink3">true rate</p>
              <p className="text-ink">{pop.e.metrics.true_hz.toFixed(2)} Hz</p>
            </div>
            <div>
              <p className="text-ink3">dropped</p>
              <p className="text-ink">{pop.e.metrics.pct_dropped.toFixed(1)} %</p>
            </div>
            <div>
              <p className="text-ink3">debris end</p>
              <p className="text-ink">{pop.e.metrics.debris_end.toFixed(2)}</p>
            </div>
          </div>
          {pop.e.detections.length > 0 && (
            <p className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-badhi">
              {pop.e.detections[0].why}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
