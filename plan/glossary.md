# Glossary — inventory, in-repo model, import path

Parent: [summary.md](./summary.md) · Consumed by: [step-2.md](./step-2.md),
[step-3.md](./step-3.md), [step-5.md](./step-5.md)

Status: **decided** — model a glossary in-repo for reference (D17); treat
community handbook rules as authoritative soft constraints (D8); inject
into bulk-pass / author prompts as high-priority constraints (decision
#16 revised).

## What exists today

### Weblate project glossaries

Surveyed live at https://translate.mattermost.com/ (2026-07-29). Top-level
projects: **Mattermost**, **Playbooks**, **Calls**. Desktop and Mobile are
components under Mattermost (not separate projects) and share the
Mattermost glossary.

| Project | Glossary URL | EN source rows | Notes |
|---------|--------------|---------------:|-------|
| Mattermost | `/projects/mattermost/glossary/` | **28,770** | Hybrid: short terms **and** full UI / third-party strings. Not a curated termbase. |
| Playbooks | `/projects/playbooks/glossary/` | **35** | Clean product terminology (`playbook`, `run`, `retrospective`, …). |
| Calls | `/projects/calls/glossary/` | **6** | Clean product terminology (`call`, `recording`, `live caption`, …). |

Per-locale Mattermost glossary downloads (CSV) for the high-value
handbook languages:

| Locale | Rows | `target ≠ source` | Identical | Empty |
|--------|-----:|------------------:|----------:|------:|
| `de` | 165 | 131 | 30 | 4 |
| `fr` | 164 | 93 | 33 | 38 |
| `nl` | 156 | 43 | 19 | 94 |

Samples that look like real glossary entries: `channel`→`Kanal`,
`post`→`message` (fr), `User Management`→`Benutzerverwaltung`,
`trigger words`→`Auslösewörter`. Pollution also present in locale files
(full sentences, ICU examples). English export is effectively a giant
term/TM dump — **do not import all 28k rows as constraints**.

Downloads captured during planning (local only, not committed):

- `/home/ubuntu/Downloads/mattermost-glossary-{en,de,fr,nl}.csv`
- `/home/ubuntu/Downloads/playbooks-glossary-{en,de}.csv`
- `/home/ubuntu/Downloads/calls-glossary-en.csv`

Export path in Weblate UI: language page → **Files → Customize download →
CSV**. There is no reliable all-locales ZIP from the glossary overview;
export per locale (or script against Weblate API once credentials/Anubis
are available in CI).

### Community handbook rules (outside Weblate)

Linked from
[handbook localization](https://handbook.mattermost.com/contributors/ways-to-contribute/localization):

| Locale | Source | Shape |
|--------|--------|--------|
| German | [gist der-test/…](https://gist.github.com/der-test/6e04bff8a173e053811cb93e08838ca2) | Short **Vokabeln** table (~15 EN→DE) + style rules (Sie/Ihre, compounds) |
| French | [wget/mattermost-localization-french-translation-rules](https://github.com/wget/mattermost-localization-french-translation-rules) | Large README: style + **Vocabulaire** tables + many worked examples |
| Dutch | [ctlaltdieliet/…-dutch-translation-rules](https://github.com/ctlaltdieliet/mattermost-localization-dutch-translation-rules) | Same pattern: style + **Woordenschat** |

These are **authoritative soft constraints** for `de`/`fr`/`nl` (D8):
prefer them over conflicting Weblate glossary rows when merging.

## In-repo model (target)

Canonical location (platform repo; other repos may submodule/copy or
read via path convention later):

```
i18n/glossary/
  README.md                 # how to edit / regenerate
  schema.md                 # field docs
  terms.json                # English term inventory (id → metadata)
  locales/
    de.json                 # term-id → target (+ optional notes)
    fr.json
    nl.json
    …                       # one file per supported non-en locale as data exists
  style/
    de.md                   # imported/adapted handbook style notes
    fr.md
    nl.md
  sources/
    IMPORT.md               # provenance + re-import steps
    weblate/                # optional raw CSV snapshots (filtered)
    handbook/               # vendored copies of community rule sources
```

### `terms.json` (conceptual)

```json
{
  "channel": {
    "source": "channel",
    "partOfSpeech": "noun",
    "doNotTranslate": false,
    "aliases": ["Channel", "Channels"],
    "provenance": ["weblate:mattermost", "handbook:de"],
    "notes": "Product concept; capitalize per locale style guides."
  },
  "post": {
    "source": "post",
    "aliases": ["Post", "posts"],
    "provenance": ["weblate:mattermost", "handbook:de", "handbook:fr"]
  }
}
```

### `locales/<code>.json` (conceptual)

```json
{
  "channel": {
    "target": "Kanal",
    "priority": "required",
    "provenance": "handbook:de",
    "inflectionNote": "compound freely; prefer Komposita over calques"
  },
  "post": {
    "target": "Nachricht",
    "priority": "required",
    "provenance": "handbook:de"
  }
}
```

`priority`:

- `required` — prompt hard preference; conflict report if AI output uses
  a different stem for the same concept
- `preferred` — soft preference
- `do_not_translate` — keep English (brand / protocol names)

No CI enforcement of glossary compliance in v12 (keeps scope trimmed;
identical-copy gate already deleted). Glossary is **prompt/reference
material** for step 2 bulk pass and step 3 author generator.

## Import path

### Phase A — bootstrap (before step 2 waves)

1. **Re-export** Weblate glossaries for all **22 supported locales** for
   Mattermost + Playbooks + Calls (CSV). Prefer API with a human-issued
   token if Anubis blocks automation; otherwise one-time browser export
   is acceptable.
2. **Filter** each locale file before import:
   - Drop rows where `source` length > ~40 **unless** they appear in a
     handbook vocab table.
   - Drop rows that are clearly full UI sentences / Xbox / Office
     compatibility strings (English dump pollution).
   - Keep brand/protocol identities as `do_not_translate` when
     `target == source` intentionally (MFA, OpenID Connect, …).
   - Prefer `target ≠ source` rows; keep intentional identical brands.
3. **Parse handbook** DE/FR/NL:
   - Extract EN→locale tables into `locales/*.json` with
     `provenance: handbook:<locale>` and `priority: required`.
   - Copy style sections into `style/<locale>.md` (formality, compounds,
     capitalization) — these are **not** term maps; inject as locale
     style preamble in prompts.
4. **Overlay merge order** (highest wins on conflict):
   1. Handbook vocab (`required`)
   2. Playbooks / Calls glossary terms for those product surfaces
   3. Mattermost Weblate glossary (filtered)
5. **Conflict report**: when handbook and Weblate disagree (e.g. French
   `post`→`message` vs another source), keep handbook and log the
   discarded Weblate row in `sources/IMPORT.md`.
6. Land `i18n/glossary/` in the platform repo; link from step 2/3 docs.

### Phase B — consume

- Step 2 context bundle: for each English string, scan against
  `terms.json` (+ aliases); attach matching `locales/<code>` targets as
  constraints; attach `style/<code>.md` excerpt once per locale batch.
- Step 3 author generator: same lookup, scoped to changed keys.
- Step 5 corrections: point humans at `i18n/glossary/` instead of
  Weblate.

### Phase C — Weblate sunset

- After freeze (step 4), in-repo glossary is the only living termbase.
- No requirement to keep Weblate glossary projects writable; optional
  final CSV snapshot under `sources/weblate/`.

## Out of scope (for now)

- Auto-enforcing glossary stems in CI.
- Translating missing glossary locales up to 100% before the bulk string
  pass (bulk pass may *propose* new glossary entries; human/AI follow-up
  can extend `locales/*.json`).
- Deduplicating the 28k English Weblate dump into a perfect termbase —
  filter aggressively; quality over recall.

## Acceptance criteria

- [ ] `i18n/glossary/` exists with schema + README.
- [ ] `de` / `fr` / `nl` locale files include handbook vocab as
  `required`, merged with filtered Weblate rows.
- [ ] Playbooks + Calls terms present (global or surface-tagged).
- [ ] `sources/IMPORT.md` documents export date, filter rules, conflicts.
- [ ] Step 2 prompt bundle loads glossary constraints successfully in the
  pilot.
