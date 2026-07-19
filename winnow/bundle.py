"""Assemble the training bundle: the episodes that survived triage, on a true clock.

Selection is a query. Start from the episodes a human passed, subtract everything
the detector panel flagged, and what remains is the training set. The manifest
records both halves so the choice can be audited later.

Sampling is the other half of the point. The recorder produced ~11 Hz with a
third of its ticks late, so `using_index_values` resamples onto an exactly
uniform grid. Each grid point also carries the source video frame it came from,
chosen by the same latest-at rule the query uses, so the images stay in step with
the proprioception.
"""
import json
import os
import shutil

import numpy as np

import align
import paths
from catalog import open_corpus
from detect import LABELLED_BAD, WARMUP

TARGET_HZ = 10.0
COLUMNS = [f"/{kind}/{arm}/{joint}"
           for kind in ("state", "action")
           for arm in paths.ARMS
           for joint in paths.JOINTS]


def selection():
    """Everything the panel did not flag, warm-up batch aside.

    The training set is defined by the measurements rather than by the hand
    labels. Every episode the panel flagged was confirmed defective on review,
    and the only episode where the labels disagreed without the panel agreeing
    (ep 22) turned out to be mislabelled, so the labels are kept as a column to
    compare against rather than used as the filter.
    """
    with open(paths.artifact("detections.json")) as f:
        detections = json.load(f)
    flagged = {int(k.split("_")[1]) for k, v in detections.items() if v}
    candidates = {e for e in paths.episodes() if e not in WARMUP}
    return sorted(candidates - flagged), sorted(flagged), detections


def column(frame, kind, arm, joint):
    return frame[f"/{kind}/{arm}/{joint}:Scalars:scalars"].explode().astype("float32").to_numpy()


def build(out_dir, hz=TARGET_HZ):
    keep, dropped, detections = selection()
    os.makedirs(out_dir, exist_ok=True)

    with open_corpus() as (_, dataset):
        segments = [f"episode_{e:04d}" for e in keep]
        grids = {k: v for k, v in align.uniform_grids(dataset, hz).items() if k in set(segments)}
        frame = (dataset.filter_segments(segments)
                        .filter_contents(COLUMNS)
                        .reader(index="true_time", using_index_values=grids, fill_latest_at=True)
                        .to_pandas())

    total = 0
    for segment, group in frame.groupby("rerun_segment_id", sort=True):
        group = group.sort_values("true_time")
        grid = group["true_time"].astype("int64").to_numpy() / 1e9

        # the video frame in force at each grid time, by the same latest-at rule
        wall = np.load(os.path.join(paths.SRC, segment, "data.npz"))["t"]
        source = np.searchsorted(wall - wall[0], grid, side="right") - 1
        source = np.clip(source, 0, len(wall) - 1)

        stack = lambda kind: np.column_stack(
            [column(group, kind, arm, joint) for arm in paths.ARMS for joint in paths.JOINTS])
        np.savez(os.path.join(out_dir, f"{segment}.npz"),
                 state=stack("state"), action=stack("action"),
                 t=grid, frame_idx=source.astype(np.int32))

        for cam in paths.CAMS:
            dst = os.path.join(out_dir, segment)
            os.makedirs(dst, exist_ok=True)
            shutil.copy(os.path.join(paths.SRC, segment, f"{cam}.mp4"),
                        os.path.join(dst, f"{cam}.mp4"))
        total += len(group)

    manifest = {
        "fps": hz,
        "episodes": segments,
        "n_frames": int(total),
        "excluded_by_panel": {f"episode_{e:04d}": [d["detector"] for d in
                                                   detections[f"episode_{e:04d}"]]
                              for e in dropped},
        "excluded_warmup": sorted(WARMUP),
        "hand_labelled_bad": sorted(LABELLED_BAD),
        "cameras": paths.CAMS,
        "state_dim": len(paths.ARMS) * len(paths.JOINTS),
    }
    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    print(f"kept {len(keep)} episodes, {total} frames at {hz:g} Hz")
    print(f"dropped {len(dropped)} flagged by the panel: "
          + ", ".join(f"ep{e}" for e in dropped))
    print(f"bundle at {out_dir}")
    return manifest


if __name__ == "__main__":
    build(os.path.join(paths.DATA, "train_bundle"))
