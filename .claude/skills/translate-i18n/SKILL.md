---
name: translate-i18n
description: Bring every locale's webapp and server catalogs up to date with en.json through the checked pipeline in i18n/scripts/, with translator subagents working in parallel. Use for the monthly translation run, attended or unattended, or when a release needs the catalogs caught up.
---

# Translation runs

[`i18n/README.md`](../../../i18n/README.md) explains how a run fits together.
[`i18n/AGENTS.md`](../../../i18n/AGENTS.md) is the brief for each agent in it,
and documents the worklist, the answer files and the rules. This is the recipe
for running the whole thing, written for any agent that can run commands and
start subagents:

**describe → glossary → plan → translate ⟲ validate → finalize → pull request**

Every step is a command or a file handed to a subagent, every run takes every
step, and a step with nothing to do does nothing. Every command refuses to go
on past a problem, so the recipe is mostly about what to do when one stops.

Run from the repository root. The work directory, `$RUN` below, lives outside
the repository; nothing in it is committed.

## Which model

The writing is done on the most capable model available, whatever model
runs the orchestration. A bad translation is very hard to recover from: it
passes the checks, ships in a language the reviewer does not read, and is
usually found by a user. Pay for the best output at the point it is produced.

In Claude Code, start each subagent as the agent defined for its job in
`.claude/agents/`, which sets its model:

| Job | Agent |
|---|---|
| Describing keys (step 1) | `i18n-describer` |
| Proposing glossary terms, choosing a locale's targets (step 2) | `i18n-glossary` |
| Translating a slice (step 4) | `i18n-translator` |

Do not pass a model when you start them; one passed there overrides theirs.
In another agent, set the most capable model on each subagent yourself.

## 0. Start

A run brings one branch's catalogs up to date: `master` unless you are asked
for a release branch. Each branch has its own `i18n/baseline.json`, so runs
for different branches are independent.

```bash
TARGET=master
git fetch origin "$TARGET"
git switch -c "translations/$TARGET/$(date -u +%F)" "origin/$TARGET"
RUN=$(mktemp -d "${TMPDIR:-/tmp}/i18n-run.XXXXXX")
(cd webapp && npm ci)
```

Every script from step 2 on checks messages with the webapp's ICU rules, and
finalizing runs the Go checker too, so a run needs Go and
`webapp/node_modules`.

The branch is named `translations/<target>/<date>`, so a run for `master` and
one for a release branch on the same day never collide, and the next run can
find this one's pull request.

Unattended, first make sure no run for the same target is open
(`gh pr list --base "$TARGET" --search "head:translations/$TARGET/" --state
open`). If one is, stop: when it merges, the next run picks up everything
since, because each locale's baseline records where it stopped.

## 1. Describe

A translator cannot render `Select` or `No recent session` without knowing
where it appears.

```bash
node i18n/scripts/find_empty_descriptions.mjs $RUN
```

It writes `$RUN/undescribed.json`, every key in either `en.json` with no
description, and always writes it. If it is empty, write `{}` to
`$RUN/descriptions.json` and go on. Otherwise give the keys to
`i18n-describer` subagents, about 100 keys each, with this brief:

> Read `i18n/AGENTS.md`, section "Before translating: the English". For each
> key in `<your keys>`, find where the code uses it, and write a description:
> where the string appears, what each placeholder refers to, and whatever
> disambiguates it (noun or verb, title or body, admin or end user, whether a
> quoted name is localized). Do not restate the English. Where a key carries a
> `suggested` description, use it unless the string has moved somewhere it no
> longer fits. Return `{"webapp": {"<key>": "<description>"}, "server":
> {"<id>": "<description>"}}`. Change no file. Report any defect in the English
> you notice (typo, wrong preposition, hardcoded value) separately.

Merge their answers into `$RUN/descriptions.json`, then:

```bash
node i18n/scripts/fill_empty_descriptions.mjs $RUN
```

It fills only empty descriptions, the one change a run may make to `en.json`,
and writes nothing if any entry is refused: fix the refused entries and run it
again. Never edit `en.json` by hand.

A run never changes the English. Record each defect the describers found for
the PR, and leave it for a PR of its own.

Commit the descriptions on their own: `Describe the strings the <month>
translation run translates`.

## 2. Glossary

```bash
node i18n/scripts/find_new_strings.mjs $RUN
```

