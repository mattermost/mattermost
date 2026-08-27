# Docs AI review

Advisory persona review of changes under `docs/main`, `docs/develop` and `docs/api`. No
verdict blocks a merge.

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

| Scope | Used by |
| --- | --- |
| `review` | Reviewing a docs PR |
| `author` | Writing a page |
| `impact` | Deciding whether a code change needs docs |

`brand-voice` is always selected and cannot be dropped by the router.

## Where a rule belongs

Anything that does not vary by audience goes in the shared prompts, stated once:

- `.github/prompts/conventions.md` — docs house rules. Reviewers and writers.
- `.github/prompts/review-contract.md` — JSON output contract and verdict semantics.
  Reviewers.

Both are sent as a byte-identical prefix across every persona, so nothing in them may be
templated per persona.

## Untrusted input

Diffs and PR descriptions are author-controlled. A prompt that embeds repository content
must wrap it with `block()` from `lib/untrusted.mjs` and include `DATA_NOTICE`.
