# Bulk translation pilot — report

Parent: [step-2.md](./step-2.md) · Ran on the `ai-i18n` branches of all
five repos. Status: **complete — methodology validated, translations
landed.**

## Scope

- **300 English keys** selected across all six surfaces, stratified by
  risk: ICU plural/select strings, short glossary-heavy labels,
  placeholder/tag-rich strings, Go plural objects, and (for Playbooks)
  the known-bad `zh_Hant` English-copy keys.
- **6 locales**: de, fr (community-rules locales), fa (RTL), ja, zh-TW
  (CJK; zh-TW includes the known-bad Playbooks file), ru (complex plural
  categories).
- **1,800 translations** generated/reviewed total.

| Surface | Keys |
|---------|-----:|
| webapp | 80 |
| server | 54 |
| mobile | 40 |
| desktop | 26 |
| calls (webapp) | 40 |
| playbooks (webapp) | 60 |

## Pipeline (as executed)

1. **Manifest per locale**: key + English + `en-with-description.json`
   description + existing translation (flagging English-copy values) +
   matched `i18n/glossary/` constraints per key.
2. **Generation**: one subagent per locale; per-entry verdict
   `keep`/`revise`/`new` — existing translations are genuinely reviewed
   (D9), not blindly kept or rewritten.
3. **Mechanical validation** (independent script): placeholder/Go-token/
   tag parity, ICU argument names, locale-correct plural category sets,
   brace balance, leading/trailing-space preservation.
4. **Blind back-translation**: separate subagents translate outputs back
   to English without access to the source.
5. **Drift judgment**: per-locale judges compare source vs
   back-translation, calibrated with the glossary (so deliberate
   terminology choices aren't false-flagged).
6. **Fix + re-validate + land**: judge fixes applied, everything
   re-validated, landed into locale files with minimal diffs.

## Results

### Actions (review of existing translations)

| Locale | keep | revise | new |
|--------|-----:|-------:|----:|
| de | 143 | 128 | 29 |
| fr | 140 | 66 | 94 |
| fa | 33 | 66 | 201 |
| ja | 129 | 129 | 42 |
| ru | 154 | 87 | 59 |
| zh-TW | 111 | 28 | 161 |
| **Total** | **710** | **504** | **586** |

### Quality gates

- **Mechanical validation: 0 issues** in 1,800 outputs (first pass) —
  the prompt's hard rules on placeholders/ICU/whitespace held.
- **Judge flags: 13 / 1,800 (0.7%)** — de 1, fr 4, fa 1, ja 2, ru 1,
  zh-TW 4. Categories: glossary 5, meaning 4, omission 2, referent 2.
  All 13 came with suggested fixes; applied and re-validated clean.
- Legitimately-identical-to-English outputs were rare and expected
  (SAML 2.0, OpenID Connect, `{{.Hour}}:{{.Minute}} {{.TimeZone}}`).

### Existing-translation defects caught by the review pass (sample)

The pilot confirmed D9 (review all): the `revise` bucket found real,
user-visible bugs that key-existence coverage can never see:

- **fa webapp**: an ICU plural missing its `other` keyword — would crash
  the formatter; branch texts still in English.
- **ja server**: a notification string with its entire content
  duplicated twice; an inverted meaning ("supported" for "Unsupported").
- **fr server**: `{{.Canal}}` — the Go token itself had been translated
  (renders literally at runtime); broken Markdown link with a space.
- **ru webapp**: `=2/=3/=4` exact-match hack instead of CLDR
  one/few/many/other (breaks 22, 23, 24…); Playbooks "run" as
  бег/забег/пробег (jog/race/mileage) and "snoozed" as захмелел ("got
  tipsy").
- **de playbooks**: "snoozed a status update" translated as
  "overslept a status update" (verschlafen).
- **zh-TW webapp**: licensed-seats overage banner inverting "exceeds by
  {seats}" vs "exceeds your {seats}".
- **Playbooks zh-TW**: all 60 pilot keys were English copies; now
  actually translated.

### Landed changes

All 1,800 pilot targets landed on `ai-i18n` in the respective repos
(values changed, added, or confirmed-kept in place). Server files were
updated in-place with new ids appended (preserving Weblate's historical
file order); flat files preserve each file's sort order and indent.

## Process learnings (apply to full pass)

1. **Give every subagent a private scratch directory.** Two pilot agents
   collided in shared `/tmp` paths (one read another's manifest
   mid-write). Both detected and recovered, but the full pass must
   isolate work dirs per agent.
2. **Landing must preserve file conventions.** Server locale JSONs are
   *partially* sorted (Weblate appended in runs); naive resorting
   rewrote 20k-line files. In-place update + append is the minimal-diff
   pattern. Indent detection must be depth-aware.
3. **The description + glossary bundle works.** Zero mechanical failures
   and a 0.7% drift rate suggest the context bundle (description,
   glossary constraints, existing translation, CLDR guidance, register
   rules) is sufficient; no prompt overhaul needed.
4. **Judge calibration matters.** Giving judges the glossary prevented
   false flags on deliberate renderings (擴充程式/"extension" for plugin,
   сценарий/"scenario" for playbook). Without it, drift review would
   drown in terminology noise.
5. **Locale-glossary gaps surface as judge flags** (5/13 were glossary
   violations, e.g. zh-TW 地位 vs 角色 for "role"). The generation prompt
   should restate: check glossary hits per string *before* writing.
6. **German (and others) legitimately *add* ICU plurals** English lacks
   (verb agreement); validators must allow new plural constructs, not
   just require preserved ones (ours does).

## Recommended full-pass parameters

- Batch size: ~300 keys per generation agent (pilot-validated).
- Waves per step-2 order: desktop+calls → playbooks → mobile → server →
  webapp; within each wave, all 21 locales in parallel.
- Keep the 6-stage pipeline exactly as piloted, including blind
  back-translation on 100% of generated/revised strings and the
  fix-reland loop.
- Scale estimate: ~14.8k keys × 21 locales ≈ 311k targets ⇒ roughly
  1,000 generation-agent runs plus back-translation/judge runs at the
  same batch size. Unlimited spend confirmed (D10); no human review of
  locale diffs (D11) — the judge + validator loop is the quality gate.
