# Homepage companion preview — v2

Preserved design experiment from `experiment/spadefoot-scenes`. This v2 interaction was approved for the homepage; the reviewed production version is in `docs/`. The prior published design remains available at commit `254bdc0`. This directory is an archival preview; make future production edits in `docs/`.

From the repository root:

```sh
python3 -m http.server 8875 --bind 127.0.0.1
```

Open http://127.0.0.1:8875/previews/spadefoot-scenes/.

## Design

A compact profile with four native details/summary rows and one persistent spadefoot beside the content. The character is static while the rows are closed. Opening a row reveals its text and figure, while the companion performs a related action. On small screens the companion becomes a compact sticky strip above the project list.

- Fortegra: the toad types on a laptop; public text stays limited to the role title.
- Spadefoot biogeography: the toad opens a map and studies it with a magnifier; the dropdown contains a separate schematic map.
- Six triangles: the companion shrinks and hops into a triangle, followed by five smaller toads. The dropdown shows the project's actual geometric arrangement.
- LLM watermarking: typing builds a short sequence of highlighted tokens; the dropdown contains a separate teaching diagram.

Three new ImageGen atlases provide sixteen poses each for typing, hopping, and map reading. Canvas adds continuous travel and transitions. Artwork, exact prompts, and source registration are recorded in [ARTWORK-v2.md](ARTWORK-v2.md). The map, token sequence, and toad arrangement are illustrations; the geometric figure in the packing dropdown comes from the published project.

Each action plays once for 7–8 seconds and holds its final pose. Replay and pause are available. Only one row opens at a time. Closing it returns the companion to idle. Hidden tabs stop playback; reduced-motion mode displays the final pose without animation controls. Theme preference is remembered locally. Native details keeps text and figures available without JavaScript. No runtime dependencies or build steps.

`companion.js` renders the character; `site.js` coordinates dropdowns and controls. The earlier four-pose version is preserved in [`../spadefoot-scenes-v1/`](../spadefoot-scenes-v1/README.md). Its original `scenes.js`, `assets/spadefoot-poses.png`, and `ARTWORK.md` remain here for provenance but are not loaded by v2.

## Verification

- JavaScript syntax and HTML structure, local asset links, content scope, and whitespace checks passed.
- All four behaviors rendered in the in-app browser. Desktop dark/light views and the compact mobile companion were visually inspected. No horizontal overflow at 390 or 320 pixels; temporary viewport overrides were reset.
- Keyboard Enter expands a row. Rapid switching leaves one row open with the matching companion. Replay, pause, and focus transfer when the pause control disappears were exercised.
- Theme selection persisted after reload; the canvas redraws with the chosen palette. Browser console showed no errors at the final check.
- A mocked canvas test visited all sixteen frame indices for each behavior and checked source rectangles, finite drawing coordinates, completion, replay, pause, delayed assets with rapid switching, initial and changed reduced-motion preferences, theme redraw, and cleanup. A restored open dropdown selects the matching companion on startup. Visibility/pagehide stops playback. Reduced motion was not tested by changing the operating system setting.
- The final packing view is saved beside the repository in `outputs/homepage-companion-v2.jpg`.

Production refinements and deployment are maintained in `docs/`; this directory preserves the reviewed design's starting point.
