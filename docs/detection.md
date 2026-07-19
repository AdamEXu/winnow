# Detecting bad demonstrations

A teammate watched all 65 episodes and produced a list of which ones were good.
That list is one bit per episode and does not say why. This document is about
deriving signals that do say why, and about being honest regarding how far they
go.

Episodes 0-6 are excluded throughout. They are an early batch recorded with the
wrong action and speed settings, so they are a known-bad *batch* rather than
seven defects to rediscover. That leaves 58 episodes, of which the teammate
flagged eight: 11, 14, 22, 24, 27, 32, 40 and 41.

## The panel

| detector | fires | labelled bad | others |
| --- | --- | --- | --- |
| `incomplete_sequence` | 10 | 5 | 5 |
| `debris_outside_basket` | 7 | 6 | 1 |
| `task_not_completed` | 1 | 1 | 0 |
| `truncated` | 1 | 1 | 0 |
| `capture_stall` | 1 | 0 | 1 |

Union: **8 of 8** labelled-bad episodes caught, plus seven episodes the human
passed.

### `incomplete_sequence`

The strongest signal is structural rather than statistical. A complete
demonstration cycles the right gripper exactly eight times; the count is the
modal value across the corpus, not a fitted threshold. Episodes that cycle it
four or six times are missing a phase of the task.

### `debris_outside_basket`

The task succeeds only when the debris ends up inside the basket, so the failure
surface is not "how much yellow remains" but "is there a piece at rest, outside
the basket, that nobody came back for". Three of the eight labelled-bad episodes
were invisible to every aggregate signal because a single pasta piece is a
rounding error against the initial pile:

- **ep 11** left a piece sitting in the dustpan, never dumped
- **ep 32** left a piece behind on the table
- **ep 40** spilled a piece out during the carry

Two resting surfaces need different evidence. A piece on the white table is
found by tracking a static yellow blob with bright surroundings, then requiring
positive proof of cleanup: after the blob was last seen, that patch must appear
bare and bright for several consecutive frames. Absence is not proof, because an
arm parked on top of the piece also makes it vanish, which is exactly what
happens in ep 40. A piece in the pan is checked only over the final few seconds,
when the arms are parked, since a loaded pan mid-carry is correct behaviour.

The basket is located per episode as the one dark object that survives a
pixelwise median, rather than by a hardcoded screen region. The dustpan drifts
through the same corner during the dump, so a fixed zone does not work.

## Where the panel and the human disagree

Seven episodes were flagged that the teammate passed. Two are confirmed real:

- **ep 48** has a 1,211 ms capture stall. It was on the good list. Shown the
  timestamp, the teammate confirmed the episode is unusable.
- **ep 21** was inspected frame by frame during review and does contain a real
  piece of debris left in the wrong place.

The remaining five (16, 31, 33, 53, 63) cycle the gripper four or six times
instead of eight. Whether that makes them unusable is a judgement call, which is
why the dashboard presents agreement as a two-way comparison rather than an
accuracy score. The labels are one person's reading of 424x240 video; the
detectors are measurements. Where they disagree, both deserve to be shown.

## Honest limitations

An adversarial review pass ran three lenses over the stray-debris detector:
overfitting, false positives, and robustness. Two passed. **The robustness lens
failed and the failure is worth stating plainly.**

Perturbing each threshold by 25% one at a time, 4 of 17 constants change the
verdict:

- `PASTA_H_MIN` 24 to 30 loses ep 11 and ep 40
- `PASTA_H_MIN` 24 to 18 adds eleven uncatalogued episodes
- `PASTA_S_MIN` 70 to 88 collapses to two flags
- `PASTA_S_MIN` 70 to 52 starts flagging known-good episodes

These are the per-blob chroma gates that separate pasta from the wooden brush
handle and the bristles, which occupy a neighbouring hue band. They are
calibrated to this rig: this pasta, this lighting, these cameras. They are not
fitted to the episode list, and the overfitting audit confirmed that no constant
is explainable only by "it makes 11, 32 and 40 fire". But they would need
recalibration for different debris, and a detector whose colour gates are that
sensitive should not be described as robust.

The geometric and temporal gates are much steadier. The score separates widely
at the chosen cut: the lowest flagged episode scores 1.40, the highest unflagged
scores 0.55, and every known-good episode scores at or below 0.10. Any threshold
in [0.6, 1.4] produces the identical partition, so the cut value itself is not
load-bearing.

One further caveat on the framing: describing the threshold as "1.0 by
construction" is circular, since normalising by the three rest gates relocates
the free parameters into those gates rather than eliminating them. The accurate
statement is three thresholds expressed as a normalised score, vindicated by a
sweep rather than by construction.
