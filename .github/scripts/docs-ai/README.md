# Docs AI

Three pipelines, one persona registry, one package.

| Workflow | Question | Runs on |
| --- | --- | --- |
| `docs-review.yml` | Is this prose right? | Manual `workflow_dispatch` with a PR number (while tuning) |
| `docs-gap.yml` | Is a page missing? | Every PR |
| `docs-writer-merged-pr.yml` | Write the missing pages | PR merged with `Docs/Needed` |

Review and gap are advisory. No verdict blocks a merge. `docs/api` reference pages are
generated from OpenAPI — out of scope for review and as a gap action.

## Layout

```
docs-ai/
  review/     # persona review entry points (router, persona-review, report)
  gap/        # gap analysis entry points (prepare, report) + lifecycle helpers
  writer/     # author loop + merged-PR entry + Docs/Done sync
  lib/        # shared (anthropic, github, untrusted, personas, diff)
  package.json
  README.md
```

One `package.json`. Separate packages would only duplicate the lockfile and CI install.

## How to run it

The review workflow is manual while we tune personas. From the Actions tab, run
**Docs AI Review** with the target PR number (same-repo branches only). That posts one
sticky comment on the PR and produces a single workflow run — no checks appear on other
PRs. When the output is trustworthy, add a `pull_request` trigger back onto the same
single job so it becomes one check rather than a matrix of them.

## This package

`.github/scripts/docs-ai/` is a small Node module (ESM). Entry points:

| Script | Role |
| --- | --- |
| `review/router.mjs` | Cheap model call that picks which personas apply |
| `review/persona-review.mjs` | One persona → one JSON verdict |
| `review/report.mjs` | Upserts the sticky review comment |
| `gap/prepare.mjs` | Collects diffs and renders the gap prompt |
| `gap/report.mjs` | Posts the sticky gap comment and owns `Docs/Needed` |
| `writer/run.mjs` | Reads the gap sticky, runs the author loop, writes MDX |
| `writer/sync.mjs` | On close of `docs/pr-*`, flips `Docs/Needed` → `Docs/Done` |

`npm test` (run from this directory) is the registry validator the workflow also runs
before reviewing or writing.

## Adding or changing a persona

One file in `.github/prompts/personas/`. The filesystem is the registry; there is no list
to keep in sync.

```yaml
---
id: system-admin              # must match the filename
label: System Administrator   # shown in the PR comment
scope: [author, review, impact]
docs_paths:                   # pages this persona owns
  - docs/main/administration-guide
code_signals:                 # code paths implying docs are needed (scope: impact)
  - server/public/model/config.go
router_hints: >               # when the router should select this persona
  Apply to administration, deployment and configuration content…
---

You are a senior Mattermost system administrator…
```

Every key is required except `code_signals`, which is required only with `impact` scope.
`docs_paths` entries must exist on disk.

Everything below the closing `---` is the persona's system prompt, sent verbatim. Write
it as the brief you would give a human reviewer: who they are, what they are accountable
for, what to look for and in what order. The writer reframes the same body as an audience
lens when `scope` includes `author`.

| Scope | Used by |
| --- | --- |
| `review` | Reviewing a docs PR |
| `author` | Writing a page (path → persona via `docs_paths`) |
| `impact` | Deciding whether a code change needs docs |

`brand-voice` is always selected and cannot be dropped by the router. It never authors.

An `impact` persona's `docs_paths` and `code_signals` are rendered into the gap prompt by
`gap/prompt.mjs`, so the two pipelines cannot disagree about who reads what. Moving a
persona's paths updates both in one edit.

## The Docs/Needed lifecycle

`gap/report.mjs` is the only writer of the label on open PRs. It reads prior state back
out of the comment it wrote last time, so it can tell its own label from a human's:

```
<!-- docs-gap:v1 -->
<!-- docs-gap-state {"applied_by":"bot","verdict":"required","sha":"…"} -->
```

| Prior state | Verdict | Action |
| --- | --- | --- |
| no label | `required` / `recommended` | add, record `applied_by: bot` |
| label, `applied_by: bot` | `none` | **remove** — the gap closed |
| label, no state (human-applied) | `none` | leave it, note the override |
| `Docs/Not Needed` or `Docs/Done` | any | skip entirely |

When a PR **merges** still carrying `Docs/Needed`, `docs-writer-merged-pr.yml` reads the
sticky comment's recommended actions, authors MDX with the matching `author` personas,
pre-reviews in-loop, and opens `docs/pr-<n>` as a draft (authored by the Docs AI App).
Closing that draft flips `Docs/Needed` → `Docs/Done` on the originating PR.

Three constraints to preserve if you change the gap label logic:

- **The label follows the verdict, not the presence of a docs diff.** A push that edits an
  unrelated page must not clear it, or the self-clearing behaviour is an escape hatch.
- **Comment before label.** A label written without its state reads as human-applied
  forever; state written without a label re-applies on the next run.
- **A failed run keeps the prior state block.** Dropping it has the same effect as writing
  a label with no state.

Every gap branch renders locally without touching a PR:

```bash
node gap/report.mjs --dry-run --result-file ./result.json \
  --labels 'Docs/Needed' --prior-state '{"applied_by":"bot"}'
```

## Writer credentials

Opening a branch and PR needs a GitHub App (`DOCS_AI_APP_CLIENT_ID` /
`DOCS_AI_APP_PRIVATE_KEY`). The default `GITHUB_TOKEN` cannot push under org policy, and
PRs it opens would not re-trigger `docs-review.yml`. Soft-skip when unset.

The milestone on the merged PR is mandatory: it is the only source of the
`From Mattermost vX.Y` version anchor.

`docs-writer-merged-pr.yml`'s sync job also needs `DOCS_AI_BOT_LOGIN` (the App's
`{slug}[bot]` login). Label flips run only when the closed PR's head repo is this
repository and its author matches that login — branch name and body markers are not
provenance.

## Where a rule belongs

Anything that does not vary by audience goes in the shared prompts, stated once:

- `.github/prompts/conventions.md` — docs house rules. Reviewers and writers.
- `.github/prompts/review-contract.md` — JSON output contract and verdict semantics.
  Reviewers.
- `.github/prompts/docs-gap-analysis.md` — the gap prompt. Gap analysis only.
- `.github/prompts/docs-writer.md` — authoring output contract and hard rules. Writers.

The conventions + contract (or conventions + writer prompt) prefixes are sent as a
byte-identical cacheable prefix across calls. The gap prompt carries `{{DATA_NOTICE}}`,
`{{INPUTS}}` and `{{PERSONAS}}`; renaming or dropping one fails the render rather than
reaching the model.

## Untrusted input

Diffs and PR descriptions are author-controlled. A prompt that embeds repository content
must wrap it with `block()` from `lib/untrusted.mjs` and include `DATA_NOTICE`. The gap
diffs are wrapped the same way and reach the model as files it opens, which keeps an
unbounded monorepo diff out of the workflow's expression context.

Model output is untrusted on the way back out. `clampResult()` strips HTML comment
delimiters from every string before it reaches a comment — without that, a summary could
forge the `docs-gap-state` block the next run reads. The writer aborts when it sees no
`path=` blocks or when a milestone was set and a page lacks a version anchor.
