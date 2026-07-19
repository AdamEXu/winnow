import type { Summary } from "../../types";

const W = 960;
const H = 128;
const LABEL_W = 250;
const BAR_H = 26;

/** Wall-clock minutes vs. video minutes at the claimed frame rate.
 *  The hatched remainder is time no policy will ever see. */
export default function DriftBar({ summary }: { summary: Summary }) {
  const { wall_clock_min, video_min_at_claimed, claimed_fps } = summary;
  const drift = wall_clock_min - video_min_at_claimed;
  const scale = (W - LABEL_W - 130) / wall_clock_min;
  const wallW = wall_clock_min * scale;
  const videoW = video_min_at_claimed * scale;

  const row = (
    y: number,
    label: string,
    w: number,
    minutes: number,
    color: string,
  ) => (
    <g>
      <text x={LABEL_W - 14} y={y + BAR_H / 2 + 4} textAnchor="end" fill="var(--color-ink2)" fontSize={13}>
        {label}
      </text>
      <rect x={LABEL_W} y={y} width={w} height={BAR_H} rx={4} fill={color} />
      <text x={LABEL_W + w + 12} y={y + BAR_H / 2 + 4.5} fill="var(--color-ink)" fontSize={14} fontFamily="var(--font-mono)" fontWeight={600}>
        {minutes.toFixed(1)} min
      </text>
    </g>
  );

  const y1 = 18;
  const y2 = y1 + BAR_H + 18;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="block w-full"
      role="img"
      aria-label={`${wall_clock_min} minutes of wall clock against ${video_min_at_claimed} minutes of video at the claimed rate: ${drift.toFixed(1)} minutes of drift`}
    >
      <defs>
        <pattern id="drift-hatch" width="7" height="7" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
          <rect width="7" height="7" fill="var(--color-amber)" opacity="0.16" />
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-amberhi)" strokeWidth="1.2" opacity="0.7" />
        </pattern>
      </defs>

      {row(y1, "wall clock, per recorder timestamps", wallW, wall_clock_min, "var(--color-data)")}
      {row(y2, `video, if every frame really took 1/${claimed_fps} s`, videoW, video_min_at_claimed, "var(--color-data)")}

      <rect x={LABEL_W + videoW + 2} y={y2} width={wallW - videoW - 2} height={BAR_H} rx={4} fill="url(#drift-hatch)" stroke="var(--color-amber)" strokeWidth={1} strokeDasharray="3 3" />
      <text
        x={LABEL_W + videoW + (wallW - videoW) / 2}
        y={y2 + BAR_H + 22}
        textAnchor="middle"
        fill="var(--color-amberhi)"
        fontSize={13}
        fontFamily="var(--font-mono)"
        fontWeight={600}
      >
        {drift.toFixed(1)} min unaccounted for
      </text>
    </svg>
  );
}
