# Kevin M. Neal

Personal professional homepage: https://kevinmneal.com

Plain HTML, CSS, and a little JavaScript, hosted on GitHub Pages. Public site files live in `docs/`; there are no dependencies or build steps, analytics, external fonts, or third-party scripts.

## Editing

- `docs/index.html`: profile, public projects, manuscripts, and scholarly links.
- `docs/styles.css`: responsive layout and Solarized dark/light themes.
- `docs/site.js`: remembered theme preference and the spadefoot greeting.
- `docs/assets/spadefoot.png`: owner-supplied pixel-art avatar.
- `docs/favicon.svg`: small spadefoot icon.
- `docs/CNAME`: custom domain.

The default theme is dark. The theme switch remembers a visitor's choice locally. The page remains readable without JavaScript, and animation respects reduced-motion preferences. No contact address is currently published.

Only add public content. Keep credentials, private drafts, and account setup notes outside this repository. Project descriptions should reflect their linked public releases; distinguish working manuscripts and preprints from peer-reviewed publications.

## Local preview

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. The page can also be opened directly from `docs/index.html`.

## Publishing

GitHub Pages publishes the `main` branch's `/docs` folder. Changes pushed to `main` redeploy automatically. Relative asset paths support both the project address, https://kevinmneal.github.io/homepage/, and the custom-domain root.

Configure the domain and HTTPS in the repository's **Settings → Pages**. To return to the default Pages address, remove the custom domain setting and `docs/CNAME` before retiring the domain.
