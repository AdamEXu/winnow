import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "./lib/useData";
import { METRICS, metricByKey, metricValue } from "./lib/metrics";
import type { Clause } from "./lib/query";
import { episodePasses } from "./lib/query";
import type { Extent } from "./lib/stats";
import { extentOf } from "./lib/stats";
import TimingSection from "./components/TimingSection";
import SectionHeader from "./components/SectionHeader";
import QueryBuilder from "./components/QueryBuilder";
import EpisodeGrid, { type GridFilter } from "./components/EpisodeGrid";
import ScatterSection from "./components/ScatterSection";
import Adjudication from "./components/Adjudication";
import EpisodeDetail from "./components/EpisodeDetail";

const NAV = [
  { id: "timing", label: "timing" },
  { id: "triage", label: "triage" },
  { id: "scatter", label: "scatter" },
  { id: "adjudication", label: "adjudication" },
];

export default function App() {
  const { data, error } = useData();

  const [clauses, setClauses] = useState<Clause[]>([
    { id: 1, metric: "pct_dropped", op: "<", value: 40 },
    { id: 2, metric: "debris_end", op: "<", value: 0.3 },
  ]);
  const [sortKey, setSortKey] = useState("pct_dropped");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [filter, setFilter] = useState<GridFilter>("all");
  const [selected, setSelected] = useState<number | null>(null);

  const candidates = useMemo(() => data?.episodes.filter((e) => !e.warmup) ?? [], [data]);
  const warmups = useMemo(() => data?.episodes.filter((e) => e.warmup) ?? [], [data]);

  const extents = useMemo(() => {
    const m = new Map<string, Extent>();
    for (const def of METRICS) {
      m.set(def.key, extentOf(candidates.map((e) => metricValue(e, def.key))));
    }
    return m;
  }, [candidates]);

  const corpusValues = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const def of METRICS) {
      m.set(def.key, candidates.map((e) => metricValue(e, def.key)));
    }
    return m;
  }, [candidates]);

  const keptIds = useMemo(
    () => new Set(candidates.filter((e) => episodePasses(e, clauses)).map((e) => e.episode)),
    [candidates, clauses],
  );

  const ordered = useMemo(() => {
    const filtered = candidates.filter((e) => {
      if (filter === "good") return e.labelled === "good";
      if (filter === "bad") return e.labelled === "bad";
      if (filter === "panel") return e.detections.length > 0;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => (metricValue(a, sortKey) - metricValue(b, sortKey)) * dir);
  }, [candidates, filter, sortKey, sortDir]);

  const navOrder = useMemo(
    () => [...warmups.map((e) => e.episode), ...ordered.map((e) => e.episode)],
    [warmups, ordered],
  );

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
  const selectedEpisode = selected === null ? null : data.episodes.find((e) => e.episode === selected);
  const sortDef = metricByKey.get(sortKey) ?? METRICS[0];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-baseline gap-x-6 px-6 py-3">
          <span className="text-lg font-semibold tracking-tight text-ink">
            winnow
            <span className="ml-2.5 hidden text-xs font-normal text-ink3 sm:inline">
              demonstration dataset triage
            </span>
          </span>
          <span className="hidden font-mono text-xs text-ink3 md:inline">
            {s.n_episodes} episodes · {s.n_frames.toLocaleString("en-US")} frames ·{" "}
            {s.wall_clock_min.toFixed(1)} min
          </span>
          <nav className="ml-auto flex gap-4 font-mono text-xs">
            {NAV.map((n) => (
              <a
                key={n.id}
                href={`#${n.id}`}
                className="text-ink3 underline-offset-4 transition-colors hover:text-amberhi hover:underline"
              >
                {n.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] space-y-24 px-6 py-12">
        <TimingSection summary={s} />

        <section id="triage" className="scroll-mt-20">
          <SectionHeader
            eyebrow="triage — the whole corpus"
            title="65 episodes, one predicate away from a training set"
            sub={`A panel of ${s.detectors.length} detectors scores every episode and explains itself in plain sentences. The query below is the same WHERE clause the export pipeline runs — drag a threshold and watch the training set change.`}
          />
          <QueryBuilder
            clauses={clauses}
            onChange={setClauses}
            extents={extents}
            keptCount={keptIds.size}
            candidateCount={candidates.length}
            warmupCount={warmups.length}
          />
          <div className="mt-6">
            <EpisodeGrid
              ordered={ordered}
              warmups={warmups}
              sortDef={sortDef}
              sortDir={sortDir}
              onSortKey={setSortKey}
              onSortDir={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
              filter={filter}
              onFilter={setFilter}
              keptIds={keptIds}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </section>

        <ScatterSection episodes={data.episodes} keptIds={keptIds} onSelect={setSelected} />

        <Adjudication data={data} onSelect={setSelected} />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-baseline gap-x-6 gap-y-1 px-6 py-6 font-mono text-[11px] text-ink3">
          <span>winnow · built on the Rerun query API</span>
          <span>detectors: {s.detectors.join(", ")}</span>
          <span>cameras: {s.cameras.join(", ")}</span>
          <span className="ml-auto">arrow keys step through episodes · esc closes detail</span>
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
