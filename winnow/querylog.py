"""Run the pipeline's queries and record what they actually returned.

Every claim the dashboard makes about the Query API is produced here, by
running the query and capturing its real output and wall time. Nothing in the
query section of the site is typed by hand; it is this file's JSON.

The five steps below are the five things the corpus needs done to it, and each
one is a different part of the Query API:

    serve     rr.server.Server + CatalogClient   58 .rrd files, one dataset
    inspect   dataset.reader -> DataFusion SQL   28k frames -> 58 rows
    align     reader(using_index_values=...)     an irregular clock made uniform
    filter    filter_segments + filter_contents  the training set is a predicate
    compare   SQL join against the hand labels   machine vs human, as a table
"""
import json
import time

import numpy as np

import align
import paths
from catalog import EPISODE_METRICS, episode_metrics, open_corpus

# The clause export.py ships with, and the columns a policy actually consumes.
WHERE = "pct_dropped < 40 AND debris_end < 0.3 AND worst_gap_ms < 500"
POLICY_COLUMNS = [f"/{kind}/{arm}/{joint}"
                  for kind in ("state", "action")
                  for arm in paths.ARMS
                  for joint in paths.JOINTS]

ALIGN_CONTENTS = ["/state/left/j1", "/state/right/j1", "/task/debris_remaining"]

# Written back into the recording by ingest.py with send_columns, so derived
# signals are queryable next to the raw ones instead of living in a side file.
DERIVED_PREFIXES = ("/timing/", "/tracking_error/", "/task/")


class Timer:
    """Wall time around a query, in milliseconds."""

    def __enter__(self):
        self.t0 = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self.ms = round((time.perf_counter() - self.t0) * 1000, 1)


def table(frame, columns, limit):
    """A few real rows of a result, formatted for display."""
    head = frame[columns].head(limit)
    rows = []
    for values in head.itertuples(index=False):
        rows.append([v.replace("episode_00", "ep ") if isinstance(v, str) else
                     (round(float(v), 4) if v is not None else None) for v in values])
    return {"columns": list(columns), "rows": rows}


def step_serve(dataset):
    names = list(dataset.schema().column_names())
    indexes = [n for n in names if ":" not in n]
    derived = [n for n in names if n.startswith(DERIVED_PREFIXES)]
    video = sorted({n.split(":")[0] for n in names if n.startswith("/video/")})
    return {
        "id": "serve",
        "verb": "serve",
        "segments": len(dataset.segment_ids()),
        "columns": len(names),
        "indexes": indexes,
        "n_derived": len(derived),
        "n_video": len(video),
        "sample_derived": ["/timing/dt_ms", "/timing/drift", "/timing/dropped_tick",
                           "/task/debris_remaining", "/tracking_error/left/j4"],
    }


def step_inspect(client, dataset):
    """One row per episode, computed in SQL across every segment at once."""
    reader = dataset.reader(index="frame_idx", fill_latest_at=True)
    rows_in = reader.count()
    client.ctx.register_view("frames", reader)
    with Timer() as t:
        frame = client.ctx.sql(EPISODE_METRICS).to_pandas()
    return {
        "id": "inspect",
        "verb": "inspect",
        "sql": EPISODE_METRICS.strip(),
        "ms": t.ms,
        "rows_in": int(rows_in),
        "rows_out": int(len(frame)),
        "result": table(frame, ["episode", "n_frames", "true_hz", "pct_dropped",
                                "worst_gap_ms", "debris_end"], 6),
        "claimed_hz": paths.NOMINAL_FPS,
        "measured_hz": round(float(frame["true_hz"].mean()), 2),
        "pct_dropped": round(float(frame["pct_dropped"].mean()), 1),
    }


def step_align(dataset):
    """The recorder's irregular clock, restated on a grid we choose."""
    from datafusion import col

    view = dataset.filter_contents(ALIGN_CONTENTS)
    grids = align.uniform_grids(dataset)
    raw = view.reader(index="true_time", fill_latest_at=True)
    with Timer() as t:
        even = view.reader(index="true_time", using_index_values=grids,
                           fill_latest_at=True)
        rows_out = even.count()

    segment = sorted(grids)[0]
    def gaps(reader):
        stamps = (reader.filter(col("rerun_segment_id") == segment)
                        .select("true_time").to_pandas()["true_time"])
        return np.diff(stamps.astype("int64").to_numpy()) / 1e6

    before, after = gaps(raw), gaps(even)
    return {
        "id": "align",
        "verb": "align",
        "ms": t.ms,
        "segment": segment.replace("episode_00", "ep "),
        "rows_in": int(raw.count()),
        "rows_out": int(rows_out),
        "target_hz": align.TARGET_HZ,
        "before": {"min": round(float(before.min()), 1), "max": round(float(before.max()), 1),
                   "sd": round(float(before.std()), 1),
                   "hz": round(float(1000 / before.mean()), 2)},
        "after": {"min": round(float(after.min()), 1), "max": round(float(after.max()), 1),
                  "sd": round(float(after.std()), 1),
                  "hz": round(float(1000 / after.mean()), 2)},
        "gaps_before": [round(float(v), 1) for v in before[:48]],
        "gaps_after": [round(float(v), 1) for v in after[:48]],
    }


