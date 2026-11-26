# Translating Mattermost strings

This is the brief for an agent translating Mattermost's catalogs, or writing
the descriptions and glossary terms a translation run needs. Read
[`README.md`](./README.md) first: it explains how a run fits together, where
the catalogs live, and what is checked. The
[`translate-i18n` skill](../.claude/skills/translate-i18n/SKILL.md) is the
recipe for running one; this page is what each step's agent needs to do its
part well.

## Working inside a run

- **Write only the file you were given.** A translator writes the answer file
  its slice names, a describer returns descriptions, and a glossary agent adds
  entries to the glossary files it was given. The scripts write everything
  else: never edit a catalog, `en.json`, `baseline.json`, `plan.json`, a
  worklist or a remaining slice by hand. A run that goes wrong is planned
  again, not patched.
- **Check your own work** before handing it back: a translator runs
  `node i18n/scripts/validate_locale.mjs <workdir> <answer file>` until it
  reports no errors. A glossary agent leaves
  `node i18n/scripts/check_glossary.mjs` to the orchestrator: it checks every
  locale, including those other agents are still writing.
- **Leave out what you cannot get right.** An item you do not answer goes to
  another translator; an answer with an error holds up the whole locale.
- **Report, do not repair, the English.** A defect in a source string goes in a
  note for the pull request. A run never changes the English.
- **Stop rather than improvise.** If a command refuses to go on, report what it
  said. Do not work around a check.

## Before translating: the English

A run translates what `en.json` says, into every locale at once, so a defect in
the English is multiplied by the number of locales. Three things come first.

1. **Every key has a description.** CI fails a pull request that adds a key
   to either `en.json` without one, and `find_empty_descriptions.mjs` lists
   the older keys that still have none. Say where the string appears and what
   the variables refer to, not what the English says. Find the actual call
   site rather than paraphrasing; it is the only point in the process where
   somebody reads every new string next to the code that shows it. Two rules
   earn their keep:
   - **If the string quotes a name, say whether that name is localized.** A
     string like `the "Clearance" attribute` is unanswerable from the English
     alone, and every locale will guess differently. Check whether the code
     hardcodes it (`CLEARANCE_FIELD_DISPLAY_NAME` did) and write the answer
     down.
   - **When you resolve an ambiguity, put the answer in the description.** The
     description is read by every locale's translator; a question you answer
     once there is a question nobody re-derives.

   A listed key may carry a `suggested` description: that of a key `en.json`
   dropped with identical English of more than one word, probably the same
   string renamed. Reuse it unless the string has moved somewhere it no longer
   fits. An unchanged description lets the plan carry the translation across
   with no translator.

   Where to write it: on the webapp, in the message descriptor in source, which
   wins, or in `en.json`, which `npm run i18n-extract` keeps. On the server, in
   `en.json`. In a run, `fill_empty_descriptions.mjs` writes them into either
   `en.json`, filling only empty descriptions. `plan_translations.mjs` refuses
   to plan a key that still has none.
2. **The English is right.** Writing descriptions routinely turns up typos,
   wrong prepositions and ambiguous source strings. Fix them before
   translating, in a PR of their own: a translation run never changes the
   English. The webapp's `en.json` is generated, so fix the `defaultMessage` in
   source and run `npm run i18n-extract` from `webapp/channels`. The server's
   is hand-maintained, so edit it and run `make i18n-extract` from `server`.
