"""Viewer layout for inspecting a single episode.

The top row is what a human would look at unaided. The bottom row is what the
queries found. Both sit on the same timeline, so scrubbing to a spike in the
drift plot lands on the video frame that produced it.
"""
import rerun.blueprint as rrb

import paths

APPLICATION_ID = "sweep"


def cameras():
    return rrb.Horizontal(*[
        rrb.Spatial2DView(origin=f"/video/{cam}", name=cam.replace("_", " "))
        for cam in paths.CAMS
    ])


def timing():
    return rrb.Vertical(
        rrb.TimeSeriesView(
            origin="/timing",
            contents=["/timing/elapsed_true", "/timing/elapsed_naive"],
            name="elapsed seconds: measured against 15 fps assumed",
            plot_legend=rrb.PlotLegend(corner=rrb.Corner2D.LeftTop),
        ),
        rrb.TimeSeriesView(
            origin="/timing",
            contents=["/timing/drift"],
            name="drift, seconds",
        ),
        rrb.TimeSeriesView(
            origin="/timing",
            contents=["/timing/dt_ms"],
            name="inter-frame gap, ms: 66 or 133, never between",
        ),
        name="timing",
    )


def derived():
    return rrb.Vertical(
        rrb.TimeSeriesView(
            origin="/task/debris_remaining",
            name="debris remaining, fraction of initial pile",
        ),
        rrb.TimeSeriesView(
            origin="/tracking_error",
            name="tracking error, abs(action - state)",
            plot_legend=rrb.PlotLegend(corner=rrb.Corner2D.RightTop),
        ),
        name="derived",
    )


def build():
    return rrb.Blueprint(
        rrb.Vertical(cameras(), rrb.Horizontal(timing(), derived()), row_shares=[3, 4]),
        rrb.BlueprintPanel(state="collapsed"),
        rrb.SelectionPanel(state="collapsed"),
        rrb.TimePanel(state="expanded"),
    )


def main():
    path = paths.artifact("sweep.rbl")
    build().save(APPLICATION_ID, path)
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
