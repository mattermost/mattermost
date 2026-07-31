# Deterministic i18n lint strategy — evaluation report

Parent: [summary.md](./summary.md) · Implements the design work for
[step-3.md](./step-3.md) §3.3/§3.4.

## Goal

A deterministic (no-AI, CI-enforceable) lint that guarantees every locale
file across all five repos is **syntactically valid** and **usable at
runtime**: files load, every message parses with the exact parser the
runtime uses, no message can throw or render raw syntax at the user, and
key sets stay in lockstep with `en.json`.

This evaluation was run hands-on against the full post-sweep corpus
(236,838 JS strings across 6 surfaces × 21 locales, plus 3 Go surfaces),
using both the off-the-shelf tooling and purpose-built checkers. All
defects found were fixed; the reference checkers now pass everywhere.

## Two runtimes, two checkers

| Surfaces | Runtime | Reference checker |
|---|---|---|
| webapp, mobile, desktop renderer, calls webapp/standalone, playbooks webapp | `react-intl` → `intl-messageformat` → `@formatjs/icu-messageformat-parser` | [`lint/check_icu.mjs`](./lint/check_icu.mjs) |
| server, calls server, playbooks assets | `mattermost/go-i18n` v1 → `text/template` | [`lint/check_go_i18n`](./lint/check_go_i18n/main.go) |

Desktop's main process additionally does plain `.replace()` interpolation
on the same files; the ICU checks are a strict superset of what it needs.

## Check layers

### Layer 1 — runtime guarantee (hard fail, no exceptions)

JS surfaces (`check_icu.mjs`):

1. File is valid JSON; every value is a string.
2. Key parity vs `en.json`: no missing keys, no extra keys.
3. Every value parses with `@formatjs/icu-messageformat-parser`
   (`ignoreTag: false`, `requiresOtherClause: true`) — the same parser
   `react-intl` runs in production, so "parses here" ⇒ "parses there".
4. Variables/tags used by the translation are a **subset** of the source's.
   An unknown variable throws `MISSING_VALUE` at format time; an unknown
   tag renders raw. Direction matters: a translation may *omit* a variable
   safely, but may never *invent* one.

Go surfaces (`check_go_i18n`):

1. The file loads through `i18n.LoadTranslationFile` from
   `github.com/mattermost/go-i18n` — the exact loader the server runs at
   startup. Verified by negative test: a broken `{{.Name` template is
   rejected at load ("unclosed action"), so template syntax is a
   load-time guarantee, not just a format-time one.
2. Id parity vs `en.json`: no missing ids, no extra ids.
3. `{{.Var}}` tokens are a subset of the source's tokens (unknown token
   renders `<no value>`).
4. Plural objects define exactly the CLDR categories go-i18n's vendored
   `PluralSpec` uses for that locale — no missing categories, no dead ones.

### Layer 2 — fidelity (hard fail unless key is allowlisted)

- `isStructurallySame(source, target)` from the **current**
  `@formatjs/icu-messageformat-parser`: same variables with same types.
- ASCII apostrophe immediately before `<` or `{` where the source has no
  escaping at that key. In ICU, `l'<link>` starts a quoted literal that
  silently swallows the tag/variable and everything after it — messages
  still parse, so only this check (or the structural diff it causes)
  catches them.

Exceptions are a per-surface JSON list of keys
([`lint/exceptions/`](./lint/exceptions/)) where the source string itself
forces a legitimate structural deviation (see "Exceptions" below). Layer 1
still applies to allowlisted keys.

## Why not the stock `formatjs verify`

Evaluated `@formatjs/cli` `verify --missing-keys --structural-equality`
(v6.7.4, the webapp's pin) against the corpus. Verdict: right idea, wrong
implementation; use the parser API directly instead.

1. **False positives from a bundled-parser bug.** The CLI bundles an old
   `collectVariables` that tests `el.value in vars` on a `Map`, so any
   variable whose name collides with a `Map` property — literally `{size}`
   — is reported as "conflicting types". 42 of mobile's 53 reported
   failures (including byte-identical `en_AU` copies) were this bug. The
   same bug corrupts type tracking for nested plurals: 17 more reports
   across bg/uk/ko/nl/it were artifacts that the current standalone parser
   (which uses `vars.has`) accepts.
2. **No extra-keys check** in any published version; stale keys accumulate
   silently (we removed 5,052 of them during this evaluation).
3. **No exception mechanism**, so legitimate deviations (below) would keep
   CI permanently red or force `--structural-equality` off entirely.
4. **Version skew**: Calls pins CLI 5.0.7, Playbooks 4.7.0; behavior
   differs per repo. A ~100-line script importing
   `@formatjs/icu-messageformat-parser` pins one behavior everywhere.

## What the evaluation caught (and fixed)

Running the checkers over the freshly landed sweep found real defects the
sweep's own validator missed (it checked Go tokens and `%` placeholders
but not rich-text tags, and used regex rather than a true ICU parse):

