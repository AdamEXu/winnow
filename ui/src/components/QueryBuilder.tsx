import { useEffect, useRef, useState } from "react";
import type { Clause, Op } from "../lib/query";
import { OPS, whereString } from "../lib/query";
import type { Extent } from "../lib/stats";
import { METRICS, metricByKey } from "../lib/metrics";

interface QueryBuilderProps {
  clauses: Clause[];
  onChange: (clauses: Clause[]) => void;
  extents: ReadonlyMap<string, Extent>;
  keptCount: number;
  candidateCount: number;
  warmupCount: number;
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

export default function QueryBuilder({
  clauses,
  onChange,
  extents,
  keptCount,
  candidateCount,
  warmupCount,
}: QueryBuilderProps) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const where = whereString(clauses);
  const command = where ? `python export.py --where "${where}"` : "python export.py";

  const update = (id: number, patch: Partial<Clause>) => {
    onChange(clauses.map((c) => (c.id === id ? { ...c, ...patch } : c)));
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
    onChange([...clauses, { id: nextClauseId++, metric, op: "<", value: +mid.toFixed(6) }]);
  };

  const copy = () => {
    void navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 1500);
    });
  };

  const selectCls =
    "rounded-sm border border-line2 bg-panel2 px-2 py-1.5 font-mono text-xs text-ink focus:border-amber";

  return (
    <div className="rounded-md border border-line bg-panel">
      <div className="grid gap-0 lg:grid-cols-[1fr_240px]">
        <div className="p-5">
          <p className="mb-4 text-sm text-ink2">
            Keep an episode when <span className="font-mono text-ink">all</span> conditions hold. The
            grid and scatter below update as you drag.
          </p>

          <div className="space-y-3">
            {clauses.map((c, i) => {
              const { min, max, step } = sliderParams(c.metric, extents);
              const def = metricByKey.get(c.metric);
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-2">
                  <span className="w-9 text-right font-mono text-[10px] tracking-widest text-ink3 uppercase">
                    {i === 0 ? "where" : "and"}
                  </span>
                  <select
                    aria-label="metric"
                    className={selectCls}
                    value={c.metric}
                    onChange={(ev) => changeMetric(c.id, ev.target.value)}
                  >
                    {METRICS.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.key}
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
                    aria-label={`${c.metric} threshold`}
                    className="h-1 min-w-24 flex-1 cursor-ew-resize appearance-none rounded-full bg-line2 accent-(--color-amberhi)"
                    min={min}
                    max={max}
                    step={step}
                    value={c.value}
                    onChange={(ev) => update(c.id, { value: +ev.target.value })}
                  />
                  <input
                    type="number"
                    aria-label={`${c.metric} value`}
                    className="w-24 rounded-sm border border-line2 bg-panel2 px-2 py-1.5 text-right font-mono text-xs text-amberhi focus:border-amber"
                    min={min}
                    max={max}
                    step={step}
                    value={c.value}
                    onChange={(ev) => update(c.id, { value: +ev.target.value })}
                  />
                  <span className="w-8 font-mono text-[10px] text-ink3">{def?.unit ?? ""}</span>
                  <button
                    type="button"
                    aria-label="remove condition"
                    className="rounded-sm border border-line2 p-1.5 text-ink3 hover:border-bad hover:text-badhi"
                    onClick={() => onChange(clauses.filter((x) => x.id !== c.id))}
                  >
                    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden="true">
                      <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="mt-4 rounded-sm border border-dashed border-line2 px-3 py-1.5 font-mono text-xs text-ink2 hover:border-amber hover:text-amberhi"
            onClick={addClause}
          >
            + add condition
          </button>
        </div>

        <div className="flex flex-col justify-center border-t border-line p-5 lg:border-t-0 lg:border-l">
          <p className="text-xs tracking-wide text-ink2">training set</p>
          <p className="mt-1 font-mono text-5xl font-semibold tracking-tight text-ink">
            {keptCount}
            <span className="text-2xl text-ink3"> / {candidateCount}</span>
          </p>
          <p className="mt-2 text-xs leading-relaxed text-ink3">
            episodes kept · {candidateCount - keptCount} rejected by the query · {warmupCount} warm-up
            excluded upstream
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-inset px-5 py-3">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink2">
          <span className="text-ink3">$ </span>
          <span className="text-ink">{command}</span>
        </code>
        <button
          type="button"
          className="shrink-0 rounded-sm border border-line2 px-3 py-1.5 font-mono text-xs text-ink2 hover:border-amber hover:text-amberhi"
          onClick={copy}
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
    </div>
  );
}
