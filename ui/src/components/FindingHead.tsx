interface FindingHeadProps {
  n: string;
  topic: string;
  title: string;
  sub?: string;
}

/** Section opener: heavy rule, numbered kicker, one-line thesis. */
export default function FindingHead({ n, topic, title, sub }: FindingHeadProps) {
  return (
    <header className="mb-8 border-t-4 border-ink pt-3">
      <p className="display text-sm font-black tracking-[0.08em] uppercase">
        <span className="text-flag">Finding {n}</span>
        <span className="mx-2 text-line2" aria-hidden="true">/</span>
        <span className="text-ink2">{topic}</span>
      </p>
      <h2 className="display-tight mt-3 max-w-4xl text-4xl leading-[1.02] font-extrabold text-ink md:text-5xl">
        {title}
      </h2>
      {sub && <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink2">{sub}</p>}
    </header>
  );
}
