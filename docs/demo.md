# Demo notes

This is a supporting slot inside the team's demo, not a talk of its own. The
robot is the show. Budget: ten seconds, one screen, one number.

## The ten seconds

Screen: the dashboard's top section. Say:

> The dataset claims fifteen fps. The timestamps say eleven. One query across
> all fifty-eight episodes found it, so we retimed the data before training.

Stop there. Do not explain the histogram, do not mention detectors, do not name
the API. If nobody asks a follow-up, that was still a win: it lands the finding
and it lands that a query produced it.

Point at the two diverging lines, or the claimed-vs-measured pair. One gesture.

## If you get a follow-up, add one line

Pick whichever fits the question:

- **Why does that matter?** Deployed at fifteen hertz, every motion runs one
  point three five times too fast. On a contact task that is brushing versus
  scattering.
- **What else did it find?** Nine bad episodes. One of them our own reviewer had
  passed; it freezes for one point two seconds.
- **How?** Rerun's catalog API. Fifty-eight recordings as one dataset, reduced
  in SQL.

One line, then hand back to the robot.

## If a judge comes to your table afterwards

This is where the real conversation happens, and where the Rerun sponsor prize
is actually decided. Have the dashboard and the Rerun viewer both open.

Lead with the same finding, then go where they steer. Material worth having
ready:

**The clock defect.** `meta.json` declares 15 fps for every episode; measured
rate is 11.12 Hz. The gap histogram is bimodal at 66 and 133 ms with an empty
valley between, which is dropped ticks rather than jitter. Across the corpus,
42.2 minutes of wall clock against 31.4 minutes of video. `using_index_values`
resamples onto a uniform grid: 31.7 ms of jitter goes to zero.

**Episode 48.** Flagged by `capture_stall` at 1,211 ms. It was on the
hand-labelled good list. Confirmed unusable once we pointed at the timestamp.

**The detector we deleted.** A gripper-cycle counter caught five of eight
labelled-bad episodes and looked like the best signal in the panel. Sweeping its
threshold from 30% to 70% changed the count for every episode in the corpus,
good ones included. It was measuring where the threshold sat. Deleted rather
than tuned.

**Three adjudications, three for three.** Ep 22 labelled bad, panel silent,
footage clean, label wrong. Eps 21 and 48 labelled good, panel flagged both,
both confirmed defective.

**The dataset is a query.** `export.py --where "..."` writes the predicate into
the manifest beside the episode list, and the survivors come back on a uniform
clock.

## Questions with sharp edges

**Did you fit the thresholds to the label list?**
An adversarial pass audited exactly that and found no constant explainable only
by making the target episodes fire. Score gap is wide: lowest flagged 1.40,
highest unflagged 0.55, every known-good at or below 0.10. Any cut in [0.6, 1.4]
gives the same partition.

**How robust is the debris detector?**
Geometry and timing gates are stable. The colour gates separating pasta from the
wooden brush handle are not; a 25% perturbation flips the verdict. Rig-specific,
would need recalibration for different debris. The sweep is in
`docs/detection.md`.

**Which API surface?**
`rr.server.Server` for a local catalog, `dataset.reader()` into DataFusion for
SQL across segments, `using_index_values` for resampling, `filter_segments()`
fed by a query result, `send_columns` to write derived signals back. `rr.dataframe`
is gone as of 0.32 and 0.34.

**Why not just watch the videos?**
Someone did. They missed 21 and 48, and wrongly failed 22.

## Do not

- Take more than ten seconds in the main demo.
- Walk the architecture. Nobody is scoring the file layout.
- Claim the detectors generalise beyond this rig.
- Quote an accuracy figure. Three adjudications is a small sample and someone
  will say so.
