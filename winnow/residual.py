#!/usr/bin/env python3
"""Residual-debris detector: did any pasta end up somewhere other than the basket?

The task succeeds only when the debris is inside the black mesh basket. So the
failure surface is not "how much yellow is left" -- it is "is there a piece of
pasta at rest, outside the basket, that nobody ever came back for". Two
physically distinct resting surfaces exist, and they need different evidence:

  A) TABLE STRAY -- a piece at rest on the white table (ep32 left behind, ep40
     fallen out of the pan during the carry). Detected by tracking a static
     yellow blob whose surroundings are bright, then demanding *positive proof
     of cleanup*: after the blob was last seen, the same patch must at some
     point be bare bright table for several consecutive frames. Absence of the
     blob is not proof -- an arm parked on top of it also makes it vanish, which
     is exactly what happens in ep40. Requiring the spot be seen clean turns
     end-of-episode occlusion into a detection instead of a miss.

  B) PAN RESIDUE -- a piece at rest on a black surface, i.e. still in the
     dustpan (ep11, never dumped). Only checked over the last ~3 s, when the
     arms are parked: a loaded pan mid-carry is correct behaviour, not a defect.

The basket is located per episode rather than hardcoded: it is the one dark
object that never moves, so it survives a pixelwise median over the episode
while the arms, pan and debris wash out.

Yellow alone does not separate pasta from the wooden brush handle and the
bristles, which sit in the same hue band. Two things do: a fixture mask (a tool
part is yellow from frame 0; debris appears mid-episode) and a per-blob chroma
test on hue and saturation, where semolina and wood are two clearly separated
populations. Every constant below is a measured property of the rig.
"""
import json
import os
import sys
from concurrent.futures import ProcessPoolExecutor

import av
import cv2
import numpy as np

import paths

# --- thresholds, each anchored to a measured quantity of the rig -------------
YELLOW_LO = (18, 55, 45)      # pasta hue measured 25-34; S/V floors low enough for
YELLOW_HI = (45, 255, 255)    # pasta shadowed inside the black pan (S 61-144, V 53-91)
MERGE_K = 3                   # mpeg4 fragments the ~6x8 px pieces; one dilation reunites them
MIN_AREA = 10                 # merged px: one pasta piece is 20-46, codec speckle is 1-4
END_MIN_AREA = 8              # same, in the parked end window where pieces sit in shadow
PASTA_H_MIN = 24              # per-blob median hue: pasta 25-34, wood/bristle 19-21
PASTA_S_MIN = 70              # per-blob median sat: pasta 77-96, wood/bristle 57-59
FIXTURE_FRAC = 0.60           # yellow in >60% of frames = tool part; real strays peaked at 45%
DARK_LUMA = 90                # black plastic measures 12-30, white table 110-140
RING_TABLE = 90               # blob surround this bright => resting on the table
RING_DARK = 45                # blob surround this dark => resting on a black object
BASKET_AREA = (1500, 9000)    # brackets the measured 4300-5000 px dark region 2x either way
BASKET_ASPECT = (0.5, 2.5)    # measured bbox is ~100x85
BASKET_PAD = 8                # codec colour bleed plus the mesh rim
STATIC_TOL = 3                # px; a resting centroid jitters 1-2 px under this codec
GAP_TOL = 10                  # frames a track may be occluded by a passing arm (~0.9 s)
MIN_OBS = 12                  # sightings (~1.1 s at 11 Hz): kills speculars and motion streaks
MIN_SPAN = 25                 # first-to-last frames (~2.3 s): at rest, not paused mid-sweep
CLEAN_LUMA = 90               # patch this bright with zero yellow = bare table
CLEAN_RUN = 5                 # consecutive clean frames (~0.5 s); longer than occlusion flicker
END_WIN = 30                  # final ~2.7 s, arms parked in every observed episode
END_MIN_HITS = 20             # of END_WIN; parked-pan residue is static and near-continuous
# ----------------------------------------------------------------------------


def decode(ep):
    path = os.path.join(paths.SRC, f"episode_{ep:04d}", "top.mp4")
    with av.open(path) as c:
        return np.stack([f.to_ndarray(format="rgb24") for f in c.decode(video=0)])


def find_basket(frames):
    """The largest dark component of the median frame that sits on the table.

    Arm bases hang from the top of the image and are dark too, so anything
    touching the first rows is rejected on geometry; the area and aspect gates
    reject shadows and the dustpan's residual smear.
    """
    idx = np.linspace(0, len(frames) - 1, 31).astype(int)
    med = np.median(frames[idx], axis=0).astype(np.uint8)
    dark = (cv2.cvtColor(med, cv2.COLOR_RGB2GRAY) < DARK_LUMA).astype(np.uint8)
    n, _, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    best = None
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if y <= 2 or not BASKET_AREA[0] <= a <= BASKET_AREA[1]:
            continue
        if not BASKET_ASPECT[0] <= w / h <= BASKET_ASPECT[1]:
            continue
        if best is None or a > best[4]:
            best = (int(x), int(y), int(w), int(h), int(a))
    return best


