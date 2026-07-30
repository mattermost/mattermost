# Plan: restore generated Plugin SDK reference pages

## Status

Implemented (all four phases). See branch `docs/plugin-sdk-reference-migration`.

Notable deviations from the plan as written, discovered/decided during implementation:

- **Open question 1 (Go toolchain) resolved by avoiding the need for one.** Both Go generators
  parse their target packages with `go/parser` + `go/doc` instead of type-checking them via
  `golang.org/x/tools/go/packages` (as the old shortcode generators did). This means they have no
  dependency on the Go toolchain version declared in `server/public/go.mod` (which the local dev
  toolchain didn't satisfy, and downloading a matching toolchain wasn't reliably possible in this
  environment) — only stdlib, no network, no `go.sum`. CI already provisions a Go toolchain
  matching `api/server/go.mod` for the OpenAPI prebuild step, which happens to already satisfy
  `server/public/go.mod` too, but the generators don't rely on that.
- **Open question 2 (paths) confirmed unchanged**: `server/public/plugin`,
  `server/public/model` (for `Manifest`), and `webapp/channels/src/plugins/registry.ts` all still
  exist at the paths the plan assumed.
- **No `Helpers` interface exists in `server/public/plugin` today** (only `API` and `Hooks`). The
  generator/component still support it (in case it's reintroduced) but render nothing for it.
- **`plugin-jsdocs` generator uses the TypeScript compiler API**, not
  `@typescript-eslint/typescript-estree`, to avoid adding a new dependency — `typescript` was
  already a `docs/site` devDependency.
- **Method/example signatures render via the site's standard `<CodeBlock>`** (real Prism syntax
  highlighting) rather than the old shortcode's raw `<pre><code>` HTML with inline pkg.go.dev links
  baked into parameter/result types. This trades those inline type links for consistent theming
  (including dark mode) and real highlighting; TOC entries still link down to each method's full
  docs.

## Background

Three pages in the new Docusaurus developer docs (`docs/develop/...`) were left as stub
placeholders during the migration from the old Hugo-based `mattermost-developer-documentation`
repo, because their content was never static prose — it was generated at Hugo build time by a
custom shortcode that parsed live source code (Go doc comments / a TypeScript file) into a full
API reference.

All three currently render only this placeholder:

```mdx
<Note title="Generated content (migrating)">

This section was rendered by the Hugo `<shortcode>` shortcode from the upstream plugin reference. Migration follow-up — see PLAN.md §11.2.

</Note>
```

Affected pages (all in this repo, `mattermost/mattermost`):

| Page | File | Old shortcode | Renders |
|---|---|---|---|
| Server plugin SDK reference | `docs/develop/integrate/reference/server/server-reference.md` | `plugingodocs` | Full `API` / `Hooks` / `Helpers` interface reference for the Go plugin package, ~3,300 lines rendered |
| Web app plugin SDK reference | `docs/develop/integrate/reference/webapp/webapp-reference.md` | `pluginjsdocs` | Method reference for the JS/TS plugin registry |
| Manifest reference | `docs/develop/integrate/plugins/manifest-reference.md` | `pluginmanifestdocs` | Field-by-field docs for `plugin.json`'s schema |

There's also one inline, single-use instance of a fourth shortcode, not a whole page:

- `docs/develop/integrate/plugins/components/server/hello-world.md` (~line 40) has an
  unconverted `{{<plugingoexamplecode name="_helloWorld">}}` call (currently left as a raw
  HTML-escaped comment) that should render one Go example's source code inline.

