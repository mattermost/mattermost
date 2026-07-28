# Step 2 — One-time bulk translation + review pass

Parent: [summary.md](./summary.md) · Prev: [step-1.md](./step-1.md) ·
Next: [step-3.md](./step-3.md)

## Goal

Bring every agreed locale on every surveyed surface to true 100% coverage
**and** remediate known-bad existing translations, using AI generation
plus layered review — not back-translation alone.

## Prerequisites

From step 1 (minimum bar — do **not** wait for every optional tool):

- [ ] Locale trim / reconciliation complete (or exceptions documented)
- [ ] Filename normalization landed for surfaces in the current wave
- [ ] Key-parity inventory available (missing/extra keys per locale)
- [ ] Minimum syntax validators available on the wave's surfaces
- [ ] Soft spend checkpoint + stop/go owner agreed (decision #10 revise)

## Scale (verified)

~14.8k English source entries across 9 surfaces; × ~21 non-English
locales ⇒ on the order of **~300k+ target cells** before retries:

| Surface | `en` entries |
|---------|-------------:|
| Webapp | 8,079 |
| Server | 3,495 |
| Mobile | 1,718 |
| Desktop | 367 |
| Calls (3 surfaces) | 365 |
| Playbooks (2 surfaces) | 810 |

Playbooks webapp `zh_Hant` is worse than "mostly English": large
identical-to-`en` set **plus** missing and stale extra keys. Key-existence
coverage would still look "complete" for the overlapping keys.

## Concrete tasks

### 2.1 Freeze scope and inventory

- [ ] Per surface: key counts, missing keys, extra keys, identical-to-`en`
  baseline rate.
- [ ] Flag known-bad locales/files (Playbooks `zh_Hant`, any spike above
  baseline).
- [ ] Record glossary/rule sources (handbook links German, French, Dutch
  translation rules — prose, not clean term maps).

### 2.2 Pilot before full spend

- [ ] Pilot 200–500 strings spanning JS + Go, short UI, plurals/`select`,
  RTL (`fa`), and glossary locales.
- [ ] Measure cost/quality; set soft budget and stop/go criteria.
- [ ] Tune prompt, batch size, and allowlists from pilot failures.

### 2.3 Context bundle (cached, batched)

Build **once per source key** (not per locale), then reuse across locales.
Batch by component/file so sibling strings share a call.

Bundle contents:

- Namespace breadcrumb from the key
- Source usage snippet (grep / extract location)
- ICU / placeholder / rich-text token inventory (JS)
- `{{.Field}}` token inventory (Go)
- Target-locale CLDR plural category set when needed
- Glossary/rule hits as **high-priority constraints** (not blind hard
  overrides that break inflection)
- 3–5 sibling few-shot examples from the same namespace/locale
- Anti-identical-copy instruction with allowlist policy

Authoring-tier artifacts (decision #17): consume Calls `temp.json` /
`formatjs --extract-source-location` when present; do not block the wave
on full `mmjstool`/`mmgotool` metadata work.

### 2.4 Generation policy

- [ ] **First pass**: fill gaps + rewrite flagged bad strings only.
- [ ] Preserve existing Weblate/human translations unless flagged
  (identical-copy spike, missing placeholders, failed syntax, failed
  review).
- [ ] Broaden to proactive rewrite of all existing strings only after
  scoring shows systematic quality issues.

### 2.5 Validation before land

- [ ] Key parity (no missing / unexpected extras)
- [ ] Syntax: `formatjs verify --structural-equality` (JS);
  template/token checks (Go — whatever minimum exists)
- [ ] Identical-to-source heuristic with **thresholds + allowlists**
  (see Challenges — `en-AU` is normally ~84–92% identical)
- [ ] Back-translation as a **semantic drift** signal, not the sole gate
- [ ] Native-speaker / language-expert sampling for: glossary locales,
  RTL/Persian, high-visibility UI, and any locale that fails automated
  gates repeatedly

### 2.6 Land in waves (not one mega-PR)

Suggested order (adjust with owners):

1. Desktop + Calls (small)
2. Playbooks (includes known-bad `zh_Hant`)
3. Mobile
4. Server
5. Webapp (largest)

- [ ] Each wave: report (coverage, identical rates, lint failures,
  sample review notes) + rollback point.
- [ ] Feed accepted prompts/checks forward into step 3's author workflow.

## Challenges (verification pass)

| Assumption | Verdict | Evidence / rationale |
|------------|---------|----------------------|
| Back-translation only (#5) | **Reject as sole review** | `"Owner"` → `"Owner"` looks perfect; misses copy-English, formality (e.g. German Sie/Ihre), gender, RTL punctuation, UI length. |
| No credit cap (#10) | **Revise** | Soft pilot + stop/go required at this scale. |
| Full grep context per key × locale (#15) | **Revise** | Cache per source key; batch by component; reuse across locales. |
| Glossary as hard constraint (#16) | **Revise** | Sources are prose rules; hard maps break inflection/case. Prefer constrained + conflict report + sampling. |
| Review *all* existing translations | **Narrow first** | Gaps + flagged + high-risk ICU first; expand if needed. |
| Single sweep all six codebases | **Reject** | Nine surfaces, two syntaxes, multiple tools — wave landings. |
| Wait for all step-1 tooling | **Do not** | Wait for trim, names, parity inventory, minimum validators only. |
| Anti-identical allowlist | **Needs design** | Scope by key+locale+reason; exempt brands/vars/URLs; fail file-level spikes and full-sentence copies. |

## Risks

- Overwriting good human/Weblate translations with worse AI output.
- Spending credits on locales later dropped if step 1's trim hasn't
  landed yet (the locale scope itself is settled).
- Reviewer fatigue on mega-diffs; wave PRs mitigate.
- Treating Playbooks `zh_Hant` as done after fill without deleting extras /
  fixing missing keys.

## Acceptance criteria

- [ ] Every in-scope locale file has full key parity with `en` for its
  surface.
- [ ] Known-bad files (at least Playbooks `zh_Hant`) remediated and
  re-measured for identical-to-`en` rate within agreed baseline.
- [ ] Syntax validators clean on landed waves.
- [ ] Pilot cost report and final spend recorded.
- [ ] Prompt/bundle/allowlist artifacts versioned for reuse in step 3.
- [ ] Native sampling notes attached for glossary + RTL locales.

## Open questions

1. Who signs off that back-translation **plus sampling** is enough?
2. Are German/French/Dutch handbook rules current and authoritative?
3. Should AI overwrite unflagged human translations at all in v12?
4. What identical-copy threshold fails a locale file (per locale family)?
5. Soft spend budget and stop/go owner?
