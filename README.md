# Kevin M. Neal

Personal professional homepage: https://kevinmneal.com

Plain HTML and CSS, hosted on GitHub Pages. Public site files live in `docs/`; there are no dependencies or build steps.

## Editing

- `docs/index.html`: profile, projects, research, publications, and correspondence.
- `docs/styles.css`: layout and appearance.
- `docs/CNAME`: custom domain, when configured.

Only add public content. Keep credentials, private drafts, and account setup notes outside this repository. The homepage can link to projects without publishing their source code here.

## Local preview

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory docs
```

Open http://127.0.0.1:8765/. The page can also be opened directly from `docs/index.html`.

## Publishing

GitHub Pages publishes the `main` branch's `/docs` folder. Changes pushed to `main` redeploy automatically. Relative asset paths support both the project address, https://kevinmneal.github.io/homepage/, and the custom-domain root.

Configure the domain and HTTPS in the repository's **Settings → Pages**. To return to the default Pages address, remove the custom domain setting and `docs/CNAME` before retiring the domain.
