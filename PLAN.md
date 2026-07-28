# AI-Driven i18n Overhaul — v12

Status: draft, iterating.

## Goal

Move translation ownership from a community-driven Weblate pipeline to an
AI-assisted, source-of-truth-in-repo model. Every supported locale reaches
100% coverage once (paid for in Cursor/Fable credits), and stays at 100%
because new strings ship with their translations in the same PR.

## Current state (as of this branch)

- **Supported locales (22)**: hard-coded in two places that must stay in
  sync — `webapp/channels/src/i18n/i18n.ts` (`languages` object) and
  `server/public/shared/i18n/i18n.go` (`supportedLocales`). Several are
  already labeled `(Alpha)`/`(Beta)` in their own display name.
- **Experimental locales**: `webapp/channels/src/i18n/imports.ts` lists many
  more locale JSON files than the 22 supported ones (64 files present vs. 22
  supported). These are only exposed when
  `EnableExperimentalLocales` is on. `server/i18n/` has 55 files — not the
  same set as webapp's 64. Server and webapp are already out of sync with
  each other.
- **Source of truth today**: `en.json` is already hand-maintained
  (`make i18n-extract` regenerates it from source in required order). All
  other locale files are Weblate-managed; `CONTRIBUTING.md` explicitly says
  not to hand-edit them.
- **Weblate**: translate.mattermost.com, feeds back via a webhook
  (referenced in `docs/site/static/images/weblate-incoming-webhook.png`).
- No existing CI check enforces key-parity between `en.json` and other
  locale files (confirmed by absence of such a check in `i18n.test.ts` /
  Makefile targets reviewed so far).
