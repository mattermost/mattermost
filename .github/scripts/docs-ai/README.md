# Docs AI review

Reviews changes under `docs/main`, `docs/develop` and `docs/api` through a set of reader
personas, and posts the result as a single comment on the PR.

**Everything here is advisory.** No verdict blocks a merge. If the pipeline is wrong,
say so on the PR and merge anyway — then fix the prompt.

## What runs on a PR

`.github/workflows/docs-review.yml`:

1. **validate** — resolves the persona registry from disk and runs the unit checks.
   Runs on every PR that touches this directory or `docs/`, including forks.
2. **prepare** — diffs the PR against its base and asks a cheap model which personas the
   change actually warrants.
3. **review** — one job per selected persona, in parallel. Each writes a JSON verdict.
4. **report** — folds the verdicts into one sticky comment, updated in place on each push.

Fork PRs stop after `validate`: they have no access to secrets or a writable token.

## The persona registry

The registry is the set of files in `.github/prompts/personas/`. Each file carries its
own metadata in YAML frontmatter, so adding a persona means adding one file — there is
no list to keep in sync.

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

`scope` decides where a persona is used:

| Scope | Used by |
| --- | --- |
| `review` | Reviewing a docs PR |
| `author` | Writing a page (the authoring lens) |
| `impact` | Deciding whether a code change needs docs |

Two prompt files are shared by every call, so a rule is stated once:

- `.github/prompts/conventions.md` — the docs house rules (version anchoring,
  frontmatter, callouts, links, terminology). Used by reviewers and writers.
- `.github/prompts/review-contract.md` — the JSON output contract and verdict
  semantics. Used by reviewers.

`brand-voice` is always selected. It owns style and version anchoring, which apply to
every page regardless of audience, so the router is not offered the chance to drop it.

**There is no prose linter in this pipeline, by decision.** `docs/.vale.ini` and
`docs/styles/Mattermost/` exist in the repo but nothing invokes them, here or anywhere
else. Those rules arrived with the docs migration, were authored against a small PoC,
and have never been tuned against this corpus — run over `docs/main docs/develop
docs/api` they produce about 8,375 findings, the large majority false positives. The
worst offenders are the `channels`/`calls`/`playbooks`/`boards` substitutions, which
fire on the common noun, and `Headings`, whose proper-noun exception list cannot keep up
with technical content.

So `brand-voice` owns heading case and terminology instead, judging them in context.
Before Vale could be wired in it would need generated content excluded, the common-noun
substitutions dropped, the `Headings` exceptions extended, and the remaining heading
debt worked down — at which point it should go in as a required check rather than an
advisory one.


```bash
cd .github/scripts/docs-ai
npm ci

git diff origin/master -- docs/ > /tmp/pr.diff

node router.mjs --diff /tmp/pr.diff                       # prints a JSON persona list
node persona-review.mjs --persona brand-voice \
  --diff /tmp/pr.diff --out /tmp/results/brand-voice.json
node report.mjs --results-dir /tmp/results --dry-run      # prints the comment
```

## Tests

```bash
npm test
```

These guard the things that fail late and expensively: path resolution from `lib/` to
`.github/prompts/`, frontmatter validity, `docs_paths` pointing at directories that
exist, the cacheable prefix being byte-identical across personas, and untrusted content
being unable to close its own prompt wrapper.

## Configuration

| Name | Kind | Default |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | secret | Review is skipped when unset |
| `DOCS_AI_ROUTER_MODEL` | variable | `claude-haiku-4-5-20251001` |
| `DOCS_AI_REVIEW_MODEL` | variable | `claude-sonnet-4-5-20250929` |

## Handling untrusted input

Diffs and PR descriptions are author-controlled. `lib/untrusted.mjs` escapes `< > &`
before wrapping content in a named block, so a crafted `</diff>` in the content cannot
terminate its data section and inject instructions. Model output is clamped back to the
contract in `persona-review.mjs` before it can reach a comment: unknown verdicts become
`COMMENT`, and findings are capped and truncated.

Adding a prompt that embeds repository content? Use `block()` and include
`DATA_NOTICE`.
