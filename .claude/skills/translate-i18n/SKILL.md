---
name: translate-i18n
description: Fill missing translations across every supported locale by fanning out one subagent per locale. Use when en.json has gained keys that the locale catalogs do not have — after a feature lands, after merging master, or when `npm run i18n-verify-translations` / `make i18n-verify` reports missing keys.
---

# Parallel i18n translation

[`i18n/AGENTS.md`](../../../i18n/AGENTS.md) is the brief for translating *one*
locale. This is the recipe for doing all of them at once without the result being
inconsistent slop.

The shape is: **describe → agree terminology → fan out → validate → apply.**
The middle step is the one people skip, and it is the one that decides whether
every locale uses the same word for a new product concept.

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
per-locale fact rather than a union across all of them.

`build_manifest.mjs` reads it back off the catalogs and writes
`/tmp/i18n-run/gaps/<locale>.json`, one worklist per locale with the English and
the description already merged in, plus `new_keys.json` holding the union for the
description and glossary passes. If it reports zero, there is nothing to do.

Read these numbers, not just the first:

- **untranslated** — the work. 300 keys is a normal feature merge; 5,000 means
  something else went wrong and fanning out will just multiply it.
- **removed** — keys `en.json` dropped. Expected after a merge, but a key you did
  not expect to lose means `en.json` is wrong.
- **seeded** — keys the catalogs never had.
- **carried** — renames: translations moved to a new key whose English and
  description are unchanged. They are not new work. **not carried** lists
  renames whose description changed, which are translated again.

## 1. Descriptions

A translator cannot render `Select` or `No recent session` without knowing
where it appears. Every new key needs a `description` in its surface's
`en.json` first.

```bash
cd webapp/channels && npm run i18n-extract && cd -
cd server && make i18n-extract && cd -
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

Skipping this is the single highest-cost mistake available here. One agent per
locale translating "exposure report" with no glossary entry will produce one
term per locale, each individually defensible, and no checker will notice.

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
- **that locale's plural categories for both surfaces** — the webapp's from
  `new Intl.PluralRules(locale).resolvedOptions().pluralCategories`, and a
  warning that the server's go-i18n may require fewer, which only
  `make i18n-verify` decides. An agent that guesses will fail it
- an instruction to calibrate register against the existing
  `webapp/channels/src/i18n/<locale>.json`
- a single output path, `{"webapp": {...}, "server": {...}}`

Tell each agent to write only to its output path and to modify no repository
file. One agent per locale editing catalogs concurrently will corrupt them.

Locales worth extra care in the prompt: `hu`/`tr`/`ko` (agglutination and
particles — tell them to rephrase rather than suffix an interpolated value), and
`en-AU` (localisation, not translation — most strings should come back
unchanged).

## 4. Validate before applying

```bash
node .claude/skills/translate-i18n/scripts/validate_translations.mjs /tmp/i18n-run <locale>
```

Checks key parity, ICU parse with the runtime parser, variable and tag parity
in both directions, argument-type parity, plural categories for the locale,
the apostrophe trap, and English left untranslated. Step 5 runs the same check
on every payload and applies nothing if any has an error, so this step is for
iterating on one locale's output, not a gate you have to remember.

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
3. **order** each catalog as it already is: code-point key order on the webapp,
   which the checker enforces; on the server, existing ids stay put and new ones
   are appended. Either way a run's diff is only what it adds or prunes.
4. **prune** the keys `en.json` no longer has, recording what they said in
   `/tmp/i18n-run/pruned/<locale>.json`.

It preserves the 2-space/trailing-newline convention and only writes a file
whose content actually changed, so a run with nothing to do leaves no diff.

The **untranslated** count is what tells you whether you are finished. It should
be zero here; anything else is a key an agent skipped, still sitting in the
catalog as `""`. Go back and get it translated rather than reverting it.

Pruning is the normal way a key retired from `en.json` leaves the catalogs —
a rename upstream orphans the old id in every catalog — so it needs no flag and is not
an error. Read the summary anyway: every removal is counted and named there,
and a key you did not expect to lose is the signal that `en.json` is wrong.

Both verify commands must pass exactly as written, with no flags. A `""` left by
step 0's seeding fails them, and fails CI too.

## Pitfalls

- **Do not let agents edit catalogs directly.** Collect JSON, apply centrally.
- **Do not skip step 2.** See above.
- **`en-AU` is not a translation.** Expect ~2 changed strings out of 300, and
  be suspicious of an agent that returns more.
- **A renamed key keeps its translations.** When a key leaves `en.json` and one
  missing key now has exactly its English and description, apply carries each
  locale's translation across and reports it as **carried**. A rename whose
  English or description also changed is not carried: a clarified description
  can mean the old translation had the wrong sense.
- **Translate only what is missing.** `build_manifest.mjs` deliberately emits
  only the gap, and `apply_translations.mjs` refuses to overwrite. Resist
  widening the scope to "improve" existing translations in the same pass: two
  independent runs over the same 200 strings agreed just 38% of the time, both
  structurally valid. Re-translating produces a large diff that is neither
  better nor reviewable.
