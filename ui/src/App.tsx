import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "./lib/useData";
import { METRICS, metricValue } from "./lib/metrics";
import type { Clause } from "./lib/query";
import { episodePasses } from "./lib/query";
import type { Extent } from "./lib/stats";
import { extentOf } from "./lib/stats";
import Masthead from "./components/Masthead";
import DefectsSection from "./components/DefectsSection";
import AdjudicationSection from "./components/AdjudicationSection";
import ExportSection from "./components/ExportSection";
import EpisodeDetail from "./components/EpisodeDetail";

const NAV = [
  { id: "defects", label: "01 defects" },
  { id: "adjudication", label: "02 adjudication" },
  { id: "export", label: "export" },
];

export default function App() {
  const { data, error } = useData();

  const [clauses, setClauses] = useState<Clause[]>([
    { id: 1, metric: "debris_end", op: "<", value: 0.15 },
    { id: 2, metric: "worst_gap_ms", op: "<", value: 500 },
    { id: 3, metric: "duration_s", op: ">", value: 20 },
  ]);
  const [selected, setSelected] = useState<number | null>(null);

  const episodes = useMemo(() => data?.episodes ?? [], [data]);

  const extents = useMemo(() => {
    const m = new Map<string, Extent>();
    for (const def of METRICS) {
      m.set(def.key, extentOf(episodes.map((e) => metricValue(e, def.key))));
    }
    return m;
  }, [episodes]);

  const corpusValues = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const def of METRICS) {
      m.set(def.key, episodes.map((e) => metricValue(e, def.key)));
    }
    return m;
  }, [episodes]);

  const keptIds = useMemo(
    () => new Set(episodes.filter((e) => episodePasses(e, clauses)).map((e) => e.episode)),
    [episodes, clauses],
  );

  const medianDuration = useMemo(() => {
    const d = episodes.map((e) => e.metrics.duration_s).sort((a, b) => a - b);
    if (d.length === 0) return 0;
    const mid = Math.floor(d.length / 2);
    return d.length % 2 ? d[mid] : (d[mid - 1] + d[mid]) / 2;
  }, [episodes]);

  const navOrder = useMemo(() => episodes.map((e) => e.episode), [episodes]);

  const step = useCallback(
    (delta: number) => {
      setSelected((cur) => {
        if (cur === null || navOrder.length === 0) return cur;
        const i = navOrder.indexOf(cur);
        if (i === -1) return navOrder[0];
        return navOrder[(i + delta + navOrder.length) % navOrder.length];
      });
    },
    [navOrder],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (selected === null) return;
      const t = ev.target as HTMLElement | null;
      if (t && ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName)) return;
      if (ev.key === "Escape") setSelected(null);
      else if (ev.key === "ArrowLeft" || ev.key === "k") step(-1);
      else if (ev.key === "ArrowRight" || ev.key === "j") step(1);
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, step]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="max-w-md font-mono text-sm text-ink2">
          Could not load data.json ({error}). Run the export pipeline, then reload.
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-sm text-ink3">reading data.json&#8230;</p>
      </div>
    );
  }

  const s = data.summary;
  const hero = episodes[0];
  const selectedEpisode = selected === null ? null : episodes.find((e) => e.episode === selected);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/92 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] items-baseline gap-x-6 px-6 py-2.5">
          <a href="#top" className="display text-sm font-black tracking-tight text-ink uppercase">
            Winnow
          </a>
          <span className="hidden text-xs text-ink3 sm:inline">
            every episode graded from the recording itself
          </span>
          <nav className="ml-auto flex gap-5 font-mono text-xs" aria-label="sections">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-ink2 underline-offset-4 transition-colors hover:text-ink hover:underline"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main id="top" className="mx-auto max-w-[1180px] space-y-24 px-6 pt-10 pb-16">
        {hero && (
          <Masthead
            summary={s}
            heroName={hero.name}
            heroPicks={hero.strip.picks}
            heroHz={hero.metrics.true_hz}
          />
        )}
        <DefectsSection
          episodes={episodes}
          frameTotal={s.n_frames}
          medianDuration={medianDuration}
          onSelect={setSelected}
        />
        <AdjudicationSection episodes={episodes} onSelect={setSelected} />
        <ExportSection
          episodes={episodes}
          clauses={clauses}
          onClauses={setClauses}
          extents={extents}
          keptIds={keptIds}
          selected={selected}
          onSelect={setSelected}
        />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-6 font-mono text-[11px] text-ink2">
          <span>winnow · built on the Rerun query API</span>
          <span>
            every figure computed from the recording itself; none taken from its metadata
          </span>
          <span className="ml-auto">arrow keys step through episodes · esc closes the record</span>
        </div>
      </footer>

      {selectedEpisode && (
        <EpisodeDetail
          episode={selectedEpisode}
          corpus={corpusValues}
          tickMs={1000 / s.claimed_fps}
          kept={keptIds.has(selectedEpisode.episode)}
          onClose={() => setSelected(null)}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
        />
      )}
    </div>
  );
}