- **3 runtime parse errors**: bg/fa/zh-TW `admin.cluster.OverrideHostnameDesc`
  copied `<blank>` without the source's ICU quoting — `UNCLOSED_TAG` at
  runtime. Fixed by restoring `'<blank>'`.
- **24 apostrophe-swallowed tags** (fr/it elisions like `l'<link>`,
  `d'<link>`, `d'{article}` in webapp, desktop, calls): the tag and often
  the rest of the sentence degraded to literal text, rendering raw
  `<link>` to users. Fixed by using `’` (U+2019). A corpus-wide scan for
  `'` before ICU syntax found exactly these 24 plus 96 intentional
  escapes that mirror English (`''{command}''`, `'{SEQ}'`) — the
  "source has no escaping at this key" condition separates them cleanly.
- **7 dropped degenerate plurals** in zh-TW (webapp `numMembers`,
  `multiselect.*`; mobile `plusMoreLines`, `entire_channel.*`,
  `session_expired_days`): `{n, plural, other {…}}` collapsed to plain
  text. Runtime-safe but structurally divergent; restored `other`-only
  plural wrappers.
- **5,052 stale extra keys** across all six JS surfaces plus 28 stale ids
  in server/playbooks Go files (Weblate-era leftovers no longer in
  `en.json`). Deleted.
- **5 dead `many` plural branches** in server `pt-BR.json`: go-i18n's
  CLDR spec for `pt` is one/other, so `many` could never be selected.
  Deleted (values duplicated `other`).
- **19 broken `{article}` renderings**: webapp
  `admin.sidebar.restricted_indicator.tooltip.message.blocked` receives a
  hardcoded English "a"/"an" from `restricted_indicator.tsx`; every
  non-English locale that kept `{article}` rendered mixed-language text
  ("Это функция an Enterprise…"). Dropped the variable from all 18
  non-English locales with per-locale grammar fixes and allowlisted the
  key (it/nl had already dropped it — correctly).

## Exceptions (5 keys total)

- `webapp/admin.sidebar.restricted_indicator.tooltip.message.blocked` —
  `{article}` is English-only by construction; non-English locales omit it.
  Long-term fix is upstream: bake the article into the source string.
- `webapp/admin.complianceExport.messagesExportedCount`, `…warningCount`,
  `…warningCount.globalrelay` — source uses bare `{count}` ("warning(s)");
  uk legitimately upgrades to a full plural. Runtime-safe (numeric value).
- `mobile/post_body.commentedOn` — `{apostrophe}` is populated only for
  `en*` locales (undefined otherwise, renders empty); fr/pl/pt-BR omit it.

## Results after fixes

| Surface | Strings checked | Result |
|---|---|---|
| webapp (21 locales) | 169,659 | PASS |
| mobile (21) | 36,078 | PASS |
| desktop (21) | 7,707 | PASS |
| calls webapp (21) | 7,329 | PASS |
| calls standalone (21) | 42 | PASS |
| playbooks webapp (21) | 16,023 | PASS |
| server (21) | ~18.5k ids/locale | PASS |
| calls server (21) | 15 ids/locale | PASS |
| playbooks assets (21) | 4 ids/locale | PASS |

Negative tests confirm every error class fires: broken template (rejected
by the real go-i18n loader), invalid plural category, unknown token,
extra id, ICU parse error, unknown variable, structural drift,
apostrophe-before-syntax.

## Rollout recommendation

1. **Land the reference checkers per repo** (they are dependency-light:
   one npm package / one Go module):
   - webapp: replace `i18n-verify-translations` (stock CLI) with
     `check_icu.mjs`; wire into the existing `check` CI job alongside
     `i18n-extract:check`.
   - mobile, desktop, calls webapp+standalone, playbooks webapp: add the
     same script + surface-specific exceptions file; run in each repo's
     lint CI job. Hash-keyed surfaces (calls, playbooks) need no special
     handling — the checker never interprets key names.
   - server, calls server, playbooks assets: run `check_go_i18n` in Go CI;
     fold the same checks into `mmgotool i18n verify` (step-3 §3.4) so the
     canonical extraction tool owns them long-term.
2. **File lists**: until step-1 deletes unsupported locale files, pass the
   21 supported locales explicitly (as the plan's locale list); after
   deletion, glob `i18n/*.json`.
3. **Pin the parser ≥ 3.x**, not the CLI: the `Map`-property bug in
   `collectVariables` is fixed only in `@formatjs/icu-messageformat-parser`
   3.x (`vars.has` + nested-plural leniency); 2.x — the line `react-intl`
   itself depends on — still has it. Parse behavior is equivalent (both
   majors parse the full 236,838-string corpus identically); only the
   structural comparator differs. Do not rely on the `verify` subcommand
   of the repo-pinned CLIs.
4. **Exceptions hygiene**: exceptions are per-surface JSON files checked
   into each repo next to the lint script; adding one requires justifying
   it in the PR. Layer 1 (runtime guarantees) never has exceptions.
5. **Source-side lint stays as-is**: `eslint-plugin-formatjs`
   (`enforce-placeholders` etc.) already guards `defaultMessage` authoring
   in JS repos; this strategy adds the missing locale-file side.
