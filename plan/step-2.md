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
- [ ] Glossary bootstrap Phase A landed — see [glossary.md](./glossary.md)

Spend policy (**decided**): unlimited — no budget requirements, no soft
checkpoint. Decision #10 stands as originally locked.

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
- [ ] Confirm `i18n/glossary/` import from Weblate + handbook per
  [glossary.md](./glossary.md).

### 2.2 Pilot (quality tuning only) — **DONE**

- [x] Piloted 300 strings × 6 locales (de/fr/fa/ja/ru/zh-TW) spanning all
  six surfaces, plurals/select, RTL, Go templates, and known-bad files.
- [x] Results: 0 mechanical validation failures; 0.7% drift-flag rate,
  all fixed; 1,800 translations landed. See
  [pilot-report.md](./pilot-report.md) for metrics, defects caught in
  existing translations, and full-pass parameters.
- [x] Pipeline validated: manifest (description+glossary+existing) →
  generate (keep/revise/new) → mechanical validation → blind
  back-translation → calibrated judge → fix → minimal-diff landing.

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
- Prompt instruction not to return the English source verbatim unless
  genuinely identical (brands, proper nouns) — generation-time only; no
  allowlist machinery or CI gate (decided)

Authoring-tier artifacts (decision #17): consume Calls `temp.json` /
`formatjs --extract-source-location` when present; do not block the wave
on full `mmjstool`/`mmgotool` metadata work.

### 2.4 Generation policy

**Decided (D9): AI reviews/rewrites all existing strings**, not only
gaps. Existing Weblate/human translations are inputs to review, not
sacred outputs.

- [ ] For every key × locale: generate or revise so the result meets
  glossary/style constraints and passes syntax validation.
- [ ] Still prioritize known-bad files (Playbooks `zh_Hant`) and
  high-risk ICU/plural strings in wave ordering / sampling density.
- [ ] Glossary constraints loaded from `i18n/glossary/` — see
  [glossary.md](./glossary.md); handbook DE/FR/NL are `required`.

### 2.5 Validation before land

- [ ] Key parity (no missing / unexpected extras)
- [ ] Syntax: `formatjs verify --structural-equality` (JS);
  template/token checks (Go — whatever minimum exists)
- [ ] One-time identical-to-`en` scan of bulk output to catch
  copy-English generator failures **in this pass only** — no ongoing CI
  gate ships (decided). Treat `en-AU` like any other locale (D3); expect
  higher legitimate identical rates and use judgment in the one-time
  scan, not a hard exemption rule.
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
| No credit cap (#10) | **Resolved — keep original** | Owner confirmed unlimited spend; no budget checkpoint required. |
| Full grep context per key × locale (#15) | **Revise** | Cache per source key; batch by component; reuse across locales. |
| Glossary as hard constraint (#16) | **Resolved** | In-repo model + filtered Weblate/handbook import ([glossary.md](./glossary.md)); soft/`required` priorities, not blind overrides. |
| Review *all* existing translations | **Resolved — review all (D9)** | Owner directed AI to review/rewrite all existing strings in the bulk pass. |
| Single sweep all six codebases | **Reject** | Nine surfaces, two syntaxes, multiple tools — wave landings. |
| Wait for all step-1 tooling | **Do not** | Wait for trim, names, parity inventory, minimum validators only. |
| Anti-identical allowlist | **Resolved — dropped** | Owner deleted the identical-copy gate from scope; only a one-time scan of this pass's output remains, with no allowlist machinery. |

## Risks

- Overwriting good human/Weblate translations with worse AI output —
  accepted under D9; mitigate with glossary constraints, back-translation,
  and sampling (D7).
- Spending credits on locales later dropped if step 1's trim hasn't
  landed yet (the locale scope itself is settled).
- No human locale-diff review (D11) — quality rests on generator + CI
  syntax/parity gates + sampling.
- Treating Playbooks `zh_Hant` as done after fill without deleting extras /
  fixing missing keys.

## Acceptance criteria

- [ ] Every in-scope locale file has full key parity with `en` for its
  surface.
- [ ] Known-bad files (at least Playbooks `zh_Hant`) remediated and
  re-measured for identical-to-`en` rate within agreed baseline.
- [ ] Syntax validators clean on landed waves.
- [ ] Prompt/bundle/allowlist artifacts versioned for reuse in step 3.
- [ ] Native sampling notes attached for glossary + RTL locales.

## Open questions

*(none remaining for step 2.)*

Resolved: D7 (owner accepts back-translation + sampling), D8 (handbook
rules authoritative), D9 (review all existing strings), D3 (`en-AU`
treated like any other locale), D6 (no ongoing identical-copy gate),
D10 (unlimited spend).
