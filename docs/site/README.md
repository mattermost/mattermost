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

#### Manual grouping overrides

Most top-level sections build their sidebar straight from the filesystem:
each subdirectory becomes a category, each file a doc, sorted by
`sidebar_position` frontmatter then filename. But a few sections are flat
piles of 15-40 files (or split across an inconsistent filesystem nesting
that doesn't reflect any real grouping) that read badly as-is, so
`gen-documentation-sidebar.mjs` layers a **manual grouping override** on
top of the auto-generated tree for those sections only: Overview
(`OVERVIEW_GROUPS`/`OVERVIEW_ROOT_ORDER`), Deployment Guide
(`DEPLOYMENT_GROUPS`/`DEPLOYMENT_ROOT_ORDER`), Administration Guide →
Configure (`ADMIN_CONFIGURE_GROUPS`/`ADMIN_CONFIGURE_ORDER`),
Administration Guide → Manage (`ADMIN_MANAGE_GROUPS`/`ADMIN_MANAGE_ORDER`),
and Integrations Guide (`INTEGRATIONS_GROUPS`/`INTEGRATIONS_ROOT_ORDER`).

The override only changes how the sidebar renders — files stay flat on
disk at their existing paths, so URLs don't move. Each override is a pair
of constants near the top of the script:

- A `*_GROUPS` map of group key → `{label, landing?, items}`, where `items`
  are doc basenames (relative to that section's directory) or nested
  inline group objects.
- A `*_ROOT_ORDER`/`*_ORDER` array listing the top-level order: plain
  strings for standalone docs, `{group: 'key'}` for a group from the map
  above.

**Adding a new file to one of these sections:** the script fails loudly if
you forget it — it logs a `WARN: N file(s) missing from *_ORDER` and falls
back to appending the orphaned file(s) at the root of that section, so a
forgotten file surfaces as a warning during `npm run build:sidebars`
rather than silently disappearing. Add the new file's basename to the
relevant group's `items` (or to the root order array, if it's a
standalone/uncategorized page) to place it deliberately instead of
leaving it at the root.

**Adding a whole new manually-grouped section:** copy the pattern of an
existing one (Integrations Guide is the simplest example), then wire it
into `main()` alongside the existing `dir === '...'` checks.

**Nesting a doc from one section under a page in another section:** most
group `items` are plain basenames relative to that section's own
directory, but `buildAdminConfigureItem` also accepts `{doc: '<full id>'}`
for cross-directory references (their label is read directly from the
target file's frontmatter via `docLabelById`, since it won't be in that
section's `leafLabels` map). This is how `ADMIN_CONFIGURE_GROUPS.agents`
nests the vendored Agents plugin pages (`main/agents/docs/`, staged by
`stage-agents-docs.mjs` — not one of the `TOP_LEVEL` sections, so it has
no top-level nav entry of its own) under
`administration-guide/configure/agents-admin-guide`. The same page is
also nested for End User Guide's `end-user-guide/agents` doc, but since
that section has no manual grouping override at all, it uses the smaller
standalone `promoteDocToCategory` helper instead of a full `*_GROUPS`
override — copy that pattern for other one-off single-doc nestings rather
than building a whole grouping override for a section that's otherwise
fine auto-generated.

**Inlining another doc's content onto a page** (rather than just linking
or nesting it): Docusaurus's built-in [Markdown
partials](https://docusaurus.io/docs/next/create-doc#markdown-partials)
feature — any `.md`/`.mdx` file with a leading underscore in its name is
excluded from the docs plugin's routing/sidebars and can be `import`ed
into another MDX file and rendered as `<Component />`. `stage-agents-docs.mjs`
uses this to reproduce Sphinx's `.. include:: /agents/docs/admin_guide.md`
behavior: it stages `admin_guide.md`/`user_guide.md` as normal (but
`unlisted: true`) docs for direct-link parity, *and* as
`_admin_guide_partial.mdx`/`_user_guide_partial.mdx` partials that
`administration-guide/configure/agents-admin-guide.mdx` and
`end-user-guide/agents.mdx` import and render inline — so those two pages
show the full vendored guide content directly, with zero extra clicks,
instead of just linking out to a separate page.

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
