import type { Summary } from "../types";
import GapHistogram from "./charts/GapHistogram";
import DriftBar from "./charts/DriftBar";
import SectionHeader from "./SectionHeader";

/** Finding one: the corpus is mis-timed, and a query over the recorder's
 *  own timestamps is how you find out. */
export default function TimingSection({ summary }: { summary: Summary }) {
  const speedup = summary.claimed_fps / summary.measured_hz;
  const drift = summary.wall_clock_min - summary.video_min_at_claimed;

  return (
    <section id="timing" className="scroll-mt-20">
      <SectionHeader
        eyebrow="finding — timing"
        title="The clock in the metadata is not the clock in the data"
        sub={`Every episode's meta.json claims ${summary.claimed_fps} fps. One query over the recorder's own timestamps says otherwise.`}
      />

      <div className="mb-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-md border border-line bg-panel p-6">
          <p className="text-sm text-ink2">claimed, in every meta.json</p>
          <p className="mt-2 font-mono text-6xl font-semibold tracking-tight text-ink3 xl:text-7xl">
            {summary.claimed_fps.toFixed(2)}
            <span className="ml-3 text-2xl font-normal">fps</span>
          </p>
        </div>
        <div className="rounded-md border border-amber/40 bg-panel p-6">
          <p className="text-sm text-ink2">measured, from the timestamps themselves</p>
          <p className="mt-2 font-mono text-6xl font-semibold tracking-tight text-amberhi xl:text-7xl">
            {summary.measured_hz.toFixed(2)}
            <span className="ml-3 text-2xl font-normal">Hz</span>
          </p>
        </div>
      </div>

      <figure className="rounded-md border border-line bg-panel p-5 pt-6">
        <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2 px-1">
          <span className="text-sm font-medium text-ink">
            All {summary.n_frames.toLocaleString("en-US")} inter-frame gaps, one histogram
          </span>
          <span className="font-mono text-xs text-ink2">
            {summary.pct_double_gaps.toFixed(1)}% of gaps are exactly two ticks long
          </span>
        </figcaption>
        <GapHistogram summary={summary} />
      </figure>

      <p className="mx-auto mt-8 max-w-3xl text-center text-[0.95rem] leading-relaxed text-ink2">
        Jitter would smear this histogram. Instead it splits cleanly in two: frames that arrived on the
        next tick, and frames that arrived one tick late because the tick between them was dropped.
        The recorder kept its {summary.claimed_fps} fps clock and silently lost{" "}
        {summary.pct_double_gaps.toFixed(1)}% of it.
      </p>

      <div className="mt-10 rounded-md border border-line bg-panel p-5">
        <p className="mb-2 px-1 text-sm font-medium text-ink">Where the lost time goes</p>
        <DriftBar summary={summary} />
      </div>

      <div className="mt-10 rounded-md border border-amber/40 bg-panel px-6 py-8 text-center">
        <p className="font-mono text-5xl font-semibold tracking-tight text-amberhi md:text-6xl">
          {drift.toFixed(1)} min
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-ink2">
          of drift across the corpus. A policy trained on these frames and deployed at{" "}
          {summary.claimed_fps} Hz replays every demonstration{" "}
          <span className="font-mono font-semibold text-ink">{speedup.toFixed(2)}x</span> faster than
          the robot actually moved.
        </p>
      </div>
    </section>
  );
}
