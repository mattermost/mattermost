# Self-hosted web fonts

These replace the Google Fonts stylesheet the site used to load at runtime. The
offline documentation bundle shipped in the release tarball has no internet
access, and a site that silently falls back to system fonts looks broken, so the
fonts travel with it.

`@font-face` declarations live in `../fonts.css`, which is registered in
`docusaurus.config.ts` under `presets[0][1].theme.customCss`. Paths there are
relative, so webpack emits the files with the right prefix for whatever
`baseUrl` the site is built against — do not move these into `static/`, where
they would need an absolute `/fonts/...` URL and break the `/documentation/`
build.

## Source

Extracted from the [Fontsource](https://fontsource.org) npm packages, which
repackage the upstream Google Fonts releases:

| Family | Package | Version |
| --- | --- | --- |
| Inter | `@fontsource/inter` | 5.3.0 |
| Archivo Black | `@fontsource/archivo-black` | 5.3.0 |
| JetBrains Mono | `@fontsource/jetbrains-mono` | 5.3.0 |

These are not runtime dependencies — the `.woff2` files were taken from the
published tarballs and committed directly, matching the approach in
`webapp/channels/src/fonts/`. To refresh them, `npm pack` the package at the
new version, copy the files listed below out of `package/files/`, and update the
`unicode-range` values in `../fonts.css` from the matching `package/<weight>.css`.

## What is included

Only the subsets and weights the site actually uses, which is why this directory
is around 360 KB rather than several megabytes:

| Family | Weights | Subsets |
| --- | --- | --- |
| Inter | 400, 500, 600, 700 | latin, latin-ext |
| Archivo Black | 400 | latin, latin-ext |
| JetBrains Mono | 400, 600 | latin, latin-ext |

Weights match what the old Google Fonts request asked for, so rendering is
unchanged. No italic faces are shipped (none were requested before either);
browsers synthesize them.

Only `.woff2` is included. Every browser the docs support reads it, and the
`.woff` fallback would roughly double the payload for no practical gain.

## Licensing

All three families are licensed under the SIL Open Font License 1.1, which
permits redistribution and bundling. The full license text for each is in this
directory as `LICENSE-*.txt`.
