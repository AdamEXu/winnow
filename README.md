# winnow

Query-driven triage and curation for robot demonstration data, built on the
[Rerun](https://rerun.io) Query API.

Fifty-eight bimanual teleoperation episodes: two arms, a brush and a dustpan,
sweeping pasta debris on a table and dumping it into a basket. Three cameras,
14 degrees of freedom, 28,219 frames, 42 minutes of wall clock.

The question that motivates all of it is the boring one that decides whether a
policy works: **which of these episodes should you actually train on?**

The videos are 424x240 at about 11 Hz. You cannot answer that by scrubbing
through them. So the corpus goes into a Rerun catalog and the answer is a query.

## The corpus is mis-timed, and a query is how you find out

`meta.json` declares `"fps": 15` for every episode. The recorder's own
timestamps disagree:

| | claimed | measured |
| --- | --- | --- |
| frame rate | 15 Hz | **11.12 Hz** |
| inter-frame gaps that are double length | 0% | **34.7%** |
| duration of the corpus | 31.4 min | **42.2 min** |

Every third frame arrives a full period late. The gap distribution is bimodal at
66 ms and 133 ms with essentially nothing in between, which is the signature of
dropped ticks rather than jitter. The likely cause is bandwidth: three RealSense
cameras on USB 2.0 cannot sustain 15 fps, and the recorder wrote the rate it
asked for instead of the rate it got.

This matters downstream. A run loop replays action chunks at whatever rate the
dataset metadata declares, so a policy trained on this corpus and deployed at
15 Hz executes every motion **1.35x faster than it was demonstrated**. On a
contact-rich task like sweeping, that is the difference between brushing debris
and scattering it.

Nothing about that is visible in the video. It is visible immediately in the
index.

## What the pipeline does

Each episode becomes one `.rrd`, which the catalog treats as one segment, so a
single query addresses the whole corpus. Every episode carries four indexes:

| index | kind | what it is |
| --- | --- | --- |
| `frame_idx` | sequence | raw sample number |
| `true_time` | duration | elapsed seconds from the recorder's clock |
| `naive_time` | duration | `frame_idx / 15`, what `meta.json` claims |
| `log_time` | timestamp | absolute wall clock |

Logging both `true_time` and `naive_time` makes the defect a first-class,
queryable quantity rather than a footnote. Scrubbing between the two timelines
in the viewer shows them drift apart in real time.

### Reduce the corpus in SQL

`dataset.reader()` returns a DataFusion frame, so cross-episode analysis is
ordinary SQL over every segment at once. Fifty-eight episodes and 28,219 frames
reduce to one row each in **under two seconds**:

```sql
SELECT rerun_segment_id AS episode,
       count(*)                          AS n_frames,
       round(count(*) / max(elapsed), 2) AS true_hz,
       round(100.0 * avg(dropped), 1)    AS pct_dropped
FROM frames
GROUP BY episode
```

### Put it on an honest clock

`reader(using_index_values=...)` asks for the state of the world at times *you*
choose and lets latest-at fill the rest, which turns an irregular capture into a
uniform one:

```
before  dt 66.7-133.7 ms, sd 31.7 ms, 11.13 Hz actual against 15 fps claimed
after   dt 100.0-100.0 ms, sd  0.0 ms
```

### Let a predicate define the dataset

```
python winnow/export.py --where "pct_dropped < 40 AND debris_end < 0.3" --out curated_v1
```

The predicate is written into `manifest.json` next to the resulting episode
list, so "which episodes did v1 train on" has an exact answer instead of a
folder somebody copied by hand. Change the clause, get a different dataset,
diff the manifests.

## Detecting bad demonstrations

Human quality labels are one bit per episode and do not say *why*. The pipeline
derives signals that do. Every feature is a plain physical quantity: tracking
error, inter-frame gaps, frozen frames, debris remaining. None are tuned against
the labels; the labels are only used afterwards, to score the detectors.

The detector that mattered most reads the end state of the task. Sweeping
succeeds only when the debris is inside the basket, so the failure to look for
is a piece left at rest somewhere else: on the table, or still in the dustpan.
Three episodes fail exactly that way and are invisible to every aggregate signal,
because one piece of pasta is a rounding error against the initial pile.

The panel flags nine episodes and all nine were confirmed defective on review,
including two the hand labels had passed. A tenth disagreement went the other
way: ep 22 is labelled bad but looks clean on review.

A detector was also deleted for measuring its own threshold rather than the
robot. Both stories, and the limitations of what survives, are in
[`docs/detection.md`](docs/detection.md).

## Running it

```
export WINNOW_SRC=/path/to/episode_folders
uv sync
make               # vision -> transcode -> ingest -> metrics -> detect
make view          # every recording at once; switch in the Sources panel
make view-one EP=32   # a single episode, much faster to start
make view-flagged  # only the episodes the panel rejected
make episodes      # list every episode and what fired on it
make ui            # the triage dashboard
```

`transcode.py` is not optional: Rerun's `AssetVideo` rejects MPEG-4 Part 2,
which is what the recorder wrote. The re-encode also rewrites presentation
timestamps from the recorder's clock, so the video plays at the speed the
demonstration actually happened.

Note the pinned `datafusion~=53.0`. Version 54 is rejected outright by
rerun-sdk 0.34.

## Layout

| file | what it does |
| --- | --- |
| `paths.py` | source and artifact locations, robot joint layout |
| `transcode.py` | MPEG-4 to H.264, timestamps from the recorder's clock |
| `vision.py` | debris, motion and luma read off the camera streams |
| `ingest.py` | one `.rrd` per episode, four indexes each |
| `catalog.py` | serves the corpus, reduces it to a row per episode in SQL |
| `align.py` | resamples onto a uniform grid via `using_index_values` |
| `features.py` | one physical feature vector per episode |
| `detect.py` | the detector panel, scored against the human labels |
| `residual.py` | debris left outside the basket, per episode |
| `bundle.py` | the curated training set, on a uniform clock |
| `export.py` | a `WHERE` clause becomes a curated training set |
| `blueprint.py` | viewer layout pairing cameras with derived signals |

## Query API notes

Built against `rerun-sdk` 0.34.1, where the Query API is `rr.catalog` and
`rr.server`. Things that cost time and are not obvious from the docs:

- `rr.dataframe` no longer exists. `load_recording()`, `.view()`, `.select()`
  and the `filter_*` methods were removed across 0.32 and 0.34.
- `rr.server.Server(datasets={...})` runs a catalog locally. No account, no
  cloud, and it accepts a plain list of `.rrd` paths.
- Every scalar column comes back as a one-element list, so `Scalars:scalars`
  needs a `[1]` subscript in SQL or `.explode()` in pandas.
- `filter_contents()` changes which *rows* exist, unlike a `select()` which only
  prunes columns. Filtering two entities then selecting one yields rows at the
  other entity's timestamps, filled with nulls.
- `get_index_ranges()` returns pandas `Timedelta` objects for duration indexes,
  not integers.