def step_filter(client, dataset, n_columns):
    """A WHERE clause selects the segments; filter_contents narrows the columns."""
    with Timer() as t:
        kept = client.ctx.sql(
            f"SELECT episode FROM metrics WHERE {WHERE} ORDER BY episode"
        ).to_pandas()["episode"].tolist()
    rejected = sorted(set(dataset.segment_ids()) - set(kept))

    grids = {k: v for k, v in align.uniform_grids(dataset).items() if k in set(kept)}
    with Timer() as t2:
        rows = (dataset.filter_segments(kept)
                       .filter_contents(POLICY_COLUMNS)
                       .reader(index="true_time", using_index_values=grids,
                               fill_latest_at=True)
                       .count())
    return {
        "id": "filter",
        "verb": "filter",
        "where": WHERE,
        "ms": round(t.ms + t2.ms, 1),
        "segments_in": len(dataset.segment_ids()),
        "segments_out": len(kept),
        "columns_in": n_columns,
        "columns_out": len(POLICY_COLUMNS),
        "rows_out": int(rows),
        "rejected": [r.replace("episode_00", "ep ") for r in rejected],
    }


COMPARE_SQL = """
SELECT
  CASE WHEN l.verdict = 'bad' THEN 'human failed it'
       ELSE 'human passed it' END        AS human,
  CASE WHEN p.fired  THEN 'panel flagged it'
       ELSE 'panel silent'  END          AS panel,
  count(*)                               AS episodes,
  CASE WHEN count(*) <= 12
       THEN string_agg(replace(m.episode, 'episode_00', 'ep '), ', '
                       ORDER BY m.episode)
       ELSE '(the rest of the corpus)' END AS which
FROM metrics m
JOIN labels l ON l.episode = m.episode
JOIN panel  p ON p.episode = m.episode
GROUP BY 1, 2
ORDER BY 1 DESC, 2 DESC
"""


def step_compare(client):
    """Machine verdicts and hand labels, joined and counted in SQL."""
    import detect
    from webdata import LABELLED_GOOD

    _, _, fired = detect.evaluate()
    names = [f"episode_{e:04d}" for e in paths.episodes()]
    client.ctx.from_pydict(
        {"episode": names,
         "verdict": ["good" if int(n[-4:]) in LABELLED_GOOD else "bad" for n in names]},
        name="labels")
    client.ctx.from_pydict(
        {"episode": names, "fired": [bool(fired.get(int(n[-4:]))) for n in names]},
        name="panel")

    with Timer() as t:
        frame = client.ctx.sql(COMPARE_SQL).to_pandas()
    return {
        "id": "compare",
        "verb": "compare",
        "sql": COMPARE_SQL.strip(),
        "ms": t.ms,
        "result": table(frame, ["human", "panel", "episodes", "which"], 4),
    }


def build():
    import rerun as rr

    with open_corpus() as (client, dataset):
        serve = step_serve(dataset)
        inspect = step_inspect(client, dataset)
        client.ctx.register_view("metrics", episode_metrics(client, dataset))
        aligned = step_align(dataset)
        filtered = step_filter(client, dataset, serve["columns"])
        compared = step_compare(client)

    return {
        "rerun_version": rr.__version__,
        "steps": [serve, inspect, aligned, filtered, compared],
    }


def main():
    import os

    log = build()
    targets = [paths.artifact("querylog.json"),
               os.path.join(paths.ROOT, "ui", "public", "querylog.json")]
    for target in targets:
        with open(target, "w") as f:
            json.dump(log, f, indent=2)
    for step in log["steps"]:
        print(f"{step['verb']:>8}  {step.get('ms', 0):>8.1f} ms")
    print("wrote " + " and ".join(targets))


if __name__ == "__main__":
    main()
