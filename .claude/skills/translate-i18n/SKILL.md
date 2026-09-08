---
name: translate-i18n
description: Fill missing translations across all 21 supported locales by fanning out one subagent per locale. Use when en.json has gained keys that the locale catalogs do not have — after a feature lands, after merging master, or when `npm run i18n-verify-translations` / `make i18n-verify` reports missing keys.
---

# Parallel i18n translation

[`i18n/AGENTS.md`](../../../i18n/AGENTS.md) is the brief for translating *one*
locale. This is the recipe for doing all 21 at once without the result being
inconsistent slop.

The shape is: **describe → agree terminology → fan out → validate → apply.**
The middle step is the one people skip, and it is the one that decides whether
21 locales use the same word for a new product concept.

Everything below assumes the repository root (the directory containing
`server/` and `webapp/`). Scripts live in `scripts/` next to this file.

## Which model

Use the strongest model available for every step, and set it explicitly on
each agent rather than inheriting — if the session is running something
lesser, upgrade for this work.

A bad translation is very hard to recover from. It passes every checker here,
ships in a language the reviewer does not read, and is usually found by a
user. Nothing downstream will catch it, so pay for the best output at the
point it is produced.

## 0. Establish the gap

Extract, sync the catalogs to `en.json`, then measure.

```bash
cd webapp/channels && npm run i18n-extract && cd -
cd server && make i18n-extract && cd -
node .claude/skills/translate-i18n/scripts/apply_translations.mjs /tmp/i18n-run
node .claude/skills/translate-i18n/scripts/build_manifest.mjs /tmp/i18n-run
```

Running `apply_translations.mjs` with nothing to apply is the sync: it seeds
every `en.json` key that a catalog lacks as `""`, and prunes every key
`en.json` no longer has. Afterwards each catalog holds exactly `en.json`'s keys,
so **untranslated is a value, not a missing key** — and that makes the gap a
per-locale fact rather than a union across all 21.

`build_manifest.mjs` reads it back off the catalogs and writes
`/tmp/i18n-run/gaps/<locale>.json`, one worklist per locale with the English and
the description already merged in, plus `new_keys.json` holding the union for the
description and glossary passes. If it reports zero, there is nothing to do.

Read three numbers, not one:

- **untranslated** — the work. 300 keys is a normal feature merge; 5,000 means
  something else went wrong and fanning out will just multiply it.
- **removed** — keys `en.json` dropped. Expected after a merge, but a key you did
  not expect to lose means `en.json` is wrong.
- **seeded** — keys the catalogs never had. Compare it against **removed**: if the
  two are equal and the strings look related, that is a rename, not new work.

## 1. Descriptions

A translator cannot render `Select` or `No recent session` without knowing
where it appears. Every new key needs a description in the authoring catalog
first.

```bash
cd webapp/channels && npm run i18n-extract-authoring && cd -
cd server && make i18n-extract-authoring && cd -
```

That adds the new keys with empty descriptions. Fill them by spawning agents
over chunks of ~100 keys, each instructed to **find the actual usage in
source** rather than paraphrase the English. Chunk so no agent handles more
than it can search carefully.

A description must say where the string appears, what each placeholder refers
to, and any disambiguation a translator needs (noun or verb? title or body?
admin or end user?). It must not restate the English.

This step reliably surfaces bugs — hardcoded English constants, wrong
prepositions, typos — because it is the first time anyone reads every new
string next to its call site. Fix the English before translating it.

Rebuild the manifest afterwards. The worklists carry the descriptions, so ones
written now are only in the files the agents read if you regenerate them — and if
you fixed any English, re-extract first:

```bash
node .claude/skills/translate-i18n/scripts/build_manifest.mjs /tmp/i18n-run
```

## 2. Glossary candidates — do not skip this

