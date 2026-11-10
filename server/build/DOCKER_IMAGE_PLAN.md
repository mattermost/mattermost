# Server Docker image: Chainguard base and document extraction fix

Status: plan for `server/build/Dockerfile`. Fixes [#36182](https://github.com/mattermost/mattermost/issues/36182) and supersedes [#38552](https://github.com/mattermost/mattermost/pull/38552), which is on hold until the base image is decided (`gcr.io/distroless/base-debian12` is end of life).

## Base image

| Stage | Image | Registry |
|---|---|---|
| Builder | `cgr.dev/chainguard/wolfi-base:latest@sha256:…` | Chainguard public catalog |
| Runtime | `scratch` + root filesystem assembled with `apk` (includes glibc) | — |

Why:

- **Fewer, faster-patched CVEs.** Wolfi packages are patched in hours to days. The runtime has no shell or package manager.
- **No customer disruption.** The public catalog needs no auth, so `docker build --build-arg MM_PACKAGE=… .` is unchanged for anyone building from source. Users of the published Docker Hub images never pull from `cgr.dev`.
- **One package ecosystem.** The FIPS image is already on Chainguard and Wolfi.
- **Org registry later, if needed.** `cgr.dev/mattermost.com` adds versioned tags and an SLA, but it always requires auth and cannot be made public. It can be injected for release builds only, through a `BUILDER_IMAGE` build argument from delivery-platform, which already authenticates with `chainctl`.
- **Updates.** Pin as `tag@digest` and bump with Digestabot or Dependabot, with a cooldown of 0–2 days. A base digest does not pin `apk` packages; the tests below guard against package drift.

## How packages are installed

```dockerfile
RUN apk add --no-cache --root /rootfs --initdb <packages>
FROM scratch
COPY --from=builder /rootfs /
```

Why not copy `.so` files by hand into `glibc-dynamic`:

- **It breaks on version bumps.** The current branch fails to build (`libpoppler.so.163` became `.166`). Even after that fix, `pdftotext` cannot load `libharfbuzz-subset`.
- **Scanners can't see hand-copied files.** With `apk --root`, the image keeps the `apk` package database, so Anchore, Grype, Trivy and the SBOM all see poppler and its libraries.
- **It drops data files.** Packages bring their own data; `unrtf`, for example, needs `/usr/share/unrtf`.
- **Cost.** About +57 MB, measured. To reduce it, ask Chainguard to split `poppler-utils` so only `pdfinfo` and `pdftotext` are installed.

## PDF fix

- `docconv` runs **both** `pdfinfo` and `pdftotext`. If either fails, it falls back to the pure-Go `mattermost/pdf` extractor, which cannot decode predefined CJK CMaps. Both `#38552` and the current branch ship only `pdftotext`.
- Install `poppler-utils`, plus the poppler-data `cMap` and `cidToUnicode` directories. These are downloaded at a pinned version with a SHA-256 check, because Wolfi has no poppler-data package. Drop the download once Wolfi ships one.
- The `unrtf` and `tidy-html5` packages work once installed as whole packages.
- **Known limitation:** `.doc` (`wv`) stays broken. `wvText` is a `/bin/sh` script and the image has no shell, and `docconv` ignores the error and indexes the file as empty. `wv` is kept for parity, and its e2e test is marked `test.fail()`.
- **Out of scope:**
  - CJK search of file content on Postgres. `file_info_store.go` uses `to_tsvector`; the `CJKSearch` LIKE path only covers posts.
  - CMap support in `mattermost/pdf`.

## Tests

| Test | Where | Proves |
|---|---|---|
| Smoke check before push | `.github/workflows/server-ci-artifacts.yml` | `pdfinfo` and `pdftotext` start in the image; the image is pushed only if they do |
| PDF canary | `e2e-tests/playwright/specs/functional/channels/search/pdf_file_content_search.spec.ts` | `pdf-cmap-canary.pdf` uses `UniJIS-UCS2-H` with no `ToUnicode`, so it is found only when `pdfinfo`, `pdftotext` and the CMaps all work. The Go fallback yields NUL-interleaved bytes. |
| `.doc` search | `…/doc_file_content_search.spec.ts` | Documents the `.doc` limitation (`test.fail()` on this branch) |

Acceptance check on a built image (each command must print text):

```bash
IMG=<image>
docker run --rm -v "$PWD/server/tests:/t:ro" --entrypoint /usr/bin/pdfinfo   $IMG /t/sample-doc.pdf
docker run --rm -v "$PWD/server/tests:/t:ro" --entrypoint /usr/bin/pdftotext $IMG -q /t/sample-doc.pdf -
docker run --rm -v "$PWD/e2e-tests/playwright/asset:/a:ro" --entrypoint /usr/bin/pdftotext $IMG -q -enc UTF-8 /a/pdf-cmap-canary.pdf -
docker run --rm -v "$PWD/server/tests:/t:ro" --entrypoint /usr/bin/unrtf     $IMG --nopict --text /t/sample-doc.rtf
docker run --rm --entrypoint /usr/bin/tidy $IMG -v
```

The failing baseline is proven on a separate branch that is not meant to be merged: `nasimoes-container-e2e-extraction-proof`. It contains only these tests, run against the current image.
