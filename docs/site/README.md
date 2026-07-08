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

### Full production build

The production build includes an OpenAPI prebuild step (`npm run
build:openapi`, wired to run automatically before `npm run build` via npm's
`prebuild` lifecycle hook) that invokes `make -C api build`. This requires
Go and takes ~2 minutes.

```shell
cd docs/site
npm ci
npm run build      # runs build:openapi (via prebuild) then Docusaurus build
```

To skip the OpenAPI rebuild during iterative content work:

```shell
cd docs/site
npm run build -- --no-minify   # still runs build:openapi first
```

If you need to bypass the OpenAPI step entirely (e.g., the api/Makefile
output already exists and is current), run:

```shell
cd docs/site
npm run docusaurus build       # calls docusaurus directly, skips build:openapi
```

### Algolia search (local)

Copy `.env.local.example` to `.env.local` and fill in credentials:

```shell
cp .env.local.example .env.local
# edit .env.local: set ALGOLIA_APP_ID and ALGOLIA_SEARCH_API_KEY
```

Without credentials the site builds cleanly — the search bar renders as an
inert box. In GitHub Actions, credentials are set as repository variables
(`vars.ALGOLIA_APP_ID`, `vars.ALGOLIA_SEARCH_API_KEY`) and injected at
build time.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Dev server with hot reload |
| `npm run build` | Production build to `build/` |
| `npm run build:openapi` | Regenerate the OpenAPI bundle only (runs automatically before `npm run build` via the `prebuild` hook) |
| `npm run serve` | Serve the `build/` output locally |
| `npm run typecheck` | TypeScript type check |
| `node scripts/gen-documentation-sidebar.mjs` | Regenerate documentation sidebar JSON |
| `node scripts/gen-active-redirects.mjs` | Regenerate legacy redirect map |

## Make targets

Run from the repo root (`make -C docs <target>`) or from `docs/` (`make <target>`):

| Target | Description |
|---|---|
| `docs-install` | `npm ci` in `docs/site` |
| `docs-dev` | Start dev server |
| `docs-build` | Production build |
| `docs-serve` | Serve production build |
| `docs-lint` | Vale lint on all content directories |
