# Offline documentation bundle

Builds the product documentation into a self-contained bundle that ships inside
the release tarball at `client/_documentation`. The Mattermost server serves it
at `/_documentation`, and `mattermost docs` serves it when the server is not
running.

Depends on the egress / self-host changes that keep the built site free of
off-origin fetches (fonts, screenshots, OpenAPI icons, video iframes).

## Build the bundle

Needs Node and Go (API reference generation).

```sh
# One-time: the docs build reads content from a submodule.
git submodule update --init docs/vendor/mattermost-plugin-agents

cd docs/site
npm ci

# BASE_URL is baked into absolute asset paths at build time.
BASE_URL=/_documentation/ npm run build
npm run check:egress

cd ../..
python3 docs/scripts/build-offline-bundle.py docs/site/build /tmp/docs-bundle.tar.gz
```

`build-offline-bundle.py` hardlinks byte-identical images, drops sitemaps, and
writes a gzip tarball.

## Try it

Point the CLI at the unpackaged build (no database, config, or webapp):

```sh
cd server
go build -o ./bin/mattermost ./cmd/mattermost
./bin/mattermost docs --dir ../docs/site/build
```

Without `--dir` it serves the bundle from a packaged release.

To exercise the server route:

```sh
cd server
make client   # only symlinks client/ -> ../webapp/channels/dist
mkdir -p ../webapp/channels/dist
tar -xzf /tmp/docs-bundle.tar.gz -C ../webapp/channels/dist
make run-server ENABLED_DOCKER_SERVICES=postgres
```

Docs are then at `http://localhost:8065/_documentation/`.

Extract into the symlink *target*, not through the symlink: `make client` only
creates the link. The webapp does not need to be built. If you do build it,
extract the bundle afterwards (`webpack` `output.clean` wipes `channels/dist`).

## Package it into a release

```sh
make package DOCS_BUNDLE=/tmp/docs-bundle.tar.gz
```

The bundle is extracted rather than copied so hardlinks survive. Leaving
`DOCS_BUNDLE` unset skips docs packaging.

## Current size

Roughly 198 MB compressed, before image optimisation (GIF→H.264 / WebP) tracked
separately.
