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


def describe_stray(record):
    """Say where the debris ended up, and for how long it sat there."""
    parts = []
    for defect in record["defects"]:
        where = f"at ({defect['x']:.0f}, {defect['y']:.0f}) in the top view"
        if defect["type"] == "table_stray":
            seen = "still visible in the final frame" if defect.get("visible_at_end") \
                else "last seen before an arm parked over it"
            parts.append(f"a piece was left on the table {where}, held still for "
                         f"{defect['obs']} frames and {seen}")
        else:
            parts.append(f"a piece was still sitting in the dustpan {where} for "
                         f"{defect['hits']} of the last {defect['of']} frames, never dumped")
    return "; ".join(parts) or "debris ended up outside the basket"


def panel(table, stray=None):
    """Boolean mask and message template per detector, aligned with `episodes`."""
    z = {k: robust_z(v) for k, v in table.items()}

    # An `incomplete_sequence` detector used to live here, counting gripper
    # open/close cycles against the corpus modal value of eight and flagging
    # anything lower. It was removed: sweeping the threshold between 30% and 70%
    # of each episode's gripper range changes the count for every episode in the
    # corpus, known-good ones included, and at 40% all of its flags count eight
    # like everything else. It measured where the threshold sat, not what the
    # robot did. See docs/detection.md.
    detectors = {
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
            residual = json.load(f)
        table["stray_score"] = np.array(
            [residual[f"episode_{e:04d}"]["score"] for e in episodes], dtype=float)
        stray = {
            "mask": np.array([residual[f"episode_{e:04d}"]["defective"] for e in episodes]),
            "message": [describe_stray(residual[f"episode_{e:04d}"]) for e in episodes],
        }

    detectors = panel(table, stray)
    fired = {}
    for i, episode in enumerate(episodes):
        hits = []
        for name, (mask, message) in detectors.items():
            if not bool(np.asarray(mask)[i]):
                continue
            # most detectors carry a format string; the stray detector carries
            # one already-rendered sentence per episode
            why = message[i] if isinstance(message, list) else \
                message.format(**features[f"episode_{episode:04d}"])
            hits.append({"detector": name, "why": why})
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
