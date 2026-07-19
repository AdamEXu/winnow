"""A panel of independent defect detectors, and an honest score against the labels.

Each detector answers one concrete question about a recording and explains itself
in a sentence a person can check against the video. Thresholds come from the
shape of the corpus, the modal gripper sequence or a median-absolute-deviation
score, never from the human labels. The labels are used once, at the end, to
report how well the panel agrees.

Episodes 0-6 are an early batch recorded with the wrong action and speed
settings. They are a known-bad batch rather than six defects to rediscover, so
they are excluded from scoring.
"""
import json
import os

import numpy as np

import paths
from features import load

WARMUP = set(range(7))
LABELLED_BAD = {11, 14, 22, 24, 27, 32, 40, 41}


def robust_z(values):
    """Median and MAD, so a single outlier cannot inflate the scale that flags it."""
    values = np.asarray(values, dtype=float)
    median = np.median(values)
    spread = np.median(np.abs(values - median)) * 1.4826
    return (values - median) / (spread if spread > 1e-9 else 1.0)


def panel(table, stray=None):
    """Boolean mask and message template per detector, aligned with `episodes`."""
    z = {k: robust_z(v) for k, v in table.items()}
    modal_cycles = int(np.bincount(table["grip_cycles_right"].astype(int)).argmax())

    detectors = {
        "incomplete_sequence": (
            table["grip_cycles_right"] < modal_cycles,
            "the right gripper cycled {grip_cycles_right:.0f} times; a complete demonstration "
            f"cycles it {modal_cycles}, so a phase of the task is missing",
        ),
        "task_not_completed": (
            table["debris_end"] > 0.30,
            "{debris_end:.0%} of the debris was still on the table when the episode ended",
        ),
        "truncated": (
            z["duration_s"] < -3.0,
            "only {duration_s:.0f} seconds, far shorter than any complete demonstration",
        ),
        "capture_stall": (
            table["worst_gap_ms"] > 500,
            "a {worst_gap_ms:.0f} ms gap with no data recorded at all",
        ),
    }

    if stray is not None:
        detectors["debris_outside_basket"] = (
            stray["mask"],
            stray["message"],
        )
    return detectors


def evaluate():
    features = load()
    episodes = [e for e in paths.episodes() if e not in WARMUP]
    keys = [k for k, v in features[f"episode_{episodes[0]:04d}"].items()
            if isinstance(v, (int, float))]
    table = {k: np.array([features[f"episode_{e:04d}"][k] for e in episodes], dtype=float)
             for k in keys}

    stray = None
    stray_path = paths.artifact("residual.json")
    if os.path.exists(stray_path):
        with open(stray_path) as f:
            scores = json.load(f)
        key = next(iter(next(iter(scores.values()))))
        values = np.array([scores[f"episode_{e:04d}"][key] for e in episodes], dtype=float)
        table[key] = values
        stray = {
            "mask": robust_z(values) > 4.0,
            "message": "debris was left outside the basket at the end of the episode",
        }

    detectors = panel(table, stray)
    fired = {}
    for i, episode in enumerate(episodes):
        hits = [
            {"detector": name, "why": message.format(**features[f"episode_{episode:04d}"])}
            for name, (mask, message) in detectors.items()
            if bool(np.asarray(mask)[i])
        ]
        fired[episode] = hits
    return episodes, detectors, fired


def main():
    episodes, detectors, fired = evaluate()
    labelled = np.array([e in LABELLED_BAD for e in episodes])
    flagged = np.array([bool(fired[e]) for e in episodes])

    print(f"{'detector':26}{'fires':>6}{'labelled bad':>14}{'other':>7}")
    for name, (mask, _) in detectors.items():
        mask = np.asarray(mask)
        print(f"{name:26}{mask.sum():>6}{int((mask & labelled).sum()):>14}"
              f"{int((mask & ~labelled).sum()):>7}")

    caught = int((flagged & labelled).sum())
    missed = [e for e, f in zip(episodes, flagged) if not f and e in LABELLED_BAD]
    print(f"\ncaught {caught} of {int(labelled.sum())} labelled bad episodes")
    print(f"missed {missed}")
    print(f"flagged {int((flagged & ~labelled).sum())} episodes not on the human's list")

    for episode in sorted(LABELLED_BAD):
        print(f"\nep{episode}")
        for hit in fired.get(episode) or [{"detector": "none", "why": "no detector fired"}]:
            print(f"  [{hit['detector']}] {hit['why']}")

    with open(paths.artifact("detections.json"), "w") as f:
        json.dump({f"episode_{e:04d}": fired[e] for e in episodes}, f, indent=1)


if __name__ == "__main__":
    main()
