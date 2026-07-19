interface GapStripProps {
  /** Inter-sample gaps in milliseconds, in order. */
  gaps: number[];
  color: string;
  /** Shared time span across both strips, in ms, so they read against each other. */
  spanMs: number;
  label: string;
  note: string;
}

const H = 26;

/** Every sample as a tick on a real time axis: irregular capture above,
 *  the grid `using_index_values` asked for below. */
export default function GapStrip({ gaps, color, spanMs, label, note }: GapStripProps) {
  let t = 0;
  const ticks: number[] = [0];
  for (const g of gaps) {
    t += g;
    if (t > spanMs) break;
    ticks.push(t);
  }

  return (
    <div>
      <div className="flex items-baseline justify-between font-mono text-[11px]">
        <span className="text-ink2">{label}</span>
        <span className="text-ink3">{note}</span>
      </div>
      <svg
        viewBox={`0 0 ${spanMs} ${H}`}
        preserveAspectRatio="none"
        className="mt-1 h-[26px] w-full border border-line bg-mount"
        role="img"
        aria-label={`${label}: ${ticks.length} samples across ${(spanMs / 1000).toFixed(1)} seconds — ${note}`}
      >
        {ticks.map((x, i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={3}
            y2={H - 3}
            stroke={color}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