3. **New product vocabulary is in the glossary.** See
   [Glossary candidates](#glossary-candidates).

## Glossary candidates

Do this **before** translating, not after. It is the difference between one
agreed term and one independently invented per locale.

New features introduce new product vocabulary: "exposure report", "clearance
attribute", "membership policy". If a term is not in [`glossary/`](./glossary/)
when translation starts, each locale coins its own. Every one will be
defensible and no two will match, and nothing can see the inconsistency until a
user reports it.

The pass, over the `strings.json` that `find_new_strings.mjs` writes before
planning, which holds every English string the run will translate:

1. Pull out the noun phrases that name a product concept: a feature, a UI
   surface, an entity, a role, a state. Ignore ordinary English.
2. Drop any term already in `glossary/en.json`, including its `aliases`.
3. Drop any term that already appears in shipped strings and has a settled
   rendering in the catalogs. Search for it before deciding it is new. An
   established term does not need a glossary entry to stay consistent.
4. For each term left, append an entry to `glossary/en.json`, and a `target`
   to every `glossary/<locale>.json` in the same order:

   ```json
   "exposure report": {
     "definition": "The CSV report listing who was exposed to a flagged post.",
     "partOfSpeech": "noun",
     "doNotTranslate": false
   }
   ```

   Set `doNotTranslate: true` for brand names, protocol acronyms, and anything
   the product renders in English regardless of locale, including strings the
   code hardcodes. Its target in every locale is the term itself.

   Any other term's target is chosen per locale, by whoever translates that
   locale, from how its catalog already renders the term or its parts. Write
   a `note` where the choice needs explaining: a rendering the catalog is
   inconsistent about, or a term with no precedent.
5. A term is a product vocabulary decision, not a translation decision. A run
   may add terms, and lists them in its PR for the reviewer to agree; it never
   changes or removes one. A correction to an existing term is a PR of its own.
   A run's translations are checked against the glossary as of its base, so a
   term it adds cannot exempt them from a rule.

`node i18n/scripts/check_glossary.mjs` checks the files. If a term is genuinely
one-off, appearing in a single string that will never recur, skip it. The
glossary is for vocabulary, not for every noun.

## What a translator receives and returns

A translator works on one slice in `remaining/<locale>/`: about 100 items,
from `01.json` onwards. A slice never splits a feature, the keys that share
their first two name segments, unless the feature alone is too big for one, so
the strings of one screen are worded by one translator. Each slice is a
complete worklist, and names in `answers` the file its translator writes.
`plan_translations.mjs` writes `remaining/` with every item no answer covers
yet, and checking a locale with `validate_locale.mjs` rewrites it with what is
still left, or removes it once every item has an answer. `worklists/<locale>/`
holds the locale's whole plan in the same shape, for reference:

```json
{
  "locale": "ru",
  "base": "<commit>",
  "slice": "3 of 12",
  "answers": "translations/ru/r1-03.json",
  "language": {
    "direction": "ltr",
    "script": "Cyrl",
    "pluralForms": {
      "webapp": {"required": ["one", "few", "many", "other"], "optional": []},
      "server": ["few", "many", "one", "other"]
    },
    "address": {"form": "formal", "use": ["вы", "вас", "вам", "ваш"], "avoid": ["ты", "..."]}
  },
  "webapp": {
    "<key>": {"kind": "new", "english": "...", "description": "...", "terms": [...], "siblings": {...}}
  },
  "server": {...}
}
```

A field with nothing in it is left out: `terms` and `siblings` on an item, a
surface with no items, and `address` for a locale `style.json` has no entry for.

Each item has a `kind`:

- **`new`**: nothing to start from.
- **`changed`**: an existing translation to start from, in `current`, and the
  English and description it was written for, in `previous`. Return a new
  translation, or `current` unchanged if it still fits: rewording "post" to
  "message" may need nothing in a language that already said "message". The
  translation is:
  - the key's own, when its English changed since this locale's baseline
  - with `carriedFrom`, a removed key's, when the key was renamed and its
    English or description changed on the way, which can mean the old
    translation had the wrong sense
  - with `sameAs`, another key's that translates the identical English. Its
    description is in `previous`: the same English can mean different things.
- **`repair`**: an existing translation that breaks a rule, listed in
  `problems`: a webapp plural missing a form the locale uses, or the wrong form
  of address. It is your judgement call. A missing plural form is a real bug:
  fix it. A pronoun inside a quotation, or a register the surrounding strings
  share, can be right: return the translation unchanged, and nothing is done.
  An unchanged repair is not checked against the rules. While you are in the
  string, fix any other clear error in it too, such as a wrong word, a dropped
  phrase or English the old translation left, and say what you changed in a
  `catalog` note, so the reviewer sees every change beyond the listed problem.

The hints are drawn from the locale's own catalog. `terms` lists the glossary
entries the English uses, with the term's definition and this locale's target
and note. A term is matched by its words alone, so check the definition: where
the string means something else, such as an operating-system thread rather
than a message thread, use the word the sense needs, and say so in a
`glossary` note. `siblings` gives
translations of the nearest keys under the same prefix. Use them to match what
the product already says.

The answers go in `translations/<locale>/`, one file per slice, named by the
slice, so several translators can work on one locale side by side. Each file
answers some of the worklist:

```json
{
  "webapp": {"<key>": "<ICU message>"},
  "server": {"<id>": "<text>", "<plural id>": {"one": "...", "other": "..."}},
  "acknowledge": {"webapp:<key>": "<why this soft finding is right>"},
  "notes": {"server:<id>": {"kind": "<kind>", "text": "<what the reviewer should know>"}}
}
```

A file answers only worklist items, and no item is answered in two files.
`acknowledge` refers to items the same file answers. Acknowledge only a
finding validation reports: an acknowledgment with nothing to acknowledge is an
error. `notes` can refer to any item in the locale's worklist, answered or not:
use it to report a defect instead of working around it, or to say why you left
an item out. Each note has a `kind`, which the report groups by:

- `english`: a defect in the English, such as a typo, an ambiguity or a count
  with no plural
- `description`: a description that is wrong or misleading, such as one naming
  a variable the string does not have
- `glossary`: a glossary term whose target is wrong for this context, such as
  a message "thread" in a string about operating-system threads
- `catalog`: a wrong translation in this locale's catalog, outside the item or
  fixed in passing while repairing it
- `choice`: a translation decision the reviewer should check

A file belongs in its locale's directory, which is where `validate_locale.mjs`
takes the locale from.

`node i18n/scripts/validate_locale.mjs <workdir> <file>` checks one file alone;
run it until it reports no errors. A relative path is also looked for in the
work directory, so the slice's `answers` path works as it is. Leave out any
item you cannot get right: an unanswered item goes to the next translator,
while an error holds up the whole locale. `node i18n/scripts/validate_locale.mjs
<workdir> <locale>` checks a locale's files together, and rewrites its
`remaining/` slices, so only the orchestrator runs it, once every translator of
that locale has finished.

`finalize.mjs` is all or nothing across locales: an error, or an unanswered
item in any locale with answers, and it applies nothing. To ship the rest, drop
the locale by deleting its `translations/<locale>/`. A locale with no answers
keeps its baseline, so the next run finds its work again, but its catalog is
still brought in line with `en.json`: removed keys are pruned, and unchanged
renames carry their translations.

## The rules

Every translation a run writes, and every translation any PR adds or changes,
is checked by `i18n/scripts/lib/rules.mjs`. The webapp's per-message rules are
`webapp/channels/scripts/icu_rules.mjs`, the code `check_icu.mjs` runs in CI.
The server's mirror `mmgotool i18n verify` string by string.

**Errors** never land:

- the message does not parse, or invents, drops or demotes a variable, tag or
  `{{.Token}}`. On the server, `{{if}}`, `{{else}}` and `{{end}}` must survive
  as the source has them.
- an ASCII apostrophe before `{` or `<` that quotes away the rest of the
  message
- **a plural missing a form.** A webapp plural that shows its count needs every
  form some count 0 to 1000 selects in that locale: `few` and `many` in
  Russian, `few` in Czech. ICU silently falls back to `other`, so "5 каналы"
  renders where "5 каналов" belongs. A form the locale never selects is an
  error too: Chinese never selects `one`, so "exactly one" is `=1`. The
  server's forms are go-i18n's, which differ from the webapp's. Spanish,
  French, Italian and Portuguese have no `many` there, and a server plural
  holds exactly go-i18n's forms for the locale, no more. The worklist's
  `pluralForms` gives both. Where the English plural itself lacks a form, the
  translation is not held to it either.
- a server plural turned into a single string, which stops pluralizing
- an empty value, or one with a U+FFFD replacement character or a control
  character
- the English left as it is, when it has three or more lowercase words to
  translate. A name is capitalized, so that is a sentence nobody translated.

**Soft findings** are usually mistakes but sometimes exactly right. A run's
answer lands only if it gives a reason in `acknowledge`, and the report counts
them per locale. For any other PR, they are CI warnings.

| Rule | Finding |
|---|---|
| `identical-to-english` | The translation is the English, and the English has words to translate: two or more in a Latin-script language, one in any other. With three or more lowercase words, it is an error instead. Not checked for English locales. |
| `english-words` | In a language not written in Latin script, the translation keeps lowercase words from the English. Names, quoted values and identifiers don't count. |
| `do-not-translate` | The English uses a `doNotTranslate` name that the translation leaves out. |
| `address` | The translation uses a pronoun `style.json` lists under `avoid` for its locale: `Sie` in German, `ты` in Russian. |
| `rtl-arrow` | A horizontal arrow in a right-to-left locale. `→` is not mirrored, so an arrow meaning "next" points backwards. Prefer wording that does not depend on the glyph. |

CI also runs both checkers over the whole of every catalog. Their own headers
state their rules: `webapp/channels/scripts/check_icu.mjs`, and `mmgotool i18n
verify` in `tools/mmgotool/commands/i18n.go`. The catalogs as they stand still
break some of the rules above, and those checks hold existing strings only to
what CI has always required; the stricter rules apply to what a pull request
adds or changes. Every run offers two kinds of existing translation for
repair: a webapp plural missing a form, and the wrong form of address. The rest
stay until someone changes those strings.

## Quality

- **Read each item's description before translating it.** It says where the
  string appears and what its variables are, and it is usually the difference
  between a correct translation and a plausible one.
- **Use the glossary**, through the worklist's `terms`. Its `note` fields record
  known mistranslations that earlier passes got wrong; do not reintroduce them.
- **A `doNotTranslate` term stays in English only where it is used as that
  name.** `Channels` is the product when a string names it, but the ordinary
  word when it starts a sentence or titles a list of channels, and the English
  looks the same either way. The glossary marks such names `commonWord`, and no
  rule flags them. Read the description and decide.
- **Never paste English into a non-English catalog.** The soft rules catch the
  obvious cases. A string that genuinely has no translation in a language still
  needs a considered decision, written in `acknowledge`.
- **Address the user as the catalog does.** `style.json` records the
  convention for the locales it lists, 11 of them today, and the worklist's
  `address` repeats it. For the others, and beyond pronouns everywhere, match
  the register of the surrounding strings in that catalog rather than
  translating the English literally.
- Leave placeholders, markup tags and code identifiers untranslated. Theme brand
  names (Denim, Sapphire, Quartz, Indigo, Onyx), protocol and product acronyms
  (`AD/LDAP`, `SAML`, `OAuth`), config keys and field names, and strings that
  are nothing but placeholders (`{source}: {value}`) come back byte-identical to
  English, and that is correct.
- Agglutinative languages, such as Hungarian, Turkish and Korean, attach
  suffixes and particles to an interpolated value whose form you cannot know.
  Rephrase so the value stands alone.
- `en-AU` is localisation, not translation: most strings come back unchanged,
  and a worklist that changes many of them is suspect.
- **Do not re-translate a string that already has a translation** unless it is
  wrong or its English changed. Two independent AI passes over the same 200
  strings agreed only 38% of the time: both valid, just different word choices.
  Re-translating churns the catalogs without improving them, which is why a run
  may change only its worklist.

## Do not

- Hand-edit `webapp/channels/src/i18n/imports.ts`. Run
  `npm run gen-lang-imports` from `webapp/`.
- Add non-locale files to `server/i18n/` or `webapp/channels/src/i18n/`. Both
  directories are scanned wholesale by tooling that assumes every `.json` in
  them is a catalog. Translator context goes in `en.json`'s `description`, and
  guidance goes in the `AGENTS.md` already there.
- Add, rename or remove a key in `en.json` by hand. Change the source and
  re-extract. What you write by hand is each entry's `description`, and on the
  server its English `translation`.
- Seed missing keys as `""`. An empty value fails both checkers, while CI and
  `make i18n-verify-all` only warn about an absent key: react-intl and go-i18n
  fall back to the English. Without `--warn-missing-keys`, the webapp checker
  fails on every absent key.
