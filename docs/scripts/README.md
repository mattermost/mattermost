# Offline documentation bundle

Builds the product documentation into a self-contained bundle that ships inside
the release tarball at `client/documentation`, so customers running airgapped
deployments can read the docs without internet access. The Mattermost server
serves it at `/documentation`, and `mattermost docs` serves it when the server
is not running at all.

## Build the bundle

The documentation site is a Docusaurus build, so this needs Node, and the
`prebuild` step also needs Go and network access (it generates the API
reference). Expect about five minutes end to end.

```sh
# One-time: the docs build reads content from a submodule.
git submodule update --init docs/vendor/mattermost-plugin-agents

cd docs/site
npm ci

# BASE_URL matters. The bundle is served under /documentation, and every
# absolute asset path in the emitted HTML is baked in at build time.
BASE_URL=/documentation/ npm run build

cd ../..
python3 docs/scripts/build-offline-bundle.py docs/site/build /tmp/docs-bundle.tar.gz
```

`build-offline-bundle.py` hardlinks byte-identical images, which removes about
172 MB, drops the sitemaps, and writes a gzip tarball. It prints what it did at
each step.

## Try it

The fastest check needs no database, no config file, and no webapp — point the
CLI straight at the unpackaged build:

```sh
cd server
go build -o ./bin/mattermost ./cmd/mattermost
./bin/mattermost docs --dir ../docs/site/build
```

Then open the URL it prints. Without `--dir` it serves the bundle from the
release it was packaged into, which is how customers use it.

To exercise the server route instead, put the bundle where the server looks for
it and start the server normally:

```sh
cd server
make client   # symlinks client/ to the webapp build output
mkdir -p client/documentation
tar -xzf /tmp/docs-bundle.tar.gz -C client --strip-components=0
make run-server
```

The docs are then at `http://localhost:8065/documentation/`.

## Package it into a release

`make package` picks the bundle up from `DOCS_BUNDLE`:

```sh
make package DOCS_BUNDLE=/tmp/docs-bundle.tar.gz
```

The bundle is extracted rather than copied, because `cp -RL` and BSD `cp -a`
both break hardlinks and would silently add about 160 MB to the release
tarball. Leaving `DOCS_BUNDLE` unset skips docs packaging, so a local
`make package` still works.

## Current size

Roughly 198 MB compressed. That is the figure before image optimisation —
converting animated GIFs to H.264 and the largest PNG and JPG files to WebP is
tracked separately and accounts for most of the remaining reduction.
