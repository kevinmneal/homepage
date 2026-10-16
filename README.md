# Kevin M. Neal

Personal professional homepage: https://kevinmneal.com

Plain HTML, CSS, and a little JavaScript, hosted on GitHub Pages. Public site files live in `docs/`; there are no dependencies or build steps, analytics, external fonts, or third-party scripts.

## Editing

- `docs/index.html`: professional profile, public projects, personal background, publications, and scholarly links.
- `docs/styles.css`: responsive layout and Solarized dark/light themes.
- `docs/site.js`: theme switch, expandable projects, and animation controls.
- `docs/companion.js`: the persistent spadefoot's contextual animations.
- `docs/hop-game.js`: the hidden MAKE HOP! game, its canvas renderer, controls, and lifecycle.
- `docs/hop-model.js`: deterministic game physics, spawning, collision, and scoring.
- `docs/hop-audio.js`: optional synthesized effects, off until enabled.
- `docs/lab/`: the small experiments index and its theme switch.
- `docs/assets/game/`: new croak/obstacle atlases, frame metadata, and exact ImageGen prompts.
- `docs/assets/companion/`: project and reaction sprite atlases, frame metadata, and reaction-generation prompts.
- `docs/assets/spadefoot.png`: original owner-supplied character reference.
- `docs/assets/spea-intermontana-map.svg`: compact map drawn from saved environmental-model predictions.
- `docs/favicon.svg`: small spadefoot icon.
- `docs/CNAME`: custom domain.

Every page load starts in dark mode. The theme switch displays the current mode and allows light mode for the current page; old stored theme choices are ignored. Opening a project reveals its text and figure while the companion plays a related action once. Replay and pause are available; reduced-motion preferences show a still frame. The native "A bit about me" disclosure is independent of the project accordion and companion. All text remains readable without JavaScript; the companion rail stays hidden until initialized. No contact address is published.

The featured work is Fortegra, spadefoot biogeography, and six-triangle packing; watermarking is a secondary experiment link. Publications distinguish peer-reviewed articles from working manuscripts and preprints. Professional descriptions are supplied by the site owner; do not infer private implementation details, metrics, or outcomes.

Typing uses short bursts and rests with one quick blink. Typing and map poses blend on a separate canvas to keep their opacity stable; the hopping sequence uses its original sprite animation.

The companion uses three dedicated sixteen-pose sequences: a curious head turn and blink on mouse hover, a startled hop on the first tap, and an indignant throat puff on the second. These have no captions or tooltip. Reactions play once and return to the selected project scene; reduced motion suppresses them. [Exact reaction prompts and assets](docs/assets/companion/REACTIONS-v3.md) accompany the original PNGs; `scripts/build-reaction-frames.py` reproduces their frame metadata using Pillow. Three clicks/taps, each within 1.8 seconds of the last, open **MAKE HOP!**; keyboard and assistive activation open it directly. The independent [lab page](docs/lab/index.html) groups the game with the existing watermarking and packing explainers, plus a small teaser for future experiments. Its game link uses `/#make-hop` (relative paths also support the GitHub project URL).

Space/Up or the field/Hop button jumps; F or Make way! launches a rechargeable force front that sends obstacles tumbling away; P pauses. Three hits end a run. Fireflies add points and recharge the croak. Speed rises from 210 to 370 logical pixels/second over 80 seconds. Tumbleweeds enter the spawn mix after 15 seconds and high moths after 30; running underneath a moth is safe. Spacing leaves room to land between obstacles. The pace and stage are shown in the dialog.

Best score is stored only in this browser when storage is available; there is no leaderboard or network service. Sound is off by default; the optional toggle enables brief synthesized croak, collection, and collision effects. The game loads on demand, pauses when the tab loses visibility/focus, and stops on close. Reduced motion removes camera shake, decorative movement, particles and sprite flourishes, while retaining essential movement and a simple visible force front. Gameplay begins only after an explicit start.

The original jump atlas is paired with ImageGen atlases for the ground-scuttling gait, roar, rocks, tumbleweeds, moths, and fireflies. The sixteen walking poses follow distance traveled, with a fixed body scale and planted-foot baseline; pause freezes the stride, and jumping or croaking takes priority. [Original prompts](docs/assets/game/ARTWORK.md) and [walking prompt and crop-repair provenance](docs/assets/game/ARTWORK-v3.md) accompany the byte-preserved PNGs. `scripts/build-game-frames.py` regenerates `frames-v3.json` from complete alpha-connected sprites, allowing objects to cross an ideal grid boundary without clipping or borrowing pixels from the next row. Use `--check` to verify the metadata. Pillow is needed only for this authoring utility.

The research thumbnail depicts modeled recording density for *Spea intermontana*, using embedded samples from Seaborn’s Rocket palette. Its source hashes, model context, and display aggregation are recorded in [`scripts/spea-intermontana-map.provenance.json`](scripts/spea-intermontana-map.provenance.json). [`scripts/build-sdm-thumbnail.py`](scripts/build-sdm-thumbnail.py) regenerates it from the existing research archive; no model is fitted. Its scientific Python dependencies are needed only for regeneration, not for serving the homepage.

Only add public content. Keep credentials, private drafts, and account setup notes outside this repository. Project descriptions should reflect their linked public releases; distinguish working manuscripts and preprints from peer-reviewed publications.

## Local preview

The earlier design experiments are preserved in [`previews/spadefoot-scenes/`](previews/spadefoot-scenes/README.md) and [`previews/spadefoot-scenes-v1/`](previews/spadefoot-scenes-v1/README.md). Production edits belong in `docs/`. [Artwork provenance and generation prompts](previews/spadefoot-scenes/ARTWORK-v2.md) accompany the original generated files.

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. Serve over HTTP for the JavaScript modules and frame metadata; direct file opening is not the complete interactive preview.

## Verification

Run `node scripts/check-hop-model.mjs` for deterministic physics, input, collision, collection, and spawn-bound checks. Run `node scripts/check-hop-game.mjs` for mocked game lifecycle and controls, and `node scripts/check-hop-audio.mjs` for audio opt-in and cleanup. Run `node scripts/check-companion.mjs` for animation lifecycle checks, including asset retry, rapid selection, reduced motion, and unavailable canvas fallback. Also run `node --check docs/site.js`, `node --check docs/companion.js`, `node --check docs/hop-game.js`, `node --check docs/hop-model.js`, `node --check docs/hop-audio.js`, `node --check docs/lab/lab.js`, and `git diff --check`. Use a browser to inspect both themes and desktop/mobile layouts; the mocked canvas checks do not verify appearance.

## Publishing

GitHub Pages publishes the `main` branch's `/docs` folder. Changes pushed to `main` redeploy automatically. Relative asset paths support both the project address, https://kevinmneal.github.io/homepage/, and the custom-domain root.

Configure the domain and HTTPS in the repository's **Settings → Pages**. To return to the default Pages address, remove the custom domain setting and `docs/CNAME` before retiring the domain.
