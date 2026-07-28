# Step 5 — Community / customer correction workflow

Parent: [summary.md](./summary.md) · Prev: [step-4.md](./step-4.md) ·
Related: [step-3.md](./step-3.md), [step-6.md](./step-6.md)

## Goal

Replace Weblate's low-friction "suggest a better string" path with an
in-GitHub correction workflow that non-engineers can still initiate, and
that maintainers can land safely against locale JSON.

## Prerequisites

- Clear post-Weblate policy message (step 4 transition banner at minimum).
- Step 3 syntax/parity CI available so bad corrections fail closed.
- Maintainer capacity / SLA for triage (see Challenges).

## Concrete tasks

### 5.1 Intake channels

Offer more than "open a PR against JSON":

- [ ] **GitHub PR** — preferred for engineers / language leads comfortable
  with git.
- [ ] **Issue template** — for non-engineers: bad string, locale, URL or
  screenshot, suggested fix (optional), product area.
- [ ] **Community channel / forum pointer** — optional mirror so people
  who never use GitHub still have a path (maintainer converts to issue).

### 5.2 Issue template fields

- [ ] Locale code and language name
- [ ] Exact English source string + translation key if known
- [ ] Current bad translation
- [ ] Suggested correction
- [ ] Where it appears (screenshot / URL / feature name)
- [ ] Glossary conflict? (link to language rules if any)

### 5.3 Maintainer conversion flow

- [ ] Document how triage turns an issue into a locale JSON PR.
- [ ] Reuse step 2/3 context bundle for the single key when regenerating
  or manually editing.
- [ ] Run syntax + identical-copy checks before merge.
- [ ] Publish a triage SLA (e.g. first response / patch target).

### 5.4 Review checklist for correction PRs

- [ ] Placeholder / ICU / `{{.Field}}` tokens preserved
- [ ] Glossary/rule compliance for that locale
- [ ] No accidental mass retranslate of unrelated keys
- [ ] Screenshots for UI-length-sensitive strings when relevant

### 5.5 What Weblate used to provide (gap fill)

Current contributor docs describe quality tiers, weekly PRs, ICU
guidance, and translation-server lookup/context. After sunset:

- [ ] Point correctors at in-repo glossary/rules excerpts.
- [ ] Point at authoring-tier source-location artifacts when they exist
  (step 1/2) so context is not worse than Weblate's UI.

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Corrections as ordinary PRs | **Revise** | Necessary backbone, but alone raises the bar vs Weblate UI → attrition risk. |
| Issue template is enough | **Revise** | Necessary but insufficient without SLA, routing, and maintainer-owned PR conversion. |
| Volume will be low | **Unknown** | Plan for triage load; do not assume silence equals quality. |

## Risks

- Non-engineer reporters disappear → fewer corrections, worse quality
  long-term.
- Untriaged issues pile up; no language-owner routing.
- Drive-by PRs break ICU/plurals without CI (mitigate via step 3 gates).

## Acceptance criteria

- [ ] Issue template live in the primary repo(s) with required context
  fields.
- [ ] Maintainer runbook: issue → PR → CI → merge.
- [ ] SLA published.
- [ ] Handbook / contributor docs point to the new path (coordinated with
  steps 4 and 6).

## Open questions

1. Non-engineer correction SLA and owning team?
2. Per-locale language experts still exist post-Weblate? How are they
   routed?
3. Security/privacy handling for screenshots in issues?
4. Should customers use the support ticket path instead of GitHub for
   proprietary deployments?
