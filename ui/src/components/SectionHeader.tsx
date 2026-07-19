interface SectionHeaderProps {
  eyebrow: string;
  title: string;
  sub?: string;
}

export default function SectionHeader({ eyebrow, title, sub }: SectionHeaderProps) {
  return (
    <header className="mb-8">
      <div className="ruler mb-4" aria-hidden="true" />
      <p className="mb-2 font-mono text-xs font-semibold tracking-[0.25em] text-amberhi uppercase">
        {eyebrow}
      </p>
      <h2 className="text-[1.75rem] leading-tight font-semibold tracking-tight text-ink">{title}</h2>
      {sub && <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-ink2">{sub}</p>}
    </header>
  );
}