The live legacy site (https://developers.mattermost.com/integrate/reference/server/server-reference/)
still serves the old, fully generated version and can be used as a visual/content reference for
what "done" looks like, alongside the shortcode source below.

## Goal

Reimplement the generation + rendering pipeline natively in the Docusaurus site so these three
pages (and the one inline example) render the full generated reference again, and remove the
"Generated content (migrating)" placeholders.

## Key simplification vs. the old repo

The old `mattermost-developer-documentation` repo was **separate** from the server source, so its
generators had to import the plugin package as an external Go module dependency, or fetch
`registry.ts` from GitHub over HTTP at build time. In this repo, `docs/site` lives in the same
monorepo as the source it documents:

- `server/public/plugin` (Go SDK: `API`, `Hooks`, `Helpers` interfaces) — for the server reference.
- `webapp/channels/src/plugins/registry.ts` (TS plugin registry) — for the web app reference.
- Plugin manifest struct — same Go module.

So the new generators can read local files directly. No network fetch, no external module
dependency, no version-skew risk between the docs and the code they document.

## Source material to port (read these before implementing)

All paths below are in the **`mattermost-developer-documentation`** repo (a sibling workspace
folder in this environment, at `/Users/evasarafianou/projects/mattermost-developer-documentation`
if available; otherwise clone `github.com/mattermost/mattermost-developer-documentation`).

1. **Server SDK reference** (`plugingodocs`):
   - Generator: `cmd/plugin-godocs/plugin-godocs.go` — walks the `server/public/plugin` package
     with `golang.org/x/tools/go/packages` + `go/doc`/`go/ast`, and emits a JSON document with
     shape `{HTML, API, Hooks, Helpers, Examples}` where each interface has `{HTML, Tags, Methods:
     [{Name, Tags, HTML, Parameters, Results}]}`.
   - Renderer: `site/layouts/shortcodes/plugingodocs.html` — a Hugo template. Read this closely;
     it defines the exact structure to reproduce: an intro doc, then API/Hooks/Helpers sections
     each with a category-grouped TOC (grouping is driven by `@tag` comments in the Go doc
     comments, see the `tags()` func in the generator), followed by full per-method docs
     (signature + doc HTML), followed by an Examples section.
   - Companion single-example shortcode: `site/layouts/shortcodes/plugingoexamplecode.html`
     (needed for the `hello-world.md` inline case).

2. **Web app SDK reference** (`pluginjsdocs`):
   - Generator: `scripts/plugin-jsdocs.js` — parses `registry.ts` with
     `@typescript-eslint/typescript-estree`, extracts `PluginRegistry` class methods/properties
     and their leading JSDoc comment blocks, emits `[{Name, Parameters, Comments}]`. **Update the
     fetch to instead read the local file** at `webapp/channels/src/plugins/registry.ts` (relative
     path from `docs/site`, e.g. `../../webapp/channels/src/plugins/registry.ts`).
   - Renderer: `site/layouts/shortcodes/pluginjsdocs.html` — simpler than the Go one: just a TOC
     + per-method signature/doc blocks, no categorization.

3. **Manifest reference** (`pluginmanifestdocs`):
   - Generator: `cmd/plugin-manifest-docs/plugin-manifest-docs.go` — read this to find the
     `Schema`-shaped JSON it emits (`{Type, ObjectProperties/ValueSchema, DocHTML}` recursively).
   - Renderer: `site/layouts/shortcodes/pluginmanifestdocs.html` — recursive TOC + docs list over
     the schema tree.

4. Cross-reference the still-live legacy pages for expected visual output:
   - https://developers.mattermost.com/integrate/reference/server/server-reference/
   - https://developers.mattermost.com/integrate/reference/webapp/webapp-reference/
   - https://developers.mattermost.com/integrate/plugins/manifest-reference/

## Existing conventions to follow in `docs/site`

This site already has an established "generate data at build time, consume it in the page" model
— follow it rather than inventing a new one:

- `docs/site/scripts/stage-agents-docs.mjs` + `npm run stage:agents-docs` — a prebuild data/content
  staging step.
- `docs/site/scripts/build-openapi.mjs` + `docusaurus gen-api-docs mattermost` — generates API doc
  pages from a spec at build time.
- Wiring lives in `docs/site/package.json`'s `prestart`/`prebuild` scripts (`npm run
  build:sidebars && ... && npm run build:openapi:docs`, etc.) — new generators should be added as
  their own `npm run build:plugin-godocs`-style scripts and appended to both `prestart` and
  `prebuild`.
- Custom rendering for structured/generated content elsewhere in this site is done via React
  components (e.g. `docs/site/src/components/CompassIcon`, `docs/site/src/components/CardGrid`),
  consumed from MDX. Follow that pattern here rather than hand-writing HTML strings.

## Proposed implementation (per page)

### Phase 1 — Server plugin SDK reference

1. Add a small Go generator at `docs/site/scripts/gen-plugin-godocs/main.go` (module-local import
   of `github.com/mattermost/mattermost/server/public/plugin`, no external fetch needed) that
   reproduces `cmd/plugin-godocs/plugin-godocs.go`'s output shape, writing JSON to e.g.
   `docs/site/data/plugin-godocs.json` (gitignored, like the old `PluginGoDocs.json`).
2. Add `"build:plugin-godocs": "go run ./scripts/gen-plugin-godocs > data/plugin-godocs.json"` to
   `docs/site/package.json`, and add it to `prestart`/`prebuild`.
3. Build a React component (e.g. `docs/site/src/components/PluginGoDocs/index.tsx`) that imports
   the generated JSON and renders it: intro doc, three category-grouped TOC sections (API / Hooks
   / Helpers, grouped by `@tag`), full per-method docs, and an Examples section. Port the
   rendering logic from `plugingodocs.html`'s Go templates (type-string formatting for
   parameters/results, interface TOC grouping by tag, etc.) into TSX/JS.
4. Swap the `<Note title="Generated content (migrating)">` block in
   `docs/develop/integrate/reference/server/server-reference.md` for `<PluginGoDocs />`.
5. Handle the inline example case in `docs/develop/integrate/plugins/components/server/hello-world.md`
   (currently a commented-out TODO around line 40) with a small companion component/prop (e.g.
   `<PluginGoExample name="_helloWorld" />`) reading from the same generated JSON's `Examples` map.

### Phase 2 — Web app plugin SDK reference

1. Add `docs/site/scripts/gen-plugin-jsdocs.mjs`, porting `scripts/plugin-jsdocs.js` but reading
   `webapp/channels/src/plugins/registry.ts` locally instead of fetching from GitHub. Output JSON
   to `docs/site/data/plugin-jsdocs.json`.
2. Wire into `package.json` as `build:plugin-jsdocs`, add to `prestart`/`prebuild`.
3. React component `docs/site/src/components/PluginJsDocs/index.tsx` rendering the TOC + per-method
   signature/doc blocks (mirrors `pluginjsdocs.html`).
4. Swap the placeholder in `docs/develop/integrate/reference/webapp/webapp-reference.md` for
   `<PluginJsDocs />`.

### Phase 3 — Manifest reference

1. Add `docs/site/scripts/gen-plugin-manifest-docs/main.go`, porting
   `cmd/plugin-manifest-docs/plugin-manifest-docs.go`. Output to
   `docs/site/data/plugin-manifest-docs.json`.
2. Wire into `package.json` as `build:plugin-manifest-docs`, add to `prestart`/`prebuild`.
3. React component `docs/site/src/components/PluginManifestDocs/index.tsx`, recursively rendering
   the schema tree (TOC + docs), mirroring `pluginmanifestdocs.html`.
4. Swap the placeholder in `docs/develop/integrate/plugins/manifest-reference.md` for
   `<PluginManifestDocs />`.

### Phase 4 — Cleanup

- Remove all three "Generated content (migrating)" `<Note>` blocks once their replacements render
  correctly.
- Add the three new `data/*.json` outputs to `.gitignore` (they're build artifacts, same as the
  old repo's `.gitignore` entries).
- Update `docs/site/README.md` if it documents the build/prebuild steps for contributors (check
  whether it needs a `go` toolchain callout, since two of the three generators are Go programs).

## Acceptance criteria

- [x] All three pages render full generated content locally (`npm run start` and `npm run build`
      both succeed and produce the expected sections) with no leftover placeholder `<Note>`.
      Verified via `npx docusaurus build`: all three pages plus `hello-world.md` built with real
      content in `build/`. (Build had two pre-existing, unrelated failures — an HTML-minifier
      error on `administration-guide/upgrade/important-upgrade-notes` and a sidebar-context error
      on `/api/reference/scheduled-recaps` — present on `master` and untouched by this change.)
- [x] Server reference: API/Hooks sections present (no `Helpers` interface exists currently, see
      Status above), grouped correctly by category/tag, with working in-page anchor links from the
      TOC to each method's full docs.
- [x] Web app reference: full method list (68 methods) from `registry.ts` with signatures and
      JSDoc comments rendered via `<CodeBlock>`, inheriting the site's existing dark-mode code
      block theming rather than needing new CSS.
- [x] Manifest reference: nested schema renders correctly (arrays/dicts/objects), TOC links work.
- [x] `hello-world.md`'s inline example renders the actual Go source (`<PluginGoExample
      name="_helloWorld" />`) instead of the raw escaped TODO comment.
- [x] New generator scripts run correctly in CI — no workflow changes needed. `docs-ci.yaml`,
      `docs-cd.yml`, and `docs-preview-template.yml` already provision Go via
      `go-version-file: api/server/go.mod` (>= 1.26.4) for the OpenAPI step, which the new Go
      generators piggyback on (and don't strictly require, per Status above).
- [x] No regression to existing prebuild steps (`stage:agents-docs`, sidebars, OpenAPI docs) — ran
      alongside them successfully; new steps appended after, per convention.

## Non-goals / out of scope

- Redesigning the visual layout beyond matching (or improving on) the legacy Hugo output — this is
  a content-restoration task, not a UX redesign.
- Migrating any other still-open Hugo shortcodes not listed above (audit the two source repos for
  any other `{{<...>}}` shortcode usages left unconverted if scope needs to expand later; this plan
  only covers the four confirmed instances found during initial investigation).

## Open questions for the implementing agent to confirm early

1. Is a Go toolchain available/acceptable in the docs site's build environment (local dev, CI, and
   any deploy preview pipeline)? If not, the Go-based generators (Phases 1 and 3) may need to be
   ported to a non-Go approach (e.g. shelling out to `go doc -json` differently, or a small
   long-lived pre-generated JSON checked into the repo and refreshed periodically instead of
   generated on every build).
2. Confirm current relative paths from `docs/site` to `server/public/plugin` and
   `webapp/channels/src/plugins/registry.ts` haven't moved (this repo has had large doc/dir
   reorganizations recently, e.g. see the July 2026 `deployment-guide` restructuring).