- **Handbook page** (`mattermost/mattermost-handbook`, file
  `contributors/join-us/localization.md`, published at
  https://handbook.mattermost.com/contributors/ways-to-contribute/localization):
  - Lists **five separate Weblate translation projects**, not just Channels:
    Channels, Playbooks, Desktop app, Mobile app (v2), and Calls. Each is a
    different repo with (presumably) its own locale files and Weblate
    config. **All five have since been surveyed** — see the Desktop, Calls,
    and Playbooks entries below (Channels/server and Mobile were already
    covered above).
  - States explicitly: *"Please don't attempt to submit translations in
    GitHub via pull requests (PRs) as your translations will be overwritten
    with the next PR update."* This is the current published policy on
    GitHub-PR translation submissions.
  - Documents a promotion pipeline for "work-in-progress" languages: a WIP
    language becomes officially supported after hitting Beta translation
    quality for 3 consecutive releases *and* having a language expert
    committed for 6+ months of maintenance. Dropping all non-supported
    locales (decision #1) means retiring this whole pipeline, not just
    deleting files.
  - Names two individuals (John Combs, Tom De Moor) as the contacts for
    supported-language permissions/access — the most concrete lead so far
    for the "who signs off on the Weblate sunset" open question, though
    their involvement/roles need reconfirming rather than assumed current.
  - Links to per-language translation rules/glossaries (e.g. German, French)
    maintained by community language leads — worth feeding into a future
    bulk translation pass so the AI output doesn't regress established
    terminology choices.
- **Mobile** (`mobile/`, separate worktree/repo):
  - `app/i18n/languages.ts` lists the same 22 locale codes as webapp/server's
    supported list — good news, the *set* already agrees across all three
    codebases.
  - `assets/base/i18n/` has 64 locale JSON files (same total count as
    webapp's full set) but a **different filename convention**: mobile uses
    underscores for region/script subtags (`en_AU.json`, `kk_Latn.json`,
    `nb_NO.json`) where webapp/server use hyphens (`en-AU.json`,
    `kk-Latn.json`, `nb-NO.json`). Any cross-repo parity/coverage tooling
    needs to normalize this, not diff filenames literally.
  - **iOS native localization** (`ios/Mattermost/i18n/*.lproj/{InfoPlist,
    Localizable}.strings`, Apple's native strings format, not JSON): 22
    locale folders exist, but the **set doesn't match** the JS-side 22 — it
    has `ar` (Arabic) but not `vi` (Vietnamese), which is in the JS list.
    All `.strings` files inspected (including `en`) are currently 0 bytes —
    likely generated/populated at build time rather than hand-maintained,
    but this needs confirming before deciding if it's in scope.
  - **Android** has no per-locale native strings — only a single default
    `android/app/src/main/res/values/strings.xml` (`values-night` is a
    dark-mode qualifier, not a locale). Android localization is handled
    entirely through the JS bundle.
  - Mobile's own checked-in `CLAUDE.md` currently states, as a hard local
    rule: *"CRITICAL: Only update en.json - never modify other language
    files or Weblate gets corrupted."*
  - Mobile's `CLAUDE.md` also says *"Never commit any planning markdown
    files"* — this is a mobile-repo-local rule, so it doesn't block
    committing `PLAN.md` into `platform/` (a different repo). **Superseded**:
    `PLAN.md` originally lived at the worktree root for this reason; it now
    lives at `platform/PLAN.md` and is committed there, since the plan is
    meant to be the source of truth for actions across all repos, not just
    a scratch doc kept outside version control.
- **Desktop** (`desktop/`, separate worktree/repo, `mattermost/desktop`):
  - `i18n/i18n.ts` `languages` object lists the **same 22 locale codes**,
    same order, as webapp/server/mobile — four-for-four agreement on the
    supported *set* now confirmed across every surface.
  - `i18n/` has 64 locale JSON files, same total as webapp/mobile, and uses
    mobile's **underscore convention** (`en_AU.json`, `kk_Latn.json`,
    `nb_NO.json`), not webapp/server's hyphens. So there are two naming
    conventions split evenly: webapp+server use hyphens, mobile+desktop use
    underscores.
  - **Quality labels disagree across surfaces for the same locale** —
    concrete evidence a review pass on existing translations is warranted,
    not just a formality. Examples: Ukrainian is
    `(Alpha)` on desktop but unlabeled on webapp; Korean is `(Alpha)` on
    desktop but unlabeled on webapp; Chinese (Traditional) is unlabeled on
    desktop but `(Beta)` on webapp. These labels are presumably
    hand-maintained per repo and have drifted out of sync with each other.
  - i18n extraction runs through a **shared external tool**,
    `mmjstool i18n extract-desktop` (from `github:mattermost/
    mattermost-utilities`), not a repo-local Makefile target like
    webapp/server. Worth checking whether webapp/mobile also route through
    `mmjstool` under the hood — if so, it's a natural single place to add
    a future key-parity/coverage CI check instead of reimplementing it per
    repo.
  - No Weblate mention in desktop's own `CONTRIBUTING.md`/`README.md` — the
    policy only lives in the handbook page, not repeated locally here.
- **Calls** (`calls/`, plugin repo, `mattermost/mattermost-plugin-calls`):
  - Three i18n locations — `standalone/i18n/`, `webapp/i18n/`,
    `server/i18n/` — and unlike Playbooks/server-webapp elsewhere, **all
    three agree exactly**: same 24 files, same locale set, in each.
  - That 24-locale set is **entirely different from the core 22** — it
    includes locales not supported anywhere else (`ar`, `cs`, `hr`, `lt`,
    `uz`) and is missing many of the core 22 (`en-AU`, `bg`, `hu`, `pt`,
    `ro`...). It's not a subset or superset, it's a different list.
  - Uses a **third filename convention**: script-based Chinese codes
    (`zh_Hans.json`, `zh_Hant.json`) instead of region-based
    (`zh-CN`/`zh-TW` on webapp/server, or their underscore equivalents on
    mobile/desktop), plus underscore region codes elsewhere (`nb_NO`,
    `pt_BR`). Any cross-product locale-matching logic now needs to handle
    three conventions, not two.
  - Has an existing CI precedent worth reusing: `make i18n-extract-check`
    (webapp/standalone) regenerates `en.json` and fails the build via
    `git diff --exit-code` if it's out of date. Same idea as a future
    coverage gate, just currently scoped to `en.json` drift only, not
    cross-locale key parity.
  - Server-side extraction uses **`mmgotool`** (a different shared tool
    from mobile's/desktop's `mmjstool`) — so there are at least two
    separate shared i18n tools across the ecosystem already
    (`mattermost/mattermost-utilities` appears to house both).
- **Syntax-correctness tooling survey (for a future linter)**:
  - All five JS-side i18n surfaces (webapp/channels, mobile, desktop,
    Calls' `webapp`/`standalone`, Playbooks' `webapp`) use `react-intl`/ICU
    MessageFormat — `{count, plural, one {...} other {...}}`,
    `{cond, select, ...}`, and rich-text tag placeholders
    (`&lt;b&gt;{token}&lt;/b&gt;`) are all in active use today (confirmed by
    sampling each repo's `en.json`; webapp alone has 115 `plural` and 7
    `select` uses, Playbooks has a non-boolean `select` example). Desktop
    currently has zero `plural`/`select` usage but still ships `react-intl`.
  - `@formatjs/cli` (the real ICU parser/verifier, published by the
    react-intl team) is already a direct devDependency in
    webapp/channels, Calls' `webapp` and `standalone`, and Playbooks'
    `webapp` — used today only for `extract`/`compile`. **Mobile and
    desktop lack `@formatjs/cli` entirely** (mobile has the runtime
    polyfills and `babel-plugin-formatjs`, desktop has bare `react-intl`)
    — both need it added as a new devDependency for any of this to work
    there.
  - Webapp/channels' `package.json` already defines an
    `i18n-verify-translations` script running
    `formatjs verify './src/i18n/*.json' --source-locale 'en'
    --structural-equality` — **confirmed it is not wired into any CI
    workflow or Makefile target today.** It has existed, unused, this whole
    time.
  - Verified against formatjs's own source
    (`packages/icu-messageformat-parser/manipulator.ts`,
    `isStructurallySame`): structural-equality comparison walks both
    message ASTs and requires the same set of variable/tag *names and
    types*, and separately, `parse()` itself already rejects a plural
    missing its required `other` clause. It does **not** require the
    target locale to reuse the source locale's plural category keys —
    formatjs's own test suite has a case named "structural equality allows
    locale-specific plural branches." So `--structural-equality` is safe to
    use as a hard CI gate: it won't reject a technically-correct Russian
    `few`/`many` plural just because English only has `one`/`other`.
  - Server-side i18n (`platform/server/public/shared/i18n`,
    `platform/server/i18n/*.json`, and the equivalent `server/i18n`
    locations in Calls and Playbooks) uses a **completely different
    syntax**: Go's `text/template`-style `{{.Field}}` interpolation, with
    plurals expressed as a structural `{"one": "...", "other": "..."}` map
    in the JSON rather than embedded ICU syntax. No `@formatjs`-equivalent
    parser/verifier exists for this format — it needs a purpose-built
    check. Also noted in passing: `platform/server/public/shared/i18n` and
    `server/i18n/*.json` use the older `mattermost/go-i18n` v1 fork, while
    `platform/server/public/pluginapi/i18n` (a different surface, the
    plugin API) already uses `nicksnyder/go-i18n/v2` — an existing,
    undocumented library split worth a separate look, not part of this
    linter design.
  - `mmgotool` is vendored in-tree at `platform/tools/mmgotool` and is the
    tool platform's server Makefile already calls for i18n extraction;
    Calls and Playbooks both pull it externally (`go install .../mmgotool`)
    rather than vendoring their own copy — meaning a new subcommand added
    to platform's vendored `mmgotool` would need to be released and
    version-bumped before Calls/Playbooks could pick it up, not something
    they'd get for free from a local change.
- **Translation input context (for a future subagent translation pipeline)**:
  confirmed `en.json` carries zero translator context anywhere today. Webapp's
  `en.json` is a flat `key -> string` map; server's is a flat list of
  `{"id", "translation"}` objects. Neither preserves react-intl's optional
  `description` field — the custom extraction formatter
  (`webapp/channels/scripts/formatter.js`) explicitly keeps only
  `defaultMessage` and drops everything else (`module.exports.format` maps
  each message to `msgs[k].defaultMessage`). Sampled `FormattedMessage` call
  sites directly (e.g. `about_build_modal.tsx`) confirm authors don't set
  `description` in practice either. So a translator — human or AI — sees only
  a dot-namespaced key and the English string, with no signal today about
  where it renders, how much space it has, or what it means in context. This
  is the gap a context-bundle pre-processing step would need to close.
- **Source-location/context tooling feasibility (follow-up investigation)**:
  confirmed adding file/line metadata to the context bundle is cheap on
  every extraction path, because every extractor already walks a real AST
  and currently discards position data it has in hand:
  - `mmgotool` (`platform/tools/mmgotool/commands/i18n.go`): `extractFromPath`
    already parses every `.go` file with `go/parser`+`token.FileSet` and
    `ast.Inspect`s for `T(...)`/`NewAppError(...)`/`TranslationId(...)` call
    sites (~line 375-583). `fset.Position(node.Pos())` gives `{File, Line}`
    for free. The only real change is a schema one: `Translation`/`Item`
    (line 28-36) are hardcoded `{Id, Translation}`; without declaring new
    fields there, the extract command's `json.Marshal`/`Unmarshal`
    round-trip (which silently drops undeclared struct fields) would erase
    any location metadata on the very next `make i18n-extract`. The
    production runtime loader (`go-i18n`, `public/shared/i18n`) parses
    generically into `map[string]interface{}` and only ever reads
    `id`/`translation` back out — it needs zero changes and tolerates new
    fields structurally.
  - `mmjstool` (external, `mattermost/mattermost-utilities`, backs mobile's
    `extract-mobile` and desktop's `extract-desktop`): same shape of
    finding. `src/i18n_extract.js` parses with
    `@typescript-eslint/typescript-estree` and walks
    `CallExpression`/`JSXOpeningElement` nodes for
    `defineMessages`/`FormattedMessage`/etc. Passing `{loc: true, range:
    true}` to `parse()` (not currently passed) yields full position info on
    every node already being visited — same free-data-in-hand shape as
    mmgotool. It's untyped `.js` with no dormant `description`/`file` field
    to repurpose, and it's not a formatjs wrapper (no `@formatjs/*`
    dependency) — an independent hand-rolled extractor that happens to
    share the same AST-based property.
  - `formatjs extract` (webapp, Calls, Playbooks) already supports this
    natively via `--extract-source-location`, plus a `description` field on
    the message descriptor that's simply never populated by any call site
    in this codebase today (confirmed zero real usages of `description:`
    across all six repos, and zero usages of formatjs's `meta:` extraction
    field either).
  - **Hard constraint discovered**: the shipped/compiled `en.json` (and
    every locale file) can never carry this metadata directly. Every
    runtime consumer — webapp's `intl_provider.tsx`, Calls'
    `getTranslations`/`IntlProvider`, Playbooks' `registerTranslations`
    (merged into webapp's same flat translations object), mobile's
    `user_locale`/`_layout.tsx` `IntlProvider` call sites, and desktop's
    renderer `intl_provider.tsx` — hands the parsed JSON straight through as
    `react-intl`'s `messages` prop, which requires flat `Record<string,
    string>` and does not tolerate nested values; this would break message
    rendering outright, not degrade gracefully. Desktop has a second,
    independent break outside react-intl entirely: its main-process
    `i18nManager.ts` calls `.replace()` directly on the translation value,
    which throws on a non-string. This constraint also directly serves the
    goal of not shipping extra metadata to the client on every locale load
    — the shipped file must stay lean regardless of where the metadata ends
    up living.
  - **Calls already has an unused artifact that solves this for free**: its
    build script (`calls/webapp/package.json`, `calls/standalone/
    package.json`) runs `formatjs extract ... --out-file i18n/temp.json &&
    formatjs compile 'i18n/temp.json' --out-file i18n/en.json && rm
    i18n/temp.json` — `temp.json` already carries formatjs's full descriptor
    format (`id`/`defaultMessage`/`description`) and would carry
    `file`/`line` too the moment `--extract-source-location` is added, but
    is generated and immediately deleted today. webapp/channels and
    Playbooks currently extract straight to the flat format in a single
    step and have no such intermediate to repurpose; mobile and desktop
    have no build-time transform step at all (mobile's
    `generate-assets.js` merges straight into the bundled
    `dist/assets/i18n`; desktop imports committed JSON directly).
  - **Industry framing**: this two-tier split — a rich authoring/interchange
    format carrying source references, translator notes, and
    disambiguation context, vs. a lean compiled runtime format with none of
    it — is a long-established localization industry pattern, not a novel
    design. Gettext's PO/POT (`#:` reference comments, `#.` extracted
    comments, `msgctxt`) compiled to binary `.mo`, and XLIFF's `<note>`/
    `<context-group context-type="sourcefile"/"linenumber">` compiled/
    exported to a platform's runtime format, are the two canonical examples.
    formatjs's own extract format already models the same split; Calls is
    already producing the authoring-tier artifact and throwing it away
    instead of treating it as a source of truth.
- **Playbooks** (`playbooks/`, plugin repo, `mattermost/mattermost-plugin-playbooks`):
  - Two i18n locations — `webapp/i18n/` (23 files) and `assets/i18n/` (18
    files) — **not in sync with each other**, the same "frontend has more
    translated locales than what server/shared assets ship" pattern seen in
    core server vs. webapp.
  - Locale set is **yet another list**, different from both the core 22 and
    from Calls's 24 — e.g. includes `kk`, `ml`, `sl`, `mn` (none of which
    are in the core 22 or in Calls), uses the same `zh_Hans`/`zh_Hant`
    script convention as Calls.
  - `server/i18n/` isn't actually a persisted directory — the Makefile
    temporarily copies `assets/i18n/en.json` into `server/i18n/` for
    extraction, then removes it. So "server" translations really live in
    `assets/i18n/`, there's no fourth location.
  - Also uses `mmgotool` for server extraction, `formatjs`/npm for webapp —
    same tooling pattern as Calls.
  - **`zh_Hant.json` is 90% untranslated**: 548 of 608 values are the
    literal English source string, not Chinese (verified by diffing
    against `en.json` key-by-key — e.g. `"Owner"`, `"Select channels"`
    pass through unchanged). `zh_Hans.json` is properly translated (6/608
    coincidental matches, the normal baseline). Confirmed this isn't a
    parsing artifact by checking every other zh file in the ecosystem
    (webapp/desktop/mobile zh-CN/zh-TW, Calls zh_Hans/zh_Hant) — all sit at
    a normal ~0-2% identical-to-English baseline; only Playbooks' zh_Hant
    is an outlier. **This is invisible to a key-existence coverage check**
    (all 608 keys are present) — it would report 100% coverage. A future
    CI gate needs a second signal beyond "key exists" (e.g. flag values
    identical to `en.json`) or this exact failure mode ships silently
    again.

## Decisions locked so far

1. **Locale scope**: keep exactly the current 22 supported locales, and
   **force Calls and Playbooks onto this same 22-locale list too** — not
   just the core product line. Drop all experimental-only/non-matching
   locale files everywhere: `server/i18n/`, `webapp/channels/src/i18n/`,
   mobile's `assets/base/i18n/`, desktop's `i18n/`, Calls' three i18n
   locations, and Playbooks' `webapp/i18n/`/`assets/i18n/`. For Calls and
   Playbooks this means **both adding locales they're currently missing
   from the 22, and dropping locales they have that aren't in the 22**
   (Calls loses `ar`/`cs`/`hr`/`lt`/`uz`; Playbooks loses `kk`/`ml`/`sl`/
   `mn`) — see workstream 1 and open questions for the reconciliation work
   this creates.
2. **Enforcement model (near-term)**: no automated CI-side translator.
   Authors are responsible for including AI-generated translations for all
   22 locales in the same PR that adds/changes `en.json` strings. Tooling to
   *improve the quality* of author-submitted translations is a later
   follow-up, not part of the v12 kickoff.
3. **Scope**: unify all five surveyed codebases — server, webapp, mobile,
   desktop, Calls, and Playbooks — on the same 22-locale list and the same
   coverage bar.
4. **Sequencing**: trim each codebase's locale list to the 22 (workstream 1)
   before running the bulk AI translation pass (workstream 2), so credits
   aren't spent translating locales about to be deleted.
5. **Review methodology for the bulk pass**: back-translation (adversarial
   second-model pass, diffed against original intent) only. Native-speaker
   sampling was considered but not adopted for this pass — can be
   revisited later if back-translation review surfaces quality concerns it
   can't resolve on its own.
6. **Handbook rewrite timing**: `contributors/join-us/localization.md`
   changes only after Weblate is fully off, not before and not
   simultaneously — avoids telling contributors two contradictory things
   during the transition window.
7. **Filename convention**: standardize all six repos on hyphens
   (`en-AU.json`, matching BCP 47 / webapp/server's current style). Rename
   files in mobile, desktop, Calls, and Playbooks to match.
8. **WIP-language/Calls/Playbooks retirement comms**: fold into the general
   Weblate deprecation notice rather than a dedicated separate
   communication.
9. **iOS `.lproj` gap**: out of scope for this plan. It's a pre-existing
   native-wiring bug (permission-prompt strings never connected to
   `InfoPlist.strings`), not a translation-content problem, and predates
   the Weblate migration — file it as a separate ticket rather than fixing
   it here.
10. **Cursor/Fable credit budget**: no hard cap set upfront — run the bulk
    pass and monitor actual spend as it happens, adjusting only if it
    starts running away.
11. **Weblate sunset communication owners**: Katie Wiersgalla and Amy Blais.
    They own the deprecation notice on translate.mattermost.com, the
    general community comms (folding in WIP-pipeline retirement and the
    Calls/Playbooks locale changes per decision #8), and confirming/
    replacing the John Combs / Tom De Moor contacts named in the handbook
    page.
12. **Dropped-locale fallback behavior**: fall back to `en` if no
    translation is available for a user/server's configured locale —
    applies both to locales dropped by this plan and to the existing
    per-string missing-key fallback already in place.
13. **Syntax-correctness linter architecture (replaces Weblate's own
    syntax checks)**: two purpose-built checks, one per syntax family,
    both required — no single tool covers both:
    - **JS side** (webapp, mobile, desktop, Calls' `webapp`/`standalone`,
      Playbooks' `webapp`): standardize on
      `formatjs verify --source-locale en --missing-keys --extra-keys
      --structural-equality`, already proven safe for locale-specific
      plural categories (see Current State). Concretely: turn webapp's
      existing-but-unwired `i18n-verify-translations` script into a real
      CI gate; add `@formatjs/cli` as a new devDependency to mobile and
      desktop (neither has it today) plus the equivalent script; add the
      same CI wiring to Calls (`webapp`, `standalone`) and Playbooks
      (`webapp`), which already have the dependency for
      extract/compile but no verify step.
    - **Go side** (`platform/server`'s two locations, plus Calls' and
      Playbooks' `server`/`assets` i18n): no off-the-shelf equivalent
      exists for the `{{.Field}}`-style syntax. New `mmgotool i18n verify`
      subcommand: parse every value with `text/template` to catch broken
      `{{ }}` syntax, diff the set of `{{.Field}}` tokens between each
      locale value and its `en.json` counterpart for the same key (catches
      dropped/renamed variables), and confirm plural entries carry a
      complete, CLDR-correct category set for their locale rather than a
      copy of English's `one`/`other`. Because Calls and Playbooks pull
      `mmgotool` externally by version rather than vendoring platform's
      copy, this needs an actual release/version bump before either can
      adopt it — not just a local change to `platform/tools/mmgotool`.
    - **Shared, both sides**: neither check catches a value that's
      syntactically valid but literally copied from English — that's the
      separate identical-to-source heuristic already called out in
      workstream 3, and it still needs to exist alongside these, not
      instead of them.
    - Both checks run in two places: as a CI gate on every PR (workstream
      3) and as a validation pass over workstream 2's bulk-translation
      output *before* it lands, so bad AI output is caught at generation
      time rather than only at the next unrelated PR that happens to touch
      that file.
14. **Weblate/workstream-3 overlap window**: no strict ordering requirement
    between disabling the Weblate webhook (workstream 4) and starting to
    accept author-submitted translation PRs (workstream 3). If Weblate
    clobbers a PR-added translation before the webhook is cut, the loss is
    immaterial — AI regeneration is cheap now, unlike under the old
    community-translator model where the same loss meant losing hours of a
    volunteer's work. Re-generate and re-land rather than sequencing around
    it.
15. **Bulk-pass context depth**: full context per key, not just the
    namespace-derived cheap signals. For every key, grep the source tree back
    to its enclosing render call/component and include a snippet in the
    subagent's input — accepted despite the cost of doing this across
    thousands of keys x six repos, since it's a one-time spend already
    covered by decision #10's no-hard-cap stance, and `en.json` itself
    carries no context to shortcut this (see Current State).
16. **Glossary integration**: build it now, not as a later follow-up.
    Community-maintained per-language glossaries (German, French, and any
    others linked from the handbook page) get parsed into
    source-term -> mandated-target-term maps and injected into the bulk
    pass's prompts as hard constraints. Locales without a published glossary
    simply get no constraint — not a blocker for those locales.
17. **Translator-context/source-location architecture**: adopt the
    industry-standard two-tier authoring-format/compiled-runtime-format
    split rather than inventing a bespoke scheme, and never let the shipped
    `en.json`/locale files change shape (a hard requirement, not a
    preference — every JS/TS runtime consumer breaks on a non-string value,
    see Current State). Concretely:
    - **webapp/channels, Calls, Playbooks**: treat formatjs's own extract
      output (`id`/`defaultMessage`/`description`, plus
      `--extract-source-location` for file/line) as the canonical
      authoring-tier artifact, mirroring gettext's `.pot`/XLIFF's role.
      Calls already produces this as `temp.json` and just needs to stop
      deleting it; webapp and Playbooks need their single-step extract
      split into a two-step extract-then-compile pipeline (adopting Calls'
      existing pattern) to get the same intermediate.
    - **mobile/desktop (`mmjstool`) and server (`mmgotool`)**: no
      file-format standard applies directly since neither uses XLIFF/PO,
      but the same architectural split does — emit a new sibling metadata
      file (e.g. `id -> {file, line}`) alongside the existing flat output,
      never merged into the shipped bundle/`assets/i18n`. For `mmgotool`
      this additionally requires declaring the new field(s) on the
      `Translation`/`Item` structs so the extract command's JSON round-trip
      doesn't silently drop them (the production runtime loader needs no
      change either way, since it already parses generically).
    - This authoring-tier artifact becomes a source-location signal for
      workstream 2's context bundle (decision #15), complementing — not
      replacing — the source-grep approach there, since grep remains the
      fallback wherever this tooling hasn't landed yet and can attribute
      location to the specific rendering call site rather than just the
      extractor's own.

## Workstreams

### 1. Finalize and lock the supported-locale list
- Confirm the 22-locale list is final (any additions/removals before the
  one-time spend, since re-running bulk translation later is wasted credit).
- Delete the non-supported locale JSON files from `server/i18n/`,
  `webapp/channels/src/i18n/`, mobile's `assets/base/i18n/`, desktop's
  `i18n/`, Calls' three i18n locations, and Playbooks'
  `webapp/i18n/`/`assets/i18n/`.
- **Calls reconciliation (exact diff computed)**: all three of Calls'
  i18n locations (`standalone/`, `webapp/`, `server/`) are identical, so
  this diff applies uniformly to all three.
  - **Drop** (not in core 22): `ar`, `cs`, `hr`, `lt`, `nb-NO`, `uz`.
  - **Add** (core 22 locales Calls is missing): `bg`, `en-AU`, `hu`, `ro`.
  - Existing Calls translators covering the dropped languages lose that
    support entirely — flag to Katie Wiersgalla / Amy Blais (decision #11)
    as a concrete, user-visible consequence, not just a file deletion.
- **Playbooks reconciliation (exact diff computed)** — Playbooks' two
  locations don't agree with each other today, so the diff differs by
  location:
  - `webapp/i18n/` (23 files) — **drop**: `cs`, `hr`, `id`, `kk`, `ml`,
    `nb-NO`, `sl`. **Add**: `bg`, `it`, `pt-BR`, `ro`, `uk`, `vi`.
  - `assets/i18n/` (18 files) — **drop**: `cs`, `hr`, `id`, `mn`, `nb-NO`.
    **Add**: `bg`, `en-AU`, `es`, `fr`, `it`, `pt-BR`, `ro`, `uk`, `vi`.
  - The two locations also disagree with each other independent of the
    core-22 alignment (`webapp/i18n` has `es`/`fr`/`kk`/`ml`/`sl` that
    `assets/i18n` lacks; `assets/i18n` has `mn` that `webapp/i18n` lacks) —
    resolve this as part of the same pass, not separately.
- **Filename/locale-code normalization (resolved)**: `zh_Hans`→`zh-CN` and
  `zh_Hant`→`zh-TW` confirmed correct by inspecting actual character usage
  — every `zh_Hans`/`zh-CN` file uses simplified characters exclusively and
  every `zh_Hant`/`zh-TW` file uses traditional characters exclusively,
  consistently across webapp, desktop, mobile, and Calls. Rename to the
  locked hyphen convention (decision #7) as part of workstream 1.
- Add `@formatjs/cli` as a new devDependency to mobile and desktop (neither
  has it today — see Current State) and wire up `formatjs verify` in every
  JS repo, plus scaffold the new `mmgotool i18n verify` subcommand — this
  is the syntax-linter tooling from decision #13, and it needs to exist
  *before* workstream 2's bulk pass runs so that pass's own output gets
  validated rather than landing unchecked.
- **Source-location/context tooling** (decision #17): stop deleting Calls'
  `temp.json` and add `--extract-source-location` to its (and, once split,
  webapp/Playbooks') `formatjs extract` step; add `{loc: true, range: true}`
  to `mmjstool`'s `typescript-estree` `parse()` call and thread `file`/`line`
  through its extraction output into a new sibling metadata file (not the
  shipped `en.json`/locale JSON); extend `mmgotool`'s `Translation`/`Item`
  structs (`platform/tools/mmgotool/commands/i18n.go:28-36`) with the same
  fields so its extract command's JSON round-trip stops silently dropping
  them. Needs to land before workstream 2's context-bundle assembly can
  consume it as a signal.
- Remove `EnableExperimentalLocales` / `getAllLanguages(includeExperimental)`
  and related config plumbing (`AvailableLocales` handling stays, since it's
  used to restrict the supported set further, not to add to it).
- Update/regenerate `imports.ts` (`gen-lang-imports` script) and any server
  equivalent so generated files match the trimmed set.
- **User-facing migration concern**: existing users/servers with a
  preference or `AvailableLocales` config pointing at a dropped locale need
  defined fallback behavior (fall back to `en`, presumably) — needs explicit
  handling, not just an accidental blank string.
- iOS native `.lproj` files are confirmed hand-maintained (not
  build-generated) but currently all empty and locale-mismatched (`ar` vs
  `vi`) — see open questions for whether fixing this is in scope for this
  plan or a separate pre-existing bug to file independently.

### 2. One-time bulk translation + review pass
- For the 22 locales × (server + webapp + mobile + desktop + Calls +
  Playbooks), machine-translate every missing key to 100% coverage using
  Fable via Cursor credits. Runs *after* workstream 1's trim/reconciliation
  lands, per the locked sequencing decision.
- Also **review existing translations**, not just fill gaps — this is
  explicitly a quality pass on what Weblate already produced, not just a
  gap-filler. Confirmed concretely necessary, not theoretical: Playbooks'
  `zh_Hant.json` is 90% literal untranslated English today, passing as
  "complete" under a naive key-existence check (see Current State).
- **Review methodology (decided)**: back-translation only — an adversarial
  second-model pass that translates output back to English and diffs
  against original intent, flagging drift. Native-speaker sampling was
  considered and explicitly not adopted for this pass. Back-translation
  should trivially catch cases like Playbooks' zh_Hant (translating
  English "Owner" back to English proves nothing changed), so this
  methodology is sufficient for that specific failure mode.
- Land as a single sweep across all six codebases once workstream 1 is
  complete everywhere.
- Run the syntax linter (decision #13) over this pass's output before
  landing — catches broken ICU/template syntax or dropped placeholders in
  the AI output itself, not just in future author PRs.
- **Subagent input pipeline (context bundle per key)**: `en.json` alone gives
  a translator nothing but a key and an English string (see Current State).
  Before invoking the translation subagent for a given key, assemble a
  structured context bundle rather than passing the raw key/string pair:
  - **Namespace breadcrumb**: split the key on `.` (e.g.
    `admin_console.data_retention.title` -> feature area
    `admin_console` / `data_retention`). Cheap, mechanical, always available
    — the fallback signal even when source-grep below comes back empty (some
    server strings are only ever referenced by string ID, not inline JSX).
  - **Source usage site** (decision #15): grep the codebase for the key's
    reference — `id: '<key>'` inside `FormattedMessage`/`defineMessages`/
    `intl.formatMessage` on the JS side, `id: "<key>"` / `T("<key>")` calls
    on the Go side — and include a snippet of the surrounding component/
    handler code in the bundle. This is what tells the subagent whether it's
    translating a button label, a modal title, a tooltip, a table header, or
    a full error paragraph, which drives register, formality, and how
    tightly to keep the translation — none of that is recoverable from the
    string or key alone.
  - **Extraction-time source-location artifact** (decision #17): in
    addition to the grep above, use each repo's authoring-tier extraction
    artifact (formatjs's `--extract-source-location`-enabled
    `temp.json`/equivalent for webapp/Calls/Playbooks; the new sibling
    metadata file from `mmjstool`/`mmgotool` for mobile/desktop/server) as a
    second, extractor-verified source-location signal — cheaper and more
    precise per call site than a grep once the tooling from workstream 1
    lands, with grep remaining the fallback on any surface where it hasn't.
  - **ICU/placeholder inventory**: extract every `{var}`, `{count, plural,
    ...}` / `{cond, select, ...}` branch, and rich-text tag (`<b>`, `<link>`)
    from the English source, and list them explicitly as tokens the output
    must reproduce unchanged. This pre-empts, rather than only retroactively
    catches, what decision #13's `formatjs verify --structural-equality`
    gate checks after the fact — fewer generations should fail the linter on
    the first try.
  - **Go-side token inventory**: same idea for `{{.Field}}`-style tokens in
    server/`public/shared` strings, feeding the same information the new
    `mmgotool i18n verify` subcommand will later check.
  - **CLDR plural category set for the target locale**: whenever the source
    has a `plural`/map-style plural block, explicitly supply the target
    locale's full correct category list (e.g. Russian's
    one/few/many/other) in the bundle, so the subagent produces the correct
    set instead of defaulting to mirroring English's one/other — same
    concern decision #13 raises for the verifier, applied upstream at
    generation time.
  - **Glossary constraints** (decision #16): scan the English string against
    the parsed per-locale glossary; any matching source term gets its
    mandated target-language translation injected into the bundle as a hard
    constraint, so the AI doesn't reinvent terminology a community language
    lead already settled.
  - **Sibling few-shot examples**: include 3-5 already-translated strings
    from the same namespace segment in the same target locale (preferring
    existing Weblate/human-authored ones where available) as tone/
    terminology anchors, so a batch of related strings doesn't drift in
    register from what's already shipped for that feature area.
  - **Anti-identical-copy guardrail**: explicit instruction that the output
    must not equal the English source verbatim, except for an allowlist of
    terms already confirmed legitimately identical (brand names like
    "Mattermost", proper nouns — the ~0-2% baseline measured across every
    properly-translated locale file in Current State). This is a preventive
    complement to workstream 3's identical-to-source CI heuristic, not a
    replacement for it — Playbooks' `zh_Hant.json` is the concrete failure
    mode both are guarding against, one before generation and one after.
  - **Batching unit**: invoke the subagent per component/file rather than
    per individual key, so sibling strings belonging to the same modal,
    wizard, or settings page are translated together in one call — this
    reinforces the sibling-few-shot mechanism rather than relying on it
    alone, since same-call context is stronger than examples pulled from a
    prior, unrelated invocation.
  - **Reused by workstream 3**: the same bundle-assembly tooling backs the
    ongoing per-PR author workflow, scoped to just the new/changed keys in
    that PR's `en.json` diff rather than a full-repo sweep — cost is bounded
    by the diff size, not by re-running the one-time pass's full scope.
  - **Reused by the back-translation reviewer** (decision #5): the reviewer
    subagent needs the same glossary constraints and sibling examples the
    generator saw, not just the English/candidate-translation pair —
    otherwise a deliberate glossary-driven substitution reads as drift and
    gets incorrectly flagged.

### 3. Author-submitted translation workflow (ongoing)
- PR template / `CONTRIBUTING.md` update, across all six repos (platform,
  mobile, desktop, Calls, Playbooks): any PR adding or changing
  translatable strings must include translations for all 22 locales in the
  same PR, generated by the author via AI.
- Rewrite mobile's `CLAUDE.md` i18n rule (currently "only update en.json,
  never modify other language files") to match the new expectation — this
  is the one codebase where the old rule is explicit and would actively
  block the new workflow if left unchanged.
- Add a CI check that **fails on missing keys** (parity between `en.json`
  and each of the 22 locale files, in every repo) — this is the actual
  "100% coverage" gate; it doesn't generate translations, it just blocks
  merge until they're present. Cheap, deterministic, no flakiness. Calls
  already has a related precedent (`i18n-extract-check` diffing `en.json`)
  worth extending rather than replacing. Needs the filename convention
  normalized per workstream 1 first. Implemented via the same
  `formatjs verify --missing-keys` / `mmgotool i18n verify` tooling as the
  syntax linter below (decision #13), not a separate reimplementation.
- **Syntax-correctness linter** (decision #13): `formatjs verify
  --structural-equality` (JS repos) and the new `mmgotool i18n verify`
  subcommand (Go repos) as a CI gate — catches unparseable ICU/template
  syntax, dropped or mistyped placeholders/tags, and missing plural
  categories, which key-existence checks alone would miss entirely (a key
  can exist and still be broken).
- **Key-existence alone is not enough** — flag any locale value that's
  byte-identical to the `en.json` value for the same key as a likely-
  untranslated placeholder (with an allowlist for legitimately identical
  short strings/product names, since ~0-2% identical is the normal
  baseline observed across every properly-translated locale file surveyed).
  Without this, a PR could add a key with the English string copy-pasted
  into all 22 locale slots and pass the coverage gate — exactly the failure
  mode already found live in Playbooks' `zh_Hant.json`. This check is
  orthogonal to the syntax linter above: a copy-pasted English string is
  syntactically perfect and would pass structural-equality cleanly.
- Document the expected author workflow (what prompt/tool to use) so
  translations are consistent in tone/quality across PRs.
- Later (explicitly out of scope for this kickoff): tooling that reviews or
  scores author-submitted translations for quality automatically.

### 4. Sunset Weblate
- Turn off the Weblate → GitHub webhook/integration.
- Remove Weblate references from `CONTRIBUTING.md` and any other docs.
- Needs a comms/deprecation step on translate.mattermost.com itself for
  existing volunteer translators — this is a community-relations decision,
  not just an engineering cutover, and should get explicit sign-off from
  whoever owns that relationship before flipping it off. John Combs and Tom
  De Moor are named as the supported-language permission contacts in the
  handbook page — likely starting point for that sign-off, pending
  confirmation they're still the right people.
- Retire the WIP-language promotion pipeline (Beta quality × 3 releases + 6
  months of committed language-expert maintenance) documented in the
  handbook — this is a standing community commitment, not just config, so
  it needs an explicit decision to wind down alongside the Weblate cutover.
- Rewrite `contributors/join-us/localization.md` in
  `mattermost/mattermost-handbook` (published at
  https://handbook.mattermost.com/contributors/ways-to-contribute/localization).
  It currently *explicitly tells contributors not to submit translations via
  GitHub PRs* ("your translations will be overwritten with the next PR
  update") — directly contradicts workstream 5, so this isn't a
  clarification, it's reversing a standing, documented policy. **Timing
  decided**: land only after Weblate is fully off, not before/concurrently.
- Also update the handbook's per-project references (it lists Channels,
  Playbooks, Desktop, Mobile, and Calls as five separate Weblate projects)
  to reflect that all five now share one process and one 22-locale list.

### 5. Community/customer correction workflow
- Corrections land as ordinary GitHub PRs directly against locale JSON
  files.
- Consider a lightweight issue template for non-engineers to flag a bad
  translation without editing JSON themselves (a maintainer or the author
  workflow above applies the fix) — raises the bar from Weblate's UI
  otherwise, likely reducing correction volume from external contributors.

### 6. Docs/tooling cleanup
- Update `CONTRIBUTING.md` step that currently says "only `en.json` should
  be modified... other languages... updated using Weblate."
- Update `platform/AGENTS.md` / `server/AGENTS.md` i18n guidance
  (`make i18n-extract` note) to reflect the new author-submits-translations
  expectation.
- Update mobile's `CLAUDE.md` i18n section to match (see workstream 3).
- Remove the Weblate webhook screenshot/doc reference once the integration
  is off.
- Update the handbook localization page (see workstream 4) — flagged here
  too since it's easy to miss as it lives outside these repos, in
  `mattermost/mattermost-handbook`.

## Explicitly out of scope for this plan

- Automated CI-side translation generation (bot/synchronous translator) —
  deferred; near-term relies on authors submitting AI translations
  themselves.
- Automated quality scoring of author-submitted translations — later
  follow-up.

## Resolved during investigation (no decision needed)

- ~~Does `enterprise/` have any i18n surface area~~ **No.** Checked — no
  `i18n/` directory, no locale JSON files, no
  `FormattedMessage`/translation-function references anywhere in
  `enterprise/`. Proprietary server-side logic with no user-facing
  translatable strings. Out of scope, nothing to do.
- ~~Is there an equivalent native-strings surface on Android~~ **No.**
  `android/app/src/main/res/values/strings.xml` is 25 lines of EMM/MDM
  admin-configuration text (pincode policy descriptions, server URL
  defaults, etc.) — read by IT admins configuring managed devices, not
  end-users, and not localized by design. Not a translation gap.
- ~~iOS `.lproj` disposition~~ **Decided: spin off separately** (see
  decision #9) — confirmed to be a real, pre-existing native-wiring gap
  (permission-prompt strings hardcoded in `Info.plist`, never connected to
  the empty per-locale `InfoPlist.strings` overrides, so every user sees
  English OS permission dialogs regardless of app language), but it
  predates this plan and isn't caused by the Weblate migration.
- ~~Is `zh_Hans`/`zh_Hant` → `zh-CN`/`zh-TW` a correct mapping~~ **Yes,
  confirmed by character-set inspection.** Every `zh_Hans`/`zh-CN` file
  (webapp, desktop, mobile, Calls) uses simplified characters exclusively;
  every `zh_Hant`/`zh-TW` file uses traditional characters exclusively.
  Consistent across the whole ecosystem — safe to merge on this mapping.
  Investigating this surfaced an unrelated, more serious finding: see
  Playbooks' `zh_Hant.json` in Current State and the new CI-check
  requirement in workstream 3.
- ~~Exact locale diff for Calls and Playbooks against the core 22~~
  **Computed exactly — see workstream 1.** This wasn't a decision (that was
  already settled by decision #1), just bookkeeping: which specific files
  get deleted vs. newly created in each repo.

## Open questions

*(none remaining — all open questions from this planning pass have been
resolved or converted into locked decisions above.)*
