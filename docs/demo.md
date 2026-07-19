# Demo script

Three minutes. Two findings. One of them has a witness.

Everything below is true and checkable. Do not oversell it; the numbers are
strong enough on their own, and the audience is the team that wrote the API.

## The one sentence

If you only get to say one thing:

> You handed us 65 episodes. The metadata was lying about the frame rate, and
> one episode your own reviewer passed was frozen solid for 1.2 seconds. We
> found both with queries.

## Before you start

- Dashboard running at `localhost:5173`
- Rerun viewer open on episode 48, timeline set to `true_time`
- Terminal in the repo root, ready to run `winnow/export.py`
- Check `ffmpeg -version` returns. The viewer shells out to it for H.264; if it
  is broken the camera panes render as grey placeholders.

## Beat 1, the setup (20 seconds)

> Fifty-eight bimanual episodes. Two arms, a brush and a dustpan, sweeping pasta
> into a basket. Twenty-eight thousand frames.
>
> The only question that matters before you train anything is which of these you
> should train on. The cameras are 424 by 240 at eleven hertz. You are not going
> to answer that by watching them.

Land the point that the raw material is genuinely hard to judge by eye. It sets
up everything that follows.

## Beat 2, the clock is wrong (60 seconds)

Dashboard, top section.

> Every `meta.json` in this corpus declares fifteen frames per second. The
> recorder's own timestamps say eleven point one two.

Point at the histogram.

> This is the distribution of gaps between frames. Two spikes, one at 66
> milliseconds and one at 133, and almost nothing in between. That shape is not
> jitter. Jitter is a smear. That is a third of frames arriving a full period
> late, which is what dropped ticks look like.
>
> Across the corpus it is forty-two minutes of real time against thirty-one
> minutes of video. Almost eleven minutes of drift.

Then the consequence, which is the part that matters to a roboticist:

> A run loop replays action chunks at whatever rate the dataset metadata
> declares. Train on this, deploy at fifteen hertz, and every motion executes
> one point three five times faster than it was demonstrated. On a contact task
> like sweeping that is the difference between brushing debris and scattering
> it.
>
> None of that is visible in the video. It is immediately visible in the index.

If you have a spare ten seconds, switch the Rerun timeline from `true_time` to
`naive_time` and back. Same data, different clock, everything moves.

## Beat 3, nine defective episodes (45 seconds)

Dashboard, episode section.

> Four detectors, each answering one physical question, each explaining itself
> in a sentence you can check against the footage.

Open episode 11.

> This one says: a piece was still sitting in the dustpan at coordinates 258, 51
> for thirty of the last thirty frames, never dumped.

That specificity is the product. A quality score tells you nothing; that
sentence tells you where to look.

Worth adding, because it is the honest part:

> The strongest-looking detector we built is not in this panel. It counted
> gripper cycles and caught five of eight. It was also measuring nothing:
> sweeping its threshold changed the count for every episode in the corpus,
> including the good ones. We deleted it rather than tune it.

## Beat 4, the punchline (30 seconds)

Dashboard, adjudication section.

> The panel disagreed with the hand labels three times. A human went back to the
> footage for each one.
>
> Episode 22 was labelled bad. The panel stayed quiet. The footage is clean, so
> the label was wrong.
>
> Episodes 21 and 48 were labelled good. The panel flagged both. Twenty-one
> really does leave a piece on the table. Forty-eight freezes for 1,211
> milliseconds.
>
> Three disagreements, three times the measurement was right.

Do not claim an accuracy number. Three adjudications is a small sample and
someone will ask.

## Beat 5, the dataset is a query (25 seconds)

Query builder, then the terminal.

> Curation is a predicate. Drag a threshold and episodes leave the training set.

Run it live:

```
uv run python winnow/export.py --where "pct_dropped < 40 AND debris_end < 0.3"
```

> The clause goes into the manifest beside the episode list, so which episodes
> version one trained on has an exact answer instead of a folder somebody copied
> by hand. The survivors come back out resampled to a uniform ten hertz, so the
> fps written next to them is finally true.

## If they ask

**How robust is the debris detector?**
Geometry and timing gates are stable. The colour gates that separate pasta from
the wooden brush handle are not; a 25% perturbation changes the verdict. They
are calibrated to this rig and would need recalibration for different debris. It
is in `docs/detection.md`, including the sweep.

**Did you fit the thresholds to the label list?**
An adversarial pass specifically audited for that and found no constant
explainable only by making the target episodes fire. The score gap is wide:
lowest flagged 1.40, highest unflagged 0.55, every known-good at or below 0.10.
Any cut in [0.6, 1.4] gives the same partition.

**Why not just watch the videos?**
Someone did. They missed 21 and 48 and wrongly failed 22.

**What is the API surface?**
`rr.server.Server` for a local catalog, `dataset.reader()` into DataFusion for
SQL across all segments, `using_index_values` for resampling,
`filter_segments()` fed by a query result, `send_columns` to write derived
signals back. Note `rr.dataframe` is gone as of 0.32 and 0.34.

## What not to do

- Do not walk the architecture. Nobody is scoring the file layout.
- Do not apologise for the 424x240 video. It is the point: too poor to judge by
  eye, which is why the queries matter.
- Do not claim the detectors generalise beyond this rig. They do not, and saying
  so costs more than admitting it.
