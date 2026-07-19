"""Curate a training set by writing a predicate.

    python export.py --where "pct_dropped < 40 AND debris_end < 0.3" --out curated_v1

The predicate is the dataset definition. It is recorded in the manifest next to
the resulting episode list, so "which episodes did v1 train on" has an exact,
reproducible answer rather than a folder somebody copied by hand at 2am.

Survivors come back out on a uniform clock, so the fps recorded beside them is
true rather than aspirational.
"""
import argparse
import json
import os

import numpy as np

import align
import paths
from catalog import episode_metrics, open_corpus

DEFAULT_WHERE = "pct_dropped < 40 AND debris_end < 0.3 AND worst_gap_ms < 500"
COLUMNS = [f"/{kind}/{arm}/{joint}"
           for kind in ("state", "action")
           for arm in paths.ARMS
           for joint in paths.JOINTS]


def column(frame, kind, arm, joint):
    key = f"/{kind}/{arm}/{joint}:Scalars:scalars"
    return frame[key].explode().astype("float32").to_numpy()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--where", default=DEFAULT_WHERE)
    parser.add_argument("--out", default="curated_v1")
    parser.add_argument("--hz", type=float, default=align.TARGET_HZ)
    args = parser.parse_args()

    out = os.path.join(paths.DATA, args.out)
    os.makedirs(out, exist_ok=True)

    with open_corpus() as (client, dataset):
        client.ctx.register_view("metrics", episode_metrics(client, dataset))
        kept = client.ctx.sql(
            f"SELECT episode FROM metrics WHERE {args.where} ORDER BY episode"
        ).to_pandas()["episode"].tolist()
        rejected = sorted(set(dataset.segment_ids()) - set(kept))

        print(f"kept {len(kept)} of {len(dataset.segment_ids())} episodes")
        print("rejected:", ", ".join(r.replace("episode_", "ep") for r in rejected) or "none")

        grids = {k: v for k, v in align.uniform_grids(dataset, args.hz).items() if k in set(kept)}
        frame = (dataset.filter_segments(kept)
                        .filter_contents(COLUMNS)
                        .reader(index="true_time", using_index_values=grids, fill_latest_at=True)
                        .to_pandas())

    total = 0
    for segment, group in frame.groupby("rerun_segment_id", sort=True):
        group = group.sort_values("true_time")
        stack = lambda kind: np.column_stack(
            [column(group, kind, arm, joint) for arm in paths.ARMS for joint in paths.JOINTS]
        )
        np.savez(os.path.join(out, f"{segment}.npz"),
                 state=stack("state"),
                 action=stack("action"),
                 t=group["true_time"].astype("int64").to_numpy() / 1e9)
        total += len(group)

    manifest = {
        "query": args.where,
        "fps": args.hz,
        "episodes": kept,
        "rejected": rejected,
        "n_frames": int(total),
        "rerun_version": __import__("rerun").__version__,
    }
    with open(os.path.join(out, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"wrote {len(kept)} episodes, {total} frames at {args.hz:g} Hz to {out}")


if __name__ == "__main__":
    main()
