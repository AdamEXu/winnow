import { useRef, useState } from "react";
import type { Summary } from "../../types";
import { niceTicks } from "../../lib/stats";

const W = 960;
const H = 320;
const M = { top: 56, right: 16, bottom: 34, left: 56 };

interface Hover {
  bin: number;
  px: number;
  py: number;
}

/** The hero: distribution of inter-frame gaps across all 32k frames.
 *  Bimodal at 1 tick and 2 ticks of the recorder clock. */
export default function GapHistogram({ summary }: { summary: Summary }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<Hover | null>(null);

  const { gap_histogram: counts, gap_bin_edges: edges, claimed_fps } = summary;
  const total = counts.reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...counts);

  const x0 = edges[0];
  const x1 = edges[edges.length - 1];
  const xOf = (ms: number) => M.left + ((ms - x0) / (x1 - x0)) * (W - M.left - M.right);
  const yOf = (c: number) => H - M.bottom - (c / maxCount) * (H - M.top - M.bottom);

  const tickMs = 1000 / claimed_fps;

  // The two modes, found from the data: tallest bin below and above 1.5 ticks.
  const split = tickMs * 1.5;
  let mode1 = 0;
  let mode2 = counts.length - 1;
  let best1 = -1;
  let best2 = -1;
  counts.forEach((c, i) => {
    const mid = (edges[i] + edges[i + 1]) / 2;
    if (mid < split && c > best1) {
      mode1 = i;
      best1 = c;
    }
    if (mid >= split && c > best2) {
      mode2 = i;
      best2 = c;
    }
  });

  const yTicks = niceTicks(0, maxCount, 4).filter((t) => t > 0);
  const xTicks = niceTicks(x0, x1, 6);

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const ms = x0 + ((ev.clientX - rect.left) / rect.width) * (x1 - x0);
    const bin = Math.max(0, Math.min(counts.length - 1, Math.floor(((ms - x0) / (x1 - x0)) * counts.length)));
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setHover({ bin, px: ev.clientX - wrap.left, py: ev.clientY - wrap.top });
  };

  const cursor = (ms: number, label: string, sub: string) => {
    const x = xOf(ms);
    return (
      <g>
        <line x1={x} y1={M.top - 30} x2={x} y2={H - M.bottom} stroke="var(--color-amberhi)" strokeWidth={1} strokeDasharray="2 4" opacity={0.8} />
        <text x={x} y={M.top - 36} textAnchor="middle" fill="var(--color-amberhi)" fontSize={13} fontFamily="var(--font-mono)" fontWeight={600}>
          {label}
        </text>
        <text x={x} y={M.top - 20} textAnchor="middle" fill="var(--color-ink2)" fontSize={11} fontFamily="var(--font-mono)">
          {sub}
        </text>
      </g>
    );
  };

  const valleyX = xOf((tickMs + tickMs * 2) / 2);

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full"
        role="img"
        aria-label="Histogram of inter-frame gaps in milliseconds, bimodal at one and two recorder ticks"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} y1={yOf(t)} x2={W - M.right} y2={yOf(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={M.left - 8} y={yOf(t) + 4} textAnchor="end" fill="var(--color-ink3)" fontSize={11} fontFamily="var(--font-mono)">
              {t >= 1000 ? `${t / 1000}k` : t}
            </text>
          </g>
        ))}

        {cursor(tickMs, "1 tick", `${tickMs.toFixed(1)} ms`)}
        {cursor(tickMs * 2, "2 ticks", `${(tickMs * 2).toFixed(1)} ms`)}

        {counts.map((c, i) => {
          if (c === 0) return null;
          const bx = xOf(edges[i]);
          const bw = Math.max(1.5, xOf(edges[i + 1]) - bx - 1);
          const by = yOf(c);
          const isMode = i === mode1 || i === mode2;
          return (
            <rect
              key={i}
              x={bx}
              y={by}
              width={bw}
              height={Math.max(1.5, H - M.bottom - by)}
              rx={1.5}
              fill={isMode ? "var(--color-amberhi)" : "var(--color-amber)"}
              opacity={hover && hover.bin === i ? 1 : isMode ? 0.95 : 0.8}
            />
          );
        })}

        {[mode1, mode2].map((i) => (
          <text
            key={i}
            x={xOf((edges[i] + edges[i + 1]) / 2)}
            y={yOf(counts[i]) - 8}
            textAnchor="middle"
            fill="var(--color-ink)"
            fontSize={13}
            fontFamily="var(--font-mono)"
            fontWeight={600}
          >
            {counts[i].toLocaleString("en-US")} · {((counts[i] / total) * 100).toFixed(1)}%
          </text>
        ))}

        <text x={valleyX} y={H - M.bottom - 60} textAnchor="middle" fill="var(--color-ink3)" fontSize={12.5}>
          near-nothing in between —
        </text>
        <text x={valleyX} y={H - M.bottom - 42} textAnchor="middle" fill="var(--color-ink3)" fontSize={12.5}>
          dropped ticks, not clock jitter
        </text>

        <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="var(--color-line2)" strokeWidth={1} />
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={xOf(t)} y1={H - M.bottom} x2={xOf(t)} y2={H - M.bottom + 5} stroke="var(--color-line2)" strokeWidth={1} />
            <text x={xOf(t)} y={H - M.bottom + 20} textAnchor="middle" fill="var(--color-ink3)" fontSize={11} fontFamily="var(--font-mono)">
              {t}
            </text>
          </g>
        ))}
        <text x={W - M.right} y={H - 4} textAnchor="end" fill="var(--color-ink3)" fontSize={11} fontFamily="var(--font-mono)">
          gap between consecutive frames, ms
        </text>
        <text x={M.left - 42} y={M.top - 36} fill="var(--color-ink3)" fontSize={11} fontFamily="var(--font-mono)">
          gaps
        </text>
      </svg>

      {hover && counts[hover.bin] > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-line2 bg-panel2 px-3 py-2 font-mono text-xs shadow-lg"
          style={{ left: Math.min(hover.px + 14, (wrapRef.current?.clientWidth ?? 600) - 190), top: hover.py - 44 }}
        >
          <div className="text-ink2">
            {edges[hover.bin].toFixed(1)}–{edges[hover.bin + 1].toFixed(1)} ms
          </div>
          <div className="text-ink">
            {counts[hover.bin].toLocaleString("en-US")} gaps · {((counts[hover.bin] / total) * 100).toFixed(1)}%
          </div>
        </div>
      )}
    </div>
  );
}
