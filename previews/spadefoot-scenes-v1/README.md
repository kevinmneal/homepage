# Expandable homepage preview

Archived first design experiment from `experiment/spadefoot-scenes`. This four-pose version was superseded by the persistent companion design. The production homepage is in `docs/`; this directory preserves the earlier draft.

From the repository root:

```sh
python3 -m http.server 8875 --bind 127.0.0.1
```

Open http://127.0.0.1:8875/previews/spadefoot-scenes-v1/.

## Design

A compact profile with four native details/summary rows. Opening a row plays a 7.6-second animation once, then holds the final scene. Only one row opens at a time. Replay and pause are available; reduced-motion mode shows the final frame and hides animation controls. Animations stop when the row closes or the tab is hidden. Theme preference is remembered locally.

- Fortegra: a generic policy review and stamp; public text stays limited to the role title.
- Spadefoot biogeography: a toad examines a schematic distribution map with a magnifier.
- Six triangles: six pieces move into the published packing arrangement.
- LLM watermarking: token selections build an illustrative signal.

The generated character has four actual poses. Scene props and motion use canvas; there are no runtime dependencies. Artwork source, exact prompt, and pose layout are recorded in [ARTWORK.md](ARTWORK.md). The map and token chart are illustrations, not research data.

## Verification

- JavaScript syntax and HTML structure, local asset links, content scope, and whitespace checks passed.
- All four scenes rendered in Brave. Desktop dark/light views and the expanded mobile layout were visually inspected. No horizontal overflow at 390 or 320 pixels.
- Keyboard Enter expands a row; selecting another closes the previous row. Replay and pause were exercised. The map's active magnifier pose was inspected while paused.
- Theme selection persisted after reload; the canvas redraws with the chosen palette.
- Animation module passed a mocked canvas test over every scene at 20 ms intervals, including completion, replay, stop, finite coordinates, theme changes, reduced-motion changes, and cleanup. Reduced motion was not tested by changing the operating system setting.
- Browser console showed no errors during the four-scene review or the final check. Full-page screenshots of the closed layout and expanded packing scene are saved alongside the repository in `outputs/homepage-scenes-closed.jpg` and `outputs/homepage-scenes-expanded.jpg`.

This archived draft is retained for comparison. Future production edits belong in `docs/`.