It writes `$RUN/strings.json`: every English string some locale will translate
in this run, once, with its description. Run the
[glossary candidate pass](../../../i18n/AGENTS.md#glossary-candidates) over it
before planning, so the worklists carry the new terms. Skipping it is the most
expensive mistake available here: one translator per locale meeting "exposure
report" with no glossary entry produces one term per locale, each defensible,
and nothing notices.

The pass has two halves:

1. **Which terms.** Choosing what is product vocabulary is an English
   decision, made once. `$RUN/strings/` holds the strings in slices one agent
   each can hold: one slice in a normal month, a few in a large catch-up. Start
   one `i18n-glossary` subagent per slice to propose the product terms its
   strings introduce, each with a definition and part of speech, following the
   candidate pass in `i18n/AGENTS.md`, and keeping any scratch file in
   `$RUN/scratch/terms-<slice>/`. Merge their proposals yourself: drop
   duplicates and terms already in the glossary, give a plural its singular's
   entry as an alias, and append the rest to `i18n/glossary/en.json`.
2. **Each locale's target.** `i18n-glossary` subagents write every new term to
   each locale's file: one locale per agent when the run adds ten terms or
   more, and three or four locales per agent when it adds fewer, since
   finding its way around the catalogs costs an agent more than a handful of
   terms do. Give each this brief:

   > Read `i18n/AGENTS.md`, section "Glossary candidates". For each term
   > `<new terms>` in `i18n/glossary/en.json`, choose the target in each of
   > `<locales>`, one locale at a time. A `doNotTranslate` term's target is
   > the term itself. For any other, search
   > `webapp/channels/src/i18n/<locale>.json` and `server/i18n/<locale>.json`
   > for how the product already renders the term or its parts, and follow
   > that. Append every new term to `i18n/glossary/<locale>.json` in the order
   > `en.json` lists them, each with its `target`, and a `note` where the
   > choice needs explaining. Keep any scratch file in
   > `$RUN/scratch/glossary-<locale>/`. Change no other file.

   `check_glossary.mjs` requires each locale's file to list the terms in
   `en.json`'s order, so one agent writes all of a locale's terms, in that
   order.

A run adds terms and never edits existing ones. Check the files with
`node i18n/scripts/check_glossary.mjs`, commit the additions on their own
(`Add the glossary terms the <month> translation run introduces`), and list
each new term in the PR. Validation and CI still judge the run by the glossary
as of its base, so a term it adds cannot exempt its own translations from a
check.

## 3. Plan

```bash
node i18n/scripts/plan_translations.mjs $RUN --upstream "origin/$TARGET"
```

Plan once, after the descriptions and glossary terms are committed: the
worklists carry both.

For each surface and locale, the plan compares `en.json` with the catalog, and
with `en.json` at the locale's entry in `i18n/baseline.json`. It prints one row
per locale:

- **new**: keys with nothing to start from.
- **changed**: keys with a translation to start from: their own, when the
  English changed; a renamed key's; or another key's with the identical
  English. Some are false alarms, where the translation still fits, and the
  translator says so by returning it unchanged.
- **repair**: existing translations that break a rule: a webapp plural
  missing a form, or the wrong form of address. The translator fixes each one,
  or returns it unchanged when it is right as it is; the report counts those as
  no action taken. The same ones come back each month until someone fixes
  them, which is expected.
- **carried**: renamed keys whose English and description are unchanged. The
  translation moves across with no translator involved.
- **pruned**: keys `en.json` no longer has.

A large plan is not a problem: a big feature can land hundreds of strings, and
the translate step scales with subagents. Planning stops only when something is
wrong: a worklist key with no description (step 1 was skipped), or a baseline
entry the base does not descend from. Unattended, stop and report either.

## 4. Translate, until nothing remains

The plan has already cut the work: `$RUN/remaining/<locale>/` holds every
item no answer covers yet, in slices, `01.json` onwards, each a complete
worklist of about 100 items that keeps every feature's strings together. On a
first plan that is everything; after planning again, only what changed. A
normal month is one slice per locale; a large catch-up is a dozen or so. Each
slice names, in its `answers` field, the file its translator writes.
`$RUN/worklists/` holds the whole plan, for reference; translators work only
from `remaining/`.

Start `i18n-translator` subagents over the slices in `remaining/`, as many at
once as you can; if you cannot start subagents at all, work through the slices
one by one. Give each translator up to three consecutive slices of one locale,
to work through in turn: what it learns of the locale's catalog in the first
carries to the next, and a large run then sends you a third as many reports.
Never give one translator two locales: quality drops when it switches between
languages, and a translator calibrates against its own locale's catalog. In
Claude Code a session runs at most 20 subagents at once; start the next as each
one finishes. Give each this brief:

> Read `i18n/AGENTS.md` first. Translate `<slice files>`, one after another;
> each carries the English, descriptions, glossary terms, plural forms, form of
> address and nearby translations. Write each slice's answers to the file its
> `answers` field names, under `$RUN`, in the shape `i18n/AGENTS.md` describes,
> and check each with `node i18n/scripts/validate_locale.mjs $RUN <that file>`
> until it reports no errors. Never check the whole locale: other translators
> may be working on it. Leave out any item you cannot get right, rather than
> answer it wrongly. Keep any scratch file in `$RUN/scratch/<locale>-<first
> slice>/`. Change no other file. Put everything a reviewer should know in each
> answer file's `notes`; report in at most three lines: per slice, how many
> items you answered, left out, acknowledged and noted, and any problem with
> the pipeline itself.

Then, for each locale, once every translator working on it has finished:

```bash
node i18n/scripts/validate_locale.mjs $RUN <locale>
```

It checks the locale's files together and rewrites `$RUN/remaining/<locale>/`
with whatever still has no answer, which is why no translator may still be
working on that locale, each slice naming a new answer file, or
removes it once every item has an answer. While it exists, start one
translator per slice in it with the same brief, and validate again. Give a
locale three rounds; if items still remain, drop the locale for this run by
deleting `$RUN/translations/<locale>/`, and name it in the PR. The next run
finds the same work again.

## 5. Validate

```bash
node i18n/scripts/validate_locale.mjs $RUN
```

Every error names the key and the rule. Read the `acknowledge` reasons too.
"Product name" for a string that is not one is a translator silencing a check:
send it back. An acknowledgment is a specific reason, such as "SAML stays in
English here, as in admin.saml.title", never a formula.

## 6. Finalize

```bash
node i18n/scripts/finalize.mjs $RUN
```

All or nothing, in order:

1. It refuses a plan the catalogs, `en.json` or the baseline have moved away
   from. Plan again: that keeps every answer whose item is unchanged.
2. It validates every locale's files together, and applies nothing if any has
   an error or leaves an item unanswered. Drop a locale that will not finish by
   deleting its `$RUN/translations/<locale>/`.
3. It writes every catalog: answers, carried renames, pruned keys. A rename
   still waiting on a translator keeps its old key, whose translation the next
   plan offers.
4. It runs both CI checkers, and restores every file if either fails.
5. It moves the baseline to the plan's base for each surface and locale with
   nothing left. A locale left out keeps its baseline, though its catalog is
   still pruned and its unchanged renames carried.

It writes `$RUN/report.md` for the PR, `$RUN/notes.md` with the translators'
notes by kind, and `$RUN/pruned.json` with the translations pruning removed. Commit the catalogs and `i18n/baseline.json`
together: `Translate the strings added and changed since the last run`.

## 7. The pull request

Run what CI runs:

```bash
node i18n/scripts/check_changes.mjs --upstream "origin/$TARGET"
node i18n/scripts/check_glossary.mjs
```

`check_changes.mjs` works out the plan again from where the branch left
`$TARGET`,
and fails the run if it does anything else: any change to the English, to a key
outside its worklist, to an existing glossary term, or to a file other than the
catalogs, `en.json` descriptions, the glossary and the baseline. It also fails a
baseline entry moved anywhere but the base, or moved with worklist keys still
untranslated.

Open the pull request against `$TARGET`, with `report.md` as its body, adding:

- the new glossary terms, for the reviewer to agree
- the English defects the describers found
- the locales dropped, if any

The report counts, per locale, what was translated, kept, repaired, left as it
was, acknowledged, carried and pruned. It stays short whatever the size of the
run. Post `notes.md` as comments on the pull request, split to fit GitHub's
65,536 characters per comment.

Read the notes before you post them. A translator can be wrong about the
pipeline, such as saying a term has no glossary entry when its worklist
carried one; check such a claim and drop the note if it is false. The
`english`, `description`, `glossary` and `catalog` notes are work for pull
requests of their own: file them where the team tracks follow-ups.

## Refreshing a run

A run's pull request cannot take a merge from its target: every baseline it
moved names the commit it planned against, and once the branch merges the
target, `check_changes.mjs` sees a newer base and fails it. The target moving
on is not a problem in itself; the pull request stays valid until it merges or
conflicts. When the branch does need the target's changes, to resolve a
conflict or because the review needs them, rebuild it instead of merging, with
the same `$RUN` and `$TARGET`:

```bash
OLD=$(git rev-parse HEAD)
git fetch origin "$TARGET"
git log --oneline "origin/$TARGET..$OLD"    # the run's commits
git switch -C <the run's branch> "origin/$TARGET"
git cherry-pick <its description commit> <its glossary commit>
```

Keep the run's descriptions and glossary terms: the answers were written
against them, and planning keeps an answer only while its item, description
included, is unchanged. Leave out the translation commit; finalizing writes it
again. If a cherry-pick conflicts because the target changed the same file,
keep both sides' entries.

Then take every step again. Describe and glossary find only what the target
added. Planning keeps every answer whose worklist item is unchanged, and
`remaining/` holds only the new and changed strings. Finalize, check, and push
with `--force-with-lease`. If `$RUN` is gone, the run starts over.

## Running unattended

A run with no person in the loop follows everything above, and also:

- **Stop rather than improvise.** A plan that stops, an `finalize.mjs` that
  restores the catalogs, or a `check_changes.mjs` failure ends the run with a
  report, not a workaround. Never pass `--no-verify` or `--base`, and never
  edit `plan.json`, a worklist, a remaining file or `i18n/baseline.json` by
  hand.
- **Never change the English, `i18n/style.json`, or an existing glossary
  term.** Report a defect in a note instead. CI enforces all three.
- **Partial is fine.** Drop a locale that will not validate and ship the rest.
- **Keep the commits apart**: descriptions, glossary terms, translations. Each
  is reviewed differently.
