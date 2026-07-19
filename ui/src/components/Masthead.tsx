import type { Summary } from "../types";
import { thumbUrl } from "../lib/metrics";

interface MastheadProps {
  summary: Summary;
  /** Clean reference episode for the hero filmstrip. */
  heroName: string;
  heroPicks: number[];
  heroHz: number;
}

const STAGES = ["scattered", "approach", "sweep", "sweep", "dump", "table clear"];

/** Who, what, and where to start — before any chart. */
export default function Masthead({ summary, heroName, heroPicks, heroHz }: MastheadProps) {
  const drift = summary.wall_clock_min - summary.video_min_at_claimed;

  const contents = [
    {
      href: "#timing",
      n: "01",
      title: "The metadata is lying about time",
      sub: `${summary.claimed_fps.toFixed(0)} fps claimed, ${summary.measured_hz.toFixed(2)} Hz measured — ${drift.toFixed(1)} min of video does not exist`,
    },
    {
      href: "#defects",
      n: "02",
      title: "Nine episodes are defective",
      sub: "each verdict comes with pixel coordinates you can check against the frame",
    },
    {
      href: "#adjudication",
      n: "03",
      title: "Machine vs. hand labels: 3–0",
      sub: "every disagreement, on review of the footage, went to the machine",
    },
  ];

  return (
    <section aria-label="introduction">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-4 border-ink pb-4">
        <h1 className="display text-4xl font-black tracking-tight uppercase">Winnow</h1>
        <p className="font-mono text-xs text-ink2">
          sweep-the-pasta corpus · {summary.n_episodes} episodes ·{" "}
          {summary.n_frames.toLocaleString("en-US")} frames · {summary.wall_clock_min.toFixed(1)} min
          · {summary.cameras.length} cameras
        </p>
      </div>

      <div className="mt-10 grid gap-x-16 gap-y-10 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="lede text-2xl leading-snug text-ink md:text-[1.7rem]">
            A two-arm robot sweeps pasta into a dustpan and tips it into a basket. Fifty-eight
            demonstrations were recorded as training data. winnow audited the recording itself
            &mdash; timestamps and pixels, nothing taken from the metadata on trust &mdash; and
            filed three findings.
          </p>
          <p className="mt-5 text-sm leading-relaxed text-ink2">
            Read the findings in order, then use the query at the end &mdash; it is the same WHERE
            clause the export pipeline runs. Click any episode anywhere on this page to open its
            full record.
          </p>
        </div>

        <nav aria-label="findings">
          <ol>
            {contents.map((c) => (
              <li key={c.n} className="border-b border-line last:border-b-0">
                <a
                  href={c.href}
                  className="group flex items-baseline gap-4 py-3 transition-colors hover:bg-paper2"
                >
                  <span className="display w-9 shrink-0 text-right text-lg font-black text-flag">
                    {c.n}
                  </span>
                  <span>
                    <span className="block text-base leading-tight font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                      {c.title}
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink2">{c.sub}</span>
                  </span>
                </a>
              </li>
            ))}
            <li className="border-t-2 border-ink">
              <a href="#export" className="group flex items-baseline gap-4 py-3 transition-colors hover:bg-paper2">
                <span className="display w-9 shrink-0 text-right text-lg font-black text-keep">
                  &rarr;
                </span>
                <span>
                  <span className="block text-base leading-tight font-semibold text-ink group-hover:underline group-hover:underline-offset-4">
                    The training set is a WHERE clause
                  </span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink2">
                    drag a threshold, watch episodes fall out, copy the export command
                  </span>
                </span>
              </a>
            </li>
          </ol>
        </nav>
      </div>

      <figure className="mt-12">
        <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
          {heroPicks.map((frame, i) => (
            <div key={i} className="border border-line bg-mount p-1 pb-1.5">
              <img
                src={thumbUrl(heroName, i)}
                alt={`${heroName}, frame ${frame}: ${STAGES[i]}`}
                className="evidence block aspect-[200/113] w-full object-cover"
              />
              <div className="mt-1 flex items-baseline justify-between px-0.5">
                <span className="text-[11px] text-ink2">{STAGES[i]}</span>
                <span className="font-mono text-[10px] text-ink3">
                  {(frame / heroHz).toFixed(0)} s
                </span>
              </div>
            </div>
          ))}
        </div>
        <figcaption className="mt-2 text-[13px] text-ink2">
          What a demonstration looks like when it goes right &mdash; {heroName}, top camera, six
          frames across {(heroPicks[heroPicks.length - 1] / heroHz).toFixed(0)} seconds. Most of the
          corpus looks like this. The findings below are about the part that does not.
        </figcaption>
      </figure>
    </section>
  );
}
