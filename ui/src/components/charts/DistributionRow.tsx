import type { MetricDef } from "../../lib/metrics";
import { fmtWithUnit } from "../../lib/metrics";
import type { Verdict } from "../../types";
import { VERDICT_COLOR_HI } from "../../lib/metrics";

interface DistributionRowProps {
  def: MetricDef;
  corpus: number[];
  value: number;
  verdict: Verdict;
}

const W = 400;
const H = 26;

/** One metric as a strip plot: every corpus value as a faint tick,
 *  this episode's value as a marked dot. Answers "is this unusual?" */
export default function DistributionRow({ def, corpus, value, verdict }: DistributionRowProps) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of corpus) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  min = Math.min(min, value);
  max = Math.max(max, value);
  const span = max - min || 1;
  const xOf = (v: number) => 6 + ((v - min) / span) * (W - 12);
  const color = VERDICT_COLOR_HI[verdict];

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 shrink-0 truncate text-xs text-ink2">{def.label}</div>
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-6 w-full" preserveAspectRatio="none" aria-hidden="true">
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--color-line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          {corpus.map((v, i) => (
            <line
              key={i}
              x1={xOf(v)}
              y1={7}
              x2={xOf(v)}
              y2={H - 7}
              stroke="var(--color-ink3)"
              strokeWidth={1}
              opacity={0.55}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line x1={xOf(value)} y1={2} x2={xOf(value)} y2={H - 2} stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <circle cx={xOf(value)} cy={H / 2} r={3.5} fill={color} stroke="var(--color-panel)" strokeWidth={1.5} />
        </svg>
      </div>
      <div className="w-24 shrink-0 text-right font-mono text-xs text-ink">{fmtWithUnit(value, def)}</div>
    </div>
  );
}
