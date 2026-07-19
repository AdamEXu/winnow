"""Where the raw episodes live, and where derived artifacts go.

Override either with an environment variable:

    WINNOW_SRC   directory of episode_XXXX/ folders (mp4 + data.npz + meta.json)
    WINNOW_DATA  directory for everything this pipeline generates
"""
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SRC = os.environ.get("WINNOW_SRC", os.path.expanduser("~/Developer/mission_robot_stuff"))
DATA = os.environ.get("WINNOW_DATA", os.path.join(ROOT, "data"))

RRD = os.path.join(DATA, "rrd")
VIDEO = os.path.join(DATA, "video_h264")
CAMS = ["top", "wrist_1", "wrist_2"]

# state/action layout: can0 then can1, each 6 joints + a gripper
ARMS = {"left": 0, "right": 7}
JOINTS = ["j1", "j2", "j3", "j4", "j5", "j6", "gripper"]

# the recorder stamped this on every episode; the timestamps disagree
NOMINAL_FPS = 15.0


def episodes():
    import glob
    return sorted(int(p.split("_")[-1]) for p in glob.glob(os.path.join(SRC, "episode_*")))


def artifact(name):
    os.makedirs(DATA, exist_ok=True)
    return os.path.join(DATA, name)
