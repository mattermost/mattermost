# Docs AI

Two pipelines, one persona registry.

| Workflow | Question | Runs on |
| --- | --- | --- |
| `docs-review.yml` | Is this prose right? | PRs touching `docs/main` or `docs/develop` |
| `docs-gap.yml` | Is a page missing? | Every PR, and every push to one |

Both are advisory. No verdict blocks a merge. `docs/api` is out of scope for review — its
reference pages are generated from the OpenAPI spec, so corrections belong in
`api/v4/source/` — and out of scope as a gap action for the same reason.

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
for, what to look for and in what order.

| Scope | Used by |
| --- | --- |
| `review` | Reviewing a docs PR |
| `author` | Writing a page |
| `impact` | Deciding whether a code change needs docs |

`brand-voice` is always selected and cannot be dropped by the router.

An `impact` persona's `docs_paths` and `code_signals` are rendered into the gap prompt by
`lib/gap-prompt.mjs`, so the two pipelines cannot disagree about who reads what. Moving a
persona's paths updates both in one edit.

## The Docs/Needed lifecycle

`gap-report.mjs` is the only writer of the label. It reads prior state back out of the
comment it wrote last time, so it can tell its own label from a human's:

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

Three constraints to preserve if you change this:

- **The label follows the verdict, not the presence of a docs diff.** A push that edits an
  unrelated page must not clear it, or the self-clearing behaviour is an escape hatch.
- **Comment before label.** A label written without its state reads as human-applied
  forever; state written without a label re-applies on the next run.
- **A failed run keeps the prior state block.** Dropping it has the same effect as writing
  a label with no state.

Every branch renders locally without touching a PR:

```bash
node gap-report.mjs --dry-run --result-file <json> \
  --labels 'Docs/Needed' --prior-state '{"applied_by":"bot"}'
```

## Where a rule belongs

Anything that does not vary by audience goes in the shared prompts, stated once:

- `.github/prompts/conventions.md` — docs house rules. Reviewers and writers.
- `.github/prompts/review-contract.md` — JSON output contract and verdict semantics.
  Reviewers.
- `.github/prompts/docs-gap-analysis.md` — the gap prompt. Gap analysis only.

The first two are sent as a byte-identical prefix across every persona, so nothing in them
may be templated per persona. The gap prompt carries `{{DATA_NOTICE}}`, `{{INPUTS}}` and
`{{PERSONAS}}`; renaming or dropping one fails the render rather than reaching the model.

## Untrusted input

Diffs and PR descriptions are author-controlled. A prompt that embeds repository content
must wrap it with `block()` from `lib/untrusted.mjs` and include `DATA_NOTICE`. The gap
diffs are wrapped the same way and reach the model as files it opens, which keeps an
unbounded monorepo diff out of the workflow's expression context.

Model output is untrusted on the way back out. `clampResult()` strips HTML comment
delimiters from every string before it reaches a comment — without that, a summary could
forge the `docs-gap-state` block the next run reads.
