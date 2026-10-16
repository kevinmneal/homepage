#!/usr/bin/env python3
"""Render a coarse SVG from saved model predictions, without fitting a model.

Requires numpy, pyproj, shapely, affine and rasterio in the research environment.
Usage: python scripts/build-sdm-thumbnail.py /path/to/spea-climate-biogeography
The source archive is not distributed with the homepage; hashes identify it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from affine import Affine
from pyproj import Transformer
from rasterio.features import shapes
from shapely.geometry import box, shape
from shapely.ops import transform

DISPLAY_CRS = "+proj=aea +lat_1=20 +lat_2=50 +lat_0=35 +lon_0=-105 +datum=WGS84 +units=m +no_defs"
COLORS = ["#251433", "#4c1d4b", "#751f58", "#a11a5b", "#cb1b4f", "#e83f3f", "#f3714d", "#f69c73", "#f7c6a6"]
# Rocket samples are embedded; rendering needs no Seaborn dependency.
PALETTE = {'name': 'rocket',
 'library': 'Seaborn',
 'version': '0.13.2',
 'source_url': 'https://raw.githubusercontent.com/mwaskom/seaborn/v0.13.2/seaborn/cm.py',
 'source_sha256': 'f209b5441c841725b417bb24af50edfd428fdb9bab142b01f72418db9f0cb4c0',
 'lookup_table_indices': [25, 51, 76, 102, 128, 153, 179, 204, 230],
 'sampling': 'Nine evenly spaced samples at 0.1 through 0.9 from the 256-entry Rocket lookup table, rounded '
             'to 8-bit RGB.',
 'license': 'BSD-3-Clause',
 'license_notice': 'Copyright (c) 2012-2023, Michael L. Waskom\n'
                   'All rights reserved.\n'
                   '\n'
                   'Redistribution and use in source and binary forms, with or without\n'
                   'modification, are permitted provided that the following conditions are met:\n'
                   '\n'
                   '* Redistributions of source code must retain the above copyright notice, this\n'
                   '  list of conditions and the following disclaimer.\n'
                   '\n'
                   '* Redistributions in binary form must reproduce the above copyright notice,\n'
                   '  this list of conditions and the following disclaimer in the documentation\n'
                   '  and/or other materials provided with the distribution.\n'
                   '\n'
                   '* Neither the name of the project nor the names of its\n'
                   '  contributors may be used to endorse or promote products derived from\n'
                   '  this software without specific prior written permission.\n'
                   '\n'
                   'THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"\n'
                   'AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE\n'
                   'IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE\n'
                   'DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE\n'
                   'FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL\n'
                   'DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR\n'
                   'SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER\n'
                   'CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,\n'
                   'OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE\n'
                   'OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.'}
RUN = "runs/2026-10-01-five-species-expanded-models-v2"
TILE_M = 25000


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_archive", type=Path)
    args = parser.parse_args()
    root = args.source_archive
    repo = Path(__file__).resolve().parents[1]
    source = root / RUN
    prediction = source / "projection/intermontana_full.npz"
    registry = source / "feature_registry.json"
    receipt = json.loads((source / "run.json").read_text())
    assert receipt["status"] == "completed"
    for path in (prediction, registry):
        assert sha256(path) == receipt["output_hashes"][str(path.relative_to(source))]

    grid = json.loads(registry.read_text())["window_grid"]
    with np.load(prediction) as saved:
        ids = saved["native_flat"]
        log_density = saved["log_relative_density"]
        area = saved["area_m2"]
    assert np.isfinite(log_density).all() and (area > 0).all()
    density = np.exp(log_density)
    native_mean = float(np.dot(density, area) / area.sum())
    assert abs(native_mean - 1) < 1e-9

    row, col = np.divmod(ids, grid["shape"][1])
    source_transform = Affine(*grid["transform"][:6])
    lon, lat = source_transform * (col + .5, row + .5)
    projector = Transformer.from_crs(grid["crs"], DISPLAY_CRS, always_xy=True)
    x, y = projector.transform(lon, lat)
    tile_x = np.floor(x / TILE_M).astype(int)
    tile_y = np.floor(y / TILE_M).astype(int)
    xmin, xmax = int(tile_x.min()), int(tile_x.max())
    ymin, ymax = int(tile_y.min()), int(tile_y.max())
    width, height = xmax - xmin + 1, ymax - ymin + 1
    tile_ids = (ymax - tile_y) * width + (tile_x - xmin)
    weights = np.bincount(tile_ids, weights=area, minlength=height * width)
    masses = np.bincount(tile_ids, weights=area * density, minlength=height * width)
    valid = weights > 0
    displayed = np.full(height * width, np.nan)
    displayed[valid] = masses[valid] / weights[valid]
    coarse_mean = float(np.dot(displayed[valid], weights[valid]) / weights.sum())
    assert abs(native_mean - coarse_mean) < 1e-12

    # Fixed logarithmic display scale matches the original map's -3..3 limits.
    bins = np.full(height * width, -1, dtype="int16")
    bins[valid] = np.minimum(8, np.maximum(0, np.floor((np.log(displayed[valid]) + 3) * 1.5))).astype("int16")
    bins = bins.reshape(height, width)
    raster_transform = Affine(TILE_M, 0, xmin * TILE_M, 0, -TILE_M, (ymax + 1) * TILE_M)
    pad = 100000
    extent = box(xmin * TILE_M - pad, ymin * TILE_M - pad, (xmax + 1) * TILE_M + pad, (ymax + 1) * TILE_M + pad)
    west, south, east, north = extent.bounds
    vw, vh, margin = 220, 220, 6
    scale = min((vw - 2 * margin) / (east - west), (vh - 2 * margin) / (north - south))
    dx = (vw - scale * (east - west)) / 2
    dy = (vh - scale * (north - south)) / 2

    def line_path(coords, close=False):
        pts = [(dx + (p[0] - west) * scale, dy + (north - p[1]) * scale) for p in coords]
        return "M" + "L".join(f"{a:.2f},{b:.2f}" for a, b in pts) + ("Z" if close else "")

    def geom_path(geom):
        if geom.is_empty:
            return ""
        if geom.geom_type == "Polygon":
            return line_path(geom.exterior.coords, True) + "".join(line_path(r.coords, True) for r in geom.interiors)
        if geom.geom_type in ("LineString", "LinearRing"):
            return line_path(geom.coords)
        return "".join(geom_path(part) for part in geom.geoms)

    land_path = root / "data/raw/climate/ne_10m_land.geojson"
    admin_path = root / "runs/2026-09-24-cartographic-context-v1/admin1_boundaries.geojson"
    country_path = root / "runs/2026-09-24-cartographic-context-v1/country_boundaries.geojson"
    geo_crop = box(-130, 28, -100, 58)

    def context_paths(path):
        result = []
        for feature in json.loads(path.read_text())["features"]:
            geom = shape(feature["geometry"]).intersection(geo_crop)
            if geom.is_empty:
                continue
            geom = transform(projector.transform, geom).intersection(extent).simplify(6500, preserve_topology=True)
            result.append(geom_path(geom))
        return "".join(result)

    chunks = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220" role="img" aria-labelledby="map-title map-description">',
        '<title id="map-title">Spea intermontana modeled recording density</title>',
        '<desc id="map-description">A coarse view of an existing environmental model for the Great Basin spadefoot. Rocket colors show modeled recorded-cell density relative to the available-landscape mean, not occupancy probability. Saved native predictions were averaged by physical area into 25-kilometer equal-area display tiles. No occurrence locations are shown.</desc>',
        f'<!-- Source prediction SHA-256: {sha256(prediction)}. Rendering and provenance: scripts/build-sdm-thumbnail.py and scripts/spea-intermontana-map.provenance.json. -->',
        f'<path d="{context_paths(land_path)}" fill="#839496" fill-opacity=".08" stroke="#839496" stroke-opacity=".45" stroke-width=".55" fill-rule="evenodd"/>',
    ]
    for geometry, value in shapes(bins, mask=bins >= 0, transform=raster_transform):
        chunks.append(f'<path d="{geom_path(shape(geometry))}" fill="{COLORS[int(value)]}" fill-rule="evenodd"/>')
    chunks.extend([
        f'<path d="{context_paths(admin_path)}" fill="none" stroke="#839496" stroke-opacity=".45" stroke-width=".4"/>',
        f'<path d="{context_paths(country_path)}" fill="none" stroke="#839496" stroke-opacity=".8" stroke-width=".65"/>',
        '</svg>\n',
    ])
    target = repo / "docs/assets/spea-intermontana-map.svg"
    target.write_text("\n".join(chunks))
    provenance = {
        "asset": "docs/assets/spea-intermontana-map.svg",
        "description": "Spea intermontana modeled recording density; saved full-data expanded environmental model.",
        "source_run": RUN,
        "source_paths_and_sha256": {str(p.relative_to(root)): sha256(p) for p in (prediction, registry, land_path, admin_path, country_path)},
        "source_report": "reports/five_species_expanded_models.md",
        "model": {"species": "Spea intermontana", "fitting_method": "CatBoost weighted classification", "environmental_columns": 56, "training_cells": 703, "trees": 300, "depth": 4, "source_date": "2026-10-01"},
        "meaning": "Recorded-cell density relative to this species' available-landscape mean; not occupancy, abundance or a physiological niche boundary.",
        "rendering": {"crs": DISPLAY_CRS, "tile_size_m": TILE_M, "native_cells": len(ids), "display_tiles": int(valid.sum()), "aggregation": "Physical-area-weighted arithmetic mean of exp(log_relative_density), followed by logarithmic coloring.", "log_color_limits": [-3, 3], "colors": COLORS, "palette": PALETTE, "native_area_weighted_mean": native_mean, "coarse_area_weighted_mean": coarse_mean, "geographic_context": "Natural Earth land, country boundaries and administrative boundaries; simplified to 6.5 km for display.", "observations_shown": False},
        "limitations": ["Thumbnail for a general research-project card, not a quantitative figure.", "Blank exterior is unmodeled; coarse edges reflect the pre-existing analysis landscape.", "Expanded 56-column model; distinct from the monthly-climate-only comparison in the public working manuscript.", "No model was refitted and no new environmental prediction was made.", "Full source prediction arrays remain in the research archive and are not bundled with this website."],
        "asset_sha256": sha256(target),
    }
    (repo / "scripts/spea-intermontana-map.provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print(json.dumps({"asset": str(target), "bytes": target.stat().st_size, "native_cells": len(ids), "display_tiles": int(valid.sum()), "source_sha256_verified": True, "weighted_mean_preserved": abs(native_mean - coarse_mean) < 1e-12}))


if __name__ == "__main__":
    main()
