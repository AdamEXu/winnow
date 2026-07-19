import type { QueryLog, QueryStep } from "../types";
import Code from "./query/Code";
import ResultTable from "./query/ResultTable";
import GapStrip from "./query/GapStrip";

interface QuerySectionProps {
  queries: QueryLog;
}

const SERVE_CODE = `files = sorted(glob.glob("data/rrd/*.rrd"))      # one .rrd per episode

with rr.server.Server(datasets={"sweep": files}) as server:
    client  = rr.catalog.CatalogClient(server.url())
    dataset = client.get_dataset("sweep")`;

const INSPECT_CODE = `reader = dataset.reader(index="frame_idx", fill_latest_at=True)
client.ctx.register_view("frames", reader)  # every segment, one view`;

const ALIGN_CODE = `step  = int(1e9 / 10)                       # 10 Hz, in nanoseconds
grids = {seg: np.arange(start, end, step) for seg, start, end in ranges}

even = (dataset.filter_contents(["/state/left/j1", "/task/debris_remaining"])
               .reader(index="true_time",
                       using_index_values=grids,   # the clock we want
                       fill_latest_at=True))`;

const FILTER_CODE = `kept = client.ctx.sql(
    f"SELECT episode FROM metrics WHERE {clause}").to_pandas()["episode"]

frame = (dataset.filter_segments(kept)      # 58 segments -> 55
                .filter_contents(COLUMNS)   # 62 columns  -> 28
                .reader(index="true_time", using_index_values=grids,
                        fill_latest_at=True)
                .to_pandas())`;

/** Timing and shape of one query, as measured on the run that built this page. */
function Meter({ step, shape }: { step: QueryStep; shape?: string }) {
  return (
    <p className="mt-2 flex flex-wrap items-baseline gap-x-3 font-mono text-[11px] text-ink3">
      {step.ms !== undefined && (
        <span>
          <span className="font-medium text-keep">{step.ms.toFixed(0)} ms</span> on the run that
          built this page
        </span>
      )}
      {shape && <span>{shape}</span>}
    </p>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="display-tight text-2xl leading-none font-black text-ink">{value}</p>
      <p className="mt-1 font-mono text-[11px] leading-tight text-ink2">{label}</p>
    </div>
  );
}

function Step({
  n,
  verb,
  title,
  children,
  aside,
}: {
  n: string;
  verb: string;
  title: string;
  children: React.ReactNode;
  aside: React.ReactNode;
}) {
  return (
    <article className="grid gap-x-10 gap-y-5 border-t border-line pt-6 lg:grid-cols-[19rem_1fr]">
      <div>
        <p className="display text-[11px] font-black tracking-[0.14em] uppercase">
          <span className="text-ink3">{n}</span>
          <span className="ml-2 text-flag">{verb}</span>
        </p>
        <h3 className="display-tight mt-2 text-xl leading-tight font-extrabold text-ink">
          {title}
        </h3>
        <div className="mt-2.5 space-y-2.5 text-[14px] leading-relaxed text-ink2">{children}</div>
      </div>
      <div className="min-w-0 space-y-3">{aside}</div>
    </article>
  );
}

/** The method section: the five queries the whole pipeline is made of, each
 *  shown with the output it actually returned. */
