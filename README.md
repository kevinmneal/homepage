# Kevin M. Neal

Personal professional homepage: https://kevinmneal.com

Plain HTML, CSS, and a little JavaScript, hosted on GitHub Pages. Public site files live in `docs/`; serving them needs no dependencies or build step. There are no analytics, external fonts, or third-party scripts. A Python standard-library authoring script keeps Markdown exports and discovery files synchronized with the HTML.

## Editing

- `docs/index.html`: professional profile, public projects, personal background, publications, and scholarly links.
- `docs/styles.css`: responsive layout and Solarized dark/light themes.
- `docs/site.js`: theme switch, expandable projects, and animation controls.
- `docs/companion.js`: the persistent spadefoot's contextual animations.
- `docs/hop-game.js`: the hidden MAKE HOP! game, its canvas renderer, controls, and lifecycle.
- `docs/hop-model.js`: deterministic game physics, spawning, collision, and scoring.
- `docs/hop-audio.js`: optional synthesized effects, off until enabled.
- `docs/lab/`: the small experiments index and its theme switch.
- `docs/lab/switchback/`: Switchback Foundry, a maze with gradual hints, an optional route challenge, and a prediction experiment. [Rules and verification](docs/lab/switchback/README.md).
- `docs/lab/all-the-ways-to-fit/`: All the Ways to Fit, an exact-count tiling playground copied from its [independent source repository](https://github.com/kevinmneal/all-the-ways-to-fit). Update it with `scripts/sync-tiling-playground.py`; preserve the included MIT license.
- `docs/assets/game/`: new croak/obstacle atlases, frame metadata, and exact ImageGen prompts.
- `docs/assets/companion/`: project and reaction sprite atlases, frame metadata, and reaction-generation prompts.
- `docs/assets/spadefoot.png`: original owner-supplied character reference.
- `docs/assets/spea-intermontana-map.svg`: compact map drawn from saved environmental-model predictions.
- `docs/favicon.svg`: small spadefoot icon.
- `docs/CNAME`: custom domain.
- `scripts/build-agent-pages.py`: generates the two Markdown pages, `llms.txt`, `sitemap.xml`, and `robots.txt` from the public HTML.

Every page load starts in dark mode. The theme switch displays the current mode and allows light mode for the current page; old stored theme choices are ignored. Opening a project reveals its text and figure while the companion plays a related action once. Replay and pause are available; reduced-motion preferences show a still frame. The native "A bit about me" disclosure is independent of the project accordion and companion. All text remains readable without JavaScript; the companion rail stays hidden until initialized. No contact address is published.

The featured work is Fortegra, spadefoot biogeography, and six-triangle packing; watermarking is a secondary experiment link. Publications distinguish peer-reviewed articles from working manuscripts and preprints. Professional descriptions are supplied by the site owner; do not infer private implementation details, metrics, or outcomes.

Typing uses short bursts and rests with one quick blink. Typing and map poses blend on a separate canvas to keep their opacity stable; the hopping sequence uses its original sprite animation.

The companion uses three dedicated sixteen-pose sequences: a curious head turn and blink on mouse hover, a startled hop on the first tap, and an indignant throat puff on the second. These have no captions or tooltip. Reactions play once and return to the selected project scene; reduced motion suppresses them. [Exact reaction prompts and assets](docs/assets/companion/REACTIONS-v3.md) accompany the original PNGs; `scripts/build-reaction-frames.py` reproduces their frame metadata using Pillow. Three clicks/taps, each within 1.8 seconds of the last, open **MAKE HOP!**; keyboard and assistive activation open it directly. The independent [lab page](docs/lab/index.html) groups the game with Switchback Foundry, All the Ways to Fit, and the existing watermarking and packing explainers, plus a small teaser for future experiments. Its game link uses `/#make-hop` (relative paths also support the GitHub project URL).

Space/Up or the field/Hop button jumps; F or Make way! launches a rechargeable force front that sends obstacles tumbling away; P pauses. Three hits end a run. Fireflies add points and recharge the croak. Speed rises from 210 to 370 logical pixels/second over 80 seconds. Tumbleweeds enter the spawn mix after 15 seconds and high moths after 30; running underneath a moth is safe. Spacing leaves room to land between obstacles. The pace and stage are shown in the dialog.

Best score is stored only in this browser when storage is available; there is no leaderboard or network service. Sound is off by default; the optional toggle enables brief synthesized croak, collection, and collision effects. The game loads on demand, pauses when the tab loses visibility/focus, and stops on close. Reduced motion removes camera shake, decorative movement, particles and sprite flourishes, while retaining essential movement and a simple visible force front. Gameplay begins only after an explicit start.

The original jump atlas is paired with ImageGen atlases for the ground-scuttling gait, roar, rocks, tumbleweeds, moths, and fireflies. The sixteen walking poses follow distance traveled, with a fixed body scale and planted-foot baseline; pause freezes the stride, and jumping or croaking takes priority. [Original prompts](docs/assets/game/ARTWORK.md) and [walking prompt and crop-repair provenance](docs/assets/game/ARTWORK-v3.md) accompany the byte-preserved PNGs. `scripts/build-game-frames.py` regenerates `frames-v3.json` from complete alpha-connected sprites, allowing objects to cross an ideal grid boundary without clipping or borrowing pixels from the next row. Use `--check` to verify the metadata. Pillow is needed only for this authoring utility.

The research thumbnail depicts modeled recording density for *Spea intermontana*, using embedded samples from Seaborn’s Rocket palette. Its source hashes, model context, and display aggregation are recorded in [`scripts/spea-intermontana-map.provenance.json`](scripts/spea-intermontana-map.provenance.json). [`scripts/build-sdm-thumbnail.py`](scripts/build-sdm-thumbnail.py) regenerates it from the existing research archive; no model is fitted. Its scientific Python dependencies are needed only for regeneration, not for serving the homepage.

Only add public content. Keep credentials, private drafts, and account setup notes outside this repository. Project descriptions should reflect their linked public releases; distinguish working manuscripts and preprints from peer-reviewed publications.

## Reading and discovery

The HTML is the source of truth. After editing either page, run:

```sh
python3 scripts/build-agent-pages.py
python3 scripts/build-agent-pages.py --check
```

Commit the regenerated files with the source changes. The script requires only Python 3.10+ and its standard library; it makes no network or model calls. It preserves expanded disclosure text, publication categories and years, source links, and professional profiles, while leaving out interactive controls and decorative artwork. Links in the exports are absolute so they remain useful when copied into another context. The map's accessible description and source image are retained.

- `/index.md` and `/lab/index.md` are faithful text versions of the homepage and lab. Both HTML pages expose a `rel="alternate"` discovery link. The visible **View as Markdown** links open byte-identical `/index.md.txt` and `/lab/index.md.txt` copies served as `text/plain`, so browsers can display the Markdown source inline instead of treating its MIME type as a download.
- `/llms.txt` is a compact directory of those pages, interactive experiences, research sources, and profiles, following the [llms.txt proposal](https://llmstxt.org/). Each HTML page links to it with `rel="describedby"` and a footer link.
- `/sitemap.xml` lists the two reading pages and both interactive lab pages, avoiding duplicate format URLs and invented modification dates.
- `/robots.txt` permits all crawlers and advertises the sitemap. This preserves the previous default public crawling policy; it adds no vendor-specific blocks or separate training-use signals.

GitHub Actions runs the read-only discovery `--check`, Switchback model/syntax checks, and tiling snapshot hash verification on pushes to `main` and pull requests. It detects missing/stale output, broken internal destinations, missing discovery/footer links, and blocked crawling. This check runs alongside GitHub Pages; it does not gate Pages deployment. Run it locally before publishing. `.nojekyll` keeps the exports as static files. These additions improve access and navigation; search indexing and agent adoption remain outside the site's control.

## Updating the tiling playground

Make and test application changes in [All the Ways to Fit](https://github.com/kevinmneal/all-the-ways-to-fit), then commit and push them there. From this homepage checkout, copy that committed release:

```sh
python3 scripts/sync-tiling-playground.py --source /path/to/all-the-ways-to-fit
python3 scripts/sync-tiling-playground.py --check
python3 scripts/build-agent-pages.py
python3 scripts/build-agent-pages.py --check
```

The copy includes only committed `dist/` files and `LICENSE`; `scripts/all-the-ways-to-fit.snapshot.json` records the upstream revision and SHA-256 of every file. The check is local and needs no source checkout or network access. Do not edit the hosted copy independently. Review the diff and exercise the page through a local HTTP preview before publishing. Updates are explicit; the source repository does not deploy to this site automatically.

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
