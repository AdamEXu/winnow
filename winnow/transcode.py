"""Re-encode the raw camera captures to H.264 with true capture timestamps.

Rerun's AssetVideo rejects MPEG-4 Part 2, which is what the recorder wrote, so
the re-encode is mandatory. Since every frame has to be rewritten anyway, we
take the opportunity to fix the clock: presentation timestamps come from the
recorder's own `t` array instead of an assumed constant rate. The result plays
at the speed the demonstration actually happened.
"""
import os
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction

import av
import numpy as np

import paths

TIME_BASE = Fraction(1, 90_000)
BIT_RATE = 2_000_000


def transcode(job):
    episode, cam = job
    src = os.path.join(paths.SRC, f"episode_{episode:04d}", f"{cam}.mp4")
    dst = os.path.join(paths.VIDEO, f"episode_{episode:04d}", f"{cam}.mp4")
    if os.path.exists(dst) and os.path.getsize(dst):
        return episode, cam, 0

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    elapsed = np.load(os.path.join(paths.SRC, f"episode_{episode:04d}", "data.npz"))["t"]
    elapsed = elapsed - elapsed[0]

    source = av.open(src)
    sink = av.open(dst, "w")
    stream = None
    written = 0

    for i, frame in enumerate(source.decode(video=0)):
        if i >= len(elapsed):
            break
        if stream is None:
            stream = sink.add_stream("h264_videotoolbox", rate=15)
            stream.width, stream.height = frame.width, frame.height
            stream.pix_fmt = "yuv420p"
            stream.time_base = TIME_BASE
            stream.bit_rate = BIT_RATE
        out = frame.reformat(format="yuv420p")
        out.pts = round(elapsed[i] / TIME_BASE)
        out.time_base = TIME_BASE
        for packet in stream.encode(out):
            sink.mux(packet)
        written += 1

    if stream is not None:
        for packet in stream.encode():
            sink.mux(packet)
    sink.close()
    source.close()
    return episode, cam, written


def main():
    jobs = [(e, c) for e in paths.episodes() for c in paths.CAMS]
    print(f"transcoding {len(jobs)} videos into {paths.VIDEO}")
    with ProcessPoolExecutor(8) as pool:
        for done, _ in enumerate(pool.map(transcode, jobs), 1):
            if done % 30 == 0:
                print(f"  {done}/{len(jobs)}")
    print("done")


if __name__ == "__main__":
    main()
