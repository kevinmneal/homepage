"""Derive source rectangles from unchanged 4x4 ImageGen reaction atlases.

Pillow is an authoring dependency only. The PNG bytes are never modified.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

base = Path(__file__).resolve().parents[1] / 'docs/assets/companion'
output = {}
for key, filename in [('curious', 'curious-v3.png'), ('happy', 'startle-v3.png'),
                      ('croak', 'puff-v3.png')]:
    path = base / filename
    atlas = Image.open(path)
    width, height = atlas.size
    assert atlas.mode == 'RGBA'
    alpha = atlas.getchannel('A')
    assert alpha.getextrema() == (0, 255)
    frames = []
    for row in range(4):
        for col in range(4):
            x0, y0, x1, y1 = (round(col * width / 4), round(row * height / 4),
                              round((col + 1) * width / 4), round((row + 1) * height / 4))
            bounds = alpha.crop((x0, y0, x1, y1)).point(lambda a: 255 if a > 128 else 0).getbbox()
            assert bounds
            left, top, right, bottom = bounds
            left, top = max(0, left - 2), max(0, top - 2)
            right, bottom = min(x1 - x0, right + 2), min(y1 - y0, bottom + 2)
            frames.append([x0 + left, y0 + top, right - left, bottom - top])
    output[key] = {'width': width, 'height': height, 'frames': frames,
                   'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    print(f'{key}: {width}x{height}, alpha verified, 16 frames')
(base / 'reactions-v3.json').write_text(json.dumps(output, indent=2) + '\n')
