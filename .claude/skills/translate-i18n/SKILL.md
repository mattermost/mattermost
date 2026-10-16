---
name: translate-i18n
description: Bring every locale's webapp and server catalogs up to date with en.json, with one translator subagent per locale, through the checked pipeline in i18n/scripts/. Use for the daily translation run, attended or not, after a feature lands, or when CI reports missing keys.
---

# Translation runs

[`i18n/AGENTS.md`](../../../i18n/AGENTS.md) is the brief for translating, and
documents the worklist, the answer file and the rules. This is the recipe for
running the whole thing: **plan → describe → glossary → translate → validate →
apply → PR.** Every step is a command, and every command refuses to go on past
a problem, so the recipe is mostly about what to do when one stops.

Run from the repository root. The work directory, `/tmp/i18n-run` here, lives
outside the repository.

## Which model

Use the strongest model available for every step, and set it explicitly on
each agent rather than inheriting. A bad translation is very hard to recover
from. It passes the checks, ships in a language the reviewer does not read,
and is usually found by a user. Pay for the best output at the point it is
produced.

## 1. Plan

```bash
git fetch origin master
git switch -c translations/$(date -u +%F) origin/master
node i18n/scripts/plan.mjs /tmp/i18n-run
```

For each surface and locale, the plan compares `en.json` with the catalog, and
with `en.json` at the locale's entry in `i18n/baseline.json`. It prints one row
per locale:

- **new**: keys with no translation.
- **changed**: keys whose English changed since the baseline. Some are false
  alarms, where the translation still fits, and the translator says so by
  returning it unchanged.
- **repair**: existing translations with a missing plural form or the wrong
  form of address. Shown as taken/available, at most `--max-repairs`, 25 by
  default, per surface and locale.
- **carried**: renamed keys whose English and description are unchanged. The
  translation moves across with no translator involved.
- **pruned**: keys `en.json` no longer has.

It stops, writing no plan, in two cases:

- **Worklist keys with no description**, listed in
  `/tmp/i18n-run/undescribed.json`. Go to step 2.
- **An unusual gap**: more than 1,000 distinct new keys, or more than 300
  changed or pruned, on one surface. A day of development does not produce
  that; a bad merge, a broken extract or a renamed namespace does. Find out
  which before going further. `--accept-unusual` is for a person who has
  looked, never for an unattended run.

## 2. Descriptions

A translator cannot render `Select` or `No recent session` without knowing
where it appears. Describe every key in `undescribed.json` by spawning agents
over chunks of about 100 keys. Instruct each to find the call site in source, and
to write where the string appears, what each placeholder refers to, and whatever
disambiguates it: noun or verb, title or body, admin or end user. It must not
restate the English. [`i18n/AGENTS.md`](../../../i18n/AGENTS.md#before-translating-the-english)
has the rules.

Have each agent return the descriptions in the shape of `undescribed.json`, and
write them all at once:

```bash
node i18n/scripts/describe.mjs /tmp/i18n-run/descriptions.json
```

It fills only empty descriptions, the one change a run may make to `en.json`,
and writes nothing if any entry is refused. Do not edit `en.json` by hand.

This step reliably finds defects in the English: hardcoded constants, wrong
prepositions, typos. A run never changes the English. Record each defect for
the PR, and leave it for a PR of its own.

Commit the descriptions on their own, then plan again.

## 3. Glossary

Run the [glossary candidate pass](../../../i18n/AGENTS.md#glossary-candidates)
over `/tmp/i18n-run/strings.json`, every new and changed English string, before
any translator starts. Skipping it is the most expensive mistake available
here. One agent per locale translating "exposure report" with no glossary entry
produces one term per locale, each defensible, and nothing notices.

A run adds terms and never edits existing ones. Check the files with
`node i18n/scripts/check_glossary.mjs`, commit the additions on their own, and
list each new term in the PR. Plan again afterwards, so the worklists carry the
new terms. Validation and CI still judge the run by the glossary as of its
base, so a term it adds cannot exempt its own translations from a check.

## 4. Translate: one agent per locale

One agent per locale with a worklist in `/tmp/i18n-run/worklists/`. Do not give
one agent several locales: quality drops when an agent switches between
languages, and a per-locale agent calibrates against its own catalog.

Give each agent:

- the repository root, and an instruction to read `i18n/AGENTS.md` first
- `/tmp/i18n-run/worklists/<locale>.json`, which already carries the English,
  descriptions, glossary terms, plural forms, form of address and nearby
  translations
- the single file it writes, `/tmp/i18n-run/translations/<locale>.json`, and the
  command to check it, `node i18n/scripts/validate.mjs /tmp/i18n-run <locale>`,
  to run until it reports no errors
- an instruction to change no file in the repository

An agent that cannot get a locale to validate leaves no answer file; that
locale waits for the next run. Do not have an agent edit a catalog directly.

## 5. Validate

```bash
node i18n/scripts/validate.mjs /tmp/i18n-run
```

Every error names the key and the rule. Read the `acknowledge` reasons too.
"Product name" for a string that is not one is a translator silencing a check.
Send it back.

## 6. Apply

```bash
node i18n/scripts/apply.mjs /tmp/i18n-run
```

All or nothing, in order:

1. It refuses a plan the catalogs, `en.json` or the baseline have moved away
   from.
2. It validates every answer file, and applies nothing if any has an error.
3. It writes every catalog: answers, carried renames, pruned keys. A rename
   still waiting on a translator keeps its old key, whose translation the next
   plan offers.
4. It runs both CI checkers, and restores every file if either fails.
5. It moves the baseline to the plan's base for each surface and locale with
   nothing left: one with an answer file, or with only repairs. A locale left
   out keeps its baseline, so the next plan finds the same work again.

It writes `/tmp/i18n-run/report.md` for the PR, and `pruned.json` with the
translations pruning removed. Commit the catalogs and `i18n/baseline.json`
together.

## 7. The pull request

Run what CI runs:

```bash
node i18n/scripts/check_pr.mjs
node i18n/scripts/check_glossary.mjs
```

`check_pr.mjs` re-derives the plan from where the branch left master, and fails
the run if it does anything else. That means any change to the English, to a key
outside its worklist, to an existing glossary term, or to a file other than the
catalogs, `en.json` descriptions, the glossary and the baseline. It also fails a
baseline entry moved anywhere but the base, or moved with new keys still
untranslated.

The PR body is `report.md`. It lists, per locale, what was translated, kept,
repaired, carried and pruned, and the locales left for the next run. It also
holds every acknowledgment and note. Add the new glossary terms and the English
defects found in step 2. The reviewer, who reads few of these languages, checks
those lists.

## Running unattended

A daily run with no person in the loop follows everything above, and also:

- **One open translation PR at a time.** If one is open, stop. When it merges,
  the next plan picks up everything since, because each locale's baseline says
  where it stopped.
- **Stop rather than improvise.** An unusual plan, an `apply.mjs` that restores
  the catalogs, or a `check_pr.mjs` failure ends the run with a report, not a
  workaround. Never pass `--accept-unusual`, `--no-verify` or `--base`, and
  never edit `plan.json`, a worklist or `i18n/baseline.json` by hand.
- **Never change the English, `i18n/style.json`, or an existing glossary
  term.** Report a defect in a note instead. CI enforces all three.
- **An acknowledgment is a specific reason**, such as "SAML stays in English
  here, as in admin.saml.title", never a formula.
- **Partial is fine.** Drop a locale that will not validate and ship the rest;
  `report.md` names what was left.
- **Keep the commits apart**: descriptions, glossary terms, translations. Each
  is reviewed differently.
