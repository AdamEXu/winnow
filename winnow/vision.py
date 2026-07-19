"""Per-frame signals read off the camera streams.

Cheap physical quantities only. Nothing here is learned and nothing is fitted;
each value is something you could point at in a single frame and explain.

    debris   yellow pixel count in the top view, tracking task progress
    motion   mean absolute difference against the previous frame
    luma     mean brightness, which falls when a wrist camera is buried or blocked
"""
import json
import os
from concurrent.futures import ProcessPoolExecutor

import av
import cv2
import numpy as np

import paths

DEBRIS_LO = (18, 90, 90)
DEBRIS_HI = (38, 255, 255)


def scan(job):
    episode, cam = job
    path = os.path.join(paths.SRC, f"episode_{episode:04d}", f"{cam}.mp4")
    debris, motion, luma = [], [], []
    previous = None

    container = av.open(path)
    for frame in container.decode(video=0):
        bgr = frame.to_ndarray(format="bgr24")
        gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY).astype(np.int16)
        if cam == "top":
            hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
            debris.append(int(cv2.inRange(hsv, DEBRIS_LO, DEBRIS_HI).sum() // 255))
        motion.append(0.0 if previous is None else float(np.abs(gray - previous).mean()))
        luma.append(float(gray.mean()))
        previous = gray
    container.close()

    return episode, cam, {"debris": debris, "motion": motion, "luma": luma}


def main():
    episodes = paths.episodes()
    jobs = [(e, c) for e in episodes for c in paths.CAMS]
    out = {f"episode_{e:04d}": {} for e in episodes}

    print(f"scanning {len(jobs)} videos")
    with ProcessPoolExecutor(8) as pool:
        for done, (episode, cam, series) in enumerate(pool.map(scan, jobs), 1):
            record = out[f"episode_{episode:04d}"]
            record[f"{cam}_motion"] = series["motion"]
            record[f"{cam}_luma"] = series["luma"]
            if cam == "top":
                record["debris"] = series["debris"]
            if done % 40 == 0:
                print(f"  {done}/{len(jobs)}")

    with open(paths.artifact("video_features.json"), "w") as f:
        json.dump(out, f)
    print("done")


if __name__ == "__main__":
    main()