Run the glossary pass described in
[`i18n/AGENTS.md`](../../../i18n/AGENTS.md#glossary-candidates). One agent
proposes new terms; you agree them; they land in `i18n/glossary/` **before**
any locale agent starts.

Skipping this is the single highest-cost mistake available here. Twenty-one
agents translating "exposure report" with no glossary entry will produce
twenty-one different terms, each individually defensible, and no checker will
notice.

## 3. Fan out, one agent per locale

One agent per locale, not one agent per batch of locales. Translation quality
drops when a single agent context-switches between languages, and per-locale
agents can each calibrate against their own existing catalog.

Give every agent:

- the repository root, and an instruction to read `i18n/AGENTS.md` first
- `i18n/glossary/<locale>.json` plus `i18n/glossary/en.json`
- `/tmp/i18n-run/gaps/<locale>.json` — that locale's worklist alone, English
  and descriptions already merged in. It is deliberately not the union: a locale
  that already has a string is not asked for it again, and the validator in step
  4 checks the answer against this file
- **that locale's plural categories for both surfaces** — the table in
  `i18n/AGENTS.md` differs between webapp and server for `es`, `fr`, `it` and
  `pt-BR`, and an agent that guesses will fail `mmgotool i18n verify`
- an instruction to calibrate register against the existing
  `webapp/channels/src/i18n/<locale>.json`
- a single output path, `{"webapp": {...}, "server": {...}}`

Tell each agent to write only to its output path and to modify no repository
file. Twenty-one agents editing catalogs concurrently will corrupt them.

Locales worth extra care in the prompt: `fr` and `it` (apostrophe elision
before tags), `ja`/`ko`/`zh-*`/`vi` (single plural category), `pl`/`ru`/`uk`
(four categories), `hu`/`tr`/`ko` (agglutination and particles — tell them to
rephrase rather than suffix an interpolated value), `fa` (RTL), and `en-AU`
(localisation, not translation — most strings should come back unchanged).

## 4. Validate before applying

```bash
node .claude/skills/translate-i18n/scripts/validate_translations.mjs /tmp/i18n-run <locale>
```

Checks key parity, ICU parse with the runtime parser, variable and tag parity
in both directions, argument-type parity, plural categories for the locale,
the apostrophe trap, and English left untranslated. Run it per locale and fix
before applying — a bad file caught here costs one agent, caught after
applying it costs a catalog.

"Identical to English" is reported as a warning, not an error, because product
names, protocol acronyms and pure-placeholder strings legitimately match. Read
the list; do not assume.

## 5. Apply and verify for real

```bash
node .claude/skills/translate-i18n/scripts/apply_translations.mjs /tmp/i18n-run
cd webapp/channels && npm run i18n-verify-translations && cd -
cd tools/mmgotool && go run . i18n verify --server-dir=../../server && cd -
```

This is the same command as step 0 — it is one pipeline, run twice. Every catalog
on both surfaces goes through the same four phases whatever the payload contains:

1. **add** the translations the payload supplies. An existing translation is never
   overwritten, so re-running is safe.
2. **seed** every remaining `en.json` key as `""`.
3. **sort** with the comparator that orders `en.json` for that surface — the
   webapp reuses `webapp/channels/scripts/formatter.js`, the server matches
   mmgotool's plain byte-wise ordering. The two are genuinely different.
4. **prune** the keys `en.json` no longer has, recording what they said in
   `/tmp/i18n-run/pruned/<locale>.json`.

It preserves the 2-space/trailing-newline convention and only writes a file
whose content actually changed, so a run with nothing to do leaves no diff.

The **untranslated** count is what tells you whether you are finished. It should
be zero here; anything else is a key an agent skipped, still sitting in the
catalog as `""`. Go back and get it translated rather than reverting it — the
checkers will not let it merge either way.

Pruning is the normal way a key retired from `en.json` leaves the catalogs —
a rename upstream orphans the old id in all 21 — so it needs no flag and is not
an error. Read the summary anyway: every removal is counted and named there,
and a key you did not expect to lose is the signal that `en.json` is wrong.

The two verify commands are what CI runs. They must pass with no flags.

## Pitfalls

- **Do not let agents edit catalogs directly.** Collect JSON, apply centrally.
- **Do not skip step 2.** See above.
- **Balanced apostrophes are sometimes load-bearing.** `'<blank>'` in a source
  string is deliberate ICU escaping; see the note in `i18n/AGENTS.md`.
- **`en-AU` is not a translation.** Expect ~2 changed strings out of 300, and
  be suspicious of an agent that returns more.
- **Agents self-report success.** Every one will tell you it validated its own
  output. Run step 4 anyway; that is the whole point of having a checker in
  the repository rather than in a prompt.
- **An empty string is a placeholder, not a translation.** It is safe to leave in
  a working tree — react-intl treats `""` as falsy and falls back to the English,
  and go-i18n's `newTemplate("")` yields a nil template so the server returns the
  id — which is to say it renders exactly as a missing key does. It is not safe to
  ship, and both checkers reject it, so a half-finished run cannot merge. Note the
  line is drawn at exactly `""`: `" "` is a real translation in a language that
  separates where English uses a word, and is left alone.
- **A key that vanished may have been renamed, not retired.** When upstream
  moves an id, step 0 reports it as both **seeded** and **removed** — two
  unrelated-looking numbers for one rename. Before translating, compare the old
  and new English; `/tmp/i18n-run/pruned/<locale>.json` still holds what each
  locale said. If the English is unchanged, carry the existing translation over to
  the new id instead of paying 21 agents to reinvent it.
- **Translate only what is missing.** `build_manifest.mjs` deliberately emits
  only the gap, and `apply_translations.mjs` refuses to overwrite. Resist
  widening the scope to "improve" existing translations in the same pass: two
  independent runs over the same 200 strings agreed just 38% of the time, both
  structurally valid. Re-translating produces a large diff that is neither
  better nor reviewable.
- **A second run is not a review.** For the same reason, you cannot check a
  translation by generating another one and diffing — you will get a 60%
  difference on correct output. The checkers verify structure; only a speaker
  verifies meaning.
- **Expect en-AU to produce a wall of warnings.** Almost every string is
  legitimately identical to English, so the validator's "identical to English"
  warning fires ~290 times. That is the expected result, not a failure.
