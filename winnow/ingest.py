"""Turn the episode folders into one queryable Rerun dataset.

Each episode becomes a single .rrd, which the catalog treats as one segment, so
a query addresses the whole corpus at once. Every episode carries four indexes
and each one answers a different kind of question:

    frame_idx    sequence    raw sample number
    true_time    duration    elapsed seconds from the recorder's clock
    naive_time   duration    frame_idx / 15, which is what meta.json claims
    log_time     timestamp   absolute wall clock

The divergence between true_time and naive_time is the defect this pipeline was
built to surface: the recorder stamped 15 fps on data that arrived at ~11 Hz.
"""
import json
import os
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import rerun as rr

import paths

DROPPED_TICK = 1.5 / paths.NOMINAL_FPS


def indexes(frame, elapsed, wall):
    return [
        rr.TimeColumn("frame_idx", sequence=frame),
        rr.TimeColumn("true_time", duration=elapsed),
        rr.TimeColumn("naive_time", duration=frame / paths.NOMINAL_FPS),
        rr.TimeColumn("log_time", timestamp=wall),
    ]


def log_proprioception(rec, times, state, action):
    for arm, base in paths.ARMS.items():
        for offset, joint in enumerate(paths.JOINTS):
            col = base + offset
            rec.send_columns(f"/state/{arm}/{joint}", times,
                             rr.Scalars.columns(scalars=state[:, col]))
            rec.send_columns(f"/action/{arm}/{joint}", times,
                             rr.Scalars.columns(scalars=action[:, col]))
            rec.send_columns(f"/tracking_error/{arm}/{joint}", times,
                             rr.Scalars.columns(scalars=np.abs(action[:, col] - state[:, col])))


def log_timing(rec, times, elapsed, naive):
    dt = np.diff(elapsed, prepend=elapsed[0] - 1.0 / paths.NOMINAL_FPS)
    series = {
        "/timing/dt_ms": dt * 1e3,
        "/timing/dropped_tick": (dt > DROPPED_TICK).astype(float),
        "/timing/elapsed_true": elapsed,
        "/timing/elapsed_naive": naive,
        "/timing/drift": elapsed - naive,
    }
    for path, values in series.items():
        rec.send_columns(path, times, rr.Scalars.columns(scalars=values))


def log_video(rec, episode, frame, elapsed, wall):
    for cam in paths.CAMS:
        path = os.path.join(paths.VIDEO, f"episode_{episode:04d}", f"{cam}.mp4")
        if not os.path.exists(path):
            continue
        asset = rr.AssetVideo(path=path)
        rec.log(f"/video/{cam}", asset, static=True)
        stamps = asset.read_frame_timestamps_nanos()
        n = min(len(stamps), len(frame))
        rec.send_columns(f"/video/{cam}",
                         indexes(frame[:n], elapsed[:n], wall[:n]),
                         rr.VideoFrameReference.columns_nanos(stamps[:n]))


def ingest(episode, debris_by_episode):
    name = f"episode_{episode:04d}"
    data = np.load(os.path.join(paths.SRC, name, "data.npz"))
    state, action, wall = data["state"], data["action"], data["t"]
    n = len(wall)
    frame = np.arange(n)
    elapsed = wall - wall[0]
    naive = frame / paths.NOMINAL_FPS

    rec = rr.RecordingStream("sweep", recording_id=name)
    rec.save(os.path.join(paths.RRD, f"{name}.rrd"))
    times = indexes(frame, elapsed, wall)

    log_proprioception(rec, times, state, action)
    log_timing(rec, times, elapsed, naive)

    debris = np.asarray(debris_by_episode.get(name, []), dtype=float)[:n]
    if len(debris) == n:
        baseline = max(np.median(debris[:max(3, n // 40)]), 1.0)
        rec.send_columns("/task/debris_remaining", times,
                         rr.Scalars.columns(scalars=debris / baseline))

    log_video(rec, episode, frame, elapsed, wall)
    rec.flush()
    return name, n


def main():
    os.makedirs(paths.RRD, exist_ok=True)
    with open(paths.artifact("video_features.json")) as f:
        video = json.load(f)
    debris = {k: v["debris"] for k, v in video.items() if "debris" in v}

    episodes = paths.episodes()
    print(f"ingesting {len(episodes)} episodes into {paths.RRD}")
    with ProcessPoolExecutor(6) as pool:
        for done, _ in enumerate(pool.map(ingest, episodes, [debris] * len(episodes)), 1):
            if done % 10 == 0:
                print(f"  {done}/{len(episodes)}")
    print("done")


if __name__ == "__main__":
    main()
