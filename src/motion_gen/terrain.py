"""Builds a shaded relief map of a lon/lat box from the free Terrain Tiles dataset (AWS Open Data)."""
import io
import json
import math
import os
import sys
import urllib.request

import numpy as np
from PIL import Image

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"
TILE = 256
MAX_TILES = 64
LAND = [(0, (214, 190, 150)), (300, (199, 166, 122)), (1000, (176, 140, 100)), (2500, (150, 122, 96)), (4500, (236, 232, 226))]
SEA_SHALLOW, SEA_DEEP = (214, 222, 232), (176, 192, 212)


def _tile_xy(lon, lat, z):
    n = 2 ** z
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return (lon + 180) / 360 * n, y


def _zoom_for(west, south, east, north):
    for z in range(11, 1, -1):
        x0, y0 = _tile_xy(west, north, z)
        x1, y1 = _tile_xy(east, south, z)
        if (int(x1) - int(x0) + 1) * (int(y1) - int(y0) + 1) <= MAX_TILES:
            return z
    return 2


def _fetch(z, x, y):
    req = urllib.request.Request(TILE_URL.format(z=z, x=x % 2 ** z, y=y), headers={"User-Agent": "auto-content-engine"})
    with urllib.request.urlopen(req, timeout=60) as r:
        rgb = np.asarray(Image.open(io.BytesIO(r.read())).convert("RGB"), dtype=np.float32)
    return rgb[..., 0] * 256 + rgb[..., 1] + rgb[..., 2] / 256 - 32768


def _ramp(height):
    stops = np.array([s for s, _ in LAND], dtype=np.float32)
    colors = np.array([c for _, c in LAND], dtype=np.float32)
    return np.stack([np.interp(height, stops, colors[:, i]) for i in range(3)], axis=-1)


def build(west, south, east, north, dest):
    z = _zoom_for(west, south, east, north)
    x0f, y0f = _tile_xy(west, north, z)
    x1f, y1f = _tile_xy(east, south, z)
    x0, y0, x1, y1 = int(x0f), int(y0f), int(x1f), int(y1f)
    rows = [np.hstack([_fetch(z, x, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)]
    h = np.vstack(rows)

    # Crop to the requested box.
    left, top = int((x0f - x0) * TILE), int((y0f - y0) * TILE)
    right, bottom = int((x1f - x0) * TILE), int((y1f - y0) * TILE)
    h = h[top:bottom, left:right]

    # Hillshade from the north-west, the cartographer's convention. Metres per pixel shrink with latitude.
    mid_lat = (north + south) / 2
    metres = 40075016 * math.cos(math.radians(mid_lat)) / (TILE * 2 ** z)
    gy, gx = np.gradient(np.maximum(h, 0) * 2.2, metres)
    normal = np.dstack((-gx, -gy, np.ones_like(h)))
    normal /= np.linalg.norm(normal, axis=2, keepdims=True)
    light = np.array([-0.6, -0.6, 0.53])
    shade = np.clip((normal * light).sum(axis=2), 0, 1)[..., None]

    land = h > 0
    land_rgb = _ramp(np.maximum(h, 0)) * (0.5 + shade * 0.95)
    depth = np.clip(-h / 2500, 0, 1)[..., None]
    sea_rgb = np.array(SEA_SHALLOW, np.float32) * (1 - depth) + np.array(SEA_DEEP, np.float32) * depth
    img = np.where(land[..., None], land_rgb, sea_rgb)

    # A crisp dark coastline, the look of a printed atlas.
    coast = land ^ (np.roll(land, 1, 0) & np.roll(land, -1, 0) & np.roll(land, 1, 1) & np.roll(land, -1, 1)) & land
    img[coast] = (88, 62, 44)

    os.makedirs(dest, exist_ok=True)
    Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).save(os.path.join(dest, "relief.jpg"), quality=90)
    meta = {"west": west, "south": south, "east": east, "north": north, "width": int(h.shape[1]), "height": int(h.shape[0])}
    with open(os.path.join(dest, "relief.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f)
    return meta


if __name__ == "__main__":
    w, s, e, n = map(float, sys.argv[1:5])
    print("relief.jpg", build(w, s, e, n, sys.argv[5]))