export default function QuerySection({ queries }: QuerySectionProps) {
  const by = new Map(queries.steps.map((s) => [s.id, s]));
  const serve = by.get("serve");
  const inspect = by.get("inspect");
  const align = by.get("align");
  const filter = by.get("filter");
  const compare = by.get("compare");

  const spanMs =
    align?.gaps_before && align.gaps_after
      ? Math.min(
          align.gaps_before.reduce((a, b) => a + b, 0),
          align.gaps_after.reduce((a, b) => a + b, 0),
        )
      : 0;

  return (
    <section id="queries" className="scroll-mt-24" aria-labelledby="queries-head">
      <header className="mb-8 border-t-4 border-ink pt-3">
        <p className="display text-sm font-black tracking-[0.08em] uppercase">
          <span className="text-flag">The method</span>
          <span className="mx-2 text-line2" aria-hidden="true">
            /
          </span>
          <span className="text-ink2">Rerun Query API · rerun-sdk {queries.rerun_version}</span>
        </p>
        <h2
          id="queries-head"
          className="display-tight mt-3 max-w-4xl text-4xl leading-[1.02] font-extrabold text-ink md:text-5xl"
        >
          Every number on this page is the output of a query.
        </h2>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-ink2">
          The corpus is served as one Rerun dataset and never opened as files again. Five queries do
          all the work: <span className="font-semibold text-ink">inspect</span> the corpus in SQL,{" "}
          <span className="font-semibold text-ink">align</span> it onto an honest clock,{" "}
          <span className="font-semibold text-ink">filter</span> it down to a training set,{" "}
          <span className="font-semibold text-ink">compare</span> the machine's verdicts against the
          human's, and <span className="font-semibold text-ink">prepare</span> what survives. Each
          one below is the real call, with the result it returned on the run that built this page.
        </p>
      </header>

      <div className="space-y-10">
        {serve && (
          <Step
            n="01"
            verb="serve · transform"
            title="Fifty-eight recordings, one query surface."
            aside={
              <>
                <Code code={SERVE_CODE} lang="python" source="winnow/catalog.py" />
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 border border-line2 bg-mount p-4 sm:grid-cols-4">
                  <Stat value={String(serve.segments)} label="segments — one per episode" />
                  <Stat value={String(serve.columns)} label="columns in the schema" />
                  <Stat value={String(serve.indexes?.length)} label="indexes on every row" />
                  <Stat value={String(serve.n_derived)} label="derived columns written back" />
                </div>
                <p className="font-mono text-[11px] leading-relaxed text-ink3">
                  indexes: {serve.indexes?.join(" · ")}
                  <br />
                  derived: {serve.sample_derived?.join(" · ")} …
                </p>
              </>
            }
          >
            <p>
              A local <code className="font-mono text-[13px] text-ink">rr.server.Server</code> serves
              every <code className="font-mono text-[13px] text-ink">.rrd</code> as a single dataset
              — no account, no cloud. From here nothing in the pipeline opens an episode file.
            </p>
            <p>
              Vision and timing analysis are written back into the recordings with{" "}
              <code className="font-mono text-[13px] text-ink">send_columns</code>, so{" "}
              {serve.n_derived} derived signals — debris remaining, drift, dropped ticks, per-joint
              tracking error — are queryable next to the raw joints instead of living in a side file.
            </p>
            <p>
              Each row carries four indexes.{" "}
              <span className="font-mono text-[13px] text-ink">naive_time</span> is what{" "}
              <span className="font-mono text-[13px] text-ink">meta.json</span> claims;{" "}
              <span className="font-mono text-[13px] text-ink">true_time</span> is the recorder's own
              clock. Logging both makes the corpus's central defect a queryable quantity rather than
              a footnote.
            </p>
          </Step>
        )}

        {inspect && (
          <Step
            n="02"
            verb="inspect"
            title="Twenty-eight thousand frames, reduced to one row each, in SQL."
            aside={
              <>
                <Code code={INSPECT_CODE} lang="python" source="winnow/catalog.py" />
                <Code code={inspect.sql ?? ""} lang="sql" source="winnow/catalog.py — EPISODE_METRICS" />
                <Meter
                  step={inspect}
                  shape={`${inspect.rows_in?.toLocaleString("en-US")} rows in → ${inspect.rows_out} out`}
                />
                {inspect.result && (
                  <ResultTable
                    table={inspect.result}
                    caption={`first 6 of ${inspect.rows_out} rows, verbatim`}
                  />
                )}
              </>
            }
          >
            <p>
              <code className="font-mono text-[13px] text-ink">dataset.reader()</code> hands back a
              DataFusion frame, so cross-episode analysis is ordinary SQL over every segment at once.
              This one aggregation produces the whole metrics table the rest of the site is built on.
            </p>
            <p>
              It is also how the headline defect surfaced. The recorder stamped{" "}
              <span className="font-semibold text-ink">{inspect.claimed_hz} fps</span> on every
              episode; the measured rate across the corpus is{" "}
              <span className="font-semibold text-flagdeep">{inspect.measured_hz} Hz</span>, with{" "}
              {inspect.pct_dropped}% of ticks arriving a full period late. Nothing about that is
              visible in the video. It is one{" "}
              <code className="font-mono text-[13px] text-ink">GROUP BY</code> away in the index.
            </p>
          </Step>
        )}

        {align && align.before && align.after && (
          <Step
            n="03"
            verb="align"
            title="Ask for the times you want, not the ones the recorder produced."
            aside={
              <>
                <Code code={ALIGN_CODE} lang="python" source="winnow/align.py" />
                <Meter
                  step={align}
                  shape={`${align.rows_in?.toLocaleString("en-US")} irregular rows → ${align.rows_out?.toLocaleString("en-US")} on the grid`}
                />
                {spanMs > 0 && (
                  <div className="space-y-3 border border-line2 bg-paper p-3">
                    <GapStrip
                      gaps={align.gaps_before ?? []}
                      spanMs={spanMs}
                      color="var(--color-flag)"
                      label={`as recorded — ${align.segment}`}
                      note={`dt ${align.before.min}–${align.before.max} ms, sd ${align.before.sd} ms`}
                    />
                    <GapStrip
                      gaps={align.gaps_after ?? []}
                      spanMs={spanMs}
                      color="var(--color-blue)"
                      label={`after using_index_values — ${align.target_hz} Hz`}
                      note={`dt ${align.after.min.toFixed(0)}–${align.after.max.toFixed(0)} ms, sd ${align.after.sd} ms`}
                    />
                    <p className="font-mono text-[11px] text-ink3">
                      every tick is one sample, on a shared {(spanMs / 1000).toFixed(1)} s axis
                    </p>
                  </div>
                )}
              </>
            }
          >
            <p>
              <code className="font-mono text-[13px] text-ink">reader(using_index_values=…)</code>{" "}
              asks for the state of the world at times <em>you</em> choose and lets latest-at fill the
              rest. An irregular capture comes back uniform by construction.
            </p>
            <p>
              It matters because a run loop replays action chunks at whatever rate the dataset
              declares. Train on {inspect?.measured_hz ?? 11} Hz data labelled{" "}
              {inspect?.claimed_hz ?? 15} fps and the policy executes every motion{" "}
              <span className="font-semibold text-flagdeep">1.35× faster than demonstrated</span> — on
              a contact-rich task, the difference between brushing debris and scattering it.
            </p>
            <p>
              {align.before.sd} ms of jitter goes to {align.after.sd.toFixed(0)}, so the{" "}
              <span className="font-mono text-[13px] text-ink">fps</span> written beside the exported
              data is finally true rather than aspirational.
            </p>
          </Step>
        )}

        {filter && (
          <Step
            n="04"
            verb="filter · prepare"
            title="The predicate is the dataset definition."
            aside={
              <>
                <Code code={FILTER_CODE} lang="python" source="winnow/export.py" />
                <Meter
                  step={filter}
                  shape={`${filter.rows_out?.toLocaleString("en-US")} rows exported at 10 Hz`}
                />
                <div className="grid grid-cols-2 gap-x-6 gap-y-4 border border-line2 bg-mount p-4 sm:grid-cols-3">
                  <Stat
                    value={`${filter.segments_in} → ${filter.segments_out}`}
                    label="segments, after the WHERE clause"
                  />
                  <Stat
                    value={`${filter.columns_in} → ${filter.columns_out}`}
                    label="columns, after filter_contents"
                  />
                  <Stat
                    value={filter.rejected?.join(", ") ?? "—"}
                    label="rejected by this clause"
                  />
                </div>
              </>
            }
          >
            <p>
              <code className="font-mono text-[13px] text-ink">filter_segments()</code> takes the
              result of a query;{" "}
              <code className="font-mono text-[13px] text-ink">filter_contents()</code> narrows{" "}
              {filter.columns_in} columns to the {filter.columns_out} a policy actually consumes.
              There is no separate cleaning step — whatever passes the clause <em>is</em> the dataset.
            </p>
            <p>
              The clause is written into{" "}
              <span className="font-mono text-[13px] text-ink">manifest.json</span> beside the
              resulting episode list, so &ldquo;which episodes did v1 train on&rdquo; has an exact
              answer instead of a folder somebody copied by hand. Change the clause, get a different
              dataset, diff the manifests.
            </p>
            <p className="font-mono text-[12px] text-ink3">
              --where &ldquo;{filter.where}&rdquo;
            </p>
          </Step>
        )}

        {compare && (
          <Step
            n="05"
            verb="compare · evaluate"
            title="Machine verdicts against human labels, as a join."
            aside={
              <>
                <Code code={compare.sql ?? ""} lang="sql" source="winnow/querylog.py" />
                <Meter step={compare} />
                {compare.result && (
                  <ResultTable
                    table={compare.result}
                    caption="the whole disagreement, in four rows"
                    wrap={["which"]}
                  />
                )}
              </>
            }
          >
            <p>
              The hand labels and the detector panel are registered as tables next to the metrics and
              joined in SQL. The result is the entire evaluation: seven episodes both called bad, one
              the human failed and the panel passed, two the panel caught that the human had waved
              through.
            </p>
            <p>
              It is deliberately not an accuracy figure. The labels are one person's reading of
              424×240 video and the detectors are measurements, so when they disagree the useful move
              is to go and look — which{" "}
              <a href="#adjudication" className="text-ink underline underline-offset-2">
                Finding 02
              </a>{" "}
              does, for all three.
            </p>
          </Step>
        )}
      </div>

      <p className="mt-10 border-y-2 border-ink py-3 text-center text-[15px] text-ink">
        Nothing above was typed by hand.{" "}
        <span className="font-semibold">
          <span className="font-mono text-[14px]">winnow/querylog.py</span> runs these queries, times
          them, and writes their output into this page.
        </span>
      </p>
    </section>
  );
}
