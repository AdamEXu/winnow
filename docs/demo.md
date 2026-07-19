# Demo notes

A supporting beat inside the team's demo, not a talk of its own. The robot is
the show. Budget: ten seconds, one screen.

## The ten seconds

Screen: episode 11, its filmstrip and the sentence underneath it.

> It grades every episode automatically. It caught nine bad takes, and two of
> them a human reviewer had already passed. This one left a single piece of
> pasta in the dustpan.

Stop. Point at the piece. It is about twenty pixels, in one of twenty-eight
thousand frames.

Nobody needs to hear the word query, or catalog, or fps. What lands is that the
machine found something a person looked straight at and missed, and that it can
say precisely where.

## If you get a follow-up, one line

- **How did it know?** Debris in the basket is success; debris anywhere else is
  a failure. It tracks pieces that come to rest in the wrong place.
- **What else?** One episode freezes for 1.2 seconds mid-demonstration. Also on
  the human's good list.
- **So what?** Those takes are out of the training set. The clean ones get
  resampled onto a true clock first.

Then hand back to the robot.

## At the table afterwards

Where the sponsor prize actually gets decided. Have the dashboard and the Rerun
viewer open. Lead with the same thing, then follow where they steer.

**The detections are specific enough to check.** Not a quality score, a
sentence: "a piece was still sitting in the dustpan at (258, 51) for thirty of
the last thirty frames, never dumped." Open the video and look at 258, 51. It is
there. That specificity is the product.

**Three cases where the panel and the human disagreed, and the panel won all
three.** Ep 22 labelled bad, panel silent, footage clean, so the label was
wrong. Eps 21 and 48 labelled good, panel flagged both, both confirmed
defective on review.

**The hard part was that these are invisible to any aggregate.** One piece of
pasta against the initial pile is a rounding error, so no sum over the frame
sees it. Three episodes failed exactly that way and each needed different
evidence: a piece left on the table, a piece spilled during the carry, a piece
never dumped from the pan. The discriminator is what the piece is resting on,
since the table is white and the pan is black. And absence is not proof of
cleanup, because an arm parked over a piece also makes it vanish, which is
precisely what happens in ep 40.

**The detector we deleted.** A gripper-cycle counter caught five of eight and
looked like the best signal in the panel. Sweeping its threshold from 30% to 70%
changed the count for every episode in the corpus, good ones included. It was
measuring where the threshold sat, not what the robot did. Deleted rather than
tuned.

**The dataset is a query.** `export.py --where "..."` writes the predicate into
the manifest beside the episode list, so which episodes a run trained on has an
exact answer.

**The clock, if they are an infrastructure person.** `meta.json` says 15 fps,
measured rate is 11.12 Hz, a third of frames arrive a full period late.
`using_index_values` resamples onto a uniform grid and 31.7 ms of jitter goes to
zero. This matters for training and it is genuinely wrong in the source data,
but it is a plumbing finding. Do not lead with it.

## Questions with sharp edges

**Did you fit the thresholds to the label list?**
An adversarial pass audited exactly that and found no constant explainable only
by making the target episodes fire. Score gap is wide: lowest flagged 1.40,
highest unflagged 0.55, every known-good at or below 0.10. Any cut in [0.6, 1.4]
gives the same partition.

**How robust is it?**
Geometry and timing gates are stable. The colour gates separating pasta from the
wooden brush handle are not; a 25% perturbation flips the verdict. Rig-specific
and would need recalibration for different debris. Sweep is in
`docs/detection.md`.

**Which API surface?**
`rr.server.Server` for a local catalog, `dataset.reader()` into DataFusion for
SQL across all segments, `using_index_values` for resampling, `filter_segments()`
fed by a query result, `send_columns` to write derived signals back.
`rr.dataframe` is gone as of 0.32 and 0.34.

**Why not just watch the videos?**
Someone did. They missed 21 and 48, and wrongly failed 22.

## Do not

- Take more than ten seconds in the main demo.
- Lead with the frame rate. It is a plumbing detail.
- Walk the architecture. Nobody is scoring the file layout.
- Claim the detectors generalise beyond this rig.
- Quote an accuracy figure. Three adjudications is a small sample.
