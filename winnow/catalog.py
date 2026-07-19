"""Serving the corpus and reducing it to one row per episode.

Everything downstream goes through the Rerun Query API. The 65 .rrd files are
served by a local catalog, read back as a single DataFusion frame, and reduced
in SQL. No stage below this one opens an episode file directly.
"""
import contextlib
import glob
import os

import rerun as rr

import paths

# Scalars arrive as one-element lists, hence the [1] subscripts.
EPISODE_METRICS = """
WITH frame AS (
  SELECT
    rerun_segment_id                                   AS episode,
    frame_idx,
    "/timing/dt_ms:Scalars:scalars"[1]                 AS dt_ms,
    "/timing/dropped_tick:Scalars:scalars"[1]          AS dropped,
    "/timing/elapsed_true:Scalars:scalars"[1]          AS elapsed,
    "/task/debris_remaining:Scalars:scalars"[1]        AS debris,
    "/tracking_error/left/gripper:Scalars:scalars"[1]  AS err_left_grip,
    "/tracking_error/right/gripper:Scalars:scalars"[1] AS err_right_grip,
    "/tracking_error/left/j4:Scalars:scalars"[1]       AS err_left_j4
  FROM frames
)
SELECT
  episode,
  count(*)                                        AS n_frames,
  round(max(elapsed), 1)                          AS duration_s,
  round(count(*) / max(elapsed), 2)               AS true_hz,
  round(100.0 * avg(dropped), 1)                  AS pct_dropped,
  round(max(dt_ms), 0)                            AS worst_gap_ms,
  round(last_value(debris ORDER BY frame_idx), 3) AS debris_end,
  round(max(err_left_j4), 3)                      AS peak_err_left_j4,
  round(avg(err_left_grip + err_right_grip) / 2, 4) AS mean_grip_err
FROM frame
GROUP BY episode
ORDER BY episode
"""


@contextlib.contextmanager
def open_corpus():
    """Serve every .rrd as one dataset and yield (client, dataset)."""
    files = sorted(glob.glob(os.path.join(paths.RRD, "*.rrd")))
    if not files:
        raise SystemExit(f"no .rrd files in {paths.RRD}; run ingest.py first")
    with rr.server.Server(datasets={"sweep": files}) as server:
        client = rr.catalog.CatalogClient(server.url())
        yield client, client.get_dataset("sweep")


def episode_metrics(client, dataset):
    """One row per episode, computed entirely in SQL over all segments."""
    client.ctx.register_view("frames", dataset.reader(index="frame_idx", fill_latest_at=True))
    return client.ctx.sql(EPISODE_METRICS)


def main():
    with open_corpus() as (client, dataset):
        print(f"{len(dataset.segment_ids())} segments")
        frame = episode_metrics(client, dataset).to_pandas()
    frame.to_csv(paths.artifact("metrics.csv"), index=False)
    print(frame.to_string(index=False))


if __name__ == "__main__":
    main()
