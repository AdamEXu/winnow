import { useMemo, useRef, useState } from "react";
import type { Episode } from "../../types";
import type { MetricDef } from "../../lib/metrics";
import { fmtWithUnit, metricValue, VERDICT_COLOR_HI, VERDICT_LABEL } from "../../lib/metrics";
import { niceTicks } from "../../lib/stats";

const W = 960;
const H = 520;
const M = { top: 20, right: 24, bottom: 52, left: 72 };

interface ScatterProps {
  episodes: Episode[];
  xDef: MetricDef;
  yDef: MetricDef;
  keptIds: ReadonlySet<number>;
  onSelect: (episode: number) => void;
}

interface Pt {
  e: Episode;
  x: number;
  y: number;
}

export default function Scatter({ episodes, xDef, yDef, keptIds, onSelect }: ScatterProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ pt: Pt; px: number; py: number } | null>(null);

  const pts = useMemo<Pt[]>(() => {
    const xs = episodes.map((e) => metricValue(e, xDef.key));
    const ys = episodes.map((e) => metricValue(e, yDef.key));
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;
    return episodes.map((e, i) => ({
      e,
      x: M.left + ((xs[i] - xMin) / xSpan) * (W - M.left - M.right),
      y: H - M.bottom - ((ys[i] - yMin) / ySpan) * (H - M.top - M.bottom),
    }));
  }, [episodes, xDef, yDef]);

  const domain = useMemo(() => {
    const xs = episodes.map((e) => metricValue(e, xDef.key));
    const ys = episodes.map((e) => metricValue(e, yDef.key));
    return {
      x: { min: Math.min(...xs), max: Math.max(...xs) },
      y: { min: Math.min(...ys), max: Math.max(...ys) },
    };
  }, [episodes, xDef, yDef]);

  const xOf = (v: number) =>
    M.left + ((v - domain.x.min) / (domain.x.max - domain.x.min || 1)) * (W - M.left - M.right);
  const yOf = (v: number) =>
    H - M.bottom - ((v - domain.y.min) / (domain.y.max - domain.y.min || 1)) * (H - M.top - M.bottom);

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const mx = ((ev.clientX - rect.left) / rect.width) * W;
    const my = ((ev.clientY - rect.top) / rect.height) * H;
    let best: Pt | null = null;
    let bestD = 18 * 18;
    for (const p of pts) {
      const d = (p.x - mx) ** 2 + (p.y - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (!best) {
      setHover(null);
      return;
    }
    const wrap = wrapRef.current?.getBoundingClientRect();
    if (!wrap) return;
    setHover({ pt: best, px: ev.clientX - wrap.left, py: ev.clientY - wrap.top });
  };

  const mark = (p: Pt) => {
    const rejected = !p.e.warmup && !keptIds.has(p.e.episode);
    const color = VERDICT_COLOR_HI[p.e.labelled];
    const active = hover?.pt.e.episode === p.e.episode;
    const opacity = active ? 1 : p.e.warmup ? 0.55 : rejected ? 0.22 : 0.92;
    if (p.e.warmup) {
      return (
        <rect
          key={p.e.episode}
          x={-4.4}
          y={-4.4}
          width={8.8}
          height={8.8}
          transform={`translate(${p.x} ${p.y}) rotate(45)`}
          fill="none"
          stroke={color}
          strokeWidth={1.6}
          opacity={opacity}
        />
      );
    }
    return (
      <circle
        key={p.e.episode}
        cx={p.x}
        cy={p.y}
        r={active ? 6.5 : 5}
        fill={rejected ? "none" : color}
        stroke={rejected ? color : "var(--color-bg)"}
        strokeWidth={rejected ? 1.4 : 1.5}
        opacity={opacity}
      />
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full cursor-crosshair"
        role="img"
        aria-label={`Scatter plot of ${yDef.label} against ${xDef.label}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={() => hover && onSelect(hover.pt.e.episode)}
      >
        {niceTicks(domain.y.min, domain.y.max, 6).map((t) => (
          <g key={`y${t}`}>
            <line x1={M.left} y1={yOf(t)} x2={W - M.right} y2={yOf(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={M.left - 10} y={yOf(t) + 4} textAnchor="end" fill="var(--color-ink3)" fontSize={11.5} fontFamily="var(--font-mono)">
              {+t.toFixed(4)}
            </text>
          </g>
        ))}
        {niceTicks(domain.x.min, domain.x.max, 7).map((t) => (
          <g key={`x${t}`}>
            <line x1={xOf(t)} y1={H - M.bottom} x2={xOf(t)} y2={H - M.bottom + 5} stroke="var(--color-line2)" strokeWidth={1} />
            <text x={xOf(t)} y={H - M.bottom + 22} textAnchor="middle" fill="var(--color-ink3)" fontSize={11.5} fontFamily="var(--font-mono)">
              {+t.toFixed(4)}
            </text>
          </g>
        ))}
        <line x1={M.left} y1={H - M.bottom} x2={W - M.right} y2={H - M.bottom} stroke="var(--color-line2)" strokeWidth={1} />

        <text x={(M.left + W - M.right) / 2} y={H - 8} textAnchor="middle" fill="var(--color-ink2)" fontSize={12.5}>
          {xDef.label}
          {xDef.unit ? `, ${xDef.unit}` : ""}
        </text>
        <text
          x={0}
          y={0}
          transform={`translate(16 ${(M.top + H - M.bottom) / 2}) rotate(-90)`}
          textAnchor="middle"
          fill="var(--color-ink2)"
          fontSize={12.5}
        >
          {yDef.label}
          {yDef.unit ? `, ${yDef.unit}` : ""}
        </text>

        {pts.map(mark)}
      </svg>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 rounded-sm border border-line2 bg-panel2 px-3 py-2 font-mono text-xs shadow-lg"
          style={{ left: Math.min(hover.px + 16, (wrapRef.current?.clientWidth ?? 600) - 210), top: hover.py - 58 }}
        >
          <div className="flex items-center gap-2 text-ink">
            <span
              className="inline-block size-2 rounded-full"
              style={{ background: VERDICT_COLOR_HI[hover.pt.e.labelled] }}
            />
            {hover.pt.e.name}
            <span className="text-ink3">{VERDICT_LABEL[hover.pt.e.labelled]}</span>
          </div>
          <div className="text-ink2">
            {xDef.label} {fmtWithUnit(metricValue(hover.pt.e, xDef.key), xDef)}
          </div>
          <div className="text-ink2">
            {yDef.label} {fmtWithUnit(metricValue(hover.pt.e, yDef.key), yDef)}
          </div>
        </div>
      )}
    </div>
  );
}
