# Full pipeline. Each stage is independent and skips work already done.
.PHONY: all vision transcode ingest metrics align export blueprint clean

all: metrics

vision:
	cd winnow && python vision.py

transcode:
	cd winnow && python transcode.py

ingest: vision transcode
	cd winnow && python ingest.py

metrics: ingest
	cd winnow && python catalog.py

align: ingest
	cd winnow && python align.py

export: ingest
	cd winnow && python export.py

blueprint:
	cd winnow && python blueprint.py

view: blueprint
	rerun data/sweep.rbl data/rrd/episode_0048.rrd

clean:
	/usr/bin/trash data/rrd data/video_h264 2>/dev/null || true
