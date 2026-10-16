"""Locate complete sprites in the unchanged ImageGen game atlases.

Generated objects can cross an ideal grid boundary. Segment the alpha channel
first, then use object centers to recover grid order. Never slice the PNG into
equal cells: that clips sprites and borrows pixels from the adjacent row.
Pillow is an authoring dependency only; source PNG bytes are never modified.
Run with --check to verify committed metadata without writing it.
"""
from pathlib import Path
import argparse
import hashlib
import json
from PIL import Image


def sprite_bounds(alpha, width, height):
    mask = bytearray(value > 128 for value in alpha.tobytes())
    objects = []
    for origin, occupied in enumerate(mask):
        if not occupied:
            continue
        mask[origin] = 0
        pending = [origin]
        area = 0
        left = right = origin % width
        top = bottom = origin // width
        while pending:
            pixel = pending.pop()
            y, x = divmod(pixel, width)
            area += 1
            left, right = min(left, x), max(right, x)
            top, bottom = min(top, y), max(bottom, y)
            # Eight-way connectivity preserves diagonal pixel-art outlines.
            for yy in range(max(0, y - 1), min(height, y + 2)):
                for xx in range(max(0, x - 1), min(width, x + 2)):
                    neighbor = yy * width + xx
                    if mask[neighbor]:
                        mask[neighbor] = 0
                        pending.append(neighbor)
        if area >= 100:  # Isolated antialias pixels are not separate sprites.
            objects.append((left, top, right + 1, bottom + 1))
    assert len(objects) == 16, f'Expected 16 separate sprites, found {len(objects)}'
    slots = {}
    for bounds in objects:
        left, top, right, bottom = bounds
        col = int((left + right) / 2 * 4 / width)
        row = int((top + bottom) / 2 * 4 / height)
        slot = row * 4 + col
        assert 0 <= row < 4 and 0 <= col < 4 and slot not in slots
        x0, y0 = max(0, left - 2), max(0, top - 2)
        x1, y1 = min(width, right + 2), min(height, bottom + 2)
        for other in objects:
            if other != bounds:
                ox0, oy0, ox1, oy1 = other
                assert x1 <= ox0 or x0 >= ox1 or y1 <= oy0 or y0 >= oy1, 'Crop borrows a neighboring sprite'
        slots[slot] = [x0, y0, x1 - x0, y1 - y0]
    return [slots[i] for i in range(16)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    base = Path(__file__).resolve().parents[1] / 'docs/assets/game'
    output = {}
    for key, filename in [('croak', 'croak-v2.png'), ('hazards', 'hazards-v2.png'),
                          ('walk', 'walk-v3.png')]:
        path = base / filename
        atlas = Image.open(path)
        width, height = atlas.size
        assert atlas.mode == 'RGBA'
        alpha = atlas.getchannel('A')
        assert alpha.getextrema() == (0, 255)
        output[key] = {'width': width, 'height': height,
                       'frames': sprite_bounds(alpha, width, height),
                       'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
        print(f'{key}: 16 complete sprites, transparent alpha and separated crops verified')
    destination = base / 'frames-v3.json'
    if args.check:
        assert json.loads(destination.read_text()) == output, 'Committed metadata differs; regenerate it'
        print('Committed frame metadata matches all three original atlases')
    else:
        destination.write_text(json.dumps(output, indent=2) + '\n')


if __name__ == '__main__':
    main()
