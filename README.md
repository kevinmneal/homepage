# Kevin M. Neal

Personal professional homepage: https://kevinmneal.com

Plain HTML, CSS, and a little JavaScript, hosted on GitHub Pages. Public site files live in `docs/`; there are no dependencies or build steps, analytics, external fonts, or third-party scripts.

## Editing

- `docs/index.html`: professional profile, public projects, personal background, publications, and scholarly links.
- `docs/styles.css`: responsive layout and Solarized dark/light themes.
- `docs/site.js`: theme switch, expandable projects, and animation controls.
- `docs/companion.js`: the persistent spadefoot's contextual animations.
- `docs/assets/companion/`: three sixteen-pose sprite atlases and frame metadata.
- `docs/assets/spadefoot.png`: original owner-supplied character reference.
- `docs/assets/spea-intermontana-map.svg`: compact map drawn from saved environmental-model predictions.
- `docs/favicon.svg`: small spadefoot icon.
- `docs/CNAME`: custom domain.

Every page load starts in dark mode. The theme switch displays the current mode and allows light mode for the current page; old stored theme choices are ignored. Opening a project reveals its text and figure while the companion plays a related action once. Replay and pause are available; reduced-motion preferences show a still frame. The native "A bit about me" disclosure is independent of the project accordion and companion. All text remains readable without JavaScript; the companion rail stays hidden until initialized. No contact address is published.

The featured work is Fortegra, spadefoot biogeography, and six-triangle packing; watermarking is a secondary experiment link. Publications distinguish peer-reviewed articles from working manuscripts and preprints. Professional descriptions are supplied by the site owner; do not infer private implementation details, metrics, or outcomes.

Typing uses short bursts and rests with one quick blink. Typing and map poses blend on a separate canvas to keep their opacity stable; the hopping sequence uses its original sprite animation.

The research thumbnail depicts modeled recording density for *Spea intermontana*, using embedded samples from Seaborn’s Rocket palette. Its source hashes, model context, and display aggregation are recorded in [`scripts/spea-intermontana-map.provenance.json`](scripts/spea-intermontana-map.provenance.json). [`scripts/build-sdm-thumbnail.py`](scripts/build-sdm-thumbnail.py) regenerates it from the existing research archive; no model is fitted. Its scientific Python dependencies are needed only for regeneration, not for serving the homepage.

Only add public content. Keep credentials, private drafts, and account setup notes outside this repository. Project descriptions should reflect their linked public releases; distinguish working manuscripts and preprints from peer-reviewed publications.

## Local preview

The earlier design experiments are preserved in [`previews/spadefoot-scenes/`](previews/spadefoot-scenes/README.md) and [`previews/spadefoot-scenes-v1/`](previews/spadefoot-scenes-v1/README.md). Production edits belong in `docs/`. [Artwork provenance and generation prompts](previews/spadefoot-scenes/ARTWORK-v2.md) accompany the original generated files.

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. Serve over HTTP for the JavaScript modules and frame metadata; direct file opening is not the complete interactive preview.

## Verification

Run `node scripts/check-companion.mjs` for animation lifecycle checks, including asset retry, rapid selection, reduced motion, and unavailable canvas fallback. Also run `node --check docs/site.js`, `node --check docs/companion.js`, and `git diff --check`. Use a browser to inspect both themes and desktop/mobile layouts; the mocked canvas checks do not verify appearance.

## Publishing

GitHub Pages publishes the `main` branch's `/docs` folder. Changes pushed to `main` redeploy automatically. Relative asset paths support both the project address, https://kevinmneal.github.io/homepage/, and the custom-domain root.

Configure the domain and HTTPS in the repository's **Settings → Pages**. To return to the default Pages address, remove the custom domain setting and `docs/CNAME` before retiring the domain.
