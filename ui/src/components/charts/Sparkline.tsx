interface SparklineProps {
  values: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  area?: boolean;
  className?: string;
}

function sparklinePoints(
  values: number[],
  width: number,
  height: number,
  pad = 1.5,
): string {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const n = values.length;
  return values
    .map((v, i) => {
      const x = (i / (n - 1)) * width;
      const y = pad + (1 - (v - min) / span) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function Sparkline({
  values,
  width,
  height,
  color,
  strokeWidth = 1.25,
  area = false,
  className,
}: SparklineProps) {
  if (values.length < 2) return null;
  const pts = sparklinePoints(values, width, height);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      {area && (
        <polygon
          points={`0,${height} ${pts} ${width},${height}`}
          fill={color}
          opacity={0.12}
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
