import type { Summary } from "../types";
import GapHistogram from "./charts/GapHistogram";
import FindingHead from "./FindingHead";

/** Finding 01: the corpus is mis-timed, provable from its own timestamps. */
export default function TimingSection({ summary }: { summary: Summary }) {
  const speedup = summary.claimed_fps / summary.measured_hz;
  const drift = summary.wall_clock_min - summary.video_min_at_claimed;
  const wallPct = 100;
  const videoPct = (summary.video_min_at_claimed / summary.wall_clock_min) * 100;

  return (
    <section id="timing" className="scroll-mt-24" aria-labelledby="timing-title">
      <FindingHead
        n="01"
        topic="Timing"
        title="The metadata is lying about time."
        sub={`Every episode's meta.json claims ${summary.claimed_fps.toFixed(0)} frames per second. Measuring the gaps between the recorder's own timestamps gives a different number.`}
      />

      <div className="flex flex-wrap items-end gap-x-14 gap-y-6">
        <div>
          <p className="text-sm text-ink2">claimed, in every meta.json</p>
          <p className="display-tight mt-1 text-5xl font-bold text-ink3 line-through decoration-flag decoration-4 md:text-6xl">
            {summary.claimed_fps.toFixed(2)}
            <span className="ml-2 text-2xl font-medium no-underline">fps</span>
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">measured, from the timestamps themselves</p>
          <p
            id="timing-title"
            className="display-tight mt-1 text-[6.5rem] leading-[0.9] font-black text-amberdeep md:text-[9rem]"
          >
            {summary.measured_hz.toFixed(2)}
            <span className="ml-3 text-4xl font-semibold text-amberdeep/80">Hz</span>
          </p>
        </div>
        <p className="max-w-[16rem] pb-2 text-sm leading-snug text-ink2">
          Same camera, same clock &mdash; the recorder just silently skipped{" "}
          <span className="font-semibold text-ink">{summary.pct_double_gaps.toFixed(1)}%</span> of
          its ticks. Here is every gap in the corpus:
        </p>
      </div>

      <div className="mt-8">
        <GapHistogram summary={summary} />
      </div>

      <div className="mt-10 grid items-center gap-x-12 gap-y-6 lg:grid-cols-[1fr_20rem]">
        <div aria-label={`${summary.wall_clock_min.toFixed(1)} minutes happened, ${summary.video_min_at_claimed.toFixed(1)} minutes of video exist at the claimed rate`}>
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="text-ink2">minutes that actually happened</span>
            <span className="font-mono text-ink">{summary.wall_clock_min.toFixed(1)} min</span>
          </div>
          <div className="mt-1 h-6 bg-ink/80" style={{ width: `${wallPct}%` }} />
          <div className="mt-3 flex items-baseline justify-between text-[13px]">
            <span className="text-ink2">
              minutes of video, if every frame really took 1/{summary.claimed_fps.toFixed(0)} s
            </span>
            <span className="font-mono text-ink">{summary.video_min_at_claimed.toFixed(1)} min</span>
          </div>
          <div className="mt-1 flex h-6">
            <div className="h-full bg-ink/80" style={{ width: `${videoPct}%` }} />
            <div className="hatch-missing h-full border-l border-amberdeep" style={{ width: `${wallPct - videoPct}%` }} />
          </div>
          <p className="mt-1.5 text-right font-mono text-[13px] font-medium text-amberdeep" style={{ width: "100%" }}>
            {drift.toFixed(1)} min of robot time has no frames at all
          </p>
        </div>

        <div className="border-l-4 border-amberdeep pl-5">
          <p className="display-tight text-6xl font-black text-ink">
            {speedup.toFixed(2)}
            <span className="text-3xl font-bold">&times;</span>
          </p>
          <p className="mt-2 text-sm leading-snug text-ink2">
            too fast. A policy trained on these frames and deployed at{" "}
            {summary.claimed_fps.toFixed(0)} Hz replays every demonstration{" "}
            {speedup.toFixed(2)}&times; faster than the robot actually moved.
          </p>
        </div>
      </div>
    </section>
  );
}
