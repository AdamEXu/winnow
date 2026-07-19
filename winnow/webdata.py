"""Bundle everything the dashboard needs into one JSON file, plus thumbnails.

The UI never talks to Rerun directly. This stage runs the queries, joins the
results, downsamples the per-frame series to something a browser can plot, and
writes a single artifact the frontend can fetch.
"""
import json
import os
from concurrent.futures import ProcessPoolExecutor

import av
import numpy as np
from PIL import Image

import detect
import paths
from catalog import episode_metrics, open_corpus
from features import load

UI_PUBLIC = os.path.join(paths.ROOT, "ui", "public")
THUMBS = os.path.join(UI_PUBLIC, "thumbs")
SPARK_POINTS = 160
STRIP_FRAMES = 6
THUMB_WIDTH = 200

# Recorded by a teammate who watched the footage. Treated as one opinion to
# compare against, not as ground truth.
LABELLED_GOOD = {7, 8, 9, 10, 12, 13, 15, 16, 17, 18, 19, 20, 21, 23, 25, 26, 28, 29, 30,
                 31, 33, 34, 35, 36, 37, 38, 39, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
                 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64}


def downsample(series, n=SPARK_POINTS):
    series = np.asarray(series, dtype=float)
    if len(series) <= n:
        return [round(float(v), 4) for v in series]
    edges = np.linspace(0, len(series), n + 1).astype(int)
    return [round(float(series[a:b].mean()), 4) for a, b in zip(edges[:-1], edges[1:]) if b > a]


def thumbnails(episode):
    """A short filmstrip per episode, evenly spaced across the demonstration."""
    out = os.path.join(THUMBS, f"episode_{episode:04d}")
    os.makedirs(out, exist_ok=True)
    src = os.path.join(paths.SRC, f"episode_{episode:04d}", "top.mp4")

    container = av.open(src)
    frames = [f.to_ndarray(format="rgb24") for f in container.decode(video=0)]
    container.close()

    picks = np.linspace(0, len(frames) - 1, STRIP_FRAMES).astype(int)
    for slot, index in enumerate(picks):
        image = Image.fromarray(frames[index])
        image.thumbnail((THUMB_WIDTH, THUMB_WIDTH))
        image.save(os.path.join(out, f"{slot}.jpg"), quality=78)
    return episode, [int(i) for i in picks], len(frames)


def build():
    features = load()
    with open(paths.artifact("video_features.json")) as f:
        video = json.load(f)
    with open_corpus() as (client, dataset):
        metrics = episode_metrics(client, dataset).to_pandas()
    metrics = metrics.set_index("episode")

    episodes, detectors, fired = detect.evaluate()

    os.makedirs(THUMBS, exist_ok=True)
    strips = {}
    with ProcessPoolExecutor(8) as pool:
        for episode, picks, n in pool.map(thumbnails, paths.episodes()):
            strips[episode] = {"picks": picks, "n_frames": n}

    records = []
    for episode in paths.episodes():
        name = f"episode_{episode:04d}"
        feat = features[name]
        row = metrics.loc[name].to_dict() if name in metrics.index else {}
        debris = np.asarray(video[name]["debris"], dtype=float)
        baseline = max(np.median(debris[:max(3, len(debris) // 40)]), 1.0)
        elapsed = np.load(os.path.join(paths.SRC, name, "data.npz"))["t"]
        elapsed = elapsed - elapsed[0]

        records.append({
            "episode": episode,
            "name": name,
            "warmup": episode in detect.WARMUP,
            "labelled": ("good" if episode in LABELLED_GOOD
                         else "batch" if episode in detect.WARMUP else "bad"),
            "metrics": {k: (None if v is None else float(v)) for k, v in row.items()},
            "features": feat,
            "detections": fired.get(episode, []),
            "series": {
                "debris": downsample(debris / baseline),
                "dt_ms": downsample(np.diff(elapsed, prepend=elapsed[0]) * 1e3),
                "motion": downsample(video[name]["top_motion"]),
                "drift": downsample(elapsed - np.arange(len(elapsed)) / paths.NOMINAL_FPS),
            },
            "strip": strips.get(episode, {}),
        })

    dt_all = np.concatenate([
        np.diff(np.load(os.path.join(paths.SRC, f"episode_{e:04d}", "data.npz"))["t"])
        for e in paths.episodes()
    ])
    total_frames = int(sum(r["features"]["n_frames"] for r in records))

    summary = {
        "n_episodes": len(records),
        "n_frames": total_frames,
        "wall_clock_min": round(float(sum(r["features"]["duration_s"] for r in records) / 60), 1),
        "claimed_fps": paths.NOMINAL_FPS,
        "measured_hz": round(float(1 / dt_all.mean()), 2),
        "pct_double_gaps": round(float(100 * ((dt_all >= 0.1) & (dt_all < 0.2)).mean()), 1),
        "video_min_at_claimed": round(total_frames / paths.NOMINAL_FPS / 60, 1),
        "gap_histogram": np.histogram(dt_all * 1e3, bins=40, range=(50, 160))[0].tolist(),
        "gap_bin_edges": [round(float(v), 1) for v in np.linspace(50, 160, 41)],
        "detectors": list(detectors),
        "cameras": paths.CAMS,
    }

    os.makedirs(UI_PUBLIC, exist_ok=True)
    with open(os.path.join(UI_PUBLIC, "data.json"), "w") as f:
        json.dump({"summary": summary, "episodes": records}, f)
    print(f"wrote {os.path.join(UI_PUBLIC, 'data.json')} for {len(records)} episodes")
    print(f"thumbnails in {THUMBS}")


if __name__ == "__main__":
    build()
