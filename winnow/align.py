"""Resample the corpus onto an honest, uniform clock.

The recorder claimed 15 fps. The timestamps say about 11 Hz, with a third of the
ticks arriving a full period late. Training on that as though it were uniform
bakes a 1.35x speed error into the policy, because the run loop replays action
chunks at whatever rate the dataset metadata declares.

`reader(using_index_values=...)` is the fix. Rather than accepting the sample
times the recorder happened to produce, we state the times we want and let
latest-at fill in the rest. The output is uniform by construction, so the `fps`
written beside it finally means something.
"""
import numpy as np

import paths
from catalog import open_corpus

TARGET_HZ = 10.0
NS_PER_S = 1_000_000_000


def uniform_grids(dataset, hz=TARGET_HZ):
    """An evenly spaced true_time grid per segment, as {segment_id: nanoseconds}."""
    ranges = dataset.get_index_ranges().to_arrow_table().to_pydict()
    step = int(NS_PER_S / hz)
    grids = {}
    for segment, start, end in zip(ranges["rerun_segment_id"],
                                   ranges["true_time:start"],
                                   ranges["true_time:end"]):
        lo = int(np.asarray(start, dtype="timedelta64[ns]").astype("int64"))
        hi = int(np.asarray(end, dtype="timedelta64[ns]").astype("int64"))
        grids[segment] = np.arange(lo, hi, step, dtype=np.int64)
    return grids


def main():
    from datafusion import col

    contents = ["/state/left/j1", "/state/right/j1", "/task/debris_remaining"]
    with open_corpus() as (_, dataset):
        view = dataset.filter_contents(contents)
        grids = uniform_grids(dataset)

        raw = view.reader(index="true_time", fill_latest_at=True)
        even = view.reader(index="true_time", using_index_values=grids, fill_latest_at=True)
        print(f"raw rows       {raw.count()}")
        print(f"resampled rows {even.count()} at a uniform {TARGET_HZ:g} Hz")

        segment = sorted(grids)[0]
        before = (raw.filter(col("rerun_segment_id") == segment)
                     .select("true_time").to_pandas()["true_time"])
        after = (even.filter(col("rerun_segment_id") == segment)
                     .select("true_time").to_pandas()["true_time"])

    gap_before = np.diff(before.astype("int64").to_numpy()) / 1e6
    gap_after = np.diff(after.astype("int64").to_numpy()) / 1e6
    print(f"\n{segment}")
    print(f"  before  dt {gap_before.min():.1f}-{gap_before.max():.1f} ms, "
          f"sd {gap_before.std():.1f} ms, {1000 / gap_before.mean():.2f} Hz actual "
          f"against {paths.NOMINAL_FPS:g} fps claimed")
    print(f"  after   dt {gap_after.min():.1f}-{gap_after.max():.1f} ms, "
          f"sd {gap_after.std():.1f} ms")


if __name__ == "__main__":
    main()
