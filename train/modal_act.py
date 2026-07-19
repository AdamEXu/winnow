"""Train a LeRobot ACT policy on the curated bundle, on Modal.

Two steps, both remote, so nothing heavy has to be installed locally:

    modal run train/modal_act.py --step convert              # bundle -> LeRobotDataset
    modal run train/modal_act.py --step train --steps 100    # smoke test, cents
    modal run train/modal_act.py --step train                # ACT, 25k steps

The bundle is uploaded separately and lives on a volume:

    modal volume create winnow
    modal volume put winnow data/train_bundle /bundle

Conversion is kept separate from training on purpose. Building the dataset
re-encodes ~19k frames across three cameras, and if that fails there is no
reason to have been holding a GPU while it did.
"""
import json
import subprocess
from pathlib import Path

import modal

VOLUME = Path("/vol")
DATASET = VOLUME / "lerobot" / "winnow_sweep"

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg", "libgl1", "libglib2.0-0")
    .pip_install("lerobot[training]==0.6.0", "opencv-python-headless", "av")
    .env({"HF_HOME": str(VOLUME / "huggingface")})
)

app = modal.App("winnow-act")
volume = modal.Volume.from_name("winnow", create_if_missing=True)

# can0 then can1, six joints and a gripper each
JOINT_NAMES = [f"{bus}_{joint}"
               for bus in ("can0", "can1")
               for joint in ("j1", "j2", "j3", "j4", "j5", "j6", "gripper")]


@app.function(image=image, cpu=8, memory=32768, timeout=3 * 60 * 60,
              volumes={VOLUME: volume})
def convert(use_videos: bool = True):
    """Bundle of npz plus mp4 into a LeRobotDataset, sampled at the manifest's fps.

    `use_videos=False` stores frames as images instead of re-encoding them into
    video. It costs disk (roughly 1 GB here, against ~200 MB) and buys random
    access that never has to walk forward from a keyframe. Worth switching only
    if the training logs show dataloading_s keeping pace with update_s.
    """
    import cv2
    import numpy as np
    from lerobot.datasets.lerobot_dataset import LeRobotDataset

    bundle = VOLUME / "bundle"
    manifest = json.loads((bundle / "manifest.json").read_text())
    cams = manifest["cameras"]

    probe = cv2.VideoCapture(str(bundle / manifest["episodes"][0] / f"{cams[0]}.mp4"))
    width, height = int(probe.get(3)), int(probe.get(4))
    probe.release()

    features = {f"observation.images.{cam}": {
        "dtype": "video" if use_videos else "image", "shape": (height, width, 3),
        "names": ["height", "width", "channels"]} for cam in cams}
    features["observation.state"] = {
        "dtype": "float32", "shape": (manifest["state_dim"],), "names": JOINT_NAMES}
    features["action"] = {
        "dtype": "float32", "shape": (manifest["state_dim"],), "names": JOINT_NAMES}

    if DATASET.exists():
        import shutil
        shutil.rmtree(DATASET)

    dataset = LeRobotDataset.create(
        repo_id="winnow/sweep", fps=int(manifest["fps"]), features=features,
        robot_type="yam_bimanual", root=str(DATASET), use_videos=use_videos)

    for name in manifest["episodes"]:
        data = np.load(bundle / f"{name}.npz")
        state, action, source = data["state"], data["action"], data["frame_idx"]

        # decode once per camera, keeping only the frames the grid asked for
        frames = {}
        for cam in cams:
            capture = cv2.VideoCapture(str(bundle / name / f"{cam}.mp4"))
            wanted, keep, index = set(source.tolist()), {}, 0
            while True:
                ok, bgr = capture.read()
                if not ok:
                    break
                if index in wanted:
                    keep[index] = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                index += 1
            capture.release()
            frames[cam] = keep

        for i, src in enumerate(source):
            src = int(src)
            if any(src not in frames[cam] for cam in cams):
                break
            dataset.add_frame({
                "task": "sweep the debris into the dustpan and empty it into the basket",
                "observation.state": state[i].astype(np.float32),
                "action": action[i].astype(np.float32),
                **{f"observation.images.{cam}": frames[cam][src] for cam in cams},
            })
        dataset.save_episode()
        print(f"  {name}: {len(source)} frames", flush=True)

    dataset.finalize()
    volume.commit()
    print(f"dataset at {DATASET}")
    return str(DATASET)


# GPU and CPU are overridden per call via .with_options(), because the useful
# question is not which GPU is biggest but whether the dataloader can keep any
# GPU fed. Compare dataloading_s against update_s in the first log lines: if
# they are close, buy cores rather than a bigger card.
@app.function(image=image, gpu="A10", cpu=8, memory=32768, timeout=8 * 60 * 60,
              volumes={VOLUME: volume})
def train(steps: int = 25_000, batch_size: int = 8, num_workers: int = 8,
          run_name: str = "act-sweep"):
    output = VOLUME / "outputs" / run_name
    command = [
        "lerobot-train",
        "--dataset.repo_id=winnow/sweep",
        f"--dataset.root={DATASET}",
        "--policy.type=act",
        "--policy.device=cuda",
        "--policy.use_amp=true",
        "--policy.push_to_hub=false",
        # without this the schedule is sized for the 100k default and the
        # learning rate never decays, which leaves a noisier final policy
        f"--policy.scheduler_decay_steps={steps}",
        f"--output_dir={output}",
        f"--job_name={run_name}",
        f"--steps={steps}",
        f"--batch_size={batch_size}",
        f"--num_workers={num_workers}",
        f"--save_freq={max(steps // 6, 1000)}",
        "--log_freq=100",
        "--env_eval_freq=0",
        "--wandb.enable=false",
    ]
    print(" ".join(command), flush=True)
    subprocess.run(command, check=True)
    volume.commit()
    return str(output)


@app.local_entrypoint()
def main(step: str = "convert", steps: int = 25_000, batch_size: int = 8,
         gpu: str = "A10", cpu: int = 8, num_workers: int = 0,
         images: bool = False, run_name: str = "act-sweep"):
    """--step convert | train, with the hardware chosen at call time."""
    if step == "convert":
        print(convert.remote(use_videos=not images))
        return
    if step != "train":
        raise SystemExit("--step must be convert or train")

    workers = num_workers or cpu
    sized = train.with_options(gpu=gpu, cpu=cpu, memory=max(32768, cpu * 4096))
    print(f"{gpu}, {cpu} cores, {workers} workers, {steps} steps, batch {batch_size}")
    print(sized.remote(steps=steps, batch_size=batch_size,
                       num_workers=workers, run_name=run_name))
