import type { EvidenceMark } from "../lib/metrics";

interface EvidencePhotoProps {
  src: string;
  alt: string;
  marks?: EvidenceMark[];
  className?: string;
  /** Show the (x, y) text next to each crosshair. */
  labelled?: boolean;
}

/** A camera frame treated as evidence: pixelated (honest about its
 *  resolution) with the detector's claimed coordinates plotted on it. */
export default function EvidencePhoto({
  src,
  alt,
  marks = [],
  className = "",
  labelled = true,
}: EvidencePhotoProps) {
  // Merge marks that sit on the same piece — labels would overprint.
  const shown: EvidenceMark[] = [];
  for (const m of marks) {
    if (shown.some((s) => Math.hypot(s.fx - m.fx, s.fy - m.fy) < 0.035)) continue;
    shown.push(m);
  }

  return (
    <div className={`relative overflow-hidden bg-ink ${className}`}>
      <img src={src} alt={alt} className="evidence block aspect-[200/113] w-full object-cover" />
      {shown.map((m) => {
        const left = `${(m.fx * 100).toFixed(2)}%`;
        const top = `${(m.fy * 100).toFixed(2)}%`;
        const flipX = m.fx > 0.68;
        return (
          <div key={m.label} className="pointer-events-none absolute" style={{ left, top }}>
            <svg
              viewBox="-14 -14 28 28"
              className="absolute -top-3.5 -left-3.5 size-7"
              aria-hidden="true"
            >
              <circle r={5.5} fill="none" stroke="#fff" strokeWidth={3.4} opacity={0.85} />
              <circle r={5.5} fill="none" stroke="var(--color-flag)" strokeWidth={1.8} />
              {[0, 90, 180, 270].map((deg) => (
                <line
                  key={deg}
                  x1={0}
                  y1={-8}
                  x2={0}
                  y2={-12.5}
                  transform={`rotate(${deg})`}
                  stroke="var(--color-flag)"
                  strokeWidth={1.8}
                />
              ))}
            </svg>
            {labelled && (
              <span
                className={`absolute top-2.5 font-mono text-[10px] leading-none font-medium whitespace-nowrap text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9)] ${
                  flipX ? "right-2.5" : "left-2.5"
                }`}
              >
                {m.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
