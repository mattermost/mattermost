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
- Go and `make` (required only for the OpenAPI prebuild step — see below)
- Vale ≥ 3 (for content linting)

## Local development

```shell
cd docs/site
npm ci
npm start          # dev server at http://localhost:3000
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

The API reference section (`docs/api/reference/`, also gitignored) has the
same requirement: `docusaurus-plugin-openapi-docs` needs `docusaurus
gen-api-docs mattermost` run before it has any pages to render. `prestart`
handles this too — using the existing OpenAPI spec if present, only falling
back to the slow `make -C api build` spec rebuild if it's missing.

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
| `npm start` | Dev server with hot reload (runs `build:sidebars` + `build:openapi:docs` first via `prestart`) |
| `npm run build` | Production build to `build/` (runs `build:sidebars` + `build:openapi` first via `prebuild`) |
| `npm run build:sidebars` | Regenerate the documentation + developer sidebar JSON |
| `npm run build:openapi:spec` | Regenerate the OpenAPI spec only (slow — invokes `make -C api build`) |
| `npm run build:openapi:docs` | Regenerate the API reference MDX pages from the existing spec (fast) |
| `npm run build:openapi` | Full OpenAPI pipeline: spec then docs |
| `npm run serve` | Serve the `build/` output locally |
| `npm run typecheck` | TypeScript type check |
| `node scripts/gen-active-redirects.mjs` | Regenerate legacy redirect map (committed to git; run manually when it changes) |

## Content linting

```shell
vale main develop api
```
