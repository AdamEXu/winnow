# Each stage is independent and skips work that already exists.
# Point WINNOW_SRC at the directory holding the episode_XXXX folders.

PY := uv run --quiet python
export PYTHONPATH := winnow

.PHONY: all vision transcode ingest metrics align export detect webdata querylog \
        blueprint view view-one view-flagged episodes ui clean

all: metrics detect

vision:
	$(PY) winnow/vision.py

transcode:
	$(PY) winnow/transcode.py

ingest: vision transcode
	$(PY) winnow/ingest.py

metrics: ingest
	$(PY) winnow/catalog.py

align: ingest
	$(PY) winnow/align.py

export: ingest
	$(PY) winnow/export.py

detect:
	$(PY) winnow/features.py
	$(PY) winnow/detect.py

webdata: detect
	$(PY) winnow/webdata.py

# Runs every query in the pipeline, times it, and captures its real output
# for the dashboard's method section.
querylog: ingest detect
	$(PY) winnow/querylog.py

blueprint:
	$(PY) winnow/blueprint.py

# Loads every recording at once; switch between them in the viewer's Sources
# panel. Use view-one for a single episode, which starts much faster.
view: blueprint
	uv run --quiet rerun data/sweep.rbl data/rrd/*.rrd

# make view-one EP=32
EP ?= 50
view-one: blueprint
	uv run --quiet rerun data/sweep.rbl \
	  data/rrd/episode_$(shell printf '%04d' $(EP)).rrd

# The episodes the detector panel rejected, for showing what it caught.
view-flagged: blueprint
	uv run --quiet rerun data/sweep.rbl $$($(PY) -c \
	  "import json,paths,os; d=json.load(open(paths.artifact('detections.json'))); \
	   print(' '.join(os.path.join(paths.RRD, k + '.rrd') for k,v in sorted(d.items()) if v))")

episodes:
	@$(PY) -c "import json,paths; d=json.load(open(paths.artifact('detections.json'))); \
	  [print(f\"{k.replace('episode_','ep'):>6}  {'FLAGGED' if v else 'clean':<8}\" \
	  + '; '.join(x['detector'] for x in v)) for k,v in sorted(d.items())]"

ui:
	cd ui && npm install && npm run dev

clean:
	/usr/bin/trash data/rrd data/video_h264 2>/dev/null || true
