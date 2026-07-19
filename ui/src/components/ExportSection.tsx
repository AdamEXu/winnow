import { useEffect, useRef, useState } from "react";
import type { Episode } from "../types";
import type { Clause, Op } from "../lib/query";
import { OPS, whereString } from "../lib/query";
import type { Extent } from "../lib/stats";
import { METRICS, metricByKey, metricValue } from "../lib/metrics";
import Sparkline from "./charts/Sparkline";

interface ExportSectionProps {
  episodes: Episode[];
  clauses: Clause[];
  onClauses: (clauses: Clause[]) => void;
  extents: ReadonlyMap<string, Extent>;
  keptIds: ReadonlySet<number>;
  selected: number | null;
  onSelect: (episode: number) => void;
}

function sliderParams(metric: string, extents: ReadonlyMap<string, Extent>) {
  const def = metricByKey.get(metric);
  const ext = extents.get(metric) ?? { min: 0, max: 1 };
  if (def && def.digits === 0) {
    return { min: Math.floor(ext.min), max: Math.ceil(ext.max), step: 1 };
  }
  const span = ext.max - ext.min || 1;
  const step = 10 ** Math.floor(Math.log10(span / 200));
  return {
    min: Math.floor(ext.min / step) * step,
    max: Math.ceil(ext.max / step) * step,
    step,
  };
}

let nextClauseId = 100;

function Tile({
  e,
  kept,
  selected,
  onSelect,
}: {
  e: Episode;
  kept: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={`episode ${e.episode}, ${kept ? "kept" : "cut by the clause"}${e.detections.length ? ", detector fired" : ""}`}
      className={`group relative block w-full border px-1.5 pt-1 pb-1.5 text-left transition-all duration-200 ${
        selected
          ? "border-ink bg-mount"
          : kept
            ? "border-line2 bg-mount hover:border-ink"
            : "border-dashed border-line bg-transparent opacity-40 saturate-0 hover:opacity-70"
      }`}
    >
      <span className="flex items-center justify-between">
        <span className="font-mono text-[11px] leading-5 text-ink2 group-hover:text-ink">
          {String(e.episode).padStart(2, "0")}
        </span>
        {e.detections.length > 0 && (
          <svg viewBox="0 0 8 8" className="size-2" aria-hidden="true">
            <rect x={1} y={1} width={6} height={6} transform="rotate(45 4 4)" fill="var(--color-flag)" />
          </svg>
        )}
      </span>
      <Sparkline
        values={e.series.debris}
        width={100}
        height={18}
        color={kept ? "var(--color-blue)" : "var(--color-ink3)"}
        className="h-[18px] w-full"
      />
    </button>
  );
}

/** The payoff: the WHERE clause is the dataset. Change it, watch episodes
 *  fall out of the training set, copy the command that ships it. */
