# Translations

Mattermost's webapp and server ship in every language with a catalog in
[`webapp/channels/src/i18n/`](../webapp/channels/src/i18n/) and
[`server/i18n/`](../server/i18n/). English is the source, in each directory's
`en.json`. The other catalogs are translated by AI agents, not by hand: once a
month, a translation run brings every catalog up to date with the English and
opens one pull request for a person to review.

This page explains how that works. [`AGENTS.md`](./AGENTS.md) is the brief for
the agents that do the translating, and the
[`translate-i18n` skill](../.claude/skills/translate-i18n/SKILL.md) is the
recipe they follow for a run.

## What a contributor does

- **Change only `en.json`.** A feature or bug fix adds and rewords English
  strings and leaves every other catalog alone; the next automated run
  translates them. On the webapp, `en.json` is generated: change the
  `defaultMessage` in source and run `npm run i18n-extract` from
  `webapp/channels`. On the server, use the id in code and run
  `make i18n-extract` from `server`, which adds it to `en.json` with an empty
  English translation and removes ids the code no longer uses; then write the
  new entry's English and description in `en.json`.
- **Describe every string you add.** Each `en.json` entry has a `description`:
  where the string appears and what its variables refer to. Every translator,
  in every language, reads it, and it is usually the difference between a
  correct translation and a plausible one. CI fails a pull request that adds a
  key without one. On the webapp it can go in the message descriptor in source,
  which wins, or in `en.json`; on the server, in `en.json`.
- **A wrong translation can be fixed by hand** in its catalog, in a pull
  request of its own. CI checks it against the same rules as a run's. If the
  fix is a product term, add it to the [glossary](./glossary/) so later runs
  use it too.
- **Adding or removing a language** is a deliberate change across several
  files: `TestSupportedLocalesAreInSync` fails if the catalogs, the Go
  `supportedLocales` list and the webapp `languages` map disagree.

## How a run works

A run brings one branch's catalogs, `master`'s or a release branch's, up to
date with that branch's English, and produces one pull request. Every run
takes the same steps in the same order, and a step with nothing to do does
nothing. Scripts do everything that can be decided mechanically and checked;
agents do the writing, and the two hand files to each other:

| Step | Script | Writes | Then an agent |
|---|---|---|---|
| 1 | `find_empty_descriptions.mjs` | the keys with no description | writes one for each |
| 2 | `fill_empty_descriptions.mjs` | those descriptions into `en.json`, and nothing else | |
| 3 | `find_new_strings.mjs` | every English string the run will translate | adds new product terms to the glossary, with a target per language |
| 4 | `plan_translations.mjs` | each language's work, cut into slices | one translator per slice writes its answers |
| 5 | `validate_locale.mjs` | whatever no answer covers yet, as new slices | more translators take what remains, until nothing does |
| 6 | `finalize.mjs` | the catalogs and the baseline, all or nothing, and a report | opens the pull request |

The scripts are in [`scripts/`](./scripts/), and each one's header states what
it does. They keep their working files in a directory outside the repository,
so nothing but the result is committed. They check messages with the
webapp's ICU rules, and finalizing also runs the Go checker, so a run needs Go
and `webapp/node_modules` (`npm ci` in `webapp/`). The agents that write
descriptions, glossary terms and translations are defined in
[`.claude/agents/`](../.claude/agents/), which runs them on the most capable
model available, whatever model runs the orchestration.

**Only what changed is translated.** [`baseline.json`](./baseline.json) records,
for each surface and language, the commit whose English that catalog was last
brought fully up to date with. A run compares the English now with the English
then, and the plan lists only what is new or reworded since, plus keys to
remove. A language a run could not finish keeps its baseline, so the next run
finds the same work again.

**Existing translations are reused wherever they still fit.** A reworded
string goes to the translator with its old translation, which it may keep. A
renamed key keeps its translation, untouched if its English and description
are unchanged. A new key whose English another key already translates starts
from that translation. The translator sees each one's context, and decides.

**Old defects are offered for repair.** Some existing translations break a
rule new work is held to: a plural missing a form the language uses, or the
wrong form of address. Every run lists them, and the translator fixes them, or
leaves one as it is when it is right in context. The report counts those left
as no action taken.

**Terms stay consistent.** The [glossary](./glossary/) holds the product's
vocabulary, its translation in each language, and the names that stay in
English. Before anything is translated, a run adds the new terms its strings
introduce, so every language and every translator uses one agreed word.
[`style.json`](./style.json) records how each language addresses the user,
formally or informally.

**The work is split so one translator holds a whole feature.** Each slice is
about 100 strings and never splits a feature's strings, the keys that share
the first two parts of their name, unless the feature alone is too big. A
normal month is one slice per language; a large backlog is a dozen or so.

## How it is kept safe

- **Every translation is checked before it lands.** Errors, such as a broken
  or missing variable, a plural missing a form, an empty value, damaged
  characters, or a sentence left in English, never land. Softer findings that
  are usually mistakes but sometimes right, such as a product name left out or
  the wrong form of address, land only with a written reason, which goes in
  the pull request. [`AGENTS.md`](./AGENTS.md#the-rules) lists them all.
- **CI checks every pull request** that touches the catalogs with
  `scripts/check_changes.mjs`: each translation it adds or changes passes the
  same rules, and each `en.json` key it adds has a description. A pull request
  that moves `baseline.json` is a translation run, and CI works out the plan
  again from where it branched and fails it if it does anything else: changes
  the English, touches a key outside its plan, edits an existing glossary term,
  or changes any file but the catalogs, the empty descriptions, new glossary
  terms and the baseline.
- **Finalizing is all or nothing.** It refuses a plan the repository has moved
  away from, applies nothing if any answer has an error, runs both catalog
  checkers on the result, and restores every file if either fails.

## Reviewing a translation pull request

The reviewer reads few of these languages, so the pull request is built to be
judged without reading every translation. Its description is the run's report:

- per language, how many strings were translated, reworded but kept,
  repaired, left as they were, acknowledged as a soft finding that is right,
  carried over from renamed keys, and removed
- the translators' notes, once per string with the languages that raised it,
  often a defect in the English
- the new glossary terms, for someone to agree, since they bind every later
  run
- any language left for the next run

The changes to `en.json` in a run are only descriptions that were empty. A
translation run never changes the English; a defect it finds is reported, for
a pull request of its own.

A run's pull request cannot take a merge from its target branch, since every
baseline it moves names the commit it planned against. When it needs the
target's changes, it is rebuilt from the target instead; the skill's
"Refreshing a run" says how, and only what the target added is translated
again.

## Where things live

| | Webapp | Server |
|---|---|---|
| Catalogs | `webapp/channels/src/i18n/<locale>.json` | `server/i18n/<locale>.json` |
| Message syntax | ICU MessageFormat (react-intl) | Go `text/template` and plural maps |
| Checker | `npm run i18n-verify-translations -- --warn-missing-keys` | `make i18n-verify` |

| | |
|---|---|
| [`glossary/`](./glossary/) | Product terms, their target in each language, and the names that stay in English |
| [`style.json`](./style.json) | How each language addresses the user, and the pronouns that would mean the other form |
| [`baseline.json`](./baseline.json) | For each surface and language, the commit whose English its catalog was last brought up to date with |
| [`scripts/`](./scripts/) | The translation pipeline, and the checks CI runs |

`make i18n-verify-all`, from `server`, runs every check CI runs on the
catalogs, the glossary and the pipeline. `node i18n/scripts/check_changes.mjs`,
from the repository root, shows what CI will say about a branch's
translations.
