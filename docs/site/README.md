# Mattermost Documentation Site

Docusaurus workspace for [docs.mattermost.com](https://docs.mattermost.com),
living in the [mattermost/mattermost](https://github.com/mattermost/mattermost)
monorepo at `docs/site/`.

## Content layout

| Directory | Route | Description |
|---|---|---|
| `docs/main/` | `/` | User and admin documentation |
| `docs/develop/` | `/developers` | Developer documentation |
| `docs/api/` | `/api` | API reference intro + generated OpenAPI pages |

Paths are relative to the repository root. The Docusaurus site reads them
via the relative paths `../main`, `../develop`, `../api` (from `docs/site/`).

## Prerequisites

- Node.js ≥ 20 — use `nvm use` inside `docs/site/` to pick up `.nvmrc`
- Go (required only for the OpenAPI prebuild step — see below)
- `make` (for convenience targets and the OpenAPI build)
- Vale ≥ 3 (for content linting)

## Local development

```shell
cd docs/site
npm ci
npm start          # dev server at http://localhost:3000
```

Or via Make (from the repo root):

```shell
make -C docs docs-install
make -C docs docs-dev
```

### Sidebar generation

The `documentation` and `developers` sidebars are generated from the content
directories (`sidebars/documentation.generated.json` /
`developers.generated.json`, both gitignored) by `npm run build:sidebars`.
Docusaurus imports these files directly, so **they must exist before
`docusaurus start` or `docusaurus build` runs** — on a fresh checkout there's
no other source for them. This is wired automatically via the `prestart` and
`prebuild` npm lifecycle hooks, so plain `npm start` / `npm run build` just
work.

(`sidebars/active-redirects.json`, by contrast, *is* committed — it's
regenerated and checked in manually via `node scripts/gen-active-redirects.mjs`
when the legacy redirect map changes, not on every build.)

### Full production build

The production build also includes an OpenAPI prebuild step (`npm run
build:openapi`, wired to run automatically before `npm run build` via the
same `prebuild` hook) that invokes `make -C api build`. This requires Go and
takes ~2 minutes.

```shell
cd docs/site
npm ci
npm run build      # runs build:sidebars + build:openapi (via prebuild), then Docusaurus build
```

To skip the OpenAPI rebuild during iterative content work:

```shell
cd docs/site
npm run build -- --no-minify   # still runs build:sidebars + build:openapi first
```

If you need to bypass the prebuild step entirely (e.g., all generated
artifacts already exist and are current), run:

```shell
cd docs/site
npm run docusaurus build       # calls docusaurus directly, skips prebuild
```

### Algolia search

There's a single Algolia DocSearch app for `docs.mattermost.com` — credentials
aren't distributed to individual developers. They're set as repository
variables (`vars.ALGOLIA_APP_ID`, `vars.ALGOLIA_SEARCH_API_KEY`) and injected
only in CI/CD. Local builds simply run without them: the site builds cleanly
and the search bar is omitted (see the conditional in
`docusaurus.config.ts`).

If you need to test search locally, export the same two variables in your
shell before running `npm start`/`npm run build`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Dev server with hot reload (runs `build:sidebars` first via `prestart`) |
| `npm run build` | Production build to `build/` (runs `build:sidebars` + `build:openapi` first via `prebuild`) |
| `npm run build:sidebars` | Regenerate the documentation + developer sidebar JSON |
| `npm run build:openapi` | Regenerate the OpenAPI bundle only |
| `npm run serve` | Serve the `build/` output locally |
| `npm run typecheck` | TypeScript type check |
| `node scripts/gen-active-redirects.mjs` | Regenerate legacy redirect map (committed to git; run manually when it changes) |

## Make targets

Run from the repo root (`make -C docs <target>`) or from `docs/` (`make <target>`):

| Target | Description |
|---|---|
| `docs-install` | `npm ci` in `docs/site` |
| `docs-dev` | Start dev server |
| `docs-build` | Production build |
| `docs-serve` | Serve production build |
| `docs-lint` | Vale lint on all content directories |
