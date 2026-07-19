# Each stage is independent and skips work that already exists.
# Point WINNOW_SRC at the directory holding the episode_XXXX folders.

PY := uv run --quiet python
export PYTHONPATH := winnow

.PHONY: all vision transcode ingest metrics align export detect webdata blueprint view ui clean

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

blueprint:
	$(PY) winnow/blueprint.py

# Opens the episode with the 1.2 second capture stall.
view: blueprint
	uv run --quiet rerun data/sweep.rbl data/rrd/episode_0048.rrd

ui:
	cd ui && npm install && npm run dev

clean:
	/usr/bin/trash data/rrd data/video_h264 2>/dev/null || true