def in_basket(cx, cy, bb):
    if bb is None:
        return False
    x, y, w, h, _ = bb
    return x - BASKET_PAD <= cx <= x + w + BASKET_PAD and y - BASKET_PAD <= cy <= y + h + BASKET_PAD


def blobs(mask, gray, hsv, min_area):
    """Yellow blobs passing the pasta-vs-wood chroma test, with their ring luma.

    The ring is the annulus between a 7x7 and a 3x3 dilation of the blob: it
    samples what the piece is lying *on* without including the piece itself.
    The chroma medians are taken over the original, undilated yellow pixels.
    """
    k3 = np.ones((MERGE_K, MERGE_K), np.uint8)
    k7 = np.ones((7, 7), np.uint8)
    n, lab, stats, cent = cv2.connectedComponentsWithStats(cv2.dilate(mask, k3), 8)
    out = []
    for i in range(1, n):
        x, y, w, h, a = stats[i]
        if a < min_area:
            continue
        blob = (lab == i).astype(np.uint8)
        core = hsv[(blob > 0) & (mask > 0)]
        if len(core) == 0:
            continue
        if np.median(core[:, 0]) < PASTA_H_MIN or np.median(core[:, 1]) < PASTA_S_MIN:
            continue
        ring = cv2.dilate(blob, k7) - cv2.dilate(blob, k3)
        rl = float(gray[ring > 0].mean()) if ring.any() else 0.0
        out.append({"cx": float(cent[i][0]), "cy": float(cent[i][1]), "area": int(a),
                    "bbox": (int(x), int(y), int(w), int(h)), "ring": rl, "mask": blob})
    return out


def track_table_strays(masks, grays, hsvs, fixture, bb):
    """Greedy static-blob tracks on the bright table, anchored at first sighting."""
    tracks = []
    for t, (m, g, hv) in enumerate(zip(masks, grays, hsvs)):
        for b in blobs(m, g, hv, MIN_AREA):
            if fixture[b["mask"] > 0].mean() > 0.5:
                continue
            if in_basket(b["cx"], b["cy"], bb) or b["ring"] < RING_TABLE:
                continue
            hit = next((tr for tr in tracks
                        if abs(tr["cx"] - b["cx"]) <= STATIC_TOL
                        and abs(tr["cy"] - b["cy"]) <= STATIC_TOL
                        and t - tr["last"] <= GAP_TOL), None)
            if hit is None:
                tracks.append({"cx": b["cx"], "cy": b["cy"], "first": t, "last": t,
                               "obs": 1, "bbox": b["bbox"]})
            else:
                hit["last"] = t
                hit["obs"] += 1
    return tracks


def spot_cleaned(tr, masks, grays, shape):
    """True only if the track's patch is later seen as bare bright table."""
    x, y, w, h = tr["bbox"]
    x0, y0 = max(x - 2, 0), max(y - 2, 0)
    x1, y1 = min(x + w + 2, shape[1]), min(y + h + 2, shape[0])
    run = 0
    for t in range(tr["last"] + 1, len(masks)):
        if grays[t][y0:y1, x0:x1].mean() > CLEAN_LUMA and not masks[t][y0:y1, x0:x1].any():
            run += 1
            if run >= CLEAN_RUN:
                return True
        else:
            run = 0
    return False


def pan_residue_bins(masks, grays, hsvs, fixture, bb):
    """Yellow on a dark surface in the parked final window, binned by position."""
    bins = {}
    for t in range(max(0, len(masks) - END_WIN), len(masks)):
        for b in blobs(masks[t], grays[t], hsvs[t], END_MIN_AREA):
            if fixture[b["mask"] > 0].mean() > 0.5:
                continue
            if in_basket(b["cx"], b["cy"], bb) or b["ring"] > RING_DARK:
                continue
            key = (round(b["cx"] / STATIC_TOL), round(b["cy"] / STATIC_TOL))
            bins.setdefault(key, []).append(b)
    return bins