export default function ExportSection({
  episodes,
  clauses,
  onClauses,
  extents,
  keptIds,
  selected,
  onSelect,
}: ExportSectionProps) {
  const [copied, setCopied] = useState(false);
  const [sortKey, setSortKey] = useState("pct_dropped");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const where = whereString(clauses);
  const command = where ? `python export.py --where "${where}"` : "python export.py";
  const cut = episodes.length - keptIds.size;

  const dir = sortDir === "asc" ? 1 : -1;
  const ordered = [...episodes].sort(
    (a, b) => (metricValue(a, sortKey) - metricValue(b, sortKey)) * dir,
  );

  const update = (id: number, patch: Partial<Clause>) => {
    onClauses(clauses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const changeMetric = (id: number, metric: string) => {
    const { min, max, step } = sliderParams(metric, extents);
    const mid = Math.round((min + max) / 2 / step) * step;
    update(id, { metric, value: +mid.toFixed(6) });
  };

  const addClause = () => {
    const used = new Set(clauses.map((c) => c.metric));
    const metric = METRICS.find((m) => !used.has(m.key))?.key ?? METRICS[0].key;
    const { min, max, step } = sliderParams(metric, extents);
    const mid = Math.round((min + max) / 2 / step) * step;
    onClauses([...clauses, { id: nextClauseId++, metric, op: "<", value: +mid.toFixed(6) }]);
  };

  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const selectCls =
    "border border-line2 bg-mount px-2 py-1.5 font-mono text-xs text-ink focus:border-ink";

  return (
    <section id="export" className="scroll-mt-24" aria-labelledby="export-head">
      <header className="mb-8 border-t-4 border-ink pt-3">
        <p className="display text-sm font-black tracking-[0.08em] uppercase">
          <span className="text-keep">The export</span>
          <span className="mx-2 text-line2" aria-hidden="true">/</span>
          <span className="text-ink2">acting on the findings</span>
        </p>
        <h2 id="export-head" className="display-tight mt-3 max-w-4xl text-4xl leading-[1.02] font-extrabold text-ink md:text-5xl">
          The training set is a WHERE clause.
        </h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink2">
          There is no separate cleaning step: whatever passes this query is the dataset the export
          writes. The clause runs against the metrics table from{" "}
          <a href="#queries" className="text-ink underline underline-offset-2">
            query 02
          </a>
          , and the episode ids that survive go straight into{" "}
          <code className="font-mono text-[13px] text-ink">dataset.filter_segments(...)</code>. Drag
          a threshold and watch episodes drop out of the wall below. Every tile is clickable.
        </p>
      </header>

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[1fr_17rem]">
        <div>
          <p className="display text-sm font-black tracking-[0.08em] text-ink uppercase">
            Keep every episode where
          </p>
          <div className="mt-4 space-y-4">
            {clauses.map((c, i) => {
              const { min, max, step } = sliderParams(c.metric, extents);
              const def = metricByKey.get(c.metric);
              return (
                <div key={c.id}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="w-9 text-right font-mono text-[11px] tracking-widest text-ink3 uppercase">
                      {i === 0 ? "" : "and"}
                    </span>
                    <select
                      aria-label="metric"
                      className={selectCls}
                      value={c.metric}
                      onChange={(ev) => changeMetric(c.id, ev.target.value)}
                    >
                      {METRICS.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="operator"
                      className={selectCls}
                      value={c.op}
                      onChange={(ev) => update(c.id, { op: ev.target.value as Op })}
                    >
                      {OPS.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                    <input
                      type="range"
                      aria-label={`${def?.label ?? c.metric} threshold`}
                      className="h-1 min-w-24 flex-1 cursor-ew-resize appearance-none rounded-full bg-line2 accent-(--color-ink)"
                      min={min}
                      max={max}
                      step={step}
                      value={c.value}
                      onChange={(ev) => update(c.id, { value: +ev.target.value })}
                    />
                    <input
                      type="number"
                      aria-label={`${def?.label ?? c.metric} value`}
                      className="w-24 border border-line2 bg-mount px-2 py-1.5 text-right font-mono text-xs font-medium text-ink focus:border-ink"
                      min={min}
                      max={max}
                      step={step}
                      value={c.value}
                      onChange={(ev) => update(c.id, { value: +ev.target.value })}
                    />
                    <span className="w-8 font-mono text-[11px] text-ink3">{def?.unit ?? ""}</span>
                    <button
                      type="button"
                      aria-label="remove condition"
                      className="border border-line2 p-1.5 text-ink3 hover:border-flag hover:text-flag"
                      onClick={() => onClauses(clauses.filter((x) => x.id !== c.id))}
                    >
                      <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                        <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {def && (
                    <p className="mt-1 ml-11 text-[12px] text-ink3">{def.gloss}</p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-4 ml-11 border border-dashed border-line2 px-3 py-1.5 font-mono text-xs text-ink2 hover:border-ink hover:text-ink"
            onClick={addClause}
          >
            + and&hellip;
          </button>
        </div>

        <div className="self-center border-l-4 border-keep pl-5" aria-live="polite">
          <p className="display-tight text-7xl font-black text-keep">
            {keptIds.size}
            <span className="text-3xl font-bold text-ink3"> / {episodes.length}</span>
          </p>
          <p className="mt-1 text-sm text-ink2">
            episodes survive the clause
            {cut > 0 && (
              <>
                {" "}
                &middot; <span className="font-semibold text-flagdeep">{cut} cut</span>
              </>
            )}
          </p>
        </div>
      </div>

      <div className="mt-8 bg-ink">
        <div className="flex items-baseline gap-3 border-b border-ink2/50 px-4 py-2.5">
          <span className="shrink-0 font-mono text-[11px] text-ink3">sql</span>
          <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] whitespace-nowrap text-paper">
            <span className="text-line2">SELECT </span>episode<span className="text-line2"> FROM </span>
            metrics<span className="text-line2"> WHERE </span>
            {where || <span className="text-ink3">true</span>}
          </code>
          <span className="shrink-0 font-mono text-[11px] text-keep" aria-live="polite">
            {keptIds.size} rows
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[13px] whitespace-nowrap text-paper">
            <span className="text-line2">$ </span>
            {command}
          </code>
          <button
            type="button"
            className="shrink-0 border border-line2/40 px-3 py-1 font-mono text-xs text-paper hover:border-paper"
            onClick={copy}
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-ink2">
          <label className="flex items-center gap-1.5">
            arrange by
            <select
              className={selectCls}
              value={sortKey}
              onChange={(ev) => setSortKey(ev.target.value)}
            >
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
            className="border border-line2 px-2 py-1 font-mono text-[11px] text-ink2 hover:text-ink"
          >
            {sortDir === "asc" ? "low to high" : "high to low"}
          </button>
          <span className="ml-auto flex items-center gap-4 font-mono text-[11px] text-ink3">
            <span className="flex items-center gap-1.5">
              <svg viewBox="0 0 8 8" className="size-2" aria-hidden="true">
                <rect x={1} y={1} width={6} height={6} transform="rotate(45 4 4)" fill="var(--color-flag)" />
              </svg>
              detector fired
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 border border-dashed border-line2 opacity-60" />
              cut by the clause
            </span>
            <span>each curve: pasta remaining over time</span>
          </span>
        </div>

        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-1.5">
          {ordered.map((e) => (
            <Tile
              key={e.episode}
              e={e}
              kept={keptIds.has(e.episode)}
              selected={selected === e.episode}
              onSelect={() => onSelect(e.episode)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
