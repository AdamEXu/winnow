"""One feature vector per episode, combining proprioception with vision.

Every feature is a plain physical quantity with a stated meaning. None of them
are chosen or tuned against the human labels; the labels are only ever used to
score features after the fact, in `detect.py`.
"""
import json
import os

import numpy as np

import paths

IDLE_SPEED = 0.05
DROPPED_TICK = 1.5 / paths.NOMINAL_FPS
FROZEN_MOTION = 0.05


def gripper_cycles(signal):
    """Open/close transitions, thresholded at the midpoint of the episode's range."""
    midpoint = (signal.max() + signal.min()) / 2
    return int(np.abs(np.diff((signal > midpoint).astype(int))).sum())


def follower_lag(action, state, max_lag=12):
    """Frames the follower trails the leader, by peak cross-correlation."""
    action = (action - action.mean()) / (action.std() + 1e-9)
    state = (state - state.mean()) / (state.std() + 1e-9)
    scores = [float(np.dot(action[:len(action) - k], state[k:]) / max(len(action) - k, 1))
              for k in range(max_lag + 1)]
    return int(np.argmax(scores))


def extract(episode, video):
    name = f"episode_{episode:04d}"
    data = np.load(os.path.join(paths.SRC, name, "data.npz"))
    state, action, wall = data["state"], data["action"], data["t"]
    n = len(wall)
    elapsed = wall - wall[0]
    dt = np.diff(elapsed)

    debris = np.asarray(video[name]["debris"], dtype=float)[:n]
    baseline = max(np.median(debris[:max(3, n // 40)]), 1.0)
    debris = debris / baseline
    trough = int(np.argmin(debris))

    speed = np.abs(np.diff(state, axis=0) / dt[:, None]).max(axis=1)
    top_motion = np.asarray(video[name]["top_motion"], dtype=float)[:n]

    return {
        "n_frames": n,
        "duration_s": float(elapsed[-1]),
        "true_hz": float(n / elapsed[-1]),
        "pct_dropped": float(100.0 * (dt > DROPPED_TICK).mean()),
        "worst_gap_ms": float(dt.max() * 1e3),

        "grip_cycles_left": gripper_cycles(state[:, paths.ARMS["left"] + 6]),
        "grip_cycles_right": gripper_cycles(state[:, paths.ARMS["right"] + 6]),
        "track_err_mean": float(np.abs(action - state).mean()),
        "track_err_p99": float(np.percentile(np.abs(action - state), 99)),
        "follower_lag": max(follower_lag(action[:, 1], state[:, 1]),
                            follower_lag(action[:, 8], state[:, 8])),
        "jerk": float(np.abs(np.diff(np.abs(np.diff(state, axis=0) / dt[:, None]), axis=0)).mean()),
        "idle_frac": float((speed < IDLE_SPEED).mean()),

        "debris_end": float(debris[-1]),
        "debris_trough_frac": float(trough / n),
        "frozen_frames": int((top_motion[1:] < FROZEN_MOTION).sum()),
        "wrist1_luma_min": float(np.min(video[name]["wrist_1_luma"][:n])),
        "wrist2_luma_min": float(np.min(video[name]["wrist_2_luma"][:n])),
    }


def load():
    with open(paths.artifact("features.json")) as f:
        return json.load(f)


def main():
    with open(paths.artifact("video_features.json")) as f:
        video = json.load(f)
    out = {f"episode_{e:04d}": extract(e, video) for e in paths.episodes()}
    with open(paths.artifact("features.json"), "w") as f:
        json.dump(out, f, indent=1)
    print(f"wrote features for {len(out)} episodes")


if __name__ == "__main__":
    main()