def run_episode(ep):
    frames = decode(ep)
    T, H, W = frames.shape[:3]
    grays = [cv2.cvtColor(f, cv2.COLOR_RGB2GRAY) for f in frames]
    hsvs = [cv2.cvtColor(f, cv2.COLOR_RGB2HSV) for f in frames]
    masks = [cv2.inRange(hv, YELLOW_LO, YELLOW_HI) for hv in hsvs]

    # a tool part is yellow from frame 0; debris only appears mid-episode
    fixture = np.mean([m > 0 for m in masks], axis=0) > FIXTURE_FRAC
    bb = find_basket(frames)

    # score = how far the strongest piece of evidence exceeds its rest gates,
    # so the decision threshold is 1.0 by construction, not by tuning
    defects, score = [], 0.0
    for tr in track_table_strays(masks, grays, hsvs, fixture, bb):
        if tr["obs"] < 2 or spot_cleaned(tr, masks, grays, (H, W)):
            continue
        s = min(tr["obs"] / MIN_OBS, (tr["last"] - tr["first"]) / MIN_SPAN)
        score = max(score, s)
        if s >= 1.0:
            defects.append({"type": "table_stray", "x": round(tr["cx"], 1), "y": round(tr["cy"], 1),
                            "first": tr["first"], "last": tr["last"], "obs": tr["obs"],
                            "bbox": list(tr["bbox"]), "visible_at_end": tr["last"] >= T - 3})

    for hits in pan_residue_bins(masks, grays, hsvs, fixture, bb).values():
        s = len(hits) / END_MIN_HITS
        score = max(score, s)
        if s >= 1.0:
            defects.append({"type": "pan_residue",
                            "x": round(float(np.mean([b["cx"] for b in hits])), 1),
                            "y": round(float(np.mean([b["cy"] for b in hits])), 1),
                            "bbox": list(hits[-1]["bbox"]), "hits": len(hits), "of": END_WIN})

    return {"episode": ep, "n_frames": T, "basket": None if bb is None else list(bb[:4]),
            "score": round(float(score), 3), "defects": defects, "defective": bool(defects)}


def overlay(ep, res, outdir):
    """Proof frame: basket zone in orange, defect circled in red, plus a 4x zoom."""
    frames = decode(ep)
    d = res["defects"][0] if res["defects"] else None
    t = d["last"] if d and d["type"] == "table_stray" else len(frames) - 1
    img = cv2.cvtColor(frames[t], cv2.COLOR_RGB2BGR).copy()
    if res["basket"]:
        x, y, w, h = res["basket"]
        cv2.rectangle(img, (x - BASKET_PAD, y - BASKET_PAD),
                      (x + w + BASKET_PAD, y + h + BASKET_PAD), (255, 128, 0), 1)
    for dd in res["defects"]:
        cv2.circle(img, (int(dd["x"]), int(dd["y"])), 9, (0, 0, 255), 1)
    cx, cy = (int(d["x"]), int(d["y"])) if d else (img.shape[1] // 2, img.shape[0] // 2)
    crop = img[max(cy - 24, 0):cy + 24, max(cx - 24, 0):cx + 24]
    crop = cv2.resize(crop, (crop.shape[1] * 4, crop.shape[0] * 4), interpolation=cv2.INTER_NEAREST)
    panel = np.zeros((max(img.shape[0], crop.shape[0]), img.shape[1] + crop.shape[1], 3), np.uint8)
    panel[:img.shape[0], :img.shape[1]] = img
    panel[:crop.shape[0], img.shape[1]:] = crop
    label = f"ep{ep} f{t} " + (",".join(x["type"] for x in res["defects"]) or "CLEAN")
    cv2.putText(panel, label, (4, 12), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (0, 255, 255), 1)
    cv2.imwrite(os.path.join(outdir, f"residual_ep{ep:02d}.png"), panel)


KNOWN_BAD = {11: "REQ", 32: "REQ", 40: "REQ",
             14: "bonus", 22: "bonus", 24: "bonus", 27: "bonus", 41: "bonus"}
KNOWN_GOOD = {8, 9, 10, 50, 55, 61, 62}


def main():
    with ProcessPoolExecutor(max_workers=6) as pool:
        results = list(pool.map(run_episode, paths.episodes()))
    out = {f"episode_{r['episode']:04d}": r for r in results}
    with open(paths.artifact("residual.json"), "w") as f:
        json.dump(out, f, indent=1)

    print(f"{'ep':>4} {'score':>6}  {'flag':<5} {'truth':<6} evidence")
    for r in sorted((x for x in results if 7 <= x["episode"] <= 64), key=lambda x: -x["score"]):
        truth = KNOWN_BAD.get(r["episode"], "GOOD" if r["episode"] in KNOWN_GOOD else "")
        det = "; ".join(f"{d['type']}@({d['x']:.0f},{d['y']:.0f})" for d in r["defects"])
        print(f"{r['episode']:>4} {r['score']:>6.2f}  {'FLAG' if r['defective'] else '':<5} "
              f"{truth:<6} {det}")

    dbg = os.path.join(HERE, "debug")
    os.makedirs(dbg, exist_ok=True)
    for ep in (11, 32, 40, 8, 50):
        overlay(ep, out[f"episode_{ep:04d}"], dbg)


if __name__ == "__main__":
    if len(sys.argv) > 1:
        for ep in (int(a) for a in sys.argv[1:]):
            print(json.dumps(run_episode(ep)))
    else:
        main()
