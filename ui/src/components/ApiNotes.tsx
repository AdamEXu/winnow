interface ApiNotesProps {
  version: string;
}

/** Things that cost time and are not obvious from the docs. Built against
 *  rerun-sdk 0.34.1, where the Query API is `rr.catalog` and `rr.server`. */
const NOTES: [string, string][] = [
  [
    "rr.dataframe is gone",
    "load_recording(), .view(), .select() and the filter_* methods were removed across 0.32 and 0.34. The catalog client replaces all of them.",
  ],
  [
    "the catalog runs locally",
    "rr.server.Server(datasets={...}) takes a plain list of .rrd paths. No account, no cloud, no upload.",
  ],
  [
    "scalars come back as lists",
    'Every scalar column is a one-element list, so "path:Scalars:scalars"[1] in SQL, or .explode() in pandas.',
  ],
  [
    "filter_contents changes rows, not just columns",
    "Unlike a SELECT, it changes which rows exist. Filter two entities and select one and you get rows at the other's timestamps, filled with nulls.",
  ],
  [
    "duration indexes are Timedeltas",
    "get_index_ranges() returns pandas Timedelta objects for duration indexes, not integers — cast before building a grid.",
  ],
  ["pin datafusion ~= 53.0", "Version 54 is rejected outright by rerun-sdk 0.34."],
];

export default function ApiNotes({ version }: ApiNotesProps) {
  return (
    <section aria-labelledby="notes-head" className="scroll-mt-24">
      <header className="mb-6 border-t-4 border-ink pt-3">
        <p className="display text-sm font-black tracking-[0.08em] uppercase">
          <span className="text-ink2">Notes</span>
          <span className="mx-2 text-line2" aria-hidden="true">
            /
          </span>
          <span className="text-ink2">rerun-sdk {version}</span>
        </p>
        <h2 id="notes-head" className="display-tight mt-3 text-3xl leading-tight font-extrabold text-ink">
          What the Query API cost us to learn.
        </h2>
      </header>
      <dl className="grid gap-x-10 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {NOTES.map(([term, note]) => (
          <div key={term} className="border-t border-line pt-2">
            <dt className="font-mono text-[12.5px] font-medium text-ink">{term}</dt>
            <dd className="mt-1 text-[13px] leading-snug text-ink2">{note}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
